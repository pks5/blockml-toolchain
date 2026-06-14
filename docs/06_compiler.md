# MachineBlocks Compiler — Compiler Pipeline

version: 1.0.0

## Purpose of this Document

This document defines the compiler pipeline — the full translation path from MBML source to SCAD output — including error handling, diagnostics, and the testing strategy.

For the MBML format see `02_mbml.md`.
For the MBOM object model see `03_mbom.md`.
For the SCAD renderer see `05_scad_renderer.md`.

---

## Overview

The compiler is implemented across four packages:

```text
@machineblocks/mbml          — parse MBML → MBOM
@machineblocks/mbom          — MBOM object model, validation
@machineblocks/scad-renderer — compile MBOM → SCAD
@machineblocks/compiler      — facade combining all three
```

All four packages are browser and Node compatible. No Node-only APIs in any of these packages.

---

## Compiler Pipeline

```text
MBML Source (.mbml or .json)
  ↓
[1] Format Detector
  ↓
[2] XML Parser / JSON Parser
  ↓
[3] Root Type Resolver
  ↓
[4] Namespace Resolver
  ↓
[5] MBML → MBOM Mapper
  ↓
[6] Type Validator
  ↓
[7] Expression Parser
  ↓
[8] Semantic Validator
  ↓
MBOM
  ↓
[9] Module Name Resolver
  ↓
[10] Import Resolver
  ↓
[11] Property Renderer
  ↓
[12] Expression Renderer
  ↓
[13] Assembly Pattern Mapper
  ↓
[14] Composition Renderer
  ↓
[15] Set Renderer (if set document)
  ↓
[16] Customizer Generator
  ↓
[17] Source Map Generator
  ↓
SCAD File(s) + Source Map(s)
```

---

## Pipeline Stages

### [1] Format Detector

Detects whether the input is XML or JSON based on the first non-whitespace character. Selects the appropriate parser.

### [2] XML Parser / JSON Parser

Parses the raw source into an intermediate document tree. Browser-compatible parsers only (no Node-only XML libraries in core).

### [3] Root Type Resolver

Reads the root element name (XML) or `type` field (JSON) to determine the document type:

```text
<block>        → Block Definition
<set>          → Set Definition
<blockPresets> → Block Presets
```

Selects the appropriate MBML→MBOM mapping rule for this root type. Extension root types register their mapping rule via the root type registry.

### [4] Namespace Resolver

Resolves all xmlns prefix mappings to FQNs:

```text
xmlns:ac="com.martianmicro.anyclosure"
ac:Wall  →  com.martianmicro.anyclosure.Wall
```

The resolved FQN is used throughout the rest of the pipeline.

### [5] MBML → MBOM Mapper

Maps the parsed document tree to MBOM objects using the mapping rule for the detected root type.

```text
XML attribute  →  MBOM property value
XML child element in <compositions>  →  MBOM composition child instance
XML child element in <aggregations>  →  MBOM aggregation metadata
```

Mapping rules are defined once per root type and apply uniformly to all documents of that type. They are configurable and extensible.

### [6] Type Validator

Validates all MBOM property values against their declared types (from `09_mbom_properties.yml` for native properties, from the block definition for custom properties).

Errors at this stage reference the MBML source position via the source map.

### [7] Expression Parser

Parses all `${}` expressions into typed Expression AST nodes. Each AST node carries:

```text
- The parsed expression tree
- The expected result type (inferred from the property type)
- The source position (line, column in the MBML file)
```

Expressions are not evaluated at this stage.

### [8] Semantic Validator

Validates the MBOM graph for semantic correctness:

```text
- Referenced block types exist and are accessible
- Versions are specified on all instance references in sets
- Composition child properties are valid for the referenced block type
- Aggregation cardinality constraints are satisfied
- Expression result types match the target property type
```

---

## Compiler Facade API

`@machineblocks/compiler` exposes three public functions:

```typescript
// Parse MBML → MBOM
compileMbmlToMbom(source: string): CompilerResult<MbomDocument>

// Compile MBOM → SCAD
compileMbomToScad(model: MbomDocument): CompilerResult<ScadOutput>

// Full pipeline: MBML → SCAD
compileMbmlToScad(source: string): CompilerResult<ScadOutput>
```

### CompilerResult

```typescript
interface CompilerResult<T> {
  output:       T | null
  diagnostics:  Diagnostic[]
  success:      boolean
}
```

### ScadOutput

```typescript
interface ScadOutput {
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
import { compileMbmlToScad } from "@machineblocks/compiler";

const result = compileMbmlToScad(xmlSource);

if (result.success) {
  const scad = result.output.files[0].content;
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
  code:      string        // e.g. "MBML_UNKNOWN_TYPE"
  message:   string
  source:    SourceLocation
}

interface SourceLocation {
  file:    string          // MBML source file path
  line:    number
  column:  number
}
```

Diagnostics always reference the MBML source position — not the generated SCAD position. Source maps provide the reverse mapping for tooling that needs it.

The compiler never throws exceptions for recoverable errors. All errors are returned as diagnostics in `CompilerResult`. Unrecoverable internal errors (bugs) may throw.

---

## Error Handling

### Recoverable Errors

Reported as diagnostics with `severity: "error"`. Compilation continues where possible to collect all errors in one pass. `result.success` is `false` if any error-level diagnostic exists.

Examples:

```text
MBML_UNKNOWN_TYPE          — referenced block type not found
MBML_INVALID_PROPERTY      — property value does not match type
MBML_MISSING_VERSION       — block instance in set has no version
MBML_EXPRESSION_TYPE_ERROR — expression result type mismatch
MBML_CARDINALITY_VIOLATION — aggregation cardinality not satisfied
```

### Warnings

Reported as diagnostics with `severity: "warning"`. Compilation succeeds. `result.success` may still be `true`.

Examples:

```text
MBML_UNKNOWN_PROPERTY     — property not defined on block type (custom property assumed)
MBML_DEPRECATED_TYPE      — referenced type is deprecated
```

---

## Source Maps

The compiler generates a Source Map V3 file alongside each SCAD output file:

```text
Wall.scad      — generated SCAD
Wall.scad.map  — Source Map V3
```

The source map records the MBML source file path, line, and column for every generated SCAD line. This allows:

```text
- Compiler diagnostics to reference MBML source positions
- Editor tooling to navigate from SCAD back to MBML
- Debugging to stay in the MBML authoring context
```

Source Map V3 is used as the format. It is language-agnostic and has established tooling support. Practical applicability to SCAD is to be verified.

---

## Extension Mechanism

The compiler supports extension root types (e.g. `<device>`) without modifying the core. Extensions register:

```text
1. A root type name  (e.g. "device")
2. An MBML→MBOM mapping rule
3. An MBOM→SCAD rendering rule (optional — may delegate to core)
4. A schema (XSD or JSON Schema)
```

Registration is done at runtime before compilation:

```typescript
import { registerRootType } from "@machineblocks/mbml";

registerRootType({
  name:    "device",
  mapper:  deviceMbmlToMbomMapper,
  schema:  deviceXsdUrl
});
```

---

## Testing Strategy

### Stage 1 — Correctness Tests

Manual verification tests that ensure the compiler produces semantically correct SCAD output.

```text
Input:    MBML source file (hand-authored)
Expected: SCAD reference file (manually verified against SCAD Library)
Test:     byte-for-byte or normalized diff

Coverage:
  - Block definition → SCAD module
  - Composite block → nested mb_block() calls
  - Set definition → STEPS + view submodules
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
Input:      same MBML source files as correctness tests
Snapshot:   the verified correct SCAD output from Stage 1
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
