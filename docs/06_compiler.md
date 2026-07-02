# BOM Compiler — Compiler Pipeline

version: 2.0.0

## Purpose of this Document

This document defines the compiler pipeline — the full translation path from BML source to render target output — including the Target Registry, error handling, diagnostics, and the testing strategy.

For the BML format see `02_mbml.md`.
For the MBOM object model see `03_mbom.md`.
For the SCAD Renderer see `05_scad_renderer.md`.

---

## Overview

The compiler is implemented across four packages:

```text
@bom/parser                    — parse BML → BOM
@bom/core                      — BOM object model, validation
@bom/compiler                  — Facade + Target Registry
@machineblocks/scad-renderer   — SCAD Render Target (Atomic)
```

`@bom/parser`, `@bom/core`, and `@bom/compiler` are browser and Node compatible. No Node-only APIs in any of these packages. Render Target packages follow the same constraint.

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

Stages 1–8 are universal — implemented in `@bom/parser` and `@bom/core`. Stages 9–19 are Target-specific — implemented in the registered Render Target package.

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

The Target Registry is the central registration point for all Render Targets. It is part of `@bom/compiler`.

### Registration

Targets are registered before compilation begins. In the CLI, registration happens at startup based on installed Target packages:

```typescript
import { registerTarget } from "@bom/compiler";
import { ScadTarget } from "@machineblocks/scad-renderer";

registerTarget(new ScadTarget());
```

### Target Interface

```typescript
interface BomTarget {
  name:                    string
  supportsBaseType(fqn:    string): boolean
  getBlockRenderer(fqn:    string): BlockRenderer
}

interface BlockRenderer {
  render(block: Block, context: RenderContext): RenderOutput
}
```

### Atomic vs. Composite Targets

An **Atomic Target** handles one domain. It declares a set of supported `baseType` FQNs and returns a Block Renderer for each:

```typescript
class ScadTarget implements BomTarget {
  name = "scad"

  supportsBaseType(fqn: string): boolean {
    return fqn === "com.machineblocks.core.Block"
        || fqn === "com.machineblocks.core.Set"
        || isSubtypeOf(fqn, "com.machineblocks.core.Block")
  }

  getBlockRenderer(fqn: string): BlockRenderer {
    if (isSubtypeOf(fqn, "com.machineblocks.core.Set")) {
      return new ScadSetRenderer()
    }
    return new ScadBlockRenderer()
  }
}
```

A **Composite Target** has no Block Renderers of its own. It resolves per Block which Atomic Target is responsible and delegates:

```typescript
class DeviceTarget implements BomTarget {
  name = "device"
  atomics = [scadTarget, kicadTarget, uiTarget]

  supportsBaseType(fqn: string): boolean {
    return this.atomics.some(t => t.supportsBaseType(fqn))
  }

  getBlockRenderer(fqn: string): BlockRenderer {
    const target = this.atomics.find(t => t.supportsBaseType(fqn))
    if (!target) throw new Error(`No atomic target for ${fqn}`)
    return target.getBlockRenderer(fqn)
  }
}
```

---

## Compiler Facade API

`@bom/compiler` exposes three public functions:

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
import { compileBmlToOutput, registerTarget } from "@bom/compiler";
import { ScadTarget } from "@machineblocks/scad-renderer";

registerTarget(new ScadTarget());

const result = compileBmlToOutput(xmlSource, "scad");

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
BML_MISSING_VERSION           — block instance in composition has no version
BML_EXPRESSION_TYPE_ERROR     — expression result type mismatch
BML_CARDINALITY_VIOLATION     — aggregation cardinality not satisfied
BML_DUPLICATE_MEMBER_NAME     — member name used more than once in a block
BML_UNKNOWN_BEAN              — @bean reference not found in aggregations
BML_CAPABILITY_LINK_MISMATCH  — capability linking: direction or payload mismatch
BML_NO_TARGET                 — no registered target supports the block's baseType
BML_UNKNOWN_TARGET            — requested target name not registered
```

### Warnings

Reported as diagnostics with `severity: "warning"`. Compilation succeeds. `result.success` may still be `true`.

Examples:

```text
BML_UNKNOWN_PROPERTY   — property not defined on block type (custom property assumed)
BML_DEPRECATED_TYPE    — referenced type is deprecated
```

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
import { registerRootType } from "@bom/parser";

registerRootType({
  name:    "device",
  mapper:  deviceBmlToBomMapper,
  schema:  deviceXsdUrl
});
```

Target registration:

```typescript
import { registerTarget } from "@bom/compiler";

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
