# BOM Compiler — Compiler Pipeline

version: 2.0.0

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
@blockml/parser                              — parse BML → BOM
@blockml/core                                — BOM object model, validation
@blockml/compiler                            — Facade + Target Registry
@blockml/core-services                       — built-in ServiceBlock BML definitions
@blockml/engine-maker                        — V1 CompilerEngine implementation (MakerEngine)
@machineblocks/machineblocks-v3-scad-target  — RenderTarget + BlockProcessors
```

`@blockml/parser`, `@blockml/core`, `@blockml/compiler`, and `@blockml/engine-maker` are browser and Node compatible. No Node-only APIs in any of these packages. RenderTarget packages follow the same constraint.

---

## Compiler Pipeline

```text
BML Source (.bml / .mbml)           — V1: XML only; JSON BML deferred (TBD)
  ↓
[1] Format Detector
  ↓
[2] XML Parser / JSON Parser
  ↓
[3] Root Type Resolver
  ↓
[4] Namespace Resolver
  ↓
[5] BML → BOM Mapper
  ↓
[6] Type Validator
  ↓
[7] Expression Parser
  ↓
[8] Semantic Validator
  ↓
BOM
  ↓
[9] Target Resolver
  ↓
[10] Block Renderer Dispatch
  ↓
[11] Module Name Resolver        (domain-specific)
  ↓
[12] Import Resolver             (domain-specific)
  ↓
[13] Property Renderer           (domain-specific)
  ↓
[14] Expression Renderer         (domain-specific)
  ↓
[15] Assembly Pattern Mapper     (domain-specific, MachineBlocks SCAD)
  ↓
[16] Composition Renderer        (domain-specific)
  ↓
[17] Set Renderer                (domain-specific, if baseType ⊆ com.machineblocks.core.Set)
  ↓
[18] Customizer Generator        (domain-specific)
  ↓
[19] Source Map Generator        (domain-specific)
  ↓
Target Output File(s) + Source Map(s)
```

Stages 1–8 are universal — implemented in `@blockml/parser` and `@blockml/core`. Stages 9–19 are Target-specific — implemented in the registered Render Target package.

---

## Pipeline Stages

### [1] Format Detector

V1 accepts **XML only** (`.bml`, domain extensions such as `.mbml`). Detects XML from the first non-whitespace character (`<`).

JSON BML authoring is deferred (TBD). When implemented, the format detector will branch on `{` vs. `<`.

### [2] XML Parser

Parses the raw XML source into an intermediate document tree. Browser-compatible parsers only.

JSON parser: **not in V1.**

### [3] Root Type Resolver

Reads the root element name to determine the document type:

```text
<block>        → Block Definition
<blockPresets> → Block Presets
```

Selects the appropriate BML→BOM mapping rule for this root type. Extension root types register their mapping rule via the root type registry.

### [4] Namespace Resolver

Resolves all xmlns prefix mappings to FQNs:

```text
xmlns:ac="com.martianmicro.anyclosure"
ac:Wall  →  com.martianmicro.anyclosure.Wall
```

The resolved FQN is used throughout the rest of the pipeline.

### [5] BML → BOM Mapper

Maps the parsed document tree to BOM objects using the mapping rule for the detected root type. Expression `${ }` spans are captured as `ExpressionValue { raw }` only — AST construction is deferred to stage [7]. See `13_bml_to_bom_mapping.md`.

```text
XML attribute        →  BOM property value (literal or ExpressionValue { raw })
XML child element    →  BOM composition child instance or aggregation metadata
```

Mapping rules are defined once per root type and apply uniformly to all documents of that type. They are configurable and extensible.

### [6] Type Validator

Validates all BOM member values against their declared types. For MBOM: native property types from `09_mbom_properties.yml`, custom property types from the block definition.

Errors at this stage reference the BML source position via the source map.

### [7] Expression Parser

Walks the stage-[5] `BomDocument` and enriches all `ExpressionValue` nodes: parses `raw` into typed **`ExpressionNode`** AST trees. See `10_expression_language.md` — Expression AST and `13_bml_to_bom_mapping.md` — Expression Parsing.

Each enriched `ExpressionValue` carries:

```text
- raw source text           (from stage [5])
- root ExpressionNode       (added in stage [7])
- resultTypeFqn             (initial inference in stage [7])
- source position           (from stage [5])
```

Expressions are **not evaluated** at this stage.

Recognized expression forms (see `00_bom_core.md` — Expression System):

```text
${ myProperty }                             — property access
${ myProperty.x }                           — attribute access
${ #builtIn.capa(args) }                    — built-in ServiceBlock call
${ @bean.capa(args) }                       — user Bean call
${ @bean.outbound }                         — capability linking
${ @model:/path }                           — absolute model binding
${ @model:relPath }                         — relative model binding
${ condition ? valueA : valueB }            — ternary
${ a + b - 1 }                             — arithmetic
```

### [8] Semantic Validator

Validates the BOM graph for semantic correctness:

```text
- Cross-instance references resolve to explicit authored id (blockId, placeId)
- bml:each elements have explicit id
- Referenced block types exist at the **exact pinned version** (no implicit latest)
- Composition child member values are valid for the referenced block type
- Aggregation cardinality constraints are satisfied
- Expression result types match the target member type
- @bean references resolve to declared Aggregations
- Capability linking: source must be Outbound, target must be Inbound, payload types must match
- Model binding: relative paths only used where a binding context exists
- Member namespace uniqueness: no duplicate names across Properties, Aggregations, Associations, Capabilities
```

### [9] Target Resolver

Looks up the requested Target by name in the Target Registry. Verifies that the Target supports the `baseType` of every Block in the BOM document. If no registered Target supports a Block's `baseType`, a diagnostic error is emitted for that Block.

For Composite Targets: resolves the responsible Atomic Target per Block and validates accordingly.

### [10] Directive Expansion and ID Resolution

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

RenderTargets must be registered before compilation reaches stage [9]:

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

Future: CLI reads `bom.config.json` → `targets[]` (TBD — not V1). See C3 in `14_compiler_runtime.md`.

### Interfaces

```typescript
interface RenderTarget {
  name:       string
  engine?:    RenderEngine
  processors: BlockProcessor[]
  delegates:  RenderTarget[]
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
  name = "machineblocks-v3-scad"
  engine = new MakerEngine()

  processors = [
    new ScadSetProcessor(),           // compile strategy — more specific
    new ScadBlockProcessor(),         // compile strategy — baseType fallback
    new MathBuiltInProcessor(),       // copy strategy
    new FunctionBlockProcessor()      // compile strategy (TS → SCAD)
  ]

  delegates = []
}
```

### Delegate-Only Target Example

```typescript
class MartianMicroAnyclosureTarget implements RenderTarget {
  name = "martianmicro-anyclosure"
  engine = undefined                  // no engine needed
  processors = []                     // no own processors
  delegates = [machineBlocksV3ScadTarget]  // full delegation
}
```

---

## Compiler Facade API

`@blockml/compiler` exposes three public functions. See `14_compiler_runtime.md` — Compiler Facade API (C2) for full specification.

```typescript
interface CompileInput {
  source:   string
  filePath: string
  format?:  "xml"          // V1: xml only
}

interface CompileOptions {
  typeRegistry?:    TypeRegistry
  activeConfig?:    string
  outputBasePath?:  string
  mbLibPath?:       string
}

compileBmlToBom(input: CompileInput, options?: CompileOptions): CompilerResult<BomDocument>
compileBomToOutput(model: BomDocument, targetName: string, options?: CompileOptions): CompilerResult<RenderOutput>
compileBmlToOutput(input: CompileInput, targetName: string, options?: CompileOptions): CompilerResult<RenderOutput>
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

For `<blockPresets>` in the MachineBlocks SCAD target, `files[]` includes the implicit block `.scad`, its `.map`, and the Customizer `.json`. Binary artifacts (`.webp`) are produced by `@blockml/cli` after compile — see `14_compiler_runtime.md` — Thumbnails (C6).

### Browser Usage

```typescript
import { compileBmlToOutput, registerTarget } from "@blockml/compiler";
import { MakerEngine } from "@blockml/engine-maker";
import { MachineBlocksV3ScadTarget } from "@machineblocks/machineblocks-v3-scad-target";

registerTarget(new MachineBlocksV3ScadTarget(new MakerEngine()));

const result = compileBmlToOutput(
  { source: xmlSource, filePath: "Wall.bml" },
  "machineblocks-v3-scad",
  { typeRegistry: preloadedRegistry }
);

if (result.success) {
  const scad = (result.output as ScadRenderOutput).files[0].content;
} else {
  result.diagnostics.forEach(d => console.error(d));
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
BML_INVALID_PROPERTY          — property value does not match declared type
BML_MISSING_BASE_TYPE         — baseType not declared on a Block definition
BML_INVALID_BLOCK_NAME        — Block name does not match [A-Z][a-zA-Z0-9]*
BML_MISSING_VERSION           — version missing on external block instance reference (always error)
BML_UNKNOWN_VERSION           — version specified but no matching BlockDefinition in TypeRegistry
BML_MISSING_ID                — referenced instance or bml:each element lacks explicit id
BML_UNRESOLVABLE_INSTANCE_REF — blockId / placeId does not match any explicit id in target aggregation
BML_EXPRESSION_TYPE_ERROR     — expression result type mismatch
BML_PROPERTY_CYCLE            — circular dependency in computed defaultValue expressions
BML_PRESET_CYCLE              — circular dependency in composite preset basePresets
BML_SUGGESTIONS_ON_ENUM       — <suggestions> declared on an enum-type property
BML_CARDINALITY_VIOLATION     — aggregation cardinality not satisfied
BML_DUPLICATE_MEMBER_NAME     — member name used more than once in a block
BML_UNKNOWN_BEAN              — @bean reference not found in aggregations
BML_CAPABILITY_LINK_MISMATCH  — capability linking: direction or payload mismatch
BML_NO_TARGET                 — no registered target supports the block's baseType
BML_UNKNOWN_TARGET            — requested target name not registered
BML_FUNCTION_MISSING_MAIN     — no function named after the Capability found in CDATA
BML_FUNCTION_DUPLICATE_MAIN   — more than one function matches the Capability name
BML_IMPLEMENTATION_UNKNOWN_TYPE — <implementation type="..."> is not a known org.blockml.language.* FQN
BML_FUNCTION_NO_RUNTIME_IMPL  — Sync Capability called with non-literal args but no runtime impl
BML_IMPLEMENTATION_NOT_SUPPORTED — <implementation type="..."> not listed in baseType supportedImplementationTypes
```

### Warnings

Reported as diagnostics with `severity: "warning"`. Compilation succeeds. `result.success` may still be `true`.

Examples:

```text
BML_UNKNOWN_PROPERTY   — property not defined on block type (custom property assumed)
BML_UNKNOWN_DIRECTIVE  — unrecognized bml:* attribute name (always error)
BML_DIRECTIVE_NOT_ALLOWED — known bml:* directive on disallowed element (always error)
BML_CUSTOM_DATA_NOT_ALLOWED — data:* on non-Block element (always error)
BML_DEPRECATED_TYPE    — referenced type is deprecated
```

---

## FunctionBlock Transpilation

A `FunctionBlock` Sub-Block binds target-language implementations to Sync Capabilities via `<implementation type="...">` — using **`org.blockml.language.*`** FQNs.

Two implementation types are supported in V1:

**`type="org.blockml.language.OpenSCAD"`** — OpenSCAD function(s) written directly in the BML. The compiler prefixes all function names with the block FQN.

**`type="org.blockml.language.TypeScript"`** — TypeScript arrow function. Compile-time execution only (V1): when all arguments at the call site are literals, the compiler executes the TS function in Node.js and emits the result as a literal. Runtime transpilation to OpenSCAD is deferred (requires LLM or dedicated transpiler).

### SCAD Implementation Rules

Each Capability has exactly one `<implementation>` block. The implementation contains:

```text
- Exactly one main function whose name matches the Capability name
- Zero or more helper functions with any names
- All function names are replaced by the compiler with the block-FQN-prefixed form
```

**Name replacement:** The processor scans the CDATA for all `function <name>(` declarations — these are the names to replace. All occurrences (declarations + calls) are replaced via regex:

```text
formatValue    → mb__com__machineblocks__calibration__Calibrator__Utils__formatValue
replaceZeroDot → mb__com__machineblocks__calibration__Calibrator__Utils__replaceZeroDot
strPrefix      → mb__com__machineblocks__calibration__Calibrator__Utils__strPrefix
strSuffix      → mb__com__machineblocks__calibration__Calibrator__Utils__strSuffix
```

**`#built-in` calls in SCAD CDATA:** `#math.*`, `#strings.*` etc. are resolved inside CDATA blocks using the same native mapping logic as in BML expressions. The author never writes raw SCAD FQN calls:

```scad
// Author writes:
function formatValue(x) =
    replaceZeroDot(str(#math.round_n(x, 1)));

// Compiler emits:
function mb__...__Utils__formatValue(x) =
    mb__...__Utils__replaceZeroDot(str(bom__org__blockml__service__Math__round_n(x, 1)));
// + adds: use <.../blocks/org/blockml/service/Math.scad>
```

**Example:**

```xml
<capability name="formatValue"
            type="org.blockml.capability.Sync"
            payloadType="org.blockml.type.Float"
            returnType="org.blockml.type.String">
  <implementation type="org.blockml.language.OpenSCAD"><![CDATA[
// Main function — name matches capability name
function formatValue(x) =
    replaceZeroDot(str(bom__com__bom__service__Math__round_n(x, 1)));

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
BML_IMPLEMENTATION_UNKNOWN_TYPE — type attribute is not a known org.blockml.language.* FQN
```

### Built-in Services — No Processor Needed

Built-in Services (`#math`, `#strings`, etc.) are defined as BML FunctionBlocks in `@blockml/core-services` (SSOT). Their SCAD equivalents live in `scad-lib/blocks/org/blockml/service/` as pre-rendered artifacts:

```text
FQN:  org.blockml.service.Math  →  scad-lib/blocks/org/blockml/service/Math.scad
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

The ScadBlockProcessor automatically adds `use` imports for each service file that the Block's expressions reference — no separate ServiceBlock Processor needed.

### Future: LLM-Based Implementation

In V1, a FunctionBlock without a matching `<implementation type="org.blockml.language.OpenSCAD">` for the SCAD target produces a `BML_FUNCTION_NO_RUNTIME_IMPL` error if called with non-literal arguments.

The natural next step is the LLM Engine: given the Capability signature (name, payloadType, returnType) and its `<documentation>`, the LLM generates a correct target-language implementation. No `<implementation>` block needed:

```xml
<!-- Future: LLM generates implementation from signature + documentation -->
<capability name="formatValue"
            type="org.blockml.capability.Sync"
            payloadType="org.blockml.type.Float"
            returnType="org.blockml.type.String">
  <documentation>
    Formats a float by removing the leading zero before the decimal point.
    Examples: 0.1 → ".1"   -0.2 → "-.2"   3.0 → "3.0"
  </documentation>
  <!-- No <implementation> — LLM Engine generates it -->
</capability>
```

This also applies to `org.blockml.language.TypeScript` → target transpilation: TS → OpenSCAD, TS → Python, TS → Java are all LLM tasks. The `<implementation type="org.blockml.language.TypeScript">` then becomes the LLM's input spec rather than a directly executable artifact.

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
<blockPresets> → implicit .scad   (same hash key as direct block compile)
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

The compiler supports extension root types (e.g. `<device>`) without modifying the core. Extensions register:

```text
1. A root type name  (e.g. "device")
2. A BML→BOM mapping rule
3. A Render Target (or reuse an existing one)
4. A schema (XSD or JSON Schema)
```

Root type registration:

```typescript
import { registerRootType } from "@blockml/parser";

registerRootType({
  name:    "device",
  mapper:  deviceBmlToBomMapper,
  schema:  deviceXsdUrl
});
```

Target registration:

```typescript
import { registerTarget } from "@blockml/compiler";

registerTarget(new DeviceTarget());
```

---

## Testing Strategy

### Stage 1 — Correctness Tests

Manual verification tests that ensure the compiler produces semantically correct output.

```text
Input:    BML source file (hand-authored)
Expected: Reference output file (manually verified against the target library)
Test:     byte-for-byte or normalized diff

Coverage (SCAD target):
  - Block definition → SCAD module
  - Composite block → nested mb_block() calls
  - MachineBlocks Set definition → STEPS + view submodules
  - blockPresets → Customizer JSON
  - Expressions → correct SCAD expressions
  - Assembly patterns → correct mb_assembly_*() calls
  - Config profile → correct parameter defaults
  - Preset + inline override → correct merge
```

Correctness tests are the authoritative definition of correct compiler behavior. They are written and verified before snapshot tests are created.

### Stage 2 — Snapshot Tests (Regression)

Snapshot tests detect unintended changes to compiler output after the correctness baseline is established.

```text
Tool:       Jest or Vitest (--updateSnapshot flag)
Input:      same BML source files as correctness tests
Snapshot:   the verified correct output from Stage 1
Test:       current output vs. stored snapshot (diff)

Behavior:
  - Test fails if output changes unexpectedly
  - Snapshots are updated intentionally when a change is correct
  - Snapshots are committed to the repository
```

### Test File Organization

```text
tests/
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
      StandardBrickPresets.mbml   — MachineBlocks library fixture (legacy .mbml)
      StandardBrick.expected.json

  snapshots/
    wall/
      Wall.scad.snap
    corner/
      Corner.scad.snap
    ...
```

### Test Execution Order

```text
1. Correctness tests run first
2. If all correctness tests pass, snapshot tests run
3. A failing correctness test blocks snapshot comparison
```
