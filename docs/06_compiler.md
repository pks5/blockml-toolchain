# BOM Compiler — Compiler Pipeline

version: 2.0.0

## Purpose of this Document

This document defines the compiler pipeline — the full translation path from BML source to render target output — including the Target Registry, error handling, diagnostics, and the testing strategy.

For the BML format see `02_mbml.md`.
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
BML Source (.mbml or .json)
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

Detects whether the input is XML or JSON based on the first non-whitespace character. Selects the appropriate parser.

### [2] XML Parser / JSON Parser

Parses the raw source into an intermediate document tree. Browser-compatible parsers only.

### [3] Root Type Resolver

Reads the root element name (XML) or `type` field (JSON) to determine the document type:

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

Maps the parsed document tree to BOM objects using the mapping rule for the detected root type.

```text
XML attribute        →  BOM property value
XML child element    →  BOM composition child instance or aggregation metadata
```

Mapping rules are defined once per root type and apply uniformly to all documents of that type. They are configurable and extensible.

### [6] Type Validator

Validates all BOM member values against their declared types. For MBOM: native property types from `09_mbom_properties.yml`, custom property types from the block definition.

Errors at this stage reference the BML source position via the source map.

### [7] Expression Parser

Parses all `${ }` expressions into typed Expression AST nodes. Each AST node carries:

```text
- The parsed expression tree
- The expected result type (inferred from the member type)
- The source position (line, column in the BML file)
```

Expressions are not evaluated at this stage.

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
- Referenced block types exist and are accessible
- Versions are specified on all instance references in compositions
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

### [10] Block Renderer Dispatch

Dispatches each Block in the BOM to its Block Renderer within the resolved Target. For Atomic Targets this is a direct lookup. For Composite Targets this iterates across Atomic Targets.

---

## Target Registry

The Target Registry is the central registration point for all RenderTargets. It is part of `@blockml/compiler`.

### Registration

RenderTargets are registered before compilation begins:

```typescript
import { registerTarget } from "@blockml/compiler";
import { MakerEngine } from "@blockml/engine-maker";
import { MachineBlocksV3ScadTarget } from "@machineblocks/machineblocks-v3-scad-target";

const engine = new MakerEngine();
registerTarget(new MachineBlocksV3ScadTarget(engine));
```

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
    new MathServiceProcessor(),       // copy strategy
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
```

---

## Compiler Facade API

`@blockml/compiler` exposes three public functions:

```typescript
// Parse BML → BOM
compileBmlToBom(source: string): CompilerResult<BomDocument>

// Compile BOM → Target Output
compileBomToOutput(model: BomDocument, targetName: string): CompilerResult<RenderOutput>

// Full pipeline: BML → Target Output
compileBmlToOutput(source: string, targetName: string): CompilerResult<RenderOutput>
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

`RenderOutput` is defined by the Render Target, not by the compiler. The compiler treats it as opaque. Each Target defines its own output structure:

```typescript
// SCAD Target
interface ScadRenderOutput {
  files: ScadFile[]
}

interface ScadFile {
  path:      string    // relative output path, e.g. "com/martianmicro/anyclosure/Wall.scad"
  content:   string    // SCAD file content
  sourceMap: string    // Source Map V3 JSON string
}
```

### Browser Usage

```typescript
import { compileBmlToOutput, registerTarget } from "@blockml/compiler";
import { MakerEngine } from "@blockml/engine-maker";
import { MachineBlocksV3ScadTarget } from "@machineblocks/machineblocks-v3-scad-target";

registerTarget(new MachineBlocksV3ScadTarget(new MakerEngine()));

const result = compileBmlToOutput(xmlSource, "machineblocks-v3-scad");

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
BML_MISSING_VERSION           — block instance in composition has no version
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
BML_FUNCTION_UNSUPPORTED_LANG — language attribute not "scad" or "typescript"
BML_FUNCTION_NO_RUNTIME_IMPL  — Sync Capability called with non-literal args but no runtime impl
BML_IMPLEMENTATION_NOT_SUPPORTED — <implementation> language not supported by baseType
```

### Warnings

Reported as diagnostics with `severity: "warning"`. Compilation succeeds. `result.success` may still be `true`.

Examples:

```text
BML_UNKNOWN_PROPERTY   — property not defined on block type (custom property assumed)
BML_DEPRECATED_TYPE    — referenced type is deprecated
```

---

## FunctionBlock Transpilation

A `FunctionBlock` Sub-Block binds target-language implementations to Sync Capabilities via `<implementation language="...">`. Two languages are supported in V1:

**`language="scad"`** — SCAD function(s) written directly in the BML. The compiler prefixes all function names with the block FQN.

**`language="typescript"`** — TypeScript arrow function. Compile-time execution only (V1): when all arguments at the call site are literals, the compiler executes the TS function in Node.js and emits the result as a literal. Runtime transpilation to SCAD is deferred (requires LLM or dedicated transpiler).

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
  <implementation language="scad"><![CDATA[
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
BML_FUNCTION_UNSUPPORTED_LANG — language attribute not "scad" or "typescript"
```

### Built-in Services — No Processor Needed

Built-in Services (`#math`, `#string`, etc.) are defined as BML FunctionBlocks in `@blockml/core-services`. Their SCAD equivalents live in `scad-lib/services/` using a consistent naming convention:

```text
FQN:  org.blockml.service.Math  →  scad-lib/services/com/bom/service/Math.scad
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

In V1, a FunctionBlock without a matching `<implementation language="scad">` for the SCAD target produces a `BML_FUNCTION_NO_RUNTIME_IMPL` error if called with non-literal arguments.

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

This also applies to `language="typescript"` → target transpilation: TS → SCAD, TS → Python, TS → Java are all LLM tasks. The `<implementation language="typescript">` then becomes the LLM's input spec rather than a directly executable artifact.

The Capability documentation is therefore not just for humans — it is a primary input for the LLM compiler. Well-written documentation directly improves generated implementation quality.

---

## Incremental Build

The compiler supports incremental builds — skipping compilation of artifacts whose inputs have not changed. This applies to both `bom compile --all` and `bom watch`.

### Strategy

Every output artifact has a set of hash inputs. Before compiling, the compiler computes a combined hash of all inputs and compares it to the stored hash from the previous build. If the hash matches, the artifact is skipped.

```text
Wall.scad
  Hash inputs:
    - Wall.mbml content
    - all transitive Block dependency versions
    - machineblocks-v3-scad-target version

Wall.json
  Hash inputs:
    - WallPresets.mbml content
    - Wall.scad hash (implicit dependency)

Wall__brick-2x4.webp
  Hash inputs:
    - Wall.json hash
    - OpenSCAD version
    - thumbnail rendering config
```

### --all Behavior

`bom compile --all machineblocks-v3-scad` processes every `.mbml` file in `srcDir` independently:

```text
<block>        → Block compile    (hash check → skip if unchanged)
<blockPresets> → Presets compile  (hash check → skip if unchanged)
               → implicit Block compile (hash check → skip if unchanged)
```

No special logic determines whether a Block has a Presets document. Every file is evaluated. The hash check prevents redundant work — a Block referenced by both a direct compile and an implicit Presets compile is only built once.

### Hash Storage

Hashes are stored in a `.bom-cache/` directory at the project root:

```text
.bom-cache/
  com/martianmicro/anyclosure/
    Wall.scad.hash
    Wall.json.hash
    Wall__brick-2x4.webp.hash
```

The `.bom-cache/` directory should be added to `.gitignore`.

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
      Wall.mbml           — input
      Wall.expected.scad  — manually verified reference
    corner/
      Corner.mbml
      Corner.expected.scad
    set/
      DefaultEnclosureSet.mbml
      DefaultEnclosureSet.expected.scad
    presets/
      StandardBrickPresets.mbml
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
