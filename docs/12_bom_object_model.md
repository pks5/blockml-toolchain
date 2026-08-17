# BOM Object Model

version: 1.3.0

## Purpose of this Document

This document defines the **formal BOM object model** — the canonical TypeScript data structures in `@blockml/core`. They are produced by `@blockml/parser` (or, V3, `BomBuilder.seal()`) and consumed by `@blockml/serializer`, `@blockml/validator`, `@blockml/compiler`, LSP, and render targets.

For conceptual foundations see `01_bom_core.md`.
For BML authoring syntax see `02_mbml.md`.
For MachineBlocks domain extensions see `03_mbom.md`.
For the ManagedObject and synthetic accessor model (Draft · V1 preparation) see `08_managed_object.md`.
For Expression AST node types see `10_expression_language.md` — Expression AST.

This document is the **implementation contract** for `@blockml/core`. It specifies TypeScript-oriented interfaces and validation rules. It does not duplicate domain semantics already defined elsewhere.

**Namespace convention:** Interfaces in this document (`BlockDefinition`, `TypeDescriptor`, `BomDocument`, …) are TypeScript contracts in `@blockml/core` — not BML Block FQNs. BML meta-model Blocks live under `org.blockml.bml.definition.*` (e.g. `org.blockml.bml.definition.BlockDefinition`, `org.blockml.bml.definition.SubBlockDefinition`, `org.blockml.bml.definition.RootBlockDefinition`). Language Blocks like `org.blockml.bml.core.Block` are BML-defined. See `01_bom_core.md` — Mandatory BML namespace.

---

## Abstraction Principle

> **A BOM document is a lossless representation of BML source.** It preserves authored structure and authored values — including directives, aggregation declarations, literal syntax, unresolved type references, namespace bindings, and XML-rendering metadata (`bml:xml`). BOM makes **no statement** about how directives are expanded, how aggregations are interpreted, or how blocks are rendered.

> **Maximum authored surface:** Render Targets (and the serializer) must be able to read **as much of the original document** as the Urmodell can carry — including details that seem parse-internal. Prefer first-class fields over hidden side channels. See `01_bom_core.md` — Maximum authored surface for renderers.

> **BML → BOM → BML must always be possible.** See `01_bom_core.md` — Fundamental Architecture Principles.

> **„Block“ in BML is the mandatory input concept — not a uniform runtime object model.** The parser must read `<block>` documents; validators must walk `baseType` chains. Internal representation after parse is free. See `17_type_system_bml.md` — Semantic Layer vs Compiler Implementation.

```text
BML source          →  universal format (authoring + WOT message / interchange)
Urmodell (BOM)      →  canonical, immutable, lossless parse/build result (SSOT, read-only)
BomBuilder (V3)     →  planned writable session; seal() → Urmodell (same types)
Pragmatic Model     →  Validator default fork + optional renderer forks (partial merges, resolve only)
Framework Utilities →  derived views / merges on forks — never mutate Urmodell
Render Target       →  chooses Urmodell / pragmatic / own forks + optional target working model
```

Examples of what BOM **stores** vs. what downstream **interprets**:

| Authored in BML | Stored in BOM | Interpreted downstream |
|---|---|---|
| `bml:each`, `bml:if`, `bml:with` | `directives[]` on element — **unexpanded** | Renderer (directive expansion) |
| `xmlns` / `xmlns:prefix` | `SourceInfo.namespaceBindings` — **1:1 authored** (order preserved; includes `xmlns:xsi`) | Serializer / FatBlock / QName emit (`19` D2 · B21) |
| `xsi:schemaLocation` / `xsi:noNamespaceSchemaLocation` | `SourceInfo.schemaLocation` / `noNamespaceSchemaLocation` (B25) | Re-emit on root start-tag |
| `<bml:xml>` / `bml:xml="…"` | First-class `xmlRendering` (block + member) — **not** flow-control `directives[]` (`19` D3) | Serializer, FatBlock, XSD, meta-serializer |
| Authored element vs attribute when both legal | `authoredPlacement` on value / `xmlRendering` (D9) | **MUST** roundtrip that form; D1 only when authored form absent |
| Authored Text vs CDATA for `text` placement | `authoredCharacterDataForm` (D8) | Emit CDATA if escape needs it **or** author used CDATA |
| `size="[5,5,6]"` vs `size="{x:5,…}"` | `LiteralValue` in **authored form** | Renderer (target serialization via type metadata) |
| `${ size.x }` | `ExpressionValue { raw }` — **AST via `parseExpression()` utility, not evaluated** | Renderer (parse AST → evaluate / emit) |
| `<aggregations>` declaration | `AggregationDefinition` (declared only) | Type Registry lookup for effective members — **metadata only, no instance data resolution** |
| `<composition>` children | `CompositionNode` tree | Renderer (wrapper logic, assembly patterns) |
| `baseType` FQN | string reference | Type Registry → effective member metadata |
| Preset reference | string `FQN::id` — **unmerged** | Renderer (preset merge) |
| Authored Capabilities | `CapabilityDefinition` in BOM | Renderer (interpretation only — not invoked at parse/validate time) |
| XML comments `<!-- … -->` | `XmlTrivia` on the **following** element (B11) | Serializer re-emits before/after that element |

---

## Design Decisions

| Topic | Decision |
|---|---|
| **Immutability** | Urmodell (`BomDocument`) is **immutable** after parse or `BomBuilder.seal()`. No utility or renderer may write derived data back. Validator and renderers work on pragmatic forks (resolve only). Structural authoring is BomBuilder (V3). See `01_bom_core.md` — Urmodell and Pragmatic Model · BomBuilder. |
| **Builder / LSP reuse** | Core interfaces must stay **construction-friendly** and **provenance-agnostic**. Parser and BomBuilder produce the same `BomDocument` graph. Parse-only metadata (source spans, XML locations) is **optional on types** but **populated by the parser** for diagnostics and the V2 Language Server. Serializer and validator must not require parser provenance. BomBuilder V3 is DOM-like and stays **within** BlockML definitions (no language-structure rewrite — V4). See `01_bom_core.md` — Language Server · BomBuilder · V1 reuse mandates. |
| **Member inheritance** | **Utility lookup only.** BOM stores **declared** members per Block. `resolveEffectiveMembers()` returns `EffectiveMemberSet` — a separate structure, never flattened into BOM. |
| **Capabilities** | Authored Capabilities stored in BOM. No synthetic getter/setter generation. Renderer interprets all Capabilities. See `08_managed_object.md`. |
| **Member identity** | Uniqueness by resolved **`(namespace, name)`**. Namespace from member element QName prefix — resolved to canonical identifier at parse time; alias never stored in BOM. |
| **Composition** | Nested inside `<aggregation>` on definitions only — never standalone. Block instances open aggregations directly (no `<composition>` wrapper). `composition aggregation="…"` removed. |
| **Sub-Blocks** | **Nested** in `BlockDefinition.subBlocks[]` — recursive type hierarchy within one `BomDocument`. FQN derived as `resolve(parent.type) + "." + name`. |
| **Embedded Blocks (Inline Library)** | **Inlined** in `RootBlockDefinition.embeddedBlocks[]` on the **document root only** (forbidden on Sub-Blocks and on embeds). Each entry is `EmbeddedBlockDefinition` — a virtual `.bml` file (FQN = `<type>`). Shadow library/file definitions within the BomDocument; duplicate embed FQNs → error; invisible externally. |
| **Semantic vs runtime** | BML `<block>` is one authoring element for all definition kinds; internal split into separate interfaces/registries is **implementation freedom** — see `17_type_system_bml.md`. |
| **Directives** | Flow-control `bml:*` on composition elements → `directives[]`. Composition meta (`bml:id`, `bml:version`) → `BlockInstance` fields. **`bml:xml` → first-class `xmlRendering`** (not `directives[]`). None expanded at parse time. |
| **Maximum authored surface** | Urmodell exposes as much of the original document as possible to renderers — including seeming internals (`01_bom_core.md`). When in doubt, preserve. |
| **XML comments (B11)** | Bind to the **following** XML element (`leadingComments`); same-line / immediately-after → `trailingComments`. Emit trailing on **next line** + blank line (B22). Not discarded. See § XML Comments · `13` B11/B22. |
| **Emit order (B12)** | Serialize `<block>` children in Definition member declaration order — **V1 hardcoded**, **V2 from Definition `.bml`**. See `13` § Serializer Emit Order. |
| **Whitespace (B13)** | Formatting whitespace is not on the Urmodell; serializer may pretty-print / normalize. See `13` B13. |
| **Dual placement (D9)** | When `element\|attribute` is legal, store and re-emit `authoredPlacement`. See `19` D9. |
| **Visibility prefixes (B14)** | BOM `name` is logical; emit `_`/`__` from `visibility`. See `13` B14. |
| **Boolean values (B15)** | Literal booleans normalize to lowercase. |
| **Boolean.True/False (B16)** | Type refs in type expressions — preserve; not boolean values. |
| **Omit defaults (B17)** | Omit emit when absence ≡ default / unchanged semantics. See `13` B17. |
| **Instance `version`** | From **`bml:version`** — optional on external block references and Library TypeReferenceEntity sugar. Omitted → resolve effective version from TypeRegistry context. Present → exact-version assert against the referenced type (`BML_UNKNOWN_VERSION` if no match). Same-document Sub-Blocks exempt. |
| **Definition `version`** | Every Block definition has an **effective version**: own `<version>` if present, else library version if the block is exported via a Library, else error (`BML_MISSING_VERSION`). |
| **Instance `id`** | From **`bml:id`** — authored in BOM only on `BlockInstance.id`; no auto-ID in `BomDocument`. Auto-IDs assigned **after directive expansion** for static unreferenced children. Referenced instances and `bml:each` elements require explicit `bml:id`. No FQN fallback. |
| **Property values** | **Deep copy only — never linked.** A property value must never point to another instance by reference. Enum tokens (`Standard`, `FQN::id`) are resolution keys — resolved values are materialized as inline copies. Cross-instance `FQN::id` references are valid only on **associations** (e.g. `basePresets`, `Step.part`), not on property values. See § Member Values — Property Value Semantics. |

---

## Package Ownership

```text
@blockml/core
  - All interfaces in this document
  - TypeRegistry + bootstrap API
  - Framework utilities: forkBom(), resolveEffectiveMembers(), validateTypes(), parseExpression(), …
  - Utilities return derived views or merge into pragmatic forks — never mutate Urmodell
  - Prefer small factory helpers for empty/partial nodes (tests, scaffolding, future BomBuilder)
  - BomBuilder / writable authoring session — **V3** (same graph types; seal() → BomDocument)

@blockml/cli
  - TypeRegistry bootstrap: discover + parse + register all project/library sources
  - Calls validateTypes() / validateConstraints() after parse (diagnostics)
  - Invokes renderer pipeline for compile
  - V3: scaffolding / IDE paths may call BomBuilder instead of string templates

@blockml/lsp (V2, planned)
  - Language Server Protocol adapter for VS Code
  - Reuses parser → Urmodell, validator → diagnostics, serializer → format
  - No parallel IDE AST; no BomBuilder required in V2

@blockml/parser
  - BML → BomDocument mapper (parser step [5]) — **single file per invocation**
  - Public API: `parse(source, options?) → ParseResult` (B26 — see `15_dev_setup.md`)
  - Produces immutable Urmodell (Canonical BOM) using `@blockml/core` types; populates source spans for LSP/diagnostics
  - Does NOT own BOM interfaces; does NOT load external BML files, populate TypeRegistry, merge inheritance, or expand directives

@blockml/serializer
  - BomDocument → canonical BML XML (inverse of parser mapping)
  - Public API: `serialize(document, options?) → SerializeResult` (B26)
  - Consumes `@blockml/core` types only — no dependency on `@blockml/parser`

@blockml/compiler
  - Target Registry facade — renderers orchestrate their own pipelines

scad-lib (MachineBlocks BML)
  - Domain BML at scad-lib/blocks/com/machineblocks/bml (com.machineblocks.bml.core.Block, NativeBlock, Set, …)
  - NativeBlock.bml + type/*.bml — MB native parameter / type SSOT
  - 09_mbom_properties.yml — pointer stub only (see NativeBlock)
  - Extends TypeRegistry bootstrap with scad-lib BML paths
```

---

## Public parse / serialize results (B26)

Shared with `@blockml/parser` / `@blockml/serializer`. Full contract: `15_dev_setup.md` — Public API.

```typescript
interface ParseResult {
  document: BomDocument | null
  diagnostics: Diagnostic[]
  success: boolean
}

interface SerializeResult {
  text: string | null
  diagnostics: Diagnostic[]
  success: boolean
}

interface ParseOptions {
  filePath?: string
  continueOnError?: boolean  // default true
}

interface SerializeOptions {
  indent?: number            // default 2
  xmlDeclaration?: boolean   // default false
}

function bomEquals(a: BomDocument, b: BomDocument): boolean
function stripProvenance<T>(node: T): T
```

Sync only. No throw on recoverable diagnostics. `Diagnostic` is the same type used by validator and compiler (`06_compiler.md`).

---

## Root: `BomDocument`

Every parsed or Builder-sealed BML document is exactly one `BomDocument` (Urmodell).

```typescript
interface BomDocument {
  /** V1: always `<block>` root. Legacy `<blockPresets>` removed — presets are MachineBlocks `_presets` blocks. */
  kind: "block"

  /** Parse metadata */
  source: SourceInfo

  /** Root block definition */
  block: BlockDefinition
}

interface SourceInfo {
  /** Absolute or project-relative path */
  filePath: string
  /** "xml" only for authoring. JSON authoring is not planned (see 02_mbml.md). */
  format: "xml"
  /**
   * Authored xmlns prefix → namespace identifier (XML).
   * Lossless 1:1 with source — required for roundtrip and for QName emit (`bml:Self`, …).
   * Includes infrastructure bindings such as xmlns:xsi → XMLSchema-instance (B25).
   * Do not invent prefixes at serialize time; missing binding → BML_NAMESPACE_UNBOUND;
   * FatBlock prefix conflicts → BML_NAMESPACE_PREFIX_COLLISION (see 19 D2).
   * Default xmlns uses prefix key "".
   * Declaration order must be preserved (B21: first prefix wins when several map to one NS).
   * B21 QName-emit mode: any non-default prefix whose URI is **not** the XSD-instance
   *   namespace (http://www.w3.org/2001/XMLSchema-instance); xsi alone does not force QName mode.
   */
  namespaceBindings?: Record<string, string>
  /**
   * Authored xsi:schemaLocation value (opaque string, whitespace preserved as authored).
   * B25 — store and re-emit on the root element; not a member value.
   */
  schemaLocation?: string
  /**
   * Authored xsi:noNamespaceSchemaLocation when present (rare in BML corpus).
   */
  noNamespaceSchemaLocation?: string
}

/**
 * XML comment trivia bound to an element (B11).
 * Bodies only — without `<!--` / `-->`; document order preserved.
 * Leading = immediately before this element's start tag (after previous sibling).
 * Trailing = immediately after this element's end tag (before next sibling), including same-line on parse.
 * Emit (B22): trailing comments on the next line after the end tag, then a blank line.
 */
interface XmlTrivia {
  leadingComments?: string[]
  trailingComments?: string[]
}

/**
 * Structural member containers flattened into members[] — comments on the container
 * element itself (e.g. before `<properties>`) live here, keyed by container local name.
 */
type MemberSectionName =
  | "properties"
  | "aggregations"
  | "associations"
  | "capabilities"

/**
 * Definition metadata child elements that map to fields rather than child BOM nodes
 * (`name`, `type`, `baseType`, `final`, `documentation`, …). Key = element localName.
 */
type MetadataElementTrivia = Record<string, XmlTrivia>
```

---

## XML Comments (B11)

> **Decided:** XML comments are part of the maximum authored surface. The parser **binds** each comment to an element; it does **not** drop comments.

**Binding rules:**

```text
1. One or more Comment nodes immediately before element E
     → E.xmlTrivia.leadingComments[]  (document order)

2. Comment node(s) immediately after E's end tag, before the next sibling
   (including same-line trailing comments)
     → E.xmlTrivia.trailingComments[]

3. File-header comment(s) before the root <block>
     → root BlockDefinition.xmlTrivia.leadingComments

4. Comments before a member-section container (<properties>, …)
     → BlockDefinition.memberSectionTrivia[section].leadingComments
     (containers are flattened into members[]; trivia stays on the definition)

5. Comments before a metadata child that maps to a field (<final>, <name>, …)
     → BlockDefinition.metadataTrivia[localName].leadingComments

6. Comment with no following element in the same parent (EOF / dangling)
     → attach as trailingComments of the previous sibling, else document-level
        trailing on the root BlockDefinition
```

**Not preserved (Phase A):** processing instructions; **formatting whitespace** / indentation / blank lines between elements (B13); attribute order on a start-tag. Gate remains BOM deep-equal (B10). **Do preserve:** XML comments (B11); dual `element|attribute` authored form (D9); authored CDATA form for `text` (D8).

**Serializer:** re-emit `leadingComments` immediately before the element. Re-emit `trailingComments` on the **next line** after the element's end tag, then a **blank line** after that trailing-comment block (**B22** — so trailing is visually distinct from the next sibling's leading comments). Parse still accepts same-line trailing comments into `trailingComments`. Comment body text is opaque — no trimming beyond what the XML parser already applied to the comment node. Sibling **element** order follows B12 (`13` — Serializer Emit Order). Layout whitespace is not part of BOM equality (B10/B13).

See `13_bml_to_bom_mapping.md` — XML Comments · B11 · B22.

---

## `BlockDefinition`

A Block definition is the abstract representation of a `<block>` document (or a Sub-Block within one). Semantically: a **Class** — type shape without instance state.

`TypeReferenceEntity` aggregations (`contracts`, `language`, Library lists) store real Entity instances. FQN membership checks use `resolve(value)`.

```typescript
/** BOM shape for org.blockml.bml.type.TypeReferenceEntity(B[, D]) instances */
interface TypeReferenceEntityInstance {
  typeFqn: "org.blockml.bml.type.TypeReferenceEntity"
  /** Authored / resolved TypeReference (FQN or TypeExpression) */
  value: string
  /** Bound B from the aggregation type application (when recorded) */
  boundB?: string
}

interface BlockDefinition {
  /** Short class name (PascalCase). Required. */
  name: string

  /**
   * Globally unique FQN.
   * Required on root blocks (authored in BML).
   * Derived on Sub-Blocks: parentFqn + "." + name
   */
  type: string

  /** Parent type FQN. Required — no default. */
  baseType: string

  /** Semantic version of this definition. Required. */
  version: string

  /** Required: names the Idea (Urbild). Reflection: bml:Self.is — see 02_mbml.md § Terminology — Urbild */
  is?: string

  /**
   * Short prose expansions (i18n + optional QName facets). Required: default-namespace entry when
   * canonical documentation is too long. See DocumentationProseEntry.
   */
  summaries?: DocumentationProseEntry[]

  /** Optional search/discovery tags — core.Keyword Entity instances (KeywordEntry[]). */
  keywords?: KeywordEntry[]

  /** Natural language for documentation prose — TypeReferenceEntity instance. Omitted: inherit Library, then Block default (English). */
  language?: TypeReferenceEntityInstance

  /** Resolved FQN projection of language.value — retained for addressability and tooling. */
  languageFqn?: string

  /**
   * Technical prose entries (i18n + optional QName facets). Required: ≥1 default-namespace entry
   * on every Block definition. Primary convenience path uses default NS + effective languageFqn.
   */
  documentations?: DocumentationProseEntry[]

  /** What this Block is not — required when confusion risk exists. Reflection: bml:Self.isnot */
  isnot?: string

  /** Alternative names for this Block type — core.Alias Entity instances (AliasEntry[]). Block-level only. */
  aliases?: AliasEntry[]

  /** Semantic version from which this definition is available. Omitted: since initial release. */
  since?: string

  /** Version history entries — oldest first. */
  changelog?: ChangelogEntry[]

  /** Usage examples with character-data body (text or CDATA — same string). */
  examples?: DocumentationExample[]

  /** Cross-references to related Blocks or Definitions. */
  references?: DocumentationReference[]

  /** Abstract type — not usable as composition instance type. Default false. */
  abstract?: boolean

  /** Final type — cannot be used as baseType on definitions. Default false. */
  final?: boolean

  /**
   * Authored block-level `<bml:xml>…</bml:xml>` — XML root-tag recipe for instances of this type.
   * First-class (not directives[]). Legal only on core.Block and Definition-branch types (19 D4);
   * ordinary composable/ValueType must omit (inherit). Illegal authoring may still be stored for
   * roundtrip/diagnostics, then rejected at Stage 2. `raw` is lossless body text.
   * See 19 D3/D4 · 00 Maximum authored surface.
   */
  xmlRendering?: XmlRenderingBlock

  /** BlockML access visibility — Sub-Blocks only. Derived from name when omitted. Forbidden on root Blocks. Does not restrict renderer BOM access. */
  visibility?: "private" | "protected" | "public"

  /** Contract TypeReferenceEntity instances merged into this Block after the baseType chain.
   * Root block only. Order is significant — later contracts override earlier ones;
   * local Block declarations override all contracts. Compare / project via resolve(value).
   * subBlocks, embeddedBlocks, and compositions on contract types are ignored.
   */
  contracts?: TypeReferenceEntityInstance[]

  /**
   * Generic type parameters declared on this Block (e.g. T on Box<T>).
   * Each parameter has a name and a baseType constraint (must satisfy via satisfiesTypeBound).
   */
  genericTypes?: GenericType[]

  /**
   * Definition meta-model type FQN for this block's definition document.
   * Default depends on block role: Sub-Blocks → SubBlockDefinition;
   * document root → RootBlockDefinition; embedded virtual files → EmbeddedBlockDefinition.
   * Selects which fields exist in definition reflection (bml:Self).
   */
  definitionFqn?: string

  /** Constraint Block instances on this Block definition — BlockConstraint branch only. */
  constraints?: BlockInstance[]

  /**
   * Members declared in THIS block only — not inherited.
   * Validator resolves effective members via baseType chain.
   * Array order is significant — see § Member Declaration Order.
   */
  members: MemberDefinition[]

  /**
   * Sub-Block definitions nested under this block (root block or embedded block).
   * Sub-Blocks form a semantic type hierarchy within the same BomDocument and may nest
   * to arbitrary depth. Each Sub-Block is a full BlockDefinition but must not declare
   * embeddedBlocks (BML_EMBEDDED_BLOCKS_ON_SUBBLOCK).
   */
  subBlocks: BlockDefinition[]

  /**
   * Inline Library — virtual .bml files on the document root only (RootBlockDefinition).
   * Each entry is EmbeddedBlockDefinition: own FQN, members, subBlocks — no nested
   * embeddedBlocks (BML_NESTED_EMBEDDED_BLOCKS). FQN = resolve(type). Shadows library/file
   * definitions within this BomDocument; duplicate FQNs → BML_DUPLICATE_EMBEDDED_BLOCK;
   * invisible externally.
   */
  embeddedBlocks: BlockDefinition[]

  /**
   * Composition templates — derived from nested <composition> inside <aggregation> member elements.
   * May contain BlockInstanceNode and VirtualContainerNode children.
   */
  compositions: CompositionTemplate[]

  /**
   * XML comments on this definition element itself (B11).
   * Root file-header comments → leadingComments on the document root BlockDefinition.
   */
  xmlTrivia?: XmlTrivia

  /**
   * Comments bound to flattened member-section containers (<properties>, …).
   * Key = container local name.
   */
  memberSectionTrivia?: Partial<Record<MemberSectionName, XmlTrivia>>

  /**
   * Comments bound to metadata child elements that map to fields (<name>, <final>, …).
   * Key = element localName.
   */
  metadataTrivia?: MetadataElementTrivia

  /** BML source span of this definition (root or sub-block) */
  source: SourceLocation
}
```

```typescript
interface GenericType {
  /** Parameter name (e.g. T) — substituted in type references within this Block */
  name: string
  /** FQN constraint — each concrete type argument must satisfy this bound via satisfiesTypeBound */
  baseType: string
  /**
   * Optional default when a generic application omits this argument.
   * Concrete TypeExpression, or the name of an earlier sibling generic parameter
   * (declaration-order only — see 17_type_system_bml.md — defaultType).
   */
  defaultType?: string
}
```

### Sub-Block FQN Derivation

Sub-Blocks omit `<type>` in BML by convention. The parser derives the FQN recursively from the **immediate enclosing block** (root block, parent Sub-Block, or embedded block):

```text
Root FQN:    com.foo.Vehicle
Sub-Block:   <name>Engine</name>
→ FQN:       com.foo.Vehicle.Engine

Parent FQN:  com.foo.Vehicle.Engine
Sub-Block:   <name>Cylinder</name>
→ FQN:       com.foo.Vehicle.Engine.Cylinder

expectedType = resolve(parent.type) + "." + subBlock.name
canonicalType = subBlock.type ? resolve(subBlock.type) : expectedType
→ must satisfy canonicalType == expectedType (BML_SUBBLOCK_TYPE_MISMATCH)
```

Sub-Blocks are **part of the same `BomDocument`** as the root block. They do not open their own document or library scope. Sub-Blocks may nest to arbitrary depth. Only Sub-Blocks must not declare `embeddedBlocks[]` (`BML_EMBEDDED_BLOCKS_ON_SUBBLOCK`). The document root may declare both `subBlocks[]` and `embeddedBlocks[]`; embedded virtual files may declare `subBlocks[]` only (`BML_NESTED_EMBEDDED_BLOCKS` if they nest embeds).

### Embedded Blocks (Inline Library)

**Gedankenstütze:** `embeddedBlocks` is an **Inline Library** of **virtual `.bml` files** on the **document root only**. Authors can define multiple BML documents inline in one source file, including Blocks from packages that do not belong to the root block's namespace.

Each embedded block is an `EmbeddedBlockDefinition` — full Block document: own FQN, members, `subBlocks[]`. Its **FQN is exactly the value of its `<type>` element** (e.g. `com.foo.internal.Physics`) — not nested under the enclosing block. Nested `embeddedBlocks[]` are forbidden (`BML_NESTED_EMBEDDED_BLOCKS`).

Sub-Blocks declared on an embedded block derive their FQNs from the embedded block's type:

```text
Embedded:  com.foo.internal.Physics
Sub-Block: <name>Force</name>          → com.foo.internal.Physics.Force
Sub-Block: <name>Vector</name> (under Force) → com.foo.internal.Physics.Force.Vector
```

`<type>` is required and must be fully qualified (`BML_MISSING_EMBEDDED_BLOCK_TYPE`, `BML_UNQUALIFIED_EMBEDDED_BLOCK_TYPE`).

Within the enclosing `BomDocument`, each embedded FQN **shadows** the corresponding library or file-based `BlockDefinition`. Duplicate embed FQNs → `BML_DUPLICATE_EMBEDDED_BLOCK`. Externally, embedded blocks and their Sub-Blocks are **invisible**.

Definition paths for an embedded block use its own FQN: `com.foo.internal.Physics.properties.width`, not a path under the root block.

Sub-Blocks must not declare `embeddedBlocks` (`BML_EMBEDDED_BLOCKS_ON_SUBBLOCK`). Composition references to an embedded block from within the same document must use the **fully qualified** Block type.

---

## Type Expressions

Types in BOM are represented by **`TypeExpression`** (alias: `TypeDescriptor` in V1 docs) — a structured, parse-time model. This applies to Capability `inputType` / `outputType` and Property `type` attributes.

**Language vs. BOM:** BML knows four ValueType kinds (Primitive, Enum, Struct, Constant). Unions, collections, and generic applications are **type expressions** — not ValueTypes. The parser maps them to `@blockml/core` `TypeExpression` / `TypeDescriptor` shapes.

### Anonymous struct = shorthand for inline class

An anonymous Object input type is **not** an untyped string. It is shorthand for an anonymous class with private typed fields:

```text
{ a: Float, b: Float }

  ≡  (conceptually)

class /*anonymous*/ {
  private Float a;
  private Float b;
}
```

The BOM stores this as `AnonymousStructType` with **ordered fields**. FunctionMapping uses field order for positional call parameters — see `22_function_mapping.md`.

A single primitive (`Float`, `org.blockml.bml.type.Integer`, …) is **not** wrapped — it is a `NamedTypeReference` directly (equivalent to a single-parameter method, not a one-field class).

### `TypeExpression` union

```typescript
/** Parse-time type expression — @blockml/core (not a language ValueType). */
type TypeExpression =
  | NamedTypeReference
  | AnonymousStructType
  | UnionTypeExpression
  | GenericParameterReference
  | SelfTypeReference

interface Multiplicity {
  min: number
  max: number | "*"
}

interface InstanceConfiguration {
  /** Named configuration — ValueType property name → value */
  named?: Record<string, LiteralValue | ExpressionValue>
  /** Positional configuration — mapped by ValueType property declaration order */
  positional?: (LiteralValue | ExpressionValue)[]
}

interface NamedTypeReference {
  kind: "named"
  fqn: string
  typeArguments?: TypeExpression[]
  /** Configures the Property's owned ValueType instance — see 20_value_type_instance_configuration.md */
  instanceConfiguration?: InstanceConfiguration
  multiplicity?: Multiplicity
}

interface UnionTypeExpression {
  kind: "union"
  alternatives: TypeExpression[]
}

interface GenericParameterReference {
  kind: "genericParam"
  name: string   // e.g. "T"
}

interface SelfTypeReference {
  kind: "self"   // bml:Self — resolved after inheritance
}

interface AnonymousStructType {
  kind: "anonymousStruct"
  fields: StructField[]
}

interface StructField {
  name: string
  type: TypeExpression
}
```

V1 may keep the alias `TypeDescriptor = TypeExpression`. Internal-only shapes the compiler may use when normalizing (not BML Block classes): `CollectionTypeDescriptor`, `GenericApplicationDescriptor`, etc.

### BML surface syntax → `TypeExpression`

Parsed from `inputType` / `outputType` / `type` attribute strings at map time:

```text
Float                              → NamedTypeReference { fqn: "org.blockml.bml.type.Float" }
org.blockml.bml.type.Float             → NamedTypeReference { fqn: "org.blockml.bml.type.Float" }
type:SizeXYZ                        → NamedTypeReference { fqn: "com.machineblocks.bml.type.SizeXYZ" }
Integer[0..n]                      → NamedTypeReference { fqn: Integer, multiplicity: { min: 0, max: "*" } }
Integer[]                          → same as Integer[0..n]
Integer[3]                         → NamedTypeReference { fqn: Integer, multiplicity: { min: 3, max: 3 } }
com.foo.Box<Integer>               → NamedTypeReference { fqn: "com.foo.Box", typeArguments: [Integer] }
Text{maxLength: 100}                → NamedTypeReference { fqn: Text, instanceConfiguration: { named: { maxLength: 100 } } }
Decimal{precision: 10, scale: 2}     → NamedTypeReference { fqn: Decimal, instanceConfiguration: { named: { precision: 10, scale: 2 } } }
Decimal{10, 2}                     → NamedTypeReference { fqn: Decimal, instanceConfiguration: { positional: [10, 2] } }
Text{maxLength: 50}[0..n]           → NamedTypeReference { fqn: Text, instanceConfiguration: { … }, multiplicity: { min: 0, max: "*" } }
Constant(Text){value: "auto"}       → NamedTypeReference { fqn: Constant, typeArguments: [Text], instanceConfiguration: { named: { value: "auto" } } }
Boolean | Constant(Text){value: "auto"} → UnionTypeExpression { alternatives: [Boolean, Constant(…)] }
"auto" | Float                     → UnionTypeExpression { alternatives: [literal "auto", Float] } — legacy; normalize to Constant form
false | SizeXYZ                     → UnionTypeExpression { alternatives: [literal false, SizeXYZ] }
Boolean | Integer                  → UnionTypeExpression { alternatives: [Boolean, Integer] }
T                                  → GenericParameterReference { name: "T" }
bml:Self                           → SelfTypeReference
{ a: Float, b: Float }             → AnonymousStructType { fields: [a, b] }
{ list: String[0..n], index: Integer }  → nested expressions with multiplicity on fields
```

Unqualified primitive names resolve to `org.blockml.bml.type.*`. Domain types require the `type:` prefix or full FQN. Parse failure → `BML_UNKNOWN_TYPE`.

Capability use `AnonymousStructType` for multi-parameter signatures. Variadic built-ins use a named collection field (`{ values: String[0..n] }`). See `17_type_system_bml.md` — Type Expressions.

---

## Member Definitions

Properties, Aggregations, Associations, and Capabilities share one namespace per Block. All are stored as a discriminated union:

```typescript
type MemberDefinition =
  | PropertyDefinition
  | AggregationDefinition
  | AssociationDefinition
  | CapabilityDefinition

interface KeywordEntry {
  /** Keyword Entity type FQN — org.blockml.bml.meta.FreeTextKeyword, FixedKeyword descendant, or domain Keyword branch block */
  typeFqn: string
  /** Search tag text — present when typeFqn is org.blockml.bml.meta.FreeTextKeyword; resolved from FixedKeyword descendant definition when applicable */
  term?: string
  /** NaturalLanguage FQN when tag deviates from effective block language. Omitted: inherit. */
  languageFqn?: string
  /** Optional RAG ranking hint — FreeTextKeyword or resolved FixedKeyword weight. Omitted: default weight. */
  weight?: number
  source?: SourceLocation
}

/**
 * One <documentation> or <summary> prose entry on a StructuralDefinition.
 * Identity: (namespace, kind, languageFqn) where kind is implied by which array holds the entry
 * (documentations[] vs summaries[]). Namespace is never used for i18n — locales use languageFqn.
 */
interface DocumentationProseEntry {
  /**
   * Resolved namespace from the element QName (xmlns:). Empty string: canonical / default facet.
   * Never stores the XML prefix alias. Facet namespaces (e.g. com.machineblocks.bml.scad) are
   * optional domain/target slots — not NaturalLanguage.
   */
  namespace: string
  /** Trimmed prose body */
  text: string
  /**
   * Resolved NaturalLanguage FQN — always set after parse (explicit language: or effective
   * Block/Library language when the attribute is omitted).
   */
  languageFqn: string
  /** How the prose body appeared when placement is text (19 D8). */
  authoredCharacterDataForm?: CharacterDataForm
  source?: SourceLocation
}

interface AliasEntry {
  /** Alias Entity type FQN — org.blockml.bml.meta.FreeTextAlias, FixedAlias descendant, or domain Alias branch block */
  typeFqn: string
  /** Alternative name — present when typeFqn is org.blockml.bml.meta.FreeTextAlias; resolved from FixedAlias descendant definition when applicable */
  name?: string
  /** NaturalLanguage FQN when alias deviates from effective block language. Omitted: inherit. */
  languageFqn?: string
  /** Legacy or deprecated alternative name — FreeTextAlias or resolved FixedAlias. Default false. */
  legacy?: boolean
  source?: SourceLocation
}

interface ChangelogEntry {
  /** Semantic version this change applies to */
  version: string
  /** Change description (trimmed text body of <change>) */
  text: string
  /** NaturalLanguage FQN when change text deviates from effective block language. Omitted: inherit. */
  languageFqn?: string
  source?: SourceLocation
}

interface DocumentationExample {
  /** Required title attribute on <example> / *:example — always in enclosing block's natural language */
  title: string
  /** Character data body — BML/MBML, target-language source, or prose (text or CDATA in XML). */
  content: string
  /** How `content` appeared in source — text node vs CDATA (19 D8). */
  authoredCharacterDataForm?: CharacterDataForm
  /** Language FQN for body content (implementation Language or NaturalLanguage). Omitted when content is BML/MBML. */
  contentLanguageFqn?: string
  /** When true, body is an illustrative fragment — skip syntax / well-formedness checks. Default false. */
  snippet?: boolean
  /**
   * Resolved Annotation FQN when the entry is an Annotation Example sibling (e.g. scad:example)
   * or when inside a faceted examples container (e.g. scad:examples); "" / omitted: canonical <example>
   */
  namespace?: string
  source?: SourceLocation
}

interface DocumentationReference {
  /** Documentation cross-link only (types↔types or types↔instances; also members/files/URLs) — not an Association. Block type reference (TypeReference) — XML type attribute on <see>. Standalone type: only; when paired with a member or instance attribute, type: qualifies the target and is not stored here. Eight target kinds — see 02_mbml.md — Associations vs References · references. */
  type?: string
  /** Block instance pointer (InstanceReference) — XML instance attribute on <see>. Local id, FQN::id, or resolved from type: + instance: . */
  instance?: string
  /** Repository markdown file — XML file attribute on <see> */
  file?: string
  /** External URL — XML url attribute on <see> */
  url?: string
  /** PropertyReference value — XML property attribute on <see> (canonical path, e.g. com.foo.Bar.properties.width) */
  property?: string
  /** AggregationReference value — XML aggregation attribute on <see> */
  aggregation?: string
  /** AssociationReference value — XML association attribute on <see> */
  association?: string
  /** CapabilityReference value — XML capability attribute on <see> */
  capability?: string
  /** Relation FQN (org.blockml.bml.relation.*) — XML relation attribute on <see>. Omitted: org.blockml.bml.relation.SeeAlso. */
  relationFqn?: string
  /** Required text body — why or how the referenced element relates */
  context: string
  /** NaturalLanguage FQN when relationship text deviates from effective block language. Omitted: inherit. */
  languageFqn?: string
  source?: SourceLocation
}

interface ConstrainableDefinition {
  /** Constraint Block instances — document order preserved. Target binding resolved at validate time only. */
  constraints?: BlockInstance[]
}

interface MemberDefinitionBase {
  /**
   * Logical member name — visibility prefixes `_` / `__` stripped (B14).
   * XML localName on emit = visibilityPrefix(visibility) + name.
   */
  name: string
  /** Short prose expansions (i18n + optional QName facets). See DocumentationProseEntry. */
  summaries?: DocumentationProseEntry[]
  /** Optional search/discovery tags — core.Keyword Entity instances (KeywordEntry[]). */
  keywords?: KeywordEntry[]
  /** Technical prose entries (i18n + optional QName facets). See DocumentationProseEntry. */
  documentations?: DocumentationProseEntry[]
  since?: string
  changelog?: ChangelogEntry[]
  examples?: DocumentationExample[]
  references?: DocumentationReference[]
  /**
   * Resolved canonical namespace identifier (FQN or URI).
   * Parsed from the member element QName prefix via document xmlns: table.
   * Unprefixed member elements → default namespace (empty string).
   * Never stores the XML alias.
   */
  namespace?: string
  /** BlockML access visibility. Derived from naming convention; explicit attribute must match. Does not restrict renderer BOM access. */
  visibility?: "private" | "protected" | "public"
  /** When true, Block instances must not set this member. Definition and child override allowed. */
  readOnly?: boolean
  /**
   * Local declaration property — not inherited. When true on this declaration, the member is
   * semantically incomplete and creates an implementation obligation for concrete descendants.
   * Effective abstractness is derived from unsatisfied obligations, not from property inheritance.
   */
  abstract?: boolean
  /** Local declaration property — not inherited. When true on this declaration, child blocks cannot override this member. Validator checks all declaring layers. */
  final?: boolean
  /** Local declaration property — not inherited. When true, this declaration overrides a same-named parent member. Must be set on every redeclaration layer. */
  override?: boolean
  /**
   * Authored member-level `bml:xml="…"`. First-class (not directives[]).
   * Omitted → D1 kind defaults at canonical emit. Dual forms store allowed kinds + authoredPlacement.
   * See 19 D1/D3 · 00 Maximum authored surface.
   */
  xmlRendering?: XmlRenderingMember
  /** Constraint Block instances — document order preserved. Target binding resolved at validate time. */
  constraints?: BlockInstance[]
  /** XML comments bound to this member element (B11). */
  xmlTrivia?: XmlTrivia
  source?: SourceLocation
}

/** Block-level `<bml:xml>` body — lossless. */
interface XmlRenderingBlock {
  /**
   * Literal local name or fixed recipe source.
   * Allowed recipes only: literal | "${ bml:Self }" | "${ #this.name }"
   * (Expression-looking syntax; constant recipes — not open Expression Language). See 19 D6.
   */
  raw: string
}

type XmlNodeKind = "attribute" | "element" | "text"

/**
 * How host-element character data appeared in source when placement is `text` (19 D8).
 * Not a bml:xml placement kind — escape / authored form only.
 */
type CharacterDataForm = "text" | "cdata"

/** Member-level `bml:xml` — lossless + emit hints. */
interface XmlRenderingMember {
  /**
   * Declared placement kind(s). Single value or dual allow-list (`element|attribute` only).
   * `text` = character data of the host element (no nested child element for this value).
   * CDATA is not a placement kind — see CharacterDataForm / 19 D8.
   */
  kinds: XmlNodeKind[]
  /**
   * When kinds include both element and attribute: which form appeared on **this** declaration
   * in source (D9). Roundtrip MUST re-emit that form. Fresh/canonical emit without this field
   * uses D1 defaults.
   */
  authoredPlacement?: XmlNodeKind
  /**
   * When placement includes `text`: whether the body was a Text node or CDATA in source.
   * Emit: CDATA if escape requires it OR this is `"cdata"` (19 D8).
   */
  authoredCharacterDataForm?: CharacterDataForm
}

interface PropertyDefinition extends MemberDefinitionBase {
  kind: "property"
  typeFqn: string
  /**
   * Value-field entries — multiplicity along Annotation namespace ("" = canonical).
   * Nested <scad:value> under this property → facet entry; not a member QName.
   * Duplicate namespace → BML_DUPLICATE_PROPERTY_VALUE.
   */
  values?: PropertyValueEntry[]
  /** Convenience — default-namespace entry from values[] (absent: Optional.empty, not null) */
  value?: MemberValue
  group?: string
  /** Block instances of the same type as typeFqn — metadata only (Property-only) */
  suggestions?: BlockInstance[]
}

/** One PropertyDefinition value-field entry (canonical or Annotation facet) */
interface PropertyValueEntry {
  /** "" = canonical <value>; else resolved Annotation FQN (e.g. ScadAnnotation) */
  namespace: string
  value: MemberValue
}

interface AggregationDefinition extends MemberDefinitionBase {
  kind: "aggregation"
  /** Full TypeExpression — plain Block[] for domain instances, TypeReferenceEntity(T)[] for type refs */
  type: TypeExpression
  cardinality: "0..1" | "0..n" | "1..1" | "1..n"
  default?: boolean
  /** Nested composition filling this aggregation — instance aggregations only */
  composition?: CompositionTemplate
}

interface AssociationDefinition extends MemberDefinitionBase {
  kind: "association"
  /** Instance-to-instance model link — TypeExpression must be InstanceReference(T) or InstanceReference(T)[] with T extending Block. Not a documentation Reference. */
  type: TypeExpression
  cardinality: "0..1" | "0..n"
}

interface CapabilityDefinition extends MemberDefinitionBase {
  kind: "capability"
  typeFqn: string           // org.blockml.bml.capability.Inbound | Outbound | Transformation
  inputType?: TypeDescriptor
  outputType?: TypeDescriptor
  implementation?: ImplementationBlock
}

interface ImplementationBlock {
  languageFqn: string      // org.blockml.bml.language.TypeScript | org.blockml.bml.language.OpenSCAD
  source: string            // host-element character data — full original text including <$ $> regions
  /** How `source` appeared in XML — text node vs CDATA (19 D8). */
  authoredCharacterDataForm?: CharacterDataForm
  embeddedExpressions: EmbeddedExpression[]
  sourceLocation?: SourceLocation
}

interface EmbeddedExpression {
  raw: string               // expression text between delimiters (for later parseExpression)
  start: number             // byte/char offset of opening <$ in source
  end: number               // offset immediately after closing $>
  // NO ast field — AST is parseExpression() utility output, never Canonical BOM
}
```

### Member Declaration Order

The parser **must preserve** the declaration order of members from BML. **No sorting** (e.g. alphabetically by name) at parse, map, or validate time.

```text
Mapping sequence (append to members[] in this order):
  1. <properties>     — child member elements in XML document order (element localName = name)
  2. <aggregations>   — child member elements in XML document order
  3. <associations>   — child member elements in XML document order
  4. <capabilities>   — child member elements in XML document order
```

The position of each entry in `BlockDefinition.members[]` is the **declaration ordinal** for that block. Render targets may use this order (e.g. Customizer parameter sequence, UI field layout). The compiler must not reorder declared members when writing BOM or when passing definitions to processors.

**StructType array literals and SCAD arrays:** for a StructType defined via `<properties>` (e.g. `SizeXYZ` with `x`, `y`, `z`), property **declaration order** defines positional array literal mapping **and** the default SCAD array serialization order (unless the type/property defines an exception). Member access in expressions uses property names only. See `17_type_system_bml.md` — Declaration Order · `04_types.md` — MBOM→SCAD Serialization Rules · `22_function_mapping.md`.

```text
size="[4, 2, 3]"   →  index 0 = x, index 1 = y, index 2 = z  (order in SizeXYZ.bml)
size="${ [size.x, size.y, size.z - 1] }"
SCAD render: [4, 2, 3]  ← same declaration order by default
```

Named object syntax (`{ x: 4, y: 2, z: 3 }`) and attribute syntax (`x="4" y="2" z="3"` on a StructType instance) are equivalent; array literals and default SCAD arrays use **declaration order**, not alphabetical name order.

**Function argument mapping:** handled by FunctionMapping — see `22_function_mapping.md` · `10_expression_language.md` — Capability Input Types and Function Parameters.

**Effective members:** `resolveEffectiveMembers()` merges by `(namespace, normalizedLogicalName)` in this order (visibility prefixes `_` / `__` stripped from element localName before match):

```text
1. baseType chain   — walk from root Block to direct baseType
2. contracts[]      — in declaration order (later overrides earlier)
3. Block local      — declared members on this Block (override all)
```

Child and contract override declarations merge with accumulated members — only specified attributes replace inherited or merged values. Private members cannot be overridden; visibility may **widen** on override (`_name` → `name`); narrowing → `BML_VISIBILITY_NARROWING`. `final="true"` on any declaring layer prevents redeclaration. `readOnly="true"` prevents instance authoring only — child Block definitions may still override the value/composition.

`abstract`, `final`, and `override` are local declaration properties stored on each declaration layer — not merged or inherited. Semantic effects propagate: an `abstract="true"` declaration creates an implementation obligation until a descendant provides a locally complete concrete override (`abstract` defaults to false). To keep a member abstract in a child block, explicitly declare `abstract="true"` on that redeclaration. Each redeclaration must set `override="true"` again when merging with a baseType or contract member — including contract completion. Omission → `BML_OVERRIDE_REQUIRED`.

An override that is locally concrete and complete for the member kind satisfies an abstract implementation obligation. An override that keeps the member abstract declares `abstract="true"` explicitly and may omit required fields locally — obligation passes to descendants.

```text
Parser / mapper     MUST NOT reorder declared members
Validator           MUST NOT reorder members[] or struct fields for display
SCAD renderer       MUST emit StructType arrays in declaration order by default
                    (exceptions only when type/property/Annotation defines otherwise)
Render target       MAY use declaration order for other output sequencing (UI, Customizer, …)
```

### Effective Members (not stored in BOM)

Inherited and native members are resolved by **`resolveEffectiveMembers()` utility** — output is `EffectiveMemberSet`, **not part of `BomDocument`**:

```typescript
/** @blockml/core — not part of BomDocument */
function resolveEffectiveMembers(
  block: BlockDefinition,
  registry: TypeRegistry
): EffectiveMemberSet

interface EffectiveMemberSet {
  /** Flattened, de-duplicated member list after baseType chain + contract merge + local declarations */
  members: MemberDefinition[]
  /** Map member name → declaring source FQN (baseType Block, contract Block, or this Block — for diagnostics) */
  declaredOn: Record<string, string>
}
```

Native MBOM properties from `NativeBlock.bml` are attached to the MachineBlocks domain Block chain in the Type Registry — not repeated in every derived Block's `members[]`.

### Capabilities in the BOM

Authored Capabilities (`Inbound`, `Outbound`, `Transformation`) are stored in Canonical BOM as declared. There are **no special** constructor, getter, or setter types — all behaviour is expressed as ordinary Capabilities. The Renderer decides how to interpret each Capability for the target system. See `08_managed_object.md` · `01_bom_core.md` — Semantics remain in BML.

V1: Canonical BOM (`BlockDefinition.members[]`) contains **only authored** members. Renderers read BOM Property values and Capability definitions directly.

### Contract Merge (not stored in BOM)

Contract contributions are **merged into** the effective member set — not validated as a separate superset check:

```typescript
/** @blockml/core — not part of BomDocument; used internally by resolveEffectiveMembers() */
function resolveContractMembers(
  contractFqn: string,
  registry: TypeRegistry
): EffectiveMemberSet
// Walks contract Block's declared members (properties, aggregations, associations,
// capabilities, constraints, suggestions, documentation, examples, references, optional defaults).
// Ignores subBlocks[], embeddedBlocks[], and compositions[].
// Does not walk contracts[] on the contract Block itself (no transitive contract merge).
```

For each FQN in `block.contracts[]`, declared members are merged in order. The Block's own declared members are merged last. Merge semantics match `baseType` partial overrides — same member kind required; only specified attributes replace prior values.

### Type bounds — satisfiesTypeBound (not stored in BOM)

Type-bound checks are separate from member merge and branch detection. See `17_type_system_bml.md` — baseType vs contracts.

```typescript
/** @blockml/core — not part of BomDocument */
function inBranch(blockFqn: string, branchFqn: string, registry: TypeRegistry): boolean
// Walk blockFqn's baseType chain toward org.blockml.bml.core.Block.
// Return true when branchFqn appears on the chain.
// contracts[] is NOT consulted.

/** @blockml/core — not part of BomDocument */
function satisfiesTypeBound(
  blockFqn: string,
  boundFqn: string,
  registry: TypeRegistry
): boolean
// Return true when:
//   boundFqn is on blockFqn's baseType chain, OR
//   boundFqn is listed directly in block.contracts[] on blockFqn's BlockDefinition.
// V1: no transitive closure through a contract Block's own contracts[].
```

```text
inBranch            — Property/Capability ValueType branch, Definition branch, branch rule table
satisfiesTypeBound  — genericTypes baseType constraints, generic type arguments, TypeReference(B)
```

Framework core branch FQNs (`org.blockml.bml.core.ValueType`, `Entity`, `Language`, …) are satisfied via **`inBranch`** / baseType chain only — they are not duplicated as interface contracts in `@blockml/core`.

---

## Member Values

Values on Block instances and property defaults use a common value model.

### Property Value Semantics

> **Property values are never linked.** A property on a Block instance or definition must never hold a reference to another instance — neither directly nor indirectly. All property values are **deep copies**.

Cross-instance references via `FQN::id` exist only on **associations** — `basePresets`, `Step.part`, and similar members whose semantics explicitly model instance identity. Properties typed with ValueTypes always store inline values.

**EnumType:** an authored token such as `Standard` or `com.machineblocks.bml.type.BaseCutout::Standard` is **not** a link to the `values` catalog entry. The validator resolves the token against `values` by `id`. The BOM stores **only id + typeFqn** (the EnumType) — catalog properties on the member (for example an optional `scad:value` string) are **not** copied into the property value. Tools look up catalog metadata from the EnumType definition when needed. See `17_type_system_bml.md` — EnumType.

**StructType and primitives:** authored literals remain inline in Canonical BOM — `[1, 1, 1]`, `{x:1, y:1, z:1}`, or a nested StructType element are self-contained copies, not references to other instances.

**Preset/config merge:** merge copies values into the render-time view — never writes references back to `BomDocument`. See `14_compiler_runtime.md` — Property resolution.

```typescript
type MemberValue =
  | LiteralValue
  | ExpressionValue
  | AddressValue

interface LiteralValue {
  kind: "literal"
  /**
   * Authored value exactly as in BML — preserved for lossless BML ↔ BOM round-trip.
   * MUST NOT be normalized to a canonical internal form at parse/validate time.
   * Examples: [5,5,6] stays an array; {x:5,y:5,z:6} stays an object;
   * <SizeXYZ x="5" …/> stays a nested BlockInstance.
   * Type compatibility is checked against typeFqn — the stored shape is not rewritten.
   */
  value: unknown
  typeFqn: string
  /**
   * When the member's bml:xml allows element|attribute: which form this value used in source (D9).
   * Roundtrip MUST emit the same form. Omitted → D1 canonical default for the host context.
   */
  authoredPlacement?: "attribute" | "element"
}

interface ExpressionValue {
  kind: "expression"
  /** Raw source inside ${ } — the only expression field in Canonical BOM */
  raw: string
  /**
   * When the member's bml:xml allows element|attribute: which form carried this expression (D9).
   */
  authoredPlacement?: "attribute" | "element"
  source: SourceLocation
}

interface AddressValue {
  kind: "address"
  /** Parsed org.blockml.bml.type.Address */
  address: Address
}

interface Address {
  raw: string
  scheme: string | null
  path: string
  isAbsolute: boolean
  isRelative: boolean
  isExpression: boolean
}
```

Union variant discrimination (`resolvedTypeFqn`) is a **`validateTypes()` utility result** — not stored in Canonical BOM.

AST (`ExpressionNode`) and `resultTypeFqn` are produced by **`parseExpression()`** — not stored in Canonical BOM.

`ExpressionNode` is specified in `10_expression_language.md` — Expression AST.

---

## Composition Tree

A Composition fills an Aggregation with a tree of nodes. `bml:*` directives follow the **Thymeleaf model** — attributes on the element they modify, not separate wrapper nodes.

```typescript
interface CompositionTemplate {
  /** Target aggregation name — e.g. "_parts", "blocks", "_presets" */
  aggregationName: string
  /** bml:with on <composition> */
  directives?: DirectiveAttribute[]
  children: CompositionNode[]
  source?: SourceLocation
}

/** Aggregation opened inline on a Block instance */
interface InstanceAggregationComposition {
  aggregationName: string
  composition: CompositionTemplate
}

type CompositionNode =
  | BlockInstanceNode
  | VirtualContainerNode

interface BlockInstanceNode {
  kind: "blockInstance"
  instance: BlockInstance
  /** bml:each, bml:if, bml:unless, bml:with on this block instance element */
  directives?: DirectiveAttribute[]
  source?: SourceLocation
}

interface VirtualContainerNode {
  kind: "virtualContainer"
  /** bml:each, bml:if, bml:unless, bml:with on <bml:container> */
  directives?: DirectiveAttribute[]
  children: CompositionNode[]
  source?: SourceLocation
}
```

### Directive Placement Rules

`bml:*` directives are stored in `directives[]` on the element they appear on — analogous to Thymeleaf `th:*` attributes on HTML elements.

| Attribute / namespace | Allowed on | Notes |
|---|---|---|
| `bml:id` | Block instances | Composition instance identity — literal or `${ expr }` |
| `bml:version` | Block instances | External block reference version |
| `bml:bean` | Block instances | Service bean name |
| `bml:scope` | Block instances | Bean visibility: `"local"` or `"context"` |
| `bml:with` | `<composition>`, `<aggregation>`, `<bml:container>`, Block instances | Local variable scope |
| `bml:each` | `<bml:container>`, Block instances | Loop |
| `bml:if`, `bml:unless` | `<bml:container>`, Block instances | Conditional inclusion |

Directives are **never expanded** at parse time. Expansion (if any) is a downstream concern.

**Composition meta** (`bml:id`, `bml:version`, `bml:bean`, `bml:scope`) is parsed from the `bml:` namespace but stored on **`BlockInstance` fields** — not in `directives[]` and not in `memberValues`.

```typescript
type DirectiveAttribute =
  | EachDirective
  | IfDirective
  | UnlessDirective
  | WithDirective

interface EachDirective {
  type: "each"
  variables: string[]
  statVariable?: string
  collection: ExpressionValue
}

interface IfDirective {
  type: "if"
  condition: ExpressionValue
}

interface UnlessDirective {
  type: "unless"
  condition: ExpressionValue
}

interface WithDirective {
  type: "with"
  bindings: WithBinding[]
}

interface WithBinding {
  name: string
  value: ExpressionValue
}
```

Dynamic instance IDs in loops use **`bml:id`** with an expression value:

```xml
<bricks:StandardBrick
    bml:each="i : ${ numberOfSamples }"
    bml:id="${ 'val_' + i }"
    size="[1, 1, 1]" />
```

In BOM: `BlockInstance.id` is an `ExpressionValue` or literal — **only when `bml:id` is authored**. Omitted `bml:id` is stored as absent; the parser does not assign auto-IDs.

---

## Instance ID Rules

**`bml:id`** identifies a child within its parent's composition tree. `org.blockml.bml.core.Block` declares no members — composition identity is not a Property. Bare `id=` on an instance is a **member value** only when the referenced Block type declares a Property named `id`.

Nested paths use `::`:

```text
parentPartId::childPartId::grandchildPartId
```

There is **no FQN fallback** — instance identity is never derived from the Block type's FQN.

### Pipeline

```text
Parse       →  bml:id stored on BlockInstance.id only when authored (literal or ExpressionValue)
Validate    →  cross-instance references (blockId, placeId, …) must target
               siblings with explicit authored bml:id; BML_MISSING_ID /
               BML_UNRESOLVABLE_INSTANCE_REF on failure
Expand      →  bml:each / bml:if / bml:with resolved to concrete instances
Resolve ID  →  id expressions evaluated; auto-ID for remaining static children
Render      →  mb_block_id(parentId, partId) using resolved part IDs
```

Auto-generated IDs are **not** stored in `BomDocument`. They exist only on the expanded composition tree used for rendering.

### Explicit vs. auto-generated

| Case | Rule |
|---|---|
| Referenced by another instance (`blockId`, `placeId`, …) | **Explicit `bml:id` required** (literal) — `BML_MISSING_ID` if absent |
| Element with `bml:each` | **Explicit `bml:id` required** (literal or Expression) — no auto-ID |
| Static anonymous `_parts` child, not referenced | Auto-ID after expansion (deterministic hash) |
| FQN as identity fallback | **Forbidden** |

### Auto-ID algorithm

Assigned after directive expansion, only for static instances still lacking `bml:id`:

```text
Hash inputs:
  - typeFqn of the Block instance
  - sibling index in the parent's composition (post-expansion)
  - parent resolved part ID

Result:  6 hex characters (e.g. "a3f7c2"); extend on collision
```

Deterministic across compile runs — same position → same ID → clean SCAD diffs.

### Reference validation (pre-expansion)

Cross-references within the same composition scope are validated against **authored explicit bml:id values**:

```text
_presets child with bml:id="wall"           ← target
_parts child basePresets="wall"       ← reference  ✓  (same document, unqualified)
```

### Qualified references (`{BlockFQN}::{id}`)

References to instances in **another Block definition** use the qualified form:

```text
com.machineblocks.bml.bricks.StandardPresets::brick-2x4
```

Valid only when:

```text
1. Target aggregation member is public (visibility public)
2. Target instance has explicit literal bml:id (no Expression, not bml:each-only)
3. Reference attribute value is a literal token (not ${ … })
```

```text
<!-- Target document: StandardPresets.bml — public presets aggregation -->
<aggregations>
  <presets type="core:Block[]">
    <composition>
      <bricks:Standard bml:id="brick-2x4" … />     ← referencable cross-document
    </composition>
  </presets>
</aggregations>

<!-- Referencing document -->
<bricks:Standard basePresets="com.machineblocks.bml.bricks.StandardPresets::brick-2x4" />  ✓

<!-- Protected or private aggregation -->
<aggregations>
  <_presets>
    <composition>
      <bricks:Standard bml:id="brick-2x4" … />
    </composition>
  </_presets>
</aggregations>
→ com.machineblocks.bml.bricks.StandardPresets::brick-2x4  ✗  BML_UNEXPORTED_INSTANCE_REF

<!-- Dynamic target or reference -->
<bricks:Standard bml:id="${ presetId }" … />                              ✗  BML_NON_STATIC_INSTANCE_REF
<bricks:Standard basePresets="${ ref }" … />                      ✗  BML_NON_STATIC_INSTANCE_REF
```

Same-document unqualified ids (`basePresets="brick-2x4"`) resolve within aggregations visible to the referencing context per visibility rules — public-aggregation requirement applies to cross-document `{BlockFQN}::{id}` only.

Local validation examples:

```text
_presets child without bml:id               ← target
_parts child basePresets="wall"     ← reference  ✗  BML_MISSING_ID on target preset

_presets child with bml:id="wall"           ← target
_parts child basePresets="floor"     ← reference  ✗  BML_UNRESOLVABLE_INSTANCE_REF
```

`basePresets` / `Step.part` values must match an authored **`bml:id`** in the referenced aggregation — not an auto-generated or FQN-derived value.

---

## `BlockInstance`

Represents a concrete child block in a composition (XML element or JSON child object). Semantically: an **Object** — instance of a Block class (`typeFqn`) with optional `bml:id` / `bml:version` and member values.

```typescript
interface BlockInstance {
  /** Resolved FQN of the referenced block type */
  typeFqn: string

  /**
   * Composition instance identity — from bml:id (literal or ExpressionValue).
   * Resolved value serves as partId in composition tree.
   */
  id?: MemberValue

  /**
   * From bml:version — optional exact-version assert on external block references and on
   * TypeReferenceEntity sugar (Library catalog aggregations). Asserts against the referenced
   * type FQN (for sugar: value). Omitted → resolve effective version from TypeRegistry context.
   * No match → BML_UNKNOWN_VERSION. See "Version Rules" below.
   */
  version?: MemberValue

  /**
   * From bml:bean — registers this instance as a named service bean.
   * Accessible in Expressions via @beanName.
   */
  bean?: MemberValue

  /**
   * From bml:scope — bean visibility: "local" (default) or "context".
   * Context-scoped beans are visible to all descendant Blocks in Compositions.
   */
  scope?: "local" | "context"

  /** Preset reference: {PresetsDocumentFQN}::{preset-id} */
  basePresets?: string

  renderGroup?: string
  namespace?: string

  /**
   * Member values set on this instance (properties + capabilities).
   * Property namespace is free — id/version here only when declared on the Block type
   * and authored as bare attributes (not bml:id / bml:version).
   */
  memberValues: Record<string, MemberValue>

  /**
   * Nested aggregation compositions on this instance.
   * Parsed from <{aggregationName}><composition>…</composition></{aggregationName}>.
   * Standalone <composition> → BML_STANDALONE_COMPOSITION.
   */
  aggregationCompositions?: InstanceAggregationComposition[]

  /** XML comments bound to this composition instance element (B11). */
  xmlTrivia?: XmlTrivia

  source: SourceLocation
}
```

### Type Reference Resolution

Composition child elements are **general block references** — they have no implicit namespace. The parser resolves the element QName via `xmlns:` declarations or full FQN. Bare PascalCase tags without prefix → `BML_UNQUALIFIED_BLOCK_REFERENCE`.

Sub-Blocks must use qualified names (`RootBlock.SubBlock`) or prefixed form (`cal:Calibrator.Base`), never bare short names.

---

## Version Rules

### Effective block version (definitions)

Every Block definition has an **effective version**:

```text
effectiveBlockVersion =
  own <version>,           if present on the Block definition
  else library.version,    if the Block is exported via a Library (blocks)
  else error               → BML_MISSING_VERSION
```

**Block in a Library:** may omit `<version>` and inherit the Library's version. If the Block declares its own `<version>`, it must be `>= library.version` (semver). Below library version → error. Patch-only drift is best practice; minor drift may warn.

**Framework convention (`org.blockml.bml.*`, `com.machineblocks.bml.*`):** maintain version only on `Library.bml` — no `<version>` on individual block files.

**Standalone block (not in a Library):** `<version>` is mandatory → `BML_MISSING_VERSION` if missing.

### Instance version rules (references)

External block references resolve version from registry context. `bml:version` is an **optional exact-version assert**, not a mandatory pin.

```text
Same-document reference (Sub-Block or type defined in subBlocks[]):
  → bml:version NOT allowed as resolution hint (same-doc scope)
  → effective version = Sub-Block definition's effectiveBlockVersion

External reference (type from another BML file — `.bml`):
  → bml:version omitted  → use effective version from TypeRegistry context
  → bml:version present  → target must be exactly that version
                           → no match → BML_UNKNOWN_VERSION (error)

Inside Library files (readMe / bootstrap / dependencies / subLibraries / blocks):
  → bml:version optional on TypeReferenceEntity sugar / explicit Entity children
  → present → exact-version assert against referenced type (value)
  → no match → BML_UNKNOWN_VERSION (error)
  → omitted → resolve from TypeRegistry / library context
```

Examples from `Calibrator.bml`:

```xml
<!-- Same file, Sub-Block — no bml:version -->
<Base bml:id="base_stud" offset="[0, 0, 0]" ... />

<!-- External type — registry context (preferred) -->
<bricks:StandardBrick bml:id="strip" ... />

<!-- External type — exact-version assert (optional) -->
<bricks:StandardBrick bml:version="3.0.0" bml:id="strip" ... />
```

### TypeRegistry lookup

```typescript
getBlockDefinition(fqn: string, version?: string): BlockDefinition | undefined
// version omitted → resolve from registry context (library bootstrap / active dependency set)
// version present → exact match required
```

---

## Presets (MachineBlocks)

Presets are **not** a BlockML core feature. MachineBlocks models them via `_presets` aggregation and `basePresets` association on `com.machineblocks.bml.core.Block`. Preset files are ordinary `BlockDefinition` documents.

```text
com.machineblocks.bml.core.Block
  aggregation  _presets   0..n   com.machineblocks.bml.core.Block
  association  basePresets  0..n  bml:Self  — space-separated ids on instance
```

Preset instances appear as Block children in `_presets` composition. Preset merge is compiler logic; Customizer JSON is render-target logic.

**Preset reference syntax:**

```text
{BlockFQN}::{preset-id}

Example:
  com.machineblocks.bml.bricks.StandardPresets::brick-2x4
```

Cross-file `basePresets` entries use the same `FQN::id` form. Local ids resolve within the enclosing Block's `_presets`.

**Merge order** when resolving base presets:

```text
1. Own instance properties
2. basePresets — applied left-to-right; later entries override earlier
3. Block definition values (property `value`)
```

Cycles in `basePresets` → `BML_PRESET_CYCLE`.

---

## Libraries (`org.blockml.bml.core.BlockLibrary`)

Library descriptors are ordinary `BlockDefinition` documents with `baseType="org.blockml.bml.core.BlockLibrary"`.

`org.blockml.bml.core.BlockLibrary` is a framework base type in `core/` — not exported via Library `blocks`. All concrete `Library.bml` files inherit from it.

**Naming (required):** every real library block is named `Library` (`<name>Library</name>`), filename is always `Library.bml`. FQN = package + `Library` (e.g. `com.machineblocks.bml.Library`, `org.blockml.bml.Library`, `org.blockml.bml.compiler.Library`).

**Membership is defined only by `Library.bml` — not by directories.** A Block belongs to the Library whose `blocks` lists it. Package-prefix overlap does not imply inclusion.

### Nested libraries

Multiple `Library.bml` files may exist at different package levels (e.g. `org.blockml.bml.Library` and `org.blockml.bml.compiler.Library`). Each is an independent publishable unit.

```text
Typical dependency:   inner dependencies → outer Library
Typical grouping:     outer subLibraries → inner Library
Forbidden:            outer blocks → Block exported by inner Library
```

Inner libraries usually declare the outer library in `dependencies`. The outer library declares inner libraries in `subLibraries` and must **not** re-export inner-library blocks in `blocks` — consumers depend on the inner library directly. Violation → `BML_LIBRARY_NESTING_VIOLATION`.

```text
org.blockml.bml.core.BlockLibrary
  property     description     String                         (public, readOnly)
  aggregation  language        org.blockml.bml.language.NaturalLanguage  (public, readOnly)
  aggregation  readMe       1..1  org.blockml.bml.core.ReadMe         (public, readOnly)
  aggregation  bootstrap       0..1  org.blockml.bml.core.Bootstrap      (public, readOnly)
  aggregation  dependencies    0..n  org.blockml.bml.core.BlockLibrary   (public, readOnly)
  aggregation  subLibraries    0..n  org.blockml.bml.core.BlockLibrary   (public, readOnly)
  aggregation  schemas         0..n  org.blockml.bml.type.FilePathEntity (public, readOnly)
  aggregation  blocks          0..n  org.blockml.bml.core.Block          (public, readOnly)

org.blockml.bml.type.FilePathEntity            property:  value (relative .xsd path)
org.blockml.bml.core.ReadMe                   abstract role marker — human/LLM reading entry
org.blockml.bml.README                         extends ReadMe — ReadFirst + TaskIndex on references
org.blockml.bml.core.Bootstrap                 abstract role marker — automation SPOE (empty)
org.blockml.bml.core.TaskGuide                 abstract — org.blockml.bml.task.* procedural blocks
org.blockml.bml.core.Diagnostic                abstract — org.blockml.bml.diagnostic.* error codes
```

Catalog members are **public** and **`readOnly`**: foreign Blocks may inspect a library descriptor; only the Library definition authors the catalog (instances → `BML_READONLY_MEMBER_WRITE`).

`readMe`, `bootstrap`, `dependencies`, `subLibraries`, and `blocks` use `TypeReferenceEntity`
aggregations — QName sugar expands to Entity instances (not instances of the named Block).
Optional **`bml:version`** on sugar children is an exact-version assert against the referenced type
(`value`); effective version when omitted is resolved from library / TypeRegistry context.
Meta-model types: `TypeReferenceEntity(core:ReadMe)[1..1]`, `TypeReferenceEntity(core:Bootstrap)`,
`TypeReferenceEntity(core:BlockLibrary)[]`, `TypeReferenceEntity(core:Block)[]`. See
`17_type_system_bml.md` — TypeReference and TypeReferenceEntity.

On library **instances**, children are authored inside `<composition>` as the aggregation-fill
container where required by instance fill rules. For these aggregations, each child is a
**TypeReferenceEntity** instance (sugar or explicit). `schemas` remains a `FilePathEntity[]`
aggregation — its children are FilePathEntity instances.

The orchestrator resolves `readMe`, `bootstrap`, `dependencies`, `subLibraries`, and `blocks`
entries by FQN, loads referenced definitions into the TypeRegistry using effective block versions,
and validates library membership.

`readMe` is the required human/LLM reading entry (exactly one ReadMe — typically
`org.blockml.bml.README`). Curated reading order uses `<references>` with `relation=ReadFirst`;
available tasks use `relation=TaskIndex`. `bootstrap` is the optional automation SPOE (at most one
Bootstrap). Concrete Library `<references>`: required `ReadFirst` → readMe target; optional
`ThenContinueWith` → bootstrap target when present. `schemas` is optional legacy XSD (`FilePathEntity`
paths). `blocks` lists exported Block and ValueType BML — primary SSOT as types migrate from XSD.
---

## Source Locations

All diagnostics reference BML source positions via:

```typescript
interface SourceLocation {
  file: string
  line: number
  column: number
  /** Optional end position for ranges */
  endLine?: number
  endColumn?: number
}
```

Every `BlockDefinition`, `BlockInstance`, `MemberDefinition`, and `ExpressionValue` SHOULD carry a `source` / `sourceLocation` for diagnostic quality.

**Roundtrip equality (B20):** Provenance fields are **not** part of BOM deep equality for the Phase-A gate. Compare semantic structure only — strip or ignore `source`, `sourceLocation`, and optional end spans before `deepEqual`. See `13_bml_to_bom_mapping.md` — V1 Parser / Serializer Scope · `15_dev_setup.md` Roundtrip test contract.

---

## Type Registry

The Type Registry is **not** part of `BomDocument`. It is a runtime service in `@blockml/core`, populated **before validation** by the compile orchestrator (`@blockml/cli` or host application).

The parser (`@blockml/parser`) is **single-file scoped** — it does not load or resolve external BML files. External block references are stored as `typeFqn` + `version` on `BlockInstance`; resolution happens at validate time against a bootstrapped registry. See `13_bml_to_bom_mapping.md` — Cross-File Resolution.

### Bootstrap sources

```text
1. Built-in services     — @blockml/core (org.blockml.bml.service.*)
2. Framework BML              — libs/bml-core, scad-lib/blocks/com/machineblocks/bml (see 16_framework_base_types.md)
3. Library blocks             — org.blockml.bml.core.BlockLibrary → resolve readMe / bootstrap / dependencies / subLibraries / blocks by FQN (optional bml:version assert against value)
4. Project srcDir scan        — remaining *.bml in bom.config.json srcDir
5. Declared dependencies      — Library dependencies entries + bom.config.json paths
```

Each discovered file is parsed independently (parser step [5]) and registered via `registerBlockDefinition(doc)`.

Without `library.xml`, all BML files in a directory are registered. With `library.xml`, the manifest explicitly lists public blocks and presets.

```typescript
interface TypeRegistry {
  /** version is required for external block lookups — no implicit latest */
  getBlockDefinition(fqn: string, version: string): BlockDefinition | undefined
  getNativeMembers(baseTypeFqn: string): MemberDefinition[]
  resolveType(typeName: string, contextFqn: string): string | undefined
  registerBlockDefinition(doc: BomDocument): void
}
```

---

## Reference Example: `Calibrator.bml`

File: `domains/machineblocks/.../scad-lib/blocks/com/machineblocks/bml/calibration/Calibrator.bml`

```text
BomDocument
  kind: "block"
  block: BlockDefinition
    name: Calibrator
    type: com.machineblocks.bml.calibration.Calibrator
    baseType: com.machineblocks.bml.core.CompositeBlock
    version: "1.0.0"

    members: (declared only — NOT including inherited size, offset, baseColor, ...)
      - PropertyDefinition numberOfSamples
      - PropertyDefinition font
      - PropertyDefinition size (computed value → ExpressionValue)
      - AggregationDefinition _utils → typeFqn: ...Calibrator.Utils, composition with Utils instance (bml:bean="utils", bml:scope="context")
      - AggregationDefinition _parts → composition with 4 calibration rows

    subBlocks:
      - BlockDefinition Utils (utility Sub-Blocks, capabilities with OpenSCAD implementation)
      - BlockDefinition Base (composition with bml:each on instances, dynamic id via id property)
      - BlockDefinition StudDiameter
      - BlockDefinition BaseWallThickness
      - BlockDefinition TubeDiameter
      - BlockDefinition PinDiameter

    compositions:
      - aggregationName: "_utils"
        children:
          - BlockInstanceNode Utils (bml:bean="utils", bml:scope="context")
      - aggregationName: "_parts" (inherited from com.machineblocks.bml.core.CompositeBlock)
        children:
          - BlockInstanceNode Base (no version — same document)
          - BlockInstanceNode StudDiameter
          - BlockInstanceNode Base (id=base_wall)
          - BlockInstanceNode BaseWallThickness
          - ... (4 calibration rows, no bml:each at root — authored explicitly)
```

Key observations for implementers:

- Root composition references Sub-Blocks by short name — parser resolves against the `subBlocks[]` tree (walk nested Sub-Blocks by local name or qualified path).
- `@utils.formatValue(...)` in expressions is stored as `ExpressionValue { raw }` — V1 runtime deferred; AST via `parseExpression()` later.
- `#math.round_n(...)`, `#math.floor(...)` likewise stored as `ExpressionValue { raw }` — builtin-call AST nodes appear only after `parseExpression()`.
- Inherited native properties (`size` used in expressions) are **not** in `Calibrator.members[]` — validator resolves via `resolveEffectiveMembers()`.

---

## Validation Responsibilities

The parser produces `BomDocument`. The validator (`@blockml/validator`, using `@blockml/core` utilities) checks:

```text
✓  Member namespace uniqueness (declared members per block)
✓  baseType exists in TypeRegistry
✓  Property values are inline deep copies — never instance references (enum FQN::id tokens are resolution keys only)
✓  resolveEffectiveMembers() — property/capability references in expressions
✓  Block definitions have effective version (BML_MISSING_VERSION if standalone and no <version>)
✓  Library member block.version >= library.version when both declared
✓  External instance references resolve via registry context; optional bml:version is exact assert (BML_UNKNOWN_VERSION)
✓  Library readMe / bootstrap / dependencies / subLibraries / blocks sugar bml:version asserts match when present (BML_UNKNOWN_VERSION)
✓  Cross-instance references (blockId, placeId, FQN::id) resolve to explicit authored id
✓  Qualified FQN::id references target public aggregations with static literal ids
✓  bml:each elements have explicit id (literal or Expression)
✓  Sub-Block references use qualified name or FQN — no bare short names
✓  generic parameter name ≠ declaring Block name; generic parameter name ≠ any direct Sub-Block name of that Block
✓  Sub-Block same name as root Block → qualified reference required at use sites
✓  Sub-Block visibility derived from name or explicit <visibility>; root Block must not declare visibility
✓  Member access respects visibility (private / protected / public) — formal access rule
✓  Sub-Block reference respects visibility scope (private / protected / public)
✓  Unqualified nested names resolve enclosing-chain (own name → generics → Sub-Blocks); grandchildren require qualification
✓  No duplicate members differing only by visibility prefix (normalized logical name)
✓  Expression result types match member types
✓  Preset block instance properties exist on referenced block type
✓  Property value cycles (topological sort)
✓  basePresets resolve (local id or FQN::id) and have no cycles
✓  contract Block references resolve and merge into effective members (declaration order; later wins)
✓  constraints — validateConstraints() on Block and all member kinds after resolveEffectiveMembers(); branch compatibility (BML_CONSTRAINT_TARGET_MISMATCH); rule enforcement only when validation is set (including ValuePresent → BML_CONSTRAINT_VIOLATION)
✓  readOnly — after resolveEffectiveMembers(): Block instances must not set members with readOnly=true (BML_READONLY_MEMBER_WRITE)
✓  Library blocks entries resolve to registered Block definitions (FQN + effectiveBlockVersion)
✓  Outer library blocks does not re-export blocks from a nested inner library (BML_LIBRARY_NESTING_VIOLATION)
✓  Library dependencies entries resolve to registered BlockLibrary definitions (FQN + effectiveBlockVersion)
```

The validator does **not** expand directives, assign auto-IDs, or interpret aggregations.

---

## What This Document Does Not Specify

| Topic | Document |
|---|---|
| Expression AST node union | `10_expression_language.md` — Expression AST |
| Embedded expressions in implementations | `10_expression_language.md` — BML Embedded Expressions |
| BML → BOM mapping algorithm | `13_bml_to_bom_mapping.md` |
| Framework base types (BML) | `16_framework_base_types.md` |
| ValueType · Language (BML) | `17_type_system_bml.md` |
| Development setup (Phase D) | `15_dev_setup.md` |
| MBOM native parameter / type SSOT | `NativeBlock.bml` + `type/*.bml` |
| MBOM → SCAD serialization | `04_types.md`, `05_scad_renderer.md` |
| Synthetic accessors · ManagedObject | `08_managed_object.md` (Draft · V1 preparation) |
| Built-in `#math` / `#strings` capabilities | `@blockml/core` |

---

## Related Diagnostics

```text
BML_MISSING_BASE_TYPE         — baseType absent on BlockDefinition
BML_MISSING_BLOCK_TYPE        — root block lacks required type
BML_BLOCK_NAME_TYPE_MISMATCH  — root block name ≠ last segment of resolve(type)
BML_MISSING_SUBBLOCK_NAME     — Sub-Block lacks required name
BML_SUBBLOCK_TYPE_MISMATCH    — explicit Sub-Block type ≠ resolve(parent.type) + "." + name
BML_EMBEDDED_BLOCKS_ON_SUBBLOCK — Sub-Block declares embeddedBlocks (forbidden on all Sub-Blocks)
BML_NESTED_EMBEDDED_BLOCKS — EmbeddedBlockDefinition declares embeddedBlocks (root-only)
BML_DUPLICATE_EMBEDDED_BLOCK — same FQN among root embeddedBlocks
BML_DEFINITION_TYPE_MISMATCH  — <definition> FQN incompatible with block role (Sub-Block vs root/embedded)
BML_MISSING_EMBEDDED_BLOCK_TYPE — embedded block lacks required type
BML_UNQUALIFIED_EMBEDDED_BLOCK_TYPE — embedded block type is not fully qualified
BML_AMBIGUOUS_TYPE            — unqualified type name resolves to multiple candidates
BML_CONSTRAINT_UNKNOWN        — constraint type not a Constraint sub-type
BML_CONSTRAINT_TYPE_MISMATCH  — constraint generic T incompatible with bound target
BML_CONSTRAINT_TARGET_MISMATCH — constraint branch incompatible with embedding context
BML_CONSTRAINT_VIOLATION      — constraint rule fails with validation Error
BML_MISSING_IS              — Block definition lacks <is> (warning V1)
BML_MISSING_DOCUMENTATION     — Block definition lacks default-namespace <documentation> (warning V1)
BML_MISSING_ISNOT             — confusion risk but <isnot> omitted (warning V1)
BML_MISSING_SUMMARY           — canonical documentation too long but default-namespace <summary> omitted (warning V1)
BML_DUPLICATE_DOCUMENTATION   — two <documentation> entries share the same (namespace, languageFqn)
BML_DUPLICATE_SUMMARY         — two <summary> entries share the same (namespace, languageFqn)
BML_DUPLICATE_PROPERTY_VALUE  — two PropertyDefinition value-field entries share the same namespace
BML_INVALID_SINCE_VERSION     — <since> is not a valid semantic version
BML_CHANGELOG_VERSION_ORDER   — <changelog> entries not ordered oldest-first (warning V1)
BML_EXAMPLE_MISSING_TITLE     — <example> / *:example lacks required title attribute
BML_EXAMPLE_EMPTY_BODY        — <example> / *:example has no character data body (text or CDATA)
BML_EXAMPLE_UNKNOWN_LANGUAGE  — <example> language attribute is not a known Language FQN
BML_UNKNOWN_NATURAL_LANGUAGE  — <language> or documentation/summary language attribute is not a NaturalLanguage FQN
BML_MISSING_VERSION           — Block definition lacks effective version (no own <version> and not exported via Library)
BML_UNKNOWN_VERSION           — bml:version assert or lookup failed — no matching BlockDefinition in TypeRegistry (includes Library TypeReferenceEntity sugar)
BML_VERSION_BELOW_LIBRARY     — block.version < library.version when both declared (error)
BML_VERSION_MINOR_DRIFT       — block.version minor differs from library.version (warning — best practice: patch only)
BML_LIBRARY_NESTING_VIOLATION  — outer library blocks re-exports a Block exported by a nested inner library
BML_MISSING_ID                — referenced instance or bml:each element lacks explicit bml:id
BML_UNRESOLVABLE_INSTANCE_REF — blockId / placeId / FQN::id does not match any explicit id in target aggregation
BML_UNEXPORTED_INSTANCE_REF   — qualified {BlockFQN}::{id} targets an instance in a non-public aggregation
BML_NON_STATIC_INSTANCE_REF   — qualified reference or export target uses Expression instead of literal id/token
BML_DUPLICATE_MEMBER_NAME     — member name collision in declared members (same normalized name and visibility)
BML_DUPLICATE_MEMBER_VISIBILITY_VARIANT — members differ only by visibility prefix
BML_INVALID_PROPERTY_TYPE     — property or Capability type is not a ValueType
BML_UNKNOWN_TYPE              — typeFqn cannot be resolved
BML_INVALID_DEFINITION_BRANCH — member/element not allowed on this baseType branch (see 17_type_system_bml.md)
BML_INVALID_TYPE_REFERENCE    — type FQN resolves but wrong branch (e.g. Block used as property type)
BML_LEGACY_TYPE_SOURCE        — type from XSD only · migrate to BML (warning)
BML_UNKNOWN_PROPERTY          — instance attribute not in effective members (warning)
BML_UNKNOWN_DIRECTIVE         — unrecognized bml:* attribute (error)
BML_DIRECTIVE_NOT_ALLOWED     — bml:* on disallowed element (error)
BML_DEPRECATED_MEMBER_NAMESPACE_ATTR — legacy namespace="…" attribute on member element (error)
BML_PROPERTY_CYCLE            — circular property value dependencies
BML_VISIBILITY_MISMATCH       — visibility attribute or <visibility> does not match naming convention
BML_VISIBILITY_ON_ROOT_BLOCK  — <visibility> on root Block
BML_VISIBILITY_NARROWING      — override reduces visibility (e.g. public → protected)
BML_PRIVATE_MEMBER_ACCESS     — private member used outside declaring Block
BML_PROTECTED_MEMBER_ACCESS   — protected member outside allowed inheritance/composition context
BML_PRIVATE_SUBBLOCK_ACCESS   — private Sub-Block referenced outside declaring Block
BML_PROTECTED_SUBBLOCK_ACCESS — protected Sub-Block outside allowed inheritance context
BML_FINAL_MEMBER_OVERRIDE     — override attempted on final or private member
BML_OVERRIDE_WITHOUT_PARENT   — override="true" but no same-named parent member (normalized logical name)
BML_OVERRIDE_REQUIRED         — local redeclaration merges with baseType or contract member but override omitted
BML_ABSTRACT_MEMBER_NOT_IMPLEMENTED — unsatisfied abstract implementation obligation on a concrete block
BML_READONLY_MEMBER_WRITE     — Block instance sets a member with readOnly=true
BML_STANDALONE_COMPOSITION     — <composition> not nested inside an aggregation member element
BML_UNKNOWN_NAMESPACE_PREFIX  — member element prefix references undeclared xmlns: prefix (Stage 1 / parse)
BML_NAMESPACE_UNBOUND         — QName emit needs a namespace with no entry in SourceInfo.namespaceBindings (Stage 2 / serialize / FatBlock — D2)
BML_NAMESPACE_PREFIX_COLLISION — same xmlns prefix maps to different namespace ids when merging documents (FatBlock / multi-doc — D2)
BML_XML_DIRECTIVE_NOT_ALLOWED — bml:xml element or attribute on disallowed host (Stage 1 if hardcoded grammar forbids the site; Stage 2 for D4 / Definition-branch — see 19 hybrid); distinct from flow-control BML_DIRECTIVE_NOT_ALLOWED
BML_XML_RENDERING_INVALID     — <bml:xml> body is not literal | ${ bml:Self } | ${ #this.name } (Stage 1 — D6)
BML_PRESET_CYCLE              — circular basePresets chain
BML_GENERIC_CONSTRAINT_VIOLATION — generic type argument fails satisfiesTypeBound
BML_GENERIC_DEFAULT_FORWARD_REF — defaultType names a later or unknown generic parameter
BML_GENERIC_DEFAULT_CYCLE — defaultType reference graph contains a cycle
BML_GENERIC_DEFAULT_UNRESOLVED — defaultType chain does not ground to a concrete type
BML_TYPE_BOUND_NOT_SATISFIED    — type reference fails satisfiesTypeBound (non-generic bound site)
BML_UNKNOWN_CONTRACT          — contract Block FQN not in TypeRegistry
BML_CONTRACT_NOT_ON_ROOT      — <contracts> on Sub-Block
BML_DUPLICATE_CONTRACT        — same type listed twice in block.contracts[]
BML_CONTRACT_MEMBER_KIND_MISMATCH — override uses a different member kind than merged member
BML_EXPR_UNKNOWN_PROPERTY     — property reference not in effective members
```

See `06_compiler.md` for the full diagnostic catalog.
