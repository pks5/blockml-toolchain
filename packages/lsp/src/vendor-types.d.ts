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
  import type { Diagnostic, Position, Range } from "vscode-languageserver";

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
    onDocumentFormatting: (
      handler: (params: DocumentFormattingParams) => TextEdit[] | null,
    ) => void;
    onHover: (handler: (params: HoverParams) => Hover | null) => void;
    onDocumentSymbol: (
      handler: (params: DocumentSymbolParams) => DocumentSymbol[] | null,
    ) => void;
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
      documentFormattingProvider?: boolean;
      hoverProvider?: boolean;
      documentSymbolProvider?: boolean;
    };
  }

  export enum SymbolKind {
    Class = 5,
    Method = 6,
    Property = 7,
    Field = 8,
  }

  export interface DocumentSymbol {
    name: string;
    detail?: string;
    kind: SymbolKind;
    range: Range;
    selectionRange: Range;
    children?: DocumentSymbol[];
  }

  export interface DocumentSymbolParams {
    textDocument: { uri: string };
  }

  export interface MarkupContent {
    kind: "plaintext" | "markdown";
    value: string;
  }

  export interface Hover {
    contents: MarkupContent;
    range?: Range;
  }

  export interface HoverParams {
    textDocument: { uri: string };
    position: Position;
  }

  export interface FormattingOptions {
    tabSize: number;
    insertSpaces: boolean;
  }

  export interface DocumentFormattingParams {
    textDocument: { uri: string };
    options: FormattingOptions;
  }

  export interface TextEdit {
    range: Range;
    newText: string;
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
