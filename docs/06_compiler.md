# BOM Compiler — Compiler Pipeline

version: 2.3.0

## Purpose of this Document

This document defines the compiler pipeline — the full translation path from BML source to render target output — including the Target Registry, error handling, diagnostics, and the testing strategy.

For the BML format see `02_mbml.md`.
For the BML→BOM mapping algorithm see `13_bml_to_bom_mapping.md`.
For compiler runtime (compile I/O model, NativeBlock model) see `14_compiler_runtime.md`.
For the formal BOM object model see `12_bom_object_model.md`.
For the MBOM object model see `03_mbom.md`.
For the SCAD Renderer see `05_scad_renderer.md`.

---

## Overview

The compiler is implemented across these packages:

```text
@blockml/core                                — BOM TypeScript contracts + TypeRegistry + framework / service BML
@blockml/parser                              — parse BML → BomDocument (types from @blockml/core)
@blockml/serializer                          — serialize BomDocument → BML (roundtrip; V1 before compiler)
@blockml/validator                           — validate BomDocument (Stage 2; after roundtrip gate)
@blockml/compiler                            — Facade + Target Registry
@blockml/engine-maker                        — V1 CompilerEngine implementation (MakerEngine)
@machineblocks/machineblocks-v3-scad-target  — RenderTarget + BlockProcessors
```

`@blockml/parser`, `@blockml/serializer`, `@blockml/validator`, `@blockml/core`, `@blockml/compiler`, and `@blockml/engine-maker` are browser and Node compatible. No Node-only APIs in any of these packages. RenderTarget packages follow the same constraint.

> **V1 build order:** Parser and serializer ship first; roundtrip tests against the BML corpus gate further work. Compiler and render targets follow only after the language loop is stable. See `15_dev_setup.md` — V1 Implementation Strategy.

---

## Compiler Pipeline

> **Architecture decision:** Parser produces the read-only Urmodell (Canonical BOM). Validator forks a default Pragmatic Model (resolve only). Renderers choose Urmodell, reuse that pragmatic model, or fork again for partial merges (including multiple times). **Language Server (V2)** reuses parser / validator / serializer. Structural authoring is **BomBuilder (V3)** — `seal()` → Urmodell. V1 must stay LSP- and Builder-ready. See `01_bom_core.md` — Language Server · BomBuilder.

## Validation Pipeline

> **Architecture decision:** Three independent validation stages. See `01_bom_core.md` — Validation pipeline.

### Stage numbering glossary (normative)

BlockML uses **three separate numbering systems**. Do not mix them:

```text
A. Validation Stages (architecture — prefer this wording)
   Stage 1 — Parser       → Urmodell
   Stage 2 — Validator    → diagnostics + default pragmatic model
   Stage 3 — Renderer     → evaluate / generate (target-specific)

B. Parser steps (sub-steps of Stage 1 only — bracket notation)
   [1] Format Detector → [2] XML Parser → [3] Root Type Resolver
   → [4] Namespace Resolver → [5] BML → BOM Mapper
   Serializer is the inverse of [5]. There are no parser steps [6]+.

C. SCAD renderer steps (example Stage-3 pipeline — bracket notation from [9])
   [9] Target Resolver … [19] Source Map Generator
   Not a framework-wide pipeline; other renderers differ.

Deprecated legacy numbering (do not use in new text):
   Former “stages [6]–[8]”  → now Stage 2 utilities / @blockml/validator
   Former “stage [7]” AST-on-BOM → parseExpression() utility (no Urmodell write-back)
   Former “stages 1–8” for bom validate → Stage 1 + Stage 2
```

**Test suites** use **Test Layer A/B/C** (roundtrip / correctness / snapshot) — not Validation Stage numbers. See § Testing Strategy.

```text
Stage 1 — Parser
  Checks: well-formed XML · namespaces (V1)
          XSD — not Stage 1; generation = Render Target (Phase C); validation only after that target
              (see 13 — V1 Scope / B8 · 15 — Phase C ordering)
  Produces: Urmodell (Canonical BOM, immutable, SSOT)
  No semantics.

Stage 2 — Validator
  Forks Urmodell → mutable default Pragmatic Model.
  May resolve: inheritance · contracts · effective members · defaults.
  Checks: inheritance · contracts · type compatibility · visibility ·
          constraints · references · expression correctness
  Expressions are NOT evaluated. Never mutates Urmodell.

Stage 3 — Renderer / Runtime
  Chooses: Urmodell · default pragmatic model · own fork(s) from Urmodell
           (forking / partial merges may happen multiple times)
  Decides: expression evaluation · optional handling · capability interpretation ·
           code generation · runtime behaviour
```

See `01_bom_core.md` — Urmodell and Pragmatic Model.

### Layer 1 — Parser (`@blockml/parser`) — Stage 1

Produces the **Urmodell** (Canonical BOM). No semantic decisions. Output is immutable and read-only.

**BML SSOT:** `org.blockml.bml.compiler.parser.documentation.*` — pipeline [1]–[5], mapping rules, `parse()` contract.

**Public API (B26):** `parse(source: string, options?: ParseOptions): ParseResult` — sync; `{ document, diagnostics, success }`. See `org.blockml.bml.compiler.parser.documentation.PublicApi`.

```text
BML Source (.bml)                   — XML only; JSON authoring not planned
  ↓
[1] Format Detector
  ↓
[2] XML Parser
  ↓
[3] Root Type Resolver
  ↓
[4] Namespace Resolver
  ↓
[5] BML → BOM Mapper
  ↓
Urmodell / Canonical BOM (immutable)
```

### Roundtrip — Serializer (`@blockml/serializer`)

Inverse of the parser mapping: **BOM → canonical BML XML**. Enables lossless roundtrip (`BML → BOM → BML`). Not a render target emitter. Operates on the Urmodell only — **no** dependency on `@blockml/validator`.

**Public API (B26):** `serialize(document: BomDocument, options?: SerializeOptions): SerializeResult` — sync; returns `{ text, diagnostics, success }`. See `15_dev_setup.md` — Public API.

**Host policy:** CLI / IDE / LSP may run Stage 2 first and abort on diagnostics before calling `serialize()` or compile. That decision is orchestration, not serializer logic.

**V1:** Implemented and tested together with the parser, before validator and compiler. See `15_dev_setup.md` — V1 Implementation Strategy.

### Layer 2 — Validator (`@blockml/validator`) + Framework Utilities (`@blockml/core`) — Stage 2

The validator orchestrates semantic checks on a **fork** of the Urmodell (default Pragmatic Model). Framework utilities live in `@blockml/core`; the validator package exposes the Stage 2 entry point (e.g. `validateBom()`). Optional, composable. **Never mutate** the Urmodell. Return derived views, diagnostics, or mutate only a pragmatic copy. **Abort-on-error is not a validator concern** — CLI, IDE, and other hosts decide whether diagnostics stop serialize/compile.

```text
forkBom(urmodell)                     → mutable Pragmatic Model copy
resolveInheritance(bom, registry)       → EffectiveMemberSet
resolveEffectiveMembers(block, registry)  → EffectiveMemberSet
resolveType(typeFqn, registry)          → TypeDescriptor
resolveReference(ref, bom, registry)    → ResolvedReference
resolveContracts(block, registry)       → EffectiveMemberSet  (contract merge slice; used by resolveEffectiveMembers)
inBranch(blockFqn, branchFqn, registry) → boolean  (baseType chain only — branch rules)
satisfiesTypeBound(blockFqn, boundFqn, registry) → boolean  (baseType chain OR direct contracts[])
resolveGenerics(typeExpr, registry)     → ResolvedTypeExpr
parseExpression(raw, context)           → ExpressionNode + resultTypeFqn
expandComposition(bom, context)       → ExpandedComposition
expandDirectives(bom, context)          → ExpandedComposition
validateTypes(bom, registry)            → Diagnostic[]
validateConstraints(bom, registry)      → Diagnostic[]
```

`evaluateExpression()` is a Stage 3 / renderer utility (constant fold / emit), not Stage 2 validation.
The CLI may invoke utilities before or during compile for diagnostics — but utilities **never write back** to the Urmodell. Renderers may call `forkBom()` again (including multiple times) and apply only the partial merges they need.

### Layer 3 — Renderer Pipeline (target-specific) — Stage 3

Each renderer defines its own flow and chooses its read source (Urmodell, default pragmatic model, or own forks). Example — **SCAD Renderer** (reference implementation):

```text
Urmodell (immutable)  — or —  default Pragmatic Model  — or —  fork(Urmodell)
  ↓
[9]  Target Resolver
  ↓
[10] expandDirectives()          — utility → ExpandedComposition (working model)
  ↓
[11] Module Name Resolver
  ↓
[12] Import Resolver
  ↓
[13] resolveEffectiveMembers() + Property merge  — utility → resolved values (working model)
  ↓
[14] evaluateExpression() / Expression emit
  ↓
[15] Assembly Pattern Mapper
  ↓
[16] Composition Renderer
  ↓
[17] Set Renderer
  ↓
[18] Customizer Generator
  ↓
[19] Source Map Generator
  ↓
Target Output File(s) + Source Map(s)
```

Example — **BlockDoc Render Target** (toolchain; planned):

```text
CompileRequest (scope: library | corpus | auto)
  + TypeRegistry (cross-links, exported blocks)
  → BlockDoc processors
  → static HTML tree (path ≡ package / FQN hierarchy)
  → siteMode: merged (one site) | perLibrary (one site per Library root)
  → later: graphs, richer navigation
```

Example — **FatBlock Render Target** (toolchain; planned):

```text
Urmodell + TypeRegistry closure of dependencies
  → emit single RootBlockDefinition .bml
  → each dependency as EmbeddedBlockDefinition under root embeddedBlocks[]
```

Example — **Documentation Renderer** (generic / early sketch — superseded in intent by BlockDoc):

```text
Urmodell (immutable)  →  renderRawBOM()  →  Markdown / HTML
```

SCAD renderer steps [9]–[19] are **not** a fixed framework pipeline — they document the SCAD reference renderer. Other renderers (XSD, BlockDoc, FatBlock, …) choose different utilities and ordering. See `15_dev_setup.md` — Phase C toolchain targets.

---

## Pipeline Stages

### [1] Format Detector

V1 accepts **XML only** (`.bml`). JSON authoring is **not planned** — see `02_mbml.md` · `13` B6. No branch on `{`.

**Detection (B24 — decided):**

```text
1. If the buffer starts with UTF-8 BOM (EF BB BF / U+FEFF) → strip it (do not store; do not re-emit)
2. Skip leading whitespace (space, tab, CR, LF)
3. First remaining character MUST be '<'
   → covers <?xml …?>, <!-- … -->, <block …>, and any other well-formed XML prolog/root
4. Otherwise → format diagnostic (not XML); abort before [2]
5. Hand the (BOM-stripped) source to [2] XML Parser
```

**Prolog comments** before the root element are valid XML; after [2] they bind per B11 (typically `leadingComments` on the root `<block>`). The detector must **not** require the file to start with `<block`.

**Serialize:** never write a UTF-8 BOM. XML declaration (`<?xml …?>`) is optional on emit — prefer omit when absence is equivalent (B17); presence is not required for roundtrip (B10).

### [2] XML Parser

Parses the raw XML source into an intermediate W3C-like document tree.

**Library (B18 — decided):** `@xmldom/xmldom` — pure-JS ponyfill of `DOMParser` / `XMLSerializer`. Use it in **both** Node and browser so parse behaviour (namespaces, `Comment`, `CDATASection`, error reporting) stays identical. Do not split “native `DOMParser` in browser / xmldom in Node” for V1.

```text
import { DOMParser } from "@xmldom/xmldom"
const doc = new DOMParser().parseFromString(source, "application/xml")
```

Thin internal facade (`parseXml(source): Document`) is fine; callers outside `@blockml/parser` should not depend on xmldom types.

**Smoke checks before locking versions:** file-header comments → `COMMENT_NODE`; `<![CDATA[…]]>` → `CDATA_SECTION_NODE`; default `xmlns="http://blockml.org/bml"` + prefixed xmlns; malformed XML → diagnostic (not a silent empty document).

**Alternatives considered:** linkedom (faster, HTML/SSR-oriented — Plan B if perf forces it and smoke checks pass); jsdom (too heavy); fast-xml-parser (no DOM — incompatible with step [2]).

JSON parser: **not in V1.**

Browser-compatible only — no Node-only XML stacks (`libxmljs`, etc.).

### [3] Root Type Resolver

Reads the root element name to determine the document type:

```text
<block>   → Block Definition (all block types)
```

V1 has a single root element. Preset blocks use `<block baseType="com.machineblocks.bml.core.Block">` with `_presets` composition.

Selects the appropriate BML→BOM mapping rule for this root type. Extension root types register their mapping rule via the root type registry.

### [4] Namespace Resolver

Resolves all xmlns prefix mappings to FQNs:

```text
xmlns:ac="com.martianmicro.anyclosure"
ac:Wall  →  com.martianmicro.anyclosure.Wall
```

The resolved FQN is used throughout the rest of the pipeline.

### [5] BML → BOM Mapper

Maps the parsed document tree to BOM objects using the mapping rule for the detected root type. Expression `${ }` spans are captured as `ExpressionValue { raw }` only — AST construction is a **`parseExpression()` utility**, not a parser stage. See `13_bml_to_bom_mapping.md`.

```text
XML attribute        →  BOM property value (literal or ExpressionValue { raw })
XML child element    →  BOM composition child instance or aggregation metadata
Member sections      →  members[] in document order (properties → aggregations → associations → capabilities); no sorting
```

Mapping rules are defined once per root type. The mapper produces the **Canonical BOM** — immutable after this stage.

---

## Framework Utilities (Stage 2 — `@blockml/core`)

> Framework utilities support **Stage 2** (and may be reused in Stage 3). Older drafts numbered these as “stages [6]–[8]” — that numbering is **retired**. See § Stage numbering glossary.

> **`@blockml/core` utilities** — read immutable BOM, return results, **never mutate** Canonical BOM. See `01_bom_core.md` — Framework Utilities.

### validateTypes()

```text
validateTypes(bom, registry) → Diagnostic[]
```

Checks member values conform to declared types **without rewriting** authored values. For MBOM: native property types from `NativeBlock.bml` / `type/*.bml`, custom types from block definitions.

### parseExpression()

```text
parseExpression(raw, context) → { ast: ExpressionNode, resultTypeFqn?: string }
```

Parses `${ }` source into AST. **Utility output** — not written into Canonical BOM. BOM stores `ExpressionValue.raw` only.

Recognized forms: property access, attribute access, built-in/bean calls, capability linking, model bindings, ternary, arithmetic. See `10_expression_language.md`.

### validateConstraints()

```text
validateConstraints(bom, registry) → Diagnostic[]
```

Semantic checks in seven phases (see `18_constraints_and_suggestions.md`):

```text
1. Resolve constraint instance typeFqn
2. Determine constraint branch via baseType chain
3. Determine embedding context (Block / Property / Aggregation / Association / Capability)
4. Check branch ↔ context compatibility (BML_CONSTRAINT_TARGET_MISMATCH)
5. Bind generic T automatically from context
6. Validate constraint instance (properties, validation reference)
7. If validation is set and understood → evaluate the constraint rule
```

Also: cross-instance references, capability linking, aggregation cardinality, expression type compatibility (via `parseExpression()`). ValuePresent and inherited constraints use effective member resolution. Returns diagnostics only.

The CLI typically calls these after parse. Renderers may call them during their pipeline.

---

## Renderer Pipeline (SCAD reference — renderer steps [9]–[19])

> These bracket numbers are **SCAD renderer steps** (Stage 3 example), not Validation Stages and not parser steps. See § Stage numbering glossary.

> **Not a fixed framework pipeline.** Each renderer defines its own flow. Stages below document the SCAD reference renderer.

### [9] Target Resolver

Looks up the requested Target by name in the Target Registry. Verifies that the Target supports the `baseType` of every Block in the BOM document. If no registered Target supports a Block's `baseType`, a diagnostic error is emitted for that Block.

For Composite Targets: resolves the responsible Atomic Target per Block and validates accordingly.

### [10] expandDirectives() + ID Resolution

**Renderer working model** — uses `expandDirectives()` utility on a **copy/view** of the BOM. Canonical BOM is unchanged. See `01_bom_core.md` — Canonical BOM is immutable.

Before rendering, the BlockProcessor expands `bml:each`, `bml:if`, and `bml:with` on the composition tree. Then:

```text
1. Evaluate id expressions on expanded instances
2. Assign deterministic auto-IDs to static unreferenced children still lacking id
3. Compose nested paths (parentPartId::childPartId) for render output
```

Auto-IDs are not written back to `BomDocument`.

### [11] Block Renderer Dispatch

Dispatches each Block in the BOM to its Block Renderer within the resolved Target. For Atomic Targets this is a direct lookup. For Composite Targets this iterates across Atomic Targets.

---

## Target Registry

The Target Registry is the central registration point for all RenderTargets. It is part of `@blockml/compiler`. The compiler **does not register any targets by default** — see `14_compiler_runtime.md` — Target Bootstrap (C3).

### Registration

RenderTargets must be registered before the SCAD renderer reaches step [9]:

```typescript
import { registerTarget } from "@blockml/compiler";
import { MakerEngine } from "@blockml/engine-maker";
import { MachineBlocksV3ScadTarget } from "@machineblocks/machineblocks-v3-scad-target";

const engine = new MakerEngine();
registerTarget(new MachineBlocksV3ScadTarget(engine));
```

**Who registers:**

```text
@blockml/cli     → bootstrapTargets() before compile/watch (V1: hardcoded SCAD target)
Browser / tests  → caller invokes registerTarget() directly
@blockml/compiler → registerTarget() / getTarget() API only — no built-in targets
```

CLI reads `bom.config.json` → `targets[]` (V1). See C3 · C7 in `14_compiler_runtime.md`.

### Interfaces

Stage-3 targets implement **`RenderTarget`** with scope acceptance (C7). SCAD targets additionally use `BlockProcessor` / `RenderEngine` (steps [9]–[19]).

```typescript
/** Normative compile contract — see 14_compiler_runtime.md C2 · C7 */
interface RenderTarget {
  name: string
  accepts: Array<"document" | "library" | "corpus" | "auto">
  validateRequest?(request: CompileRequest): Diagnostic[]
  render(request: CompileRequest, ctx: RenderContext): RenderOutput
}

/** SCAD reference — also uses processors + engine */
interface ScadRenderTarget extends RenderTarget {
  engine?: RenderEngine
  processors: BlockProcessor[]
  delegates: RenderTarget[]
}

interface BlockProcessor {
  baseType: string
  process(block: Block, engine: RenderEngine): RenderOutput
}

interface RenderEngine {
  compile(block: Block, processor: BlockProcessor, context: RenderContext): RenderOutput
  renderTemplate(block: Block, templatePath: string): RenderOutput
  renderTemplates(block: Block, templatePaths: string[]): RenderOutput
  copyTemplate(sourcePath: string, targetPath: string): RenderOutput
  callLLM(block: Block, prompt: string, context: RenderContext): RenderOutput  // future
}
```

### RenderContext

Per-block render state passed to `RenderEngine.compile()`. **Internal API** — not part of the public Facade (C2). Full specification: `14_compiler_runtime.md` — RenderContext (C1).

```typescript
interface RenderSession {
  typeRegistry: TypeRegistry
  sourceFilePath: string
  outputBasePath: string
  targetName: string
  documentKind: BomDocumentKind
  activeConfig?: string
  mbLibPath?: string
}

interface RenderContext {
  session: RenderSession
  blockFqn: string
  outputRelativePath: string
  parentPartId?: string
  partId?: string
  instance?: BlockInstance
  withScope: ReadonlyMap<string, ExpressionValue>
  loopScope?: ReadonlyMap<string, ExpressionValue>
  activePresetId?: string
  child(overrides: Partial<Omit<RenderContext, "session" | "child">>): RenderContext
}
```

`CompileOptions` (session-level) maps into `RenderSession`. Per-node fields are forked via `context.child()` during composition rendering. Property values are resolved on demand via `PropertyResolver` — not cached on context (V1).

### Dispatch Logic

For each Block:

```text
1. Own processors: exact FQN match        (most specific wins)
2. Own processors: baseType-chain fallback
3. Delegates: same logic applied recursively
4. No match → BML_NO_TARGET diagnostic error
```

### Target Example — Mixed Strategies

```typescript
class MachineBlocksV3ScadTarget implements RenderTarget {
  name: "machineblocks-v3-scad"
  engine: new MakerEngine()

  processors: [
    new ScadSetProcessor(),           // compile strategy — more specific
    new ScadBlockProcessor(),         // compile strategy — baseType fallback
    new MathBuiltInProcessor(),       // copy strategy
    new CapabilityImplementationProcessor()      // compile strategy (TS → SCAD)
  ]

  delegates: []
}
```

### Delegate-Only Target Example

```typescript
class MartianMicroAnyclosureTarget implements RenderTarget {
  name: "martianmicro-anyclosure"
  engine: undefined                  // no engine needed
  processors: []                     // no own processors
  delegates: [machineBlocksV3ScadTarget]  // full delegation
}
```

---

## Compiler Facade API

`@blockml/compiler` exposes **`compileToOutput`** as the normative Stage-3 entry. See `14_compiler_runtime.md` — Compiler Facade API (C2) · Compile Scope (C7).

```typescript
interface CompileInput {
  source:   string
  filePath: string
  format?:  "xml"
}

interface CompileScope {
  kind: "document" | "library" | "corpus" | "auto"
  document?: CompileInput
  libraries?: string[]
  roots?: string[]
  includeDependencies?: boolean
}

interface CompileRequest {
  scope: CompileScope
  targetOptions?: unknown
}

interface CompileOptions {
  typeRegistry?:    TypeRegistry
  activeConfig?:    string
  outputBasePath?:  string
  mbLibPath?:       string
}

compileBmlToBom(input: CompileInput, options?: CompileOptions): CompilerResult<BomDocument>
compileBomToOutput(model: BomDocument, targetName: string, options?: CompileOptions): CompilerResult<RenderOutput>
compileToOutput(request: CompileRequest, targetName: string, options?: CompileOptions): CompilerResult<RenderOutput>
compileBmlToOutput(input: CompileInput, targetName: string, options?: CompileOptions): CompilerResult<RenderOutput>
// ↑ sugar for compileToOutput({ scope: { kind: "document", document: input } }, …)
```

### CompilerResult

```typescript
interface CompilerResult<T> {
  output:       T | null
  diagnostics:  Diagnostic[]
  success:      boolean
}
```

### RenderOutput

`RenderOutput` is defined by the Render Target, not by the compiler. The compiler treats it as opaque — **no assumption of 1:1 input→output or non-empty files**. See `14_compiler_runtime.md` — Compile I/O Model (C4).

```typescript
// SCAD Target (file-based — MachineBlocks convention)
interface ScadRenderOutput {
  files: ScadFile[]                    // may be [] — side-effect-only compile is valid
  sideEffects?: RenderSideEffect[]     // optional — future / other targets
}

interface ScadFile {
  path:      string
  content:   string
  sourceMap?: string
}
```

A target may also return **side effects without files** (service calls, deploy, registry update). `CompilerResult.success === true` with empty `files[]` is valid.

For preset blocks in the MachineBlocks SCAD target, `files[]` includes the implicit block `.scad`, its `.map`, and the Customizer `.json`. Binary artifacts (`.webp`) are produced by `@blockml/cli` after compile — see `14_compiler_runtime.md` — Thumbnails (C6).

### Browser Usage

```typescript
import { compileToOutput, registerTarget } from "@blockml/compiler";
import { MakerEngine } from "@blockml/engine-maker";
import { MachineBlocksV3ScadTarget } from "@machineblocks/machineblocks-v3-scad-target";

registerTarget(new MachineBlocksV3ScadTarget(new MakerEngine()));

const result = compileToOutput(
  {
    scope: {
      kind: "document",
      document: { source: xmlSource, filePath: "Wall.bml" },
    },
  },
  "machineblocks-v3-scad",
  { typeRegistry: preloadedRegistry }
);

if (result.success) {
  const scad: (result.output as ScadRenderOutput).files[0].content;
} else {
  result.diagnostics.forEach(d: > console.error(d));
}
```

---

## Diagnostics

Every error, warning, and info message produced by the compiler is a `Diagnostic`:

```typescript
interface Diagnostic {
  severity:  "error" | "warning" | "info"
  code:      string        // e.g. "BML_UNKNOWN_TYPE"
  message:   string
  source:    SourceLocation
}

interface SourceLocation {
  file:    string          // BML source file path
  line:    number
  column:  number
}
```

Diagnostics always reference the BML source position — not the generated target output position. Source maps provide the reverse mapping for tooling that needs it.

The compiler never throws exceptions for recoverable errors. All errors are returned as diagnostics in `CompilerResult`. Unrecoverable internal errors (bugs) may throw.

---

## Error Handling

### Recoverable Errors

Reported as diagnostics with `severity: "error"`. Compilation continues where possible to collect all errors in one pass. `result.success` is `false` if any error-level diagnostic exists.

Examples:

```text
BML_UNKNOWN_TYPE              — referenced block type not found
BML_AMBIGUOUS_TYPE            — unqualified type name resolves to multiple candidates
BML_INVALID_PROPERTY          — property value does not match declared type
BML_MISSING_BASE_TYPE         — baseType not declared on a Block definition
BML_MISSING_BLOCK_TYPE        — root block lacks required type
BML_IDENTITY_TYPE_CHILD_ELEMENT — identity <type> or <baseType> uses child element instead of FQN text
BML_BLOCK_NAME_TYPE_MISMATCH  — root block name ≠ last segment of resolve(type)
BML_MISSING_SUBBLOCK_NAME     — Sub-Block lacks required name
BML_SUBBLOCK_TYPE_MISMATCH    — explicit Sub-Block type ≠ resolve(parent.type) + "." + name
BML_EMBEDDED_BLOCKS_ON_SUBBLOCK — Sub-Block declares embeddedBlocks (forbidden on all Sub-Blocks)
BML_NESTED_EMBEDDED_BLOCKS — EmbeddedBlockDefinition declares embeddedBlocks (root-only)
BML_DUPLICATE_EMBEDDED_BLOCK — same FQN appears twice among root embeddedBlocks
BML_DEFINITION_TYPE_MISMATCH  — <definition> FQN incompatible with block role (Sub-Block vs root vs embed)
BML_MISSING_EMBEDDED_BLOCK_TYPE — embedded block lacks required type
BML_UNQUALIFIED_EMBEDDED_BLOCK_TYPE — embedded block type is not fully qualified
BML_INVALID_BLOCK_NAME        — Block name does not match [A-Z][a-zA-Z0-9]*
BML_MISSING_VERSION           — Block definition lacks effective version (no own <version> and not exported via Library)
BML_UNKNOWN_VERSION           — bml:version assert or lookup failed — no matching BlockDefinition in TypeRegistry
BML_VERSION_BELOW_LIBRARY     — block.version < library.version when both declared (error)
BML_LIBRARY_NESTING_VIOLATION  — outer library blocks re-exports a Block exported by a nested inner library
BML_VERSION_MINOR_DRIFT       — block.version minor differs from library.version (warning — best practice: patch only)
BML_MISSING_ID                — referenced instance or bml:each element lacks explicit id
BML_UNRESOLVABLE_INSTANCE_REF — blockId / placeId / FQN::id does not match any explicit id in target aggregation
BML_UNEXPORTED_INSTANCE_REF   — qualified {BlockFQN}::{id} targets an instance in a non-public aggregation
BML_NON_STATIC_INSTANCE_REF   — qualified reference or export target uses Expression instead of literal id/token
BML_EXPRESSION_TYPE_ERROR     — expression result type mismatch
BML_PROPERTY_CYCLE            — circular dependency in computed property value expressions
BML_VISIBILITY_MISMATCH       — visibility attribute or <visibility> element does not match naming convention
BML_VISIBILITY_ON_ROOT_BLOCK  — <visibility> declared on a root Block (Sub-Blocks only)
BML_VISIBILITY_NARROWING      — override reduces visibility (e.g. public → protected)
BML_PRIVATE_MEMBER_ACCESS     — private member used outside declaring Block
BML_PROTECTED_MEMBER_ACCESS   — protected member outside allowed inheritance/composition context
BML_PRIVATE_SUBBLOCK_ACCESS   — private Sub-Block referenced outside declaring Block
BML_PROTECTED_SUBBLOCK_ACCESS — protected Sub-Block outside allowed inheritance context
BML_DUPLICATE_MEMBER_VISIBILITY_VARIANT — members differ only by visibility prefix (normalized name collision)
BML_FINAL_MEMBER_OVERRIDE     — override attempted on final or private member
BML_OVERRIDE_WITHOUT_PARENT   — override="true" but no same-named parent member (normalized logical name)
BML_OVERRIDE_REQUIRED         — local redeclaration merges with baseType or contract member but override omitted
BML_ABSTRACT_MEMBER_NOT_IMPLEMENTED — abstract member on a concrete block (must be explicitly implemented via abstract="false")
BML_READONLY_MEMBER_WRITE     — Block instance sets a member with readOnly=true
BML_STANDALONE_COMPOSITION     — <composition> not nested inside an aggregation member element
BML_UNKNOWN_NAMESPACE_PREFIX  — member element prefix references undeclared xmlns: prefix
BML_NAMESPACE_UNBOUND         — QName emit needs unbound namespace (no namespaceBindings entry — D2)
BML_NAMESPACE_PREFIX_COLLISION — prefix→namespace conflict when merging documents (FatBlock — D2)
BML_XML_DIRECTIVE_NOT_ALLOWED — bml:xml on disallowed host (Stage 1 structural / Stage 2 D4 — 19 hybrid); not flow-control BML_DIRECTIVE_NOT_ALLOWED
BML_XML_RENDERING_INVALID     — <bml:xml> body not an allowed recipe (literal | ${ bml:Self } | ${ #this.name } — Stage 1 D6)
BML_OUTSIDE_BML_NAMESPACE — Block FQN, xmlns binding, or Library export is outside <domain>.bml.*
BML_DEPRECATED_MEMBER_NAMESPACE_ATTR — legacy namespace="…" attribute on member element
BML_PRESET_CYCLE              — circular dependency in basePresets chain
BML_UNKNOWN_CONTRACT          — contract Block FQN not in TypeRegistry
BML_CONTRACT_NOT_ON_ROOT      — <contracts> declared on a Sub-Block
BML_DUPLICATE_CONTRACT        — same contract Block referenced twice
BML_CONTRACT_MEMBER_KIND_MISMATCH — override uses a different member kind than merged member
BML_GENERIC_CONSTRAINT_VIOLATION  — generic type argument fails satisfiesTypeBound
BML_GENERIC_DEFAULT_FORWARD_REF   — defaultType names a later or unknown generic parameter
BML_GENERIC_DEFAULT_CYCLE         — defaultType reference graph contains a cycle
BML_GENERIC_DEFAULT_UNRESOLVED    — defaultType chain does not ground to a concrete type
BML_TYPE_BOUND_NOT_SATISFIED      — type reference fails satisfiesTypeBound
BML_SUGGESTIONS_ON_ENUM       — <suggestions> declared on an enum-type property
BML_CONSTRAINT_UNKNOWN        — constraint Block type not in TypeRegistry or not a Constraint sub-type
BML_CONSTRAINT_TYPE_MISMATCH  — constraint generic T incompatible with bound target type
BML_CONSTRAINT_TARGET_MISMATCH — constraint branch incompatible with embedding context
BML_CONSTRAINT_VALUE_MISMATCH — constraint instance property value incompatible with bound generic T
BML_VALIDATION_UNKNOWN        — validation Block type not in TypeRegistry or not a Validation sub-type
BML_CONSTRAINT_VIOLATION      — constraint rule fails with validation="Error"
BML_CONSTRAINT_WARNING        — constraint rule fails with validation:Warning
BML_CONSTRAINT_INFORMATION    — constraint rule fails with validation:Information
BML_SUGGESTION_TYPE_MISMATCH  — suggestion instance incompatible with property type (e.g. Text instead of TextEntity)
BML_CARDINALITY_VIOLATION     — aggregation occurrence constraint not satisfied (type notation)
BML_DUPLICATE_MEMBER_NAME     — member name used more than once in a block
BML_INVALID_PROPERTY_TYPE     — property or Capability type is not a ValueType
BML_UNKNOWN_BEAN              — @bean reference not found in aggregations
BML_CAPABILITY_LINK_MISMATCH  — capability linking: direction or inputType/outputType mismatch
BML_UNKNOWN_FUNCTION_PARAMETER — named capability call parameter not a StructType property
BML_DUPLICATE_FUNCTION_PARAMETER — duplicate named parameter in capability call
BML_MISSING_FUNCTION_PARAMETER — required struct property missing in capability call
BML_TOO_MANY_FUNCTION_PARAMETERS — excess positional parameters for inputType
BML_MIXED_FUNCTION_ARGUMENTS   — positional and named parameters mixed (default FunctionMapping)
BML_MIXED_TYPE_CONFIGURATION     — positional and named arguments mixed in ValueType {…} configuration
BML_UNKNOWN_TYPE_CONFIGURATION   — configuration key or positional index not a ValueType Property
BML_TYPE_CONFIGURATION_VIOLATION — configuration value incompatible with target Property type
BML_DUPLICATE_TYPE_CONFIGURATION — same ValueType Property configured twice
BML_PREFER_TYPE_CONFIGURATION    — constraint duplicates an available ValueType configuration Property (hint)
BML_MISSING_GENERIC_TYPE_ARGUMENT — generic application missing required type argument (e.g. bare Constant)
BML_MISSING_CONSTANT_VALUE       — Constant(T) reference without required {value: …} configuration
BML_CONSTANT_VALUE_MISMATCH      — Constant configured value incompatible with bound type T
BML_PREFER_CONSTANT_TYPE         — union literal alternative should desugar to Constant(T){value: …} (hint)
BML_UNREACHABLE_UNION_ALTERNATIVE — union alternative subsumed by an earlier alternative under left-to-right match (warning)
BML_MISSING_FUNCTION_MAPPING   — implementation requires FunctionMapping but none declared
BML_AMBIGUOUS_FUNCTION_MAPPING — capability call form maps ambiguously to inputType
BML_NO_TARGET                 — no registered target supports the block's baseType
BML_UNKNOWN_TARGET            — requested target name not registered
BML_FUNCTION_MISSING_MAIN     — no function named after the Capability found in CDATA
BML_FUNCTION_DUPLICATE_MAIN   — more than one function matches the Capability name
BML_IMPLEMENTATION_UNKNOWN_LANGUAGE — <implementation language="..."> is not a known org.blockml.bml.language.* FQN
BML_FUNCTION_NO_RUNTIME_IMPL  — Transformation Capability called with non-literal args but no runtime impl
BML_DUPLICATE_GENERIC           — duplicate generic parameter name on root Block
BML_GENERIC_BLOCK_NAME_COLLISION — generic parameter element name equals the declaring Block's <name>
BML_GENERIC_SUBBLOCK_NAME_COLLISION — generic parameter element name equals a direct Sub-Block <name> of the declaring Block
BML_GENERIC_DEFAULT_FORWARD_REF — defaultType names a later or unknown generic parameter
BML_GENERIC_DEFAULT_CYCLE — defaultType reference graph contains a cycle
BML_GENERIC_DEFAULT_UNRESOLVED — defaultType chain does not ground to a concrete type
BML_UNQUALIFIED_BLOCK_REFERENCE — bare block reference without FQN or xmlns prefix at a general reference site (composition tag, baseType, aggregation/association type)
BML_SUBBLOCK_QUALIFIED_REFERENCE_REQUIRED — Sub-Block shares root Block name; bare short tag is ambiguous
BML_UNCLOSED_EMBEDDED_EXPRESSION — <$ in implementation CDATA without matching $>
BML_INVALID_EMBEDDED_EXPRESSION — nested or malformed <$ $> region in implementation
BML_UNKNOWN_CAPABILITY — Capability referenced in embedded expression does not exist
BML_UNKNOWN_SERVICE — #namespace in embedded expression is not a registered built-in service
```

### Warnings

Reported as diagnostics with `severity: "warning"`. Compilation succeeds. `result.success` may still be `true`.

Examples:

```text
BML_UNKNOWN_PROPERTY   — property not defined on block type (custom property assumed)
BML_UNKNOWN_DIRECTIVE  — unrecognized bml:* attribute name (always error)
BML_DIRECTIVE_NOT_ALLOWED — known bml:* directive on disallowed element (always error)
BML_XML_DIRECTIVE_NOT_ALLOWED — bml:xml misplaced / illegal host (Stage 1 structural or Stage 2 D4 — 19 hybrid)
BML_XML_RENDERING_INVALID — illegal <bml:xml> recipe body (Stage 1 — 19 D6)
BML_NAMESPACE_UNBOUND — missing xmlns binding for QName emit (see 19 D2)
BML_NAMESPACE_PREFIX_COLLISION — conflicting prefix bindings on merge (FatBlock)
BML_DEPRECATED_TYPE    — referenced type is deprecated
BML_UNREACHABLE_UNION_ALTERNATIVE — later union alternative subsumed under left-to-right match
```

---

## Capability Implementation Transpilation

A `utility Sub-Block` Sub-Block binds target-language implementations to Transformation Capabilities via `<implementation language="...">` — using **`org.blockml.bml.language.*`** FQNs.

Two implementation languages are supported in V1:

**`language="org.blockml.bml.language.OpenSCAD"`** — OpenSCAD function(s) written directly in the BML. The compiler prefixes all function names with the block FQN.

**`language="org.blockml.bml.language.TypeScript"`** — TypeScript arrow function. Compile-time execution only (V1): when all arguments at the call site are literals, the compiler executes the TS function in Node.js and emits the result as a literal. Runtime transpilation to OpenSCAD is deferred (requires LLM or dedicated transpiler).

### SCAD Implementation Rules

Each Capability has exactly one `<implementation>` block. The implementation contains:

```text
- Exactly one main function whose name matches the Capability name
- Zero or more helper functions with any names
- Optional BML Embedded Expressions (<$ … $>) for language-neutral Capability references
- All function names are replaced by the compiler with the block-FQN-prefixed form
```

**BML Embedded Expressions:** BlockML Capability calls inside implementation source use `<$ … $>` delimiters — not raw `#built-in` or FQN-prefixed target calls in author source. See `10_expression_language.md` — BML Embedded Expressions.

**Name replacement:** The processor scans the CDATA for all `function <name>(` declarations — these are the names to replace. All occurrences (declarations + calls) are replaced via regex. Embedded expression regions are resolved **before** name replacement on the surrounding target-language text:

```text
formatValue    → mb__com__machineblocks__scad__calibration__Calibrator__Utils__formatValue
replaceZeroDot → mb__com__machineblocks__scad__calibration__Calibrator__Utils__replaceZeroDot
```

**Embedded expression resolution in SCAD CDATA:** `#math.*`, `#strings.*`, `#this.*`, and `@bean.*` inside `<$ $>` are parsed as BlockML expressions and mapped to SCAD by the renderer. The author never writes raw SCAD FQN calls or service import paths:

```scad
// Author writes:
function formatValue(x) =
    replaceZeroDot(str(<$ #math.round_n(x, 1) $>));

// Renderer emits (after embedded substitution + FQN prefixing):
function mb__...__Utils__formatValue(x) =
    mb__...__Utils__replaceZeroDot(str(bom__org__blockml__service__Math__round_n(x, 1)));
// + adds: use <.../blocks/org/blockml/bml/service/Math.scad>
```

**Example:**

```xml
<capability name="formatValue"
            type="org.blockml.bml.capability.Transformation"
            inputType="org.blockml.bml.type.Float"
            outputType="org.blockml.bml.type.Text">
  <implementation language="org.blockml.bml.language.OpenSCAD"><![CDATA[
// Main function — name matches capability name
function formatValue(x) =
    replaceZeroDot(str(<$ #math.round_n(x, 1) $>));

// Helper functions
function replaceZeroDot(s, i = 0) =
    (i >= len(s) - 1) ? s :
    (s[i] == "0" && s[i + 1] == ".")
        ? str(strPrefix(s, i), ".", replaceZeroDot(strSuffix(s, i + 2), 0))
        : replaceZeroDot(s, i + 1);

function strPrefix(s, k, i = 0) =
    (i >= k) ? "" : str(s[i], strPrefix(s, k, i + 1));

function strSuffix(s, k, i = 0) =
    (k + i >= len(s)) ? "" : str(s[k + i], strSuffix(s, k, i + 1));
  ]]></implementation>
</capability>
```

**Validation errors:**

```text
BML_FUNCTION_MISSING_MAIN    — no function named after the Capability found in CDATA
BML_FUNCTION_DUPLICATE_MAIN  — more than one function matches the Capability name
BML_IMPLEMENTATION_UNKNOWN_LANGUAGE — language attribute is not a known org.blockml.bml.language.* FQN
```

### Built-in Services — No Processor Needed

Built-in Services (`#math`, `#strings`, etc.) are defined as BML service Blocks in `node_modules/@blockml/core` (SSOT). Their SCAD equivalents live in `node_modules/@machineblocks/core/blocks/org/blockml/bml/service/` as pre-rendered artifacts:

```text
FQN:  org.blockml.bml.service.Math  →  node_modules/@machineblocks/core/blocks/org/blockml/bml/service/Math.scad
```

`Math.scad` example:

```scad
function bom__com__bom__service__Math__min(a, b) = min(a, b);
function bom__com__bom__service__Math__max(a, b) = max(a, b);
function bom__com__bom__service__Math__round_n(x, n) = round(x * pow(10, n)) / pow(10, n);
function bom__com__bom__service__Math__floor(x) = floor(x);
function bom__com__bom__service__Math__ceil(x) = ceil(x);
function bom__com__bom__service__Math__abs(x) = abs(x);
function bom__com__bom__service__Math__clamp(x, lo, hi) = min(max(x, lo), hi);
```

The ScadBlockProcessor automatically adds `use` imports for each service file that the Block's expressions reference — no separate service processor needed.

### Future: LLM-Based Implementation

In V1, an Entity Sub-Block without a matching `<implementation language="org.blockml.bml.language.OpenSCAD">` for the SCAD target produces a `BML_FUNCTION_NO_RUNTIME_IMPL` error if called with non-literal arguments.

The natural next step is the LLM Engine: given the Capability signature (name, inputType, outputType) and its `<documentation>`, the LLM generates a correct target-language implementation. No `<implementation>` block needed:

```xml
<!-- Future: LLM generates implementation from signature + documentation -->
<capability name="formatValue"
            type="org.blockml.bml.capability.Transformation"
            inputType="org.blockml.bml.type.Float"
            outputType="org.blockml.bml.type.Text">
  <documentation>
    Formats a float by removing the leading zero before the decimal point.
    Examples: 0.1 → ".1"   -0.2 → "-.2"   3.0 → "3.0"
  </documentation>
  <!-- No <implementation> — LLM Engine generates it -->
</capability>
```

This also applies to `org.blockml.bml.language.TypeScript` → target transpilation: TS → OpenSCAD, TS → Python, TS → Java are all LLM tasks. The `<implementation language="org.blockml.bml.language.TypeScript">` then becomes the LLM's input spec rather than a directly executable artifact.

The Capability documentation is therefore not just for humans — it is a primary input for the LLM compiler. Well-written documentation directly improves generated implementation quality.

---

## Incremental Build

The CLI supports incremental builds — skipping compilation (and thumbnail generation) when hash inputs are unchanged. Applies to `bom compile --all`, single-file `bom compile`, and `bom watch`. Full specification: `14_compiler_runtime.md` — Incremental Build (C5).

### Strategy

Every output artifact has a canonical input set. Before work begins, the CLI computes `SHA-256(canonicalJSON(inputs))` and compares it to `.bom-cache/<output-path>.hash`. Match → skip. `--force` bypasses the cache.

Cache key is the **output path** — implicit and direct compiles of the same block share one `.scad.hash` file.

### Hash inputs (summary)

```text
Wall.scad
  - Wall.bml content hash
  - external BlockInstance refs (typeFqn + version), sorted
  - activeConfig profile hash (or null)
  - target + compiler package versions

Wall.json
  - WallPresets.bml content hash
  - stored Wall.scad hash (cascade)
  - activeConfig, target, compiler versions

Wall__brick-2x4.webp
  - stored Wall.json + Wall.scad hashes
  - OpenSCAD version
  - thumbnailPipelineVersion: "1"
```

### --all Behavior

```text
<block>        → Block compile    (hash check → skip if unchanged)
<block> (preset block) → implicit .scad   (same hash key as direct block compile)
               → Presets .json    (hash check → skip if unchanged)
               → thumbnails       (per-preset hash check)
```

Every file in `srcDir` is evaluated. Shared output paths deduplicate work via the cache.

### Hash Storage

```text
.bom-cache/
  com/martianmicro/anyclosure/
    Wall.scad.hash              →  sha256:<hex>
    Wall.json.hash
    Wall__brick-2x4.webp.hash
```

Mirror `outDir` structure. Add `.bom-cache/` to `.gitignore`. Implemented in `@blockml/cli` as `incrementalBuild.ts`.

---

## Source Maps

The compiler (via the Render Target) generates a Source Map V3 file alongside each output file:

```text
Wall.scad      — generated SCAD
Wall.scad.map  — Source Map V3
```

The source map records the BML source file path, line, and column for every generated output line. This allows:

```text
- Compiler diagnostics to reference BML source positions
- Editor tooling to navigate from generated output back to BML
- Debugging to stay in the BML authoring context
```

Source Map V3 is used as the format. It is language-agnostic and has established tooling support. Practical applicability to SCAD output is to be verified.

---

## Extension Mechanism

BML is **universal**: the only document root is `<block>`. Domains extend the system by registering **types**, **libraries**, and **Render Targets** — not by new root element names.

```text
1. Domain Block types / packages (BML corpus under a domain FQN)
2. Optional domain XSD(s) for allowed-type vocabularies (alongside universal block.xsd)
3. One or more Render Targets (or reuse an existing one)
```

Legacy idea of alternate roots (`<device>`, `<sign>`, …) is **withdrawn**. Parser registration is for **targets and type packages**, not multiple document roots:

```typescript
import { registerTarget } from "@blockml/compiler";

registerTarget(new MachineBlocksScadTarget());
// Domain schemas: produced by XSD Render Target / published under domain schema URLs
```

---

## Testing Strategy

> **V1 gate (before compiler):** Roundtrip tests (`parse → serialize → parse`) against the existing BML corpus are the first integration milestone. See `15_dev_setup.md` — V1 Implementation Strategy.

### Test Layer A — Roundtrip Tests (V1 gate)

Prove the language layer before validator, compiler, or render targets exist.

```text
Input:    BML source files from repository corpus (T0–T3 tiers)
Test:     parse → serialize → parse; BomDocument deep equality modulo provenance (B20 — strip source spans)
Tool:     Vitest — tests/roundtrip/
Gate:     Phase C (compiler, targets, CLI compile) must not start until roundtrip passes
```

Coverage:

```text
  - Lossless BML → BOM mapping (structure, members, raw expression text)
  - Document-order preservation in members[]
  - Namespace and FQN resolution stored correctly
  - Serializer inverse of 13_bml_to_bom_mapping.md (V1 hardcoded; meta-serializer deferred)
```

Does **not** require: TypeRegistry bootstrap, validator, SCAD output, or compiler facade.

### Test Layer B — Correctness Tests

Manual verification tests that ensure the compiler produces semantically correct output.

```text
Input:    BML source file (hand-authored)
Expected: Reference output file (manually verified against the target library)
Test:     byte-for-byte or normalized diff

Coverage (SCAD target):
  - Block definition → SCAD module
  - Composite block → nested mb_block() calls
  - MachineBlocks Set definition → STEPS + view submodules
  - Preset blocks (_presets) → Customizer JSON (render target)
  - Expressions → correct SCAD expressions
  - Assembly patterns → correct mb_assembly_*() calls
  - Config profile → correct parameter defaults
  - Preset + inline override → correct merge
```

Correctness tests are the authoritative definition of correct compiler behavior. They are written and verified before snapshot tests are created.

### Test Layer C — Snapshot Tests (Regression)

Snapshot tests detect unintended changes to compiler output after the correctness baseline is established.

```text
Tool:       Jest or Vitest (--updateSnapshot flag)
Input:      same BML source files as correctness tests
Snapshot:   the verified correct output from Test Layer B
Test:       current output vs. stored snapshot (diff)

Behavior:
  - Test fails if output changes unexpectedly
  - Snapshots are updated intentionally when a change is correct
  - Snapshots are committed to the repository
```

### Test File Organization

```text
tests/
  roundtrip/                 — V1 gate: parse → serialize → parse (see 15_dev_setup.md)
  correctness/
    wall/
      Wall.bml            — input
      Wall.expected.scad  — manually verified reference
    corner/
      Corner.bml
      Corner.expected.scad
    set/
      DefaultEnclosureSet.bml
      DefaultEnclosureSet.expected.scad
    presets/
      presets/StandardPresets.bml   — @machineblocks/core fixture (preset block)
      Library.bml                   — @machineblocks/core fixture (Library)
      Standard.expected.json

  snapshots/
    wall/
      Wall.scad.snap
    corner/
      Corner.scad.snap
    ...
```

### Test Execution Order

```text
0. Roundtrip tests run first (V1 gate — before compiler exists)
1. Correctness tests run first (after compiler + targets exist)
2. If all correctness tests pass, snapshot tests run
3. A failing correctness test blocks snapshot comparison
```
