/**
 * Documentation block definitions for org.blockml.bml.lsp.documentation.*
 */

/** @typedef {{ name: string, is: string, doc: string, refs?: { type: string, relation: string, context?: string }[] }} DocBlock */

/** @type {DocBlock[]} */
export const documentationBlocks = [
  {
    name: "Introduction",
    is: "Purpose and scope of the LSP package",
    doc: `The @blockml/lsp package provides an editor-agnostic Language Server for BML.
    It is a thin LSP adapter over the existing language loop — not a second parser or AST.

    This library (org.blockml.bml.lsp.*) is the SSOT. TypeScript in packages/lsp/src/
    implements it. IDE-specific clients (VS Code extension with TextMate grammar, etc.)
    live outside this repository and connect via stdio LSP.

    V1: textDocument sync + publishDiagnostics (parse + Stage-2 validate)
    + textDocument/formatting (parse → serialize)
    + textDocument/hover (Urmodell hit-test + TypeRegistry)
    + textDocument/documentSymbol (Urmodell outline tree).
    Semantics: @blockml/parser, @blockml/serializer, @blockml/validator, @blockml/framework.`,
    refs: [
      { type: "lspdocumentation:LayerSeparation", relation: "ReadNext" },
      { type: "valdocumentation:Introduction", relation: "SeeAlso" },
    ],
  },
  {
    name: "LayerSeparation",
    is: "LSP vs language-service vs language stack",
    doc: `Layers:

    org.blockml.bml.lsp.* (@blockml/lsp) — LSP protocol adapter + language-service API.
    No semantic rules here.

    @blockml/parser — Stage 1 BML → BomDocument (including source spans for hover).
    @blockml/serializer — BomDocument → canonical BML XML (format).
    @blockml/validator — Stage 2 validate() orchestration.
    @blockml/framework — TypeRegistry bootstrap for workspace.

    External IDE packages — Language Client only; grammar and file associations stay IDE-local.`,
    refs: [
      { type: "lspdocumentation:ArchitectureOverview", relation: "ReadNext" },
    ],
  },
  {
    name: "ArchitectureOverview",
    is: "Data flow from editor to diagnostics",
    doc: `Editor ↔ LSP (stdio) ↔ @blockml/lsp server.ts
    → analyzeDocument (language-service.ts)
    → parse + validate with workspace TypeRegistry
    → Diagnostic[] mapped to LSP ranges (positions.ts)

    Format: onDocumentFormatting → formatDocument → parse + serialize → TextEdit.

    Hover: onHover → hoverAt → parse (no validator) → smallest covering Urmodell span
    → TypeRegistry Markdown.

    Outline: onDocumentSymbol → documentSymbols → parse (no validator) → hierarchical
    DocumentSymbol tree (Block, members, subBlocks, embeddedBlocks).

    Workspace bootstrap reads bom.config.json (srcDir, libraries) inline — no @blockml/cli dependency.`,
    refs: [
      { type: "lspdocumentation:ServerLifecycle", relation: "ReadNext" },
    ],
  },
  {
    name: "V1Scope",
    is: "Explicit V1 capabilities and exclusions",
    doc: `In scope V1:
    • textDocument/didOpen, didChange, didClose
    • textDocumentSync Full
    • publishDiagnostics (parse + validate)
    • workspace/didChangeWatchedFiles (TypeRegistry refresh)
    • textDocument/formatting (parse → serialize)
    • textDocument/hover (Urmodell hit-test + TypeRegistry)
    • textDocument/documentSymbol (Urmodell outline tree)
    • blockml-lsp stdio binary
    • analyzeDocument, formatDocument, hoverAt, and documentSymbols public API for tests and non-LSP hosts

    Out of scope V1:
    • Completion, go-to-definition
    • Range formatting, tab indent
    • XSD validation, BomBuilder (V3)
    • VS Code extension in this repo`,
    refs: [
      { type: "lspdocumentation:ScopeExclusions", relation: "ReadNext" },
    ],
  },
  {
    name: "PublicApi",
    is: "Exported API from packages/lsp/src/index.ts",
    doc: `    analyzeDocument(text, filePath, workspace): AnalysisResult
    formatDocument(text, options?): string | null
    hoverAt(text, filePath, position, workspace): HoverInfo | null
    documentSymbols(text, filePath): OutlineSymbol[] | null
    createWorkspace(rootDir): WorkspaceState
    loadBomConfig(rootDir): BomConfig
    invalidateWorkspace(rootDir): void
    bomLocationToRange(loc, documentText?): LSP Range
    bomSeverityToLsp(severity): LSP DiagnosticSeverity
    diagnosticToLsp(diagnostic, documentText?): LSP Diagnostic

    Server entry (not exported from index): packages/lsp/dist/server.js via bin blockml-lsp.`,
    refs: [
      { type: "lspcap:AnalyzeDocument", relation: "Defines" },
      { type: "lspcap:FormatDocument", relation: "Defines" },
      { type: "lspcap:HoverAt", relation: "Defines" },
      { type: "lspcap:DocumentSymbols", relation: "Defines" },
      { type: "lspdocumentation:DesignDecisions", relation: "ReadNext" },
    ],
  },
  {
    name: "ServerLifecycle",
    is: "LSP server initialize and document handlers",
    doc: `initialize: resolve workspace root from rootUri or workspaceFolders[0];
    createWorkspace(rootDir).

    onDidOpenTextDocument: store TextDocument, validate immediately.
    onDidChangeTextDocument: debounce 400ms, re-validate.
    onDidCloseTextDocument: clear diagnostics.

    onInitialized: if the client supports dynamic file watchers, register
    **/*.bml, **/bom.config.json, **/package.json.
    onDidChangeWatchedFiles: debounce 400ms, invalidateWorkspace, re-bootstrap,
    re-validate all open documents. node_modules paths are ignored.
    Refresh uses the disk snapshot — unsaved buffers are not overlaid into the registry.

    onDocumentFormatting: formatDocument on the in-memory buffer; one full-document
    TextEdit, empty list if unchanged, or none if parse cannot produce a document.

    onHover: hoverAt on the in-memory buffer; innermost covering Urmodell span;
    Markdown from TypeRegistry. Parse-only — no validator.

    onDocumentSymbol: documentSymbols on the in-memory buffer; hierarchical
    Urmodell tree. Parse-only — no validator. selectionRange equals range.

    Bootstrap errors (BML_LIBRARY_*) published once per workspace on each document until fixed.`,
    refs: [
      { type: "lspcap:StartLanguageServer", relation: "Defines" },
    ],
  },
  {
    name: "PackageOwnership",
    is: "Toolchain responsibilities for LSP",
    doc: `@blockml/lsp — LSP server, language-service, workspace bootstrap. Owns this BML library.

    @blockml/parser / @blockml/serializer / @blockml/validator / @blockml/framework — semantic backend.
    External VS Code (or other) extension — Language Client, TextMate grammar, .bml file association.`,
    refs: [
      { type: "lspdocumentation:ScopeExclusions", relation: "ReadNext" },
    ],
  },
  {
    name: "ScopeExclusions",
    is: "Explicit out-of-scope for @blockml/lsp V1",
    doc: `Out of scope:
    • IDE extension UI, syntax highlighting — external packages
    • BomBuilder structural authoring (V3)
    • Completion, go-to-definition, references
    • Range formatting, tab indent
    • Duplicate parse/validate/serialize logic — must delegate to parser/validator/serializer`,
    refs: [
      { type: "lspdocumentation:Introduction", relation: "SeeAlso" },
    ],
  },
  {
    name: "DesignDecisions",
    is: "Normative LSP V1 design decisions",
    doc: `Editor-agnostic: vscode-languageserver for protocol only; no vscode Extension API in this package.

    Inline bom.config.json loading — avoids @blockml/cli dependency chain.

    Full text sync + debounced validation — simpler than incremental parse for V1.

    continueOnError true on parse and validate — diagnostics survive partial BOM.

    Workspace TypeRegistry cached per rootDir until invalidateWorkspace.
    File watchers trigger a full bootstrap rebuild from disk (not incremental,
    not unsaved-buffer overlay). Paths under node_modules are skipped.

    Format is full-document parse→serialize; spaces only (serializer XmlWriter).
    No edits when parse cannot produce a document. xmlDeclaration inferred from
    a leading XML declaration in the source.

    Hover is parse-only (no validator). Hit-test picks the smallest covering
    Urmodell span; equal area ties break toward the later start (innermost).
    Contents are Markdown (FQN, is, first documentation/summary). Unknown FQN
    is still shown. Referenced types come from the disk TypeRegistry.

    Outline is parse-only (no validator, no TypeRegistry). Hierarchical
    DocumentSymbol tree: Block Class, property Property, aggregation/association
    Field, capability Method; children in members then subBlocks then
    embeddedBlocks order. selectionRange equals the element range.`,
    refs: [
      { type: "lspdocumentation:PublicApi", relation: "ReadNext" },
    ],
  },
];
