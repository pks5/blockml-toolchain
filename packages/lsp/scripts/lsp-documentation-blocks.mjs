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
    + textDocument/hover (XML-token hit-test + TypeRegistry)
    + textDocument/documentSymbol (Urmodell outline tree)
    + textDocument/definition and textDocument/references (hit-test + TypeRegistry)
    + textDocument/semanticTokens/full (position-based FrameworkRoles highlight).
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
    → parse + validate with workspace TypeRegistry overlaid by the open document
    → Diagnostic[] mapped to LSP ranges (positions.ts)

    Format: onDocumentFormatting → formatDocument → parse + serialize → TextEdit.

    Hover: onHover → hoverAt → parse (no validator) → XML token at cursor
    → language member docs, type QName target, or concrete member Markdown.

    Outline: onDocumentSymbol → documentSymbols → parse (no validator) → hierarchical
    DocumentSymbol tree (Block, members, subBlocks, embeddedBlocks).

    Navigation: onDefinition / onReferences → XML-token hitAt → TypeRegistry
    (definition = LocationLink with whole-QName originSelectionRange; references =
    baseType + member types, optional declaration).

    Semantic tokens: textDocument/semanticTokens/full → semanticTokensFor → XML-stack
    walk classified by FrameworkRoles position (no parse()). Document root or nested
    block re-enters L1 (doc:DocumentFormat). Unused root xmlns prefixes set the
    unnecessary modifier.

    Workspace bootstrap reads blockml.config.json (srcDir, libraries) inline — no @blockml/cli dependency.
    Corpus-first: always scan srcDir. Seed = package.json blockml.library then config.libraries
    (additive). FQN dependencies resolve via discovered BlockML workspace then npm packages
    (source root = srcDir, default blocks). Same type FQN: workspace wins over node_modules.
    Library blocks trees inside srcDir are not scanned twice.`,
    refs: [
      { type: "lspdocumentation:ServerLifecycle", relation: "ReadNext" },
      { type: "doc:DocumentFormat", relation: "SeeAlso" },
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
    • textDocument/hover (XML-token hit-test + TypeRegistry)
    • textDocument/documentSymbol (Urmodell outline tree)
    • textDocument/definition and textDocument/references (hit-test + TypeRegistry)
    • textDocument/semanticTokens/full (position-based FrameworkRoles highlight)
    • blockml-lsp stdio binary
    • analyzeDocument, formatDocument, hoverAt, documentSymbols, definitionAt, referencesAt, and semanticTokensFor public API for tests and non-LSP hosts

    Out of scope V1:
    • Completion
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
    definitionAt(text, filePath, position, workspace): LspLocationLink[] | null
    referencesAt(text, filePath, position, workspace, includeDeclaration?): LspLocation[] | null
    semanticTokensFor(text): SemanticTokensResult
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
      { type: "lspcap:DefinitionAt", relation: "Defines" },
      { type: "lspcap:ReferencesAt", relation: "Defines" },
      { type: "lspcap:SemanticTokensFor", relation: "Defines" },
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
    onDidCloseTextDocument: drop the in-memory buffer; keep last-published
    diagnostics so the client can still mark the closed file.

    onInitialized: if the client supports dynamic file watchers, register
    **/*.bml, **/blockml.config.json, **/package.json.
    onDidChangeWatchedFiles: debounce 400ms, invalidateWorkspace, re-bootstrap,
    re-validate all open documents. node_modules paths are ignored.
    Refresh uses the disk snapshot — unsaved buffers are not overlaid into the registry.

    onDocumentFormatting: formatDocument on the in-memory buffer; one full-document
    TextEdit, empty list if unchanged, or none if parse cannot produce a document.

    onHover: hoverAt on the in-memory buffer; XML token at the cursor;
    language / type-QName / member Markdown. Parse-only — no validator.

    onDocumentSymbol: documentSymbols on the in-memory buffer; hierarchical
    Urmodell tree. Parse-only — no validator. selectionRange equals range.

    onDefinition / onReferences: XML-token hitAt on the in-memory buffer, then
    TypeRegistry from disk. F12 on type QNames — prefix:Local, dotted FQN, or
    unqualified PascalCase in a type slot (implicit namespace). LocationLink covers
    the whole QName. includeDeclaration controls whether the defining block.source
    is included.

    onSemanticTokens: semanticTokensFor on the in-memory buffer; XML-stack walk
    classified by FrameworkRoles position (no parser, no TypeRegistry). Nested
    block re-enters L1. Unused root xmlns prefixes set the unnecessary modifier.
    Legend token types map to *.bml TextMate scopes in the client.

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
    External VS Code (or other) extension — Language Client, TextMate grammar, token colors, .bml file association.`,
    refs: [
      { type: "lspdocumentation:ScopeExclusions", relation: "ReadNext" },
    ],
  },
  {
    name: "ScopeExclusions",
    is: "Explicit out-of-scope for @blockml/lsp V1",
    doc: `Out of scope:
    • IDE extension UI, TextMate grammar, token colors, and file associations — external packages
    • BomBuilder structural authoring (V3)
    • Completion, workspace/symbol
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

    Inline blockml.config.json loading — avoids @blockml/cli dependency chain.

    Workspace bootstrap is corpus-first (srcDir). Seed = package.json blockml.library
    then config.libraries (additive, realpath-deduped). npm/workspace packages with
    blockml.library or blockml.config.json are the search index (source root = srcDir,
    default blocks). A library blocks tree already under srcDir is not registered twice.

    Full text sync + debounced validation — simpler than incremental parse for V1.
    didClose does not send an empty diagnostic list; last-published diagnostics
    stay so the client can mark closed files.

    continueOnError true on parse and validate — diagnostics survive partial BOM.

    Workspace TypeRegistry cached per rootDir until invalidateWorkspace.
    File watchers trigger a full bootstrap rebuild from disk (not incremental).
    Paths under node_modules are skipped. Analysis, hover, definition, and
    references overlay the open document onto a TypeRegistry copy (same FQN).
    The cached workspace registry stays disk-only. Same type FQN: workspace
    sources win over node_modules.

    Format is full-document parse→serialize; spaces only (serializer XmlWriter).
    No edits when parse cannot produce a document. xmlDeclaration inferred from
    a leading XML declaration in the source.

    Hover is parse-only (no validator). Hit-test classifies the XML token at
    the cursor (element name, attribute key/value, text) — not the covering
    Urmodell element. Language tags use org.blockml.bml.definition.* member
    documentation; type QNames use the target TypeRegistry block; concrete
    member tags use that member. Range is the token (whole QName). Unknown FQN
    is still shown. Referenced types come from the TypeRegistry with the open
    document overlaid.

    Outline is parse-only (no validator, no TypeRegistry). Hierarchical
    DocumentSymbol tree: Block Class, property Property, aggregation/association
    Field, capability Method; children in members then subBlocks then
    embeddedBlocks order. selectionRange equals the element range.

    Definition and references share Hover's XML-token hit-test. F12 is only
    offered on type QNames and returns LocationLink with originSelectionRange
    covering the whole prefix:Local, dotted FQN, or unqualified PascalCase in a
    type slot (implicit namespace). Language tags are not definitions. Targets
    and usages come from the TypeRegistry with the open document overlaid.
    includeDeclaration defaults true.

    Semantic tokens are an XML-stack walk (no parse()). Element names are classified
    by nesting relative to the nearest document root or nested block, matching
    org.blockml.bml.vscode.theme.FrameworkRoles — same local name, different color
    by position. Nested block re-enters block-body rules. Unused xmlns:<prefix> on
    the document root (prefix never used as a QName in tags, attributes, or text)
    keep their lexical types and set the unnecessary modifier. Clients map the
    legend types to *.bml TextMate scopes; theming of the unused fade stays in the
    IDE package.`,
    refs: [
      { type: "lspdocumentation:PublicApi", relation: "ReadNext" },
    ],
  },
];
