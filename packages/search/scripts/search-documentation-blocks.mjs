/**
 * Documentation block definitions for org.blockml.bml.search.documentation.*
 */

/** @typedef {{ name: string, is: string, doc: string, refs?: { type: string, relation: string }[] }} DocBlock */

/** @type {DocBlock[]} */
export const documentationBlocks = [
  {
    name: "Introduction",
    is: "Purpose and scope of the Search package",
    doc: `The @blockml/search package provides local full-text search over the effective BML corpus of a BlockML project. The corpus is the same set of documents bootstrapped by blockml validate --all.

    This library (org.blockml.bml.search.*) is the SSOT. TypeScript in packages/search/src/ implements it. Orama is an internal engine and is not part of the public API.

    Consumers (CLI, LSP, agents, replicator) call BlockML-owned interfaces only.`,
    refs: [
      { type: "searchdocumentation:LayerSeparation", relation: "ReadNext" },
      { type: "fwcap:BootstrapFullProjectRegistry", relation: "SeeAlso" },
    ],
  },
  {
    name: "LayerSeparation",
    is: "Search vs framework vs parser vs CLI",
    doc: `Layers:

    org.blockml.bml.search.* (@blockml/search) — SearchDocument mapping, Orama index, persistence, Search API.
    @blockml/framework — Discovery and TypeRegistry bootstrap (bootstrapFullProjectRegistry).
    @blockml/parser / @blockml/bom — Normalized aliases, keywords, documentation, FQNs.
    @blockml/cli — Human and --json CLI over this package.

    Search does not parse BML with a second XML/regex path. It does not own a separate corpus.`,
    refs: [{ type: "searchdocumentation:ArchitectureOverview", relation: "ReadNext" }],
  },
  {
    name: "ArchitectureOverview",
    is: "Corpus to index to Search API",
    doc: `BML files → bootstrapFullProjectRegistry → TypeRegistry → SearchDocument[] → Orama index → .blockml/search/ cache → Search API.

    Search corpus == validate --all corpus. Index is a derived cache; BML remains source of truth.

    Field boost (Orama): fqn 10, name 8, aliases 6, keywords 6, documentation 1.

    Persistence: .blockml/search/orama.json plus manifest.json (package.json/lockfile hashes, indexed file mtimes). Missing or stale index → full rebuild.`,
    refs: [{ type: "searchdocumentation:V1Scope", relation: "ReadNext" }],
  },
  {
    name: "V1Scope",
    is: "Explicit V1 capabilities",
    doc: `In scope V1:
    • Full-text search over FQN, name, aliases, keywords, documentation
    • Local persisted index under .blockml/search/
    • Auto-build when the index is missing or stale
    • CLI: blockml search QUERY and blockml search index
    • --json output of SearchResult[]

    Out of scope: see ScopeExclusions.`,
    refs: [{ type: "searchdocumentation:ScopeExclusions", relation: "SeeAlso" }],
  },
  {
    name: "PublicApi",
    is: "Exported API from packages/search/src/index.ts",
    doc: `buildIndex(options?) → BuildIndexResult
    search(query, options?) → SearchResult[]
    rebuildIndex(options?) → BuildIndexResult
    loadIndex(options?) → SearchIndex | undefined
    saveIndex(index, options?) → void
    getIndexStatus(options?) → IndexStatus
    openIndex(options?) → BuildIndexResult
    buildMemoryIndex(documents, diagnostics?) → SearchIndex

    Options: rootDir?, srcDir?, libraries?, indexDir?, limit? (search only).
    Orama types are not exported.`,
    refs: [
      { type: "searchcap:BuildIndex", relation: "Defines" },
      { type: "searchcap:Search", relation: "Defines" },
    ],
  },
  {
    name: "PackageOwnership",
    is: "Toolchain responsibilities for Search",
    doc: `@blockml/search — index, persistence, Search API. Owns this BML library.

    @blockml/framework — project discovery and TypeRegistry bootstrap (same corpus as validate --all).
    @blockml/cli — blockml search command host.
    @blockml/bom — SearchDocument fields come from BlockDefinition.`,
    refs: [{ type: "searchdocumentation:ScopeExclusions", relation: "ReadNext" }],
  },
  {
    name: "ScopeExclusions",
    is: "Explicit out-of-scope for @blockml/search V1",
    doc: `Out of scope:
    • Embeddings, vector database, LLM / RAG
    • Claude, Replicator, LSP, MCP, remote/cloud search
    • Incremental indexing
    • Second BML discovery or parser
    • Graph ranking beside Orama field boost
    • postinstall hooks that mutate consumer projects`,
    refs: [{ type: "searchdocumentation:Introduction", relation: "SeeAlso" }],
  },
];
