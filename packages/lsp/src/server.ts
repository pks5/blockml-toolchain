#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import {
  createConnection,
  ProposedFeatures,
  TextDocumentSyncKind,
  type DidChangeTextDocumentParams,
  type DidCloseTextDocumentParams,
  type DidOpenTextDocumentParams,
  type InitializeParams,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { analyzeDocument } from "./language-service.js";
import { diagnosticToLsp } from "./positions.js";
import { createWorkspace } from "./workspace.js";

const connection = createConnection(ProposedFeatures.all);

const documents = new Map<string, TextDocument>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 400;

let workspaceRoot: string | undefined;

function uriToFilePath(uri: string): string {
  return fileURLToPath(uri);
}

function resolveWorkspaceRoot(params: InitializeParams): string | undefined {
  if (params.workspaceFolders?.length) {
    return fileURLToPath(params.workspaceFolders[0]!.uri);
  }
  if (params.rootUri) {
    return fileURLToPath(params.rootUri);
  }
  return undefined;
}

function publishForDocument(doc: TextDocument): void {
  if (!workspaceRoot) {
    return;
  }
  const filePath = uriToFilePath(doc.uri);
  const workspace = createWorkspace(workspaceRoot);
  const result = analyzeDocument(doc.getText(), filePath, workspace);
  const text = doc.getText();

  const lspDiagnostics = [
    ...workspace.bootstrapDiagnostics
      .filter((d) => d.severity === "error")
      .map((d) => diagnosticToLsp(d, text)),
    ...result.diagnostics.map((d) => diagnosticToLsp(d, text)),
  ];

  connection.sendDiagnostics({ uri: doc.uri, diagnostics: lspDiagnostics });
}

function scheduleValidation(doc: TextDocument): void {
  const existing = debounceTimers.get(doc.uri);
  if (existing) {
    clearTimeout(existing);
  }
  debounceTimers.set(
    doc.uri,
    setTimeout(() => {
      debounceTimers.delete(doc.uri);
      publishForDocument(doc);
    }, DEBOUNCE_MS),
  );
}

connection.onInitialize((params) => {
  workspaceRoot = resolveWorkspaceRoot(params);
  if (workspaceRoot) {
    createWorkspace(workspaceRoot);
  }
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
    },
  };
});

connection.onInitialized(() => {
  connection.console.log("BlockML language server initialized");
});

connection.onDidOpenTextDocument((params: DidOpenTextDocumentParams) => {
  const doc = TextDocument.create(
    params.textDocument.uri,
    params.textDocument.languageId,
    params.textDocument.version,
    params.textDocument.text,
  );
  documents.set(params.textDocument.uri, doc);
  publishForDocument(doc);
});

connection.onDidChangeTextDocument((params: DidChangeTextDocumentParams) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {
    return;
  }
  const updated = TextDocument.update(doc, params.contentChanges, params.textDocument.version);
  documents.set(params.textDocument.uri, updated);
  scheduleValidation(updated);
});

connection.onDidCloseTextDocument((params: DidCloseTextDocumentParams) => {
  documents.delete(params.textDocument.uri);
  const timer = debounceTimers.get(params.textDocument.uri);
  if (timer) {
    clearTimeout(timer);
    debounceTimers.delete(params.textDocument.uri);
  }
  connection.sendDiagnostics({ uri: params.textDocument.uri, diagnostics: [] });
});

connection.listen();
