#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { createConnection, ProposedFeatures, TextDocumentSyncKind, } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { analyzeDocument } from "./language-service.js";
import { diagnosticToLsp } from "./positions.js";
import { createWorkspace, invalidateWorkspace, isWorkspaceRefreshPath, WATCH_GLOBS, } from "./workspace.js";
const connection = createConnection(ProposedFeatures.all);
const documents = new Map();
const debounceTimers = new Map();
const DEBOUNCE_MS = 400;
let workspaceRoot;
let watchFilesSupported = false;
let workspaceRefreshTimer;
function uriToFilePath(uri) {
    return fileURLToPath(uri);
}
function resolveWorkspaceRoot(params) {
    if (params.workspaceFolders?.length) {
        return fileURLToPath(params.workspaceFolders[0].uri);
    }
    if (params.rootUri) {
        return fileURLToPath(params.rootUri);
    }
    return undefined;
}
function publishForDocument(doc) {
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
function scheduleValidation(doc) {
    const existing = debounceTimers.get(doc.uri);
    if (existing) {
        clearTimeout(existing);
    }
    debounceTimers.set(doc.uri, setTimeout(() => {
        debounceTimers.delete(doc.uri);
        publishForDocument(doc);
    }, DEBOUNCE_MS));
}
function scheduleWorkspaceRefresh() {
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
function clientSupportsFileWatchers(params) {
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
        },
    };
});
connection.onInitialized(() => {
    connection.console.log("BlockML language server initialized");
    if (!watchFilesSupported) {
        connection.console.log("Client does not support dynamic file watchers; workspace refresh disabled");
        return;
    }
    connection.client.register({ method: "workspace/didChangeWatchedFiles" }, { watchers: WATCH_GLOBS.map((globPattern) => ({ globPattern })) });
});
connection.onDidChangeWatchedFiles((params) => {
    const shouldRefresh = params.changes.some((change) => {
        try {
            return isWorkspaceRefreshPath(uriToFilePath(change.uri));
        }
        catch {
            return false;
        }
    });
    if (shouldRefresh) {
        scheduleWorkspaceRefresh();
    }
});
connection.onDidOpenTextDocument((params) => {
    const doc = TextDocument.create(params.textDocument.uri, params.textDocument.languageId, params.textDocument.version, params.textDocument.text);
    documents.set(params.textDocument.uri, doc);
    publishForDocument(doc);
});
connection.onDidChangeTextDocument((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
        return;
    }
    const updated = TextDocument.update(doc, params.contentChanges, params.textDocument.version);
    documents.set(params.textDocument.uri, updated);
    scheduleValidation(updated);
});
connection.onDidCloseTextDocument((params) => {
    documents.delete(params.textDocument.uri);
    const timer = debounceTimers.get(params.textDocument.uri);
    if (timer) {
        clearTimeout(timer);
        debounceTimers.delete(params.textDocument.uri);
    }
    connection.sendDiagnostics({ uri: params.textDocument.uri, diagnostics: [] });
});
connection.listen();
//# sourceMappingURL=server.js.map