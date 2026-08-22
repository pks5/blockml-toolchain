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

    V1: textDocument sync + publishDiagnostics (parse + Stage-2 validate).
    Semantics: @blockml/parser, @blockml/validator, @blockml/framework.`,
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

    @blockml/parser — Stage 1 BML → BomDocument.
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
    • blockml-lsp stdio binary
    • analyzeDocument public API for tests and non-LSP hosts

    Out of scope V1:
    • Format (serializer), hover, completion, go-to-definition
    • XSD validation, documentSymbol, BomBuilder (V3)
    • VS Code extension in this repo`,
    refs: [
      { type: "lspdocumentation:ScopeExclusions", relation: "ReadNext" },
    ],
  },
  {
    name: "PublicApi",
    is: "Exported API from packages/lsp/src/index.ts",
    doc: `analyzeDocument(text, filePath, workspace): AnalysisResult
    createWorkspace(rootDir): WorkspaceState
    loadBomConfig(rootDir): BomConfig
    invalidateWorkspace(rootDir): void
    bomLocationToRange(loc, documentText?): LSP Range
    bomSeverityToLsp(severity): LSP DiagnosticSeverity
    diagnosticToLsp(diagnostic, documentText?): LSP Diagnostic

    Server entry (not exported from index): packages/lsp/dist/server.js via bin blockml-lsp.`,
    refs: [
      { type: "lspcap:AnalyzeDocument", relation: "Defines" },
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

    Bootstrap errors (BML_LIBRARY_*) published once per workspace on each document until fixed.`,
    refs: [
      { type: "lspcap:StartLanguageServer", relation: "Defines" },
    ],
  },
  {
    name: "PackageOwnership",
    is: "Toolchain responsibilities for LSP",
    doc: `@blockml/lsp — LSP server, language-service, workspace bootstrap. Owns this BML library.

    @blockml/parser / @blockml/validator / @blockml/framework — semantic backend.
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
    • Format-on-save (serializer) — V1.1+
    • Hover, completion, references — V1.1+
    • Duplicate parse/validate logic — must delegate to parser/validator`,
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
    not unsaved-buffer overlay). Paths under node_modules are skipped.`,
    refs: [
      { type: "lspdocumentation:PublicApi", relation: "ReadNext" },
    ],
  },
];
