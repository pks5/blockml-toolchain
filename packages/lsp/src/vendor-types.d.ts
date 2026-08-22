declare module "vscode-languageserver" {
  export type DiagnosticSeverity = 1 | 2 | 3 | 4;

  export interface Position {
    line: number;
    character: number;
  }

  export interface Range {
    start: Position;
    end: Position;
  }

  export interface Diagnostic {
    range: Range;
    severity?: DiagnosticSeverity;
    code?: string | number;
    source?: string;
    message: string;
  }
}

declare module "vscode-languageserver/node.js" {
  import type { Diagnostic } from "vscode-languageserver";

  export enum TextDocumentSyncKind {
    Full = 1,
    Incremental = 2,
  }

  export const ProposedFeatures: {
    all: unknown;
  };

  export interface FileSystemWatcher {
    globPattern: string;
  }

  export interface DidChangeWatchedFilesRegistrationOptions {
    watchers: FileSystemWatcher[];
  }

  export interface FileEvent {
    uri: string;
    type: number;
  }

  export interface DidChangeWatchedFilesParams {
    changes: FileEvent[];
  }

  export interface Connection {
    console: { log: (message: string) => void };
    client: {
      register: (
        type: { method: string },
        registerParams?: DidChangeWatchedFilesRegistrationOptions,
      ) => void;
    };
    onInitialize: (handler: (params: InitializeParams) => InitializeResult) => void;
    onInitialized: (handler: () => void) => void;
    onDidOpenTextDocument: (handler: (params: DidOpenTextDocumentParams) => void) => void;
    onDidChangeTextDocument: (handler: (params: DidChangeTextDocumentParams) => void) => void;
    onDidCloseTextDocument: (handler: (params: DidCloseTextDocumentParams) => void) => void;
    onDidChangeWatchedFiles: (handler: (params: DidChangeWatchedFilesParams) => void) => void;
    sendDiagnostics: (params: { uri: string; diagnostics: Diagnostic[] }) => void;
    listen: () => void;
  }

  export interface InitializeParams {
    rootUri?: string;
    workspaceFolders?: Array<{ uri: string; name: string }>;
    capabilities?: {
      workspace?: {
        didChangeWatchedFiles?: {
          dynamicRegistration?: boolean;
        };
      };
    };
  }

  export interface InitializeResult {
    capabilities: {
      textDocumentSync?: TextDocumentSyncKind;
    };
  }

  export interface TextDocumentIdentifier {
    uri: string;
    languageId: string;
    version: number;
    text: string;
  }

  export interface DidOpenTextDocumentParams {
    textDocument: TextDocumentIdentifier;
  }

  export interface TextDocumentContentChangeEvent {
    text: string;
  }

  export interface VersionedTextDocumentIdentifier {
    uri: string;
    version: number;
  }

  export interface DidChangeTextDocumentParams {
    textDocument: VersionedTextDocumentIdentifier;
    contentChanges: TextDocumentContentChangeEvent[];
  }

  export interface DidCloseTextDocumentParams {
    textDocument: VersionedTextDocumentIdentifier;
  }

  export function createConnection(features?: unknown): Connection;
}

declare module "vscode-languageserver-textdocument" {
  export interface TextDocument {
    uri: string;
    languageId: string;
    version: number;
    getText(): string;
  }

  export const TextDocument: {
    create: (
      uri: string,
      languageId: string,
      version: number,
      text: string,
    ) => TextDocument;
    update: (
      document: TextDocument,
      changes: Array<{ text: string }>,
      version: number,
    ) => TextDocument;
  };
}
