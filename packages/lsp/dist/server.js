#!/usr/bin/env node
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createConnection, ProposedFeatures, TextDocumentSyncKind, } from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { hoverAt } from "./hover.js";
import { analyzeDocument, analyzeProjectWorkspaceFile, formatDocument, listProjectWorkspaceFiles, } from "./language-service.js";
import { definitionAt, referencesAt } from "./navigation.js";
import { documentSymbols } from "./outline.js";
import { SEMANTIC_TOKEN_LEGEND, semanticTokensFor } from "./semantic-tokens.js";
import { diagnosticToLsp } from "./positions.js";
import { createWorkspace, invalidateWorkspace, isWorkspaceRefreshPath, WATCH_GLOBS, } from "./workspace.js";
const connection = createConnection(ProposedFeatures.all);
const documents = new Map();
const debounceTimers = new Map();
const DEBOUNCE_MS = 400;
const WORKSPACE_DIAGNOSTICS_MS = 1500;
const WORKSPACE_YIELD_EVERY = 6;
let workspaceRoot;
let watchFilesSupported = false;
let workspaceRefreshTimer;
let workspaceDiagnosticsTimer;
let workspaceScanGeneration = 0;
let workspaceScanRunning = false;
const publishedWorkspaceUris = new Set();
function uriToFilePath(uri) {
    return fileURLToPath(uri);
}
function filePathToUri(filePath) {
    return pathToFileURL(resolve(filePath)).href;
}
function isOpenFile(filePath) {
    const abs = resolve(filePath);
    for (const doc of documents.values()) {
        try {
            if (resolve(uriToFilePath(doc.uri)) === abs) {
                return true;
            }
        }
        catch {
            continue;
        }
    }
    return false;
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
        scheduleWorkspaceDiagnostics();
    }, DEBOUNCE_MS);
}
function scheduleWorkspaceDiagnostics() {
    if (!workspaceRoot) {
        return;
    }
    if (workspaceDiagnosticsTimer) {
        clearTimeout(workspaceDiagnosticsTimer);
    }
    workspaceDiagnosticsTimer = setTimeout(() => {
        workspaceDiagnosticsTimer = undefined;
        void publishWorkspaceDiagnostics();
    }, WORKSPACE_DIAGNOSTICS_MS);
}
function pauseWorkspaceScanForEdit() {
    const pending = workspaceDiagnosticsTimer !== undefined || workspaceScanRunning;
    if (!pending) {
        return;
    }
    workspaceScanGeneration += 1;
    workspaceScanRunning = false;
    scheduleWorkspaceDiagnostics();
}
async function publishWorkspaceDiagnostics() {
    if (!workspaceRoot) {
        return;
    }
    const generation = ++workspaceScanGeneration;
    workspaceScanRunning = true;
    const workspace = createWorkspace(workspaceRoot);
    const filePaths = listProjectWorkspaceFiles(workspace);
    const nextUris = new Set();
    for (let i = 0; i < filePaths.length; i++) {
        if (generation !== workspaceScanGeneration) {
            return;
        }
        if (i > 0 && i % WORKSPACE_YIELD_EVERY === 0) {
            await new Promise((resolveYield) => {
                setImmediate(resolveYield);
            });
            if (generation !== workspaceScanGeneration) {
                return;
            }
        }
        const filePath = filePaths[i];
        const uri = filePathToUri(filePath);
        nextUris.add(uri);
        if (isOpenFile(filePath)) {
            continue;
        }
        const diagnostics = analyzeProjectWorkspaceFile(workspace, filePath);
        connection.sendDiagnostics({
            uri,
            diagnostics: diagnostics.map((d) => diagnosticToLsp(d)),
        });
    }
    if (generation !== workspaceScanGeneration) {
        return;
    }
    for (const uri of publishedWorkspaceUris) {
        if (!nextUris.has(uri) && !documents.has(uri)) {
            connection.sendDiagnostics({ uri, diagnostics: [] });
        }
    }
    publishedWorkspaceUris.clear();
    for (const uri of nextUris) {
        publishedWorkspaceUris.add(uri);
    }
    workspaceScanRunning = false;
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
            documentFormattingProvider: true,
            hoverProvider: true,
            documentSymbolProvider: true,
            definitionProvider: true,
            referencesProvider: true,
            semanticTokensProvider: {
                legend: SEMANTIC_TOKEN_LEGEND,
                full: true,
                range: false,
            },
        },
    };
});
connection.onInitialized(() => {
    connection.console.log("BlockML language server initialized");
    scheduleWorkspaceDiagnostics();
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
    pauseWorkspaceScanForEdit();
    scheduleValidation(updated);
});
connection.onDidCloseTextDocument((params) => {
    documents.delete(params.textDocument.uri);
    const timer = debounceTimers.get(params.textDocument.uri);
    if (timer) {
        clearTimeout(timer);
        debounceTimers.delete(params.textDocument.uri);
    }
});
function fullDocumentRange(text) {
    const lines = text.split(/\r?\n/);
    const last = lines[lines.length - 1] ?? "";
    return {
        start: { line: 0, character: 0 },
        end: { line: Math.max(0, lines.length - 1), character: last.length },
    };
}
connection.onDocumentFormatting((params) => {
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
connection.onHover((params) => {
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
connection.onDocumentSymbol((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
        return null;
    }
    return documentSymbols(doc.getText(), uriToFilePath(doc.uri));
});
connection.onDefinition((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc || !workspaceRoot) {
        return null;
    }
    const workspace = createWorkspace(workspaceRoot);
    const links = definitionAt(doc.getText(), uriToFilePath(doc.uri), params.position, workspace);
    if (!links) {
        return null;
    }
    return links.map((link) => ({
        originSelectionRange: link.originSelectionRange,
        targetUri: link.target.uri,
        targetRange: link.target.range,
        targetSelectionRange: link.target.range,
    }));
});
connection.languages.semanticTokens.on((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
        return { data: [] };
    }
    return semanticTokensFor(doc.getText());
});
connection.onReferences((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc || !workspaceRoot) {
        return null;
    }
    const workspace = createWorkspace(workspaceRoot);
    return referencesAt(doc.getText(), uriToFilePath(doc.uri), params.position, workspace, params.context.includeDeclaration);
});
connection.listen();
//# sourceMappingURL=server.js.map