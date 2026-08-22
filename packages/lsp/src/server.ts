#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import {
  createConnection,
  ProposedFeatures,
  TextDocumentSyncKind,
  type DidChangeTextDocumentParams,
  type DidChangeWatchedFilesParams,
  type DidCloseTextDocumentParams,
  type DidOpenTextDocumentParams,
  type DocumentFormattingParams,
  type DocumentSymbolParams,
  type HoverParams,
  type InitializeParams,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { hoverAt } from "./hover.js";
import { analyzeDocument, formatDocument } from "./language-service.js";
import { documentSymbols } from "./outline.js";
import { diagnosticToLsp } from "./positions.js";
import {
  createWorkspace,
  invalidateWorkspace,
  isWorkspaceRefreshPath,
  WATCH_GLOBS,
} from "./workspace.js";

const connection = createConnection(ProposedFeatures.all);

const documents = new Map<string, TextDocument>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 400;

let workspaceRoot: string | undefined;
let watchFilesSupported = false;
let workspaceRefreshTimer: ReturnType<typeof setTimeout> | undefined;

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

function scheduleWorkspaceRefresh(): void {
  if (!workspaceRoot) {
    return;
  }
  if (workspaceRefreshTimer) {
    clearTimeout(workspaceRefreshTimer);
  }
  workspaceRefreshTimer = setTimeout(() => {
    workspaceRefreshTimer = undefined;
    if (!workspaceRoot) {
      return;
    }
    invalidateWorkspace(workspaceRoot);
    createWorkspace(workspaceRoot);
    for (const doc of documents.values()) {
      publishForDocument(doc);
    }
  }, DEBOUNCE_MS);
}

function clientSupportsFileWatchers(params: InitializeParams): boolean {
  return params.capabilities?.workspace?.didChangeWatchedFiles?.dynamicRegistration === true;
}

connection.onInitialize((params) => {
  workspaceRoot = resolveWorkspaceRoot(params);
  watchFilesSupported = clientSupportsFileWatchers(params);
  if (workspaceRoot) {
    createWorkspace(workspaceRoot);
  }
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      documentFormattingProvider: true,
      hoverProvider: true,
      documentSymbolProvider: true,
    },
  };
});

connection.onInitialized(() => {
  connection.console.log("BlockML language server initialized");
  if (!watchFilesSupported) {
    connection.console.log(
      "Client does not support dynamic file watchers; workspace refresh disabled",
    );
    return;
  }
  connection.client.register(
    { method: "workspace/didChangeWatchedFiles" },
    { watchers: WATCH_GLOBS.map((globPattern) => ({ globPattern })) },
  );
});

connection.onDidChangeWatchedFiles((params: DidChangeWatchedFilesParams) => {
  const shouldRefresh = params.changes.some((change) => {
    try {
      return isWorkspaceRefreshPath(uriToFilePath(change.uri));
    } catch {
      return false;
    }
  });
  if (shouldRefresh) {
    scheduleWorkspaceRefresh();
  }
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

function fullDocumentRange(text: string): { start: { line: number; character: number }; end: { line: number; character: number } } {
  const lines = text.split(/\r?\n/);
  const last = lines[lines.length - 1] ?? "";
  return {
    start: { line: 0, character: 0 },
    end: { line: Math.max(0, lines.length - 1), character: last.length },
  };
}

connection.onDocumentFormatting((params: DocumentFormattingParams) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {
    return null;
  }
  const text = doc.getText();
  const indent = params.options.insertSpaces ? params.options.tabSize : 2;
  const formatted = formatDocument(text, { indent });
  if (formatted === null) {
    return null;
  }
  if (formatted === text) {
    return [];
  }
  return [{ range: fullDocumentRange(text), newText: formatted }];
});

connection.onHover((params: HoverParams) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc || !workspaceRoot) {
    return null;
  }
  const workspace = createWorkspace(workspaceRoot);
  const info = hoverAt(doc.getText(), uriToFilePath(doc.uri), params.position, workspace);
  if (!info) {
    return null;
  }
  return { contents: info.contents, range: info.range };
});

connection.onDocumentSymbol((params: DocumentSymbolParams) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {
    return null;
  }
  return documentSymbols(doc.getText(), uriToFilePath(doc.uri));
});

connection.listen();
