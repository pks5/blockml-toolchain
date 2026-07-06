# SCAD Renderer — Render Target

version: 2.0.0

## Purpose of this Document

This document defines the SCAD Renderer — the MachineBlocks Atomic Render Target that serializes MBOM Blocks into MachineBlocks V3 SCAD files. It covers the Target registration, Block Renderer and Set Renderer, FQN→SCAD naming, MBOM→SCAD property mapping, assembly pattern resolution, and source map generation.

For the MBOM object model see `03_mbom.md`.
For the MBOM type system and serialization rules see `04_types.md`.
For the Target system see `06_compiler.md`.
For the MachineBlocks V3 SCAD Library specification see `domains/machineblocks/runtimes/scad-lib/docs/`.

---

## Overview

The MachineBlocks V3 SCAD Target is implemented in `@machineblocks/machineblocks-v3-scad-target`. It is browser and Node compatible — no Node-only APIs.

The target uses `@blockml/engine-maker` (**MakerEngine**) as its CompilerEngine implementation. It registers under the name `"machineblocks-v3-scad"` and contains two BlockProcessors. All MBOM→SCAD mappings are declarative and configurable — no mappings are hardcoded in the processor logic.

### V1 Scope

The MachineBlocks V3 SCAD Target V1 supports exactly two base types:

```text
com.machineblocks.core.Block  →  ScadBlockProcessor  (standard SCAD block module)
com.machineblocks.core.Set    →  ScadSetProcessor    (STEPS-based set with view submodules)
```

All user-defined Block types that inherit from `com.machineblocks.core.Block` or `com.machineblocks.core.Set` are handled by the same two processors respectively.

---

## Target Registration

```typescript
import { registerTarget } from "@blockml/compiler";
import { MakerEngine } from "@blockml/engine-maker";
import { MachineBlocksV3ScadTarget } from "@machineblocks/machineblocks-v3-scad-target";

registerTarget(new MachineBlocksV3ScadTarget(new MakerEngine()));
```

```typescript
class MachineBlocksV3ScadTarget implements RenderTarget {
  name = "machineblocks-v3-scad"
  engine = new MakerEngine()

  processors = [
    new ScadSetProcessor(),    // checked first — more specific
    new ScadBlockProcessor()   // fallback for all com.machineblocks.core.Block
  ]

  delegates = []
}
```

`isSubtypeOf` traverses the `baseType` chain in the BOM type registry. A Block whose `baseType` chain does not include `com.machineblocks.core.Block` is not supported by this Target — the compiler emits `BML_NO_TARGET` for that Block.

---

## Renderer Pipeline

Each Block Renderer runs the following internal pipeline:

```text
MBOM Block
  ↓
Module Name Resolver     — FQN → SCAD module name
  ↓
Import Resolver          — FQN → use/include paths
  ↓
Property Renderer        — MBOM properties → SCAD settings array entries
  ↓
Expression Renderer      — Expression AST → SCAD expressions
  ↓
Assembly Pattern Mapper  — semantic values → SCAD assembly function calls
  ↓
Composition Renderer     — MBOM compositions → nested mb_block() calls
  ↓      (ScadBlockRenderer only)
Set Renderer             — MBOM set → STEPS array + view submodules
  ↓      (ScadSetRenderer only)
Customizer Generator     — block properties → OpenSCAD customizer section
  ↓
Source Map Generator     — BML positions → SCAD positions (Source Map V3)
  ↓
ScadFile(s)
```

---

## FQN → SCAD Module Name

Every MBOM Block class is identified by its FQN. The SCAD Renderer maps FQNs to SCAD module names following a deterministic convention.

### Convention

```text
Segments:     double underscore (__) as separator
Packages:     lowercase
Class names:  PascalCase
Subclasses:   additional PascalCase segment
Helpers:      __help__camelCase  (private, not a block)
Functions:    __func__camelCase  (private, not a block)
```

### Examples

```text
FQN:   com.martianmicro.anyclosure.Wall
SCAD:  mb__com__martianmicro__anyclosure__Wall

FQN:   com.martianmicro.anyclosure.Wall  (subclass Bottom)
SCAD:  mb__com__martianmicro__anyclosure__Wall__Bottom

FQN:   com.martianmicro.anyclosure.Wall  (private helper)
SCAD:  mb__com__martianmicro__anyclosure__Wall__help__myHelper

FQN:   com.martianmicro.anyclosure.Wall  (private function)
SCAD:  mb__com__martianmicro__anyclosure__Wall__func__myFunc
```

The names `help` and `func` are reserved and cannot be used as subclass names.

---

## FQN → SCAD File Path

```text
FQN:   com.martianmicro.anyclosure.Wall
File:  scad/com/martianmicro/anyclosure/Wall.scad
```

Multiple block classes may exist in one SCAD file. The file is named after the primary class. The output directory root (`scad/`) is configurable via `outDir` in `bom.config.json`.

---

## Import Resolver

Every generated SCAD file includes the required imports for the MachineBlocks V3 Library and the project config. Import paths are computed relative to the output file location using the `mbLibPath` from `bom.config.json`.

### Standard Imports

```scad
use <{relative_path_to_scad-lib}/lib/block.scad>;
include <{relative_path_to_scad-lib}/config/mb_config.scad>;
```

### Block-to-Block Imports (Sets only)

Ordinary Composite Block compositions render leaf instances as **`mb_block()`** (NativeBlock) — no `use` import of dependency block SCAD files. See `14_compiler_runtime.md` — NativeBlock Render Model.

For **Sets** (`com.machineblocks.core.Set`), `_blocks` configurations may reference typed block modules by `blockId`. In that case the Set renderer generates `use` imports for the referenced block SCAD files:

```scad
use <../wall/Wall.scad>;
use <../corner/Corner.scad>;
```

Set `_blocks` dispatch is specified separately when Set MBML examples are available in scad-lib.

### Built-in Service Imports

When a Block's expressions reference `#built-in` calls, the processor automatically adds `use` imports for the required service files. The import is only added when the service is actually used:

```scad
use <{relative_path_to_scad-lib}/blocks/org/blockml/service/Math.scad>;
use <{relative_path_to_scad-lib}/blocks/org/blockml/service/Strings.scad>;
```

Built-in service files live under `scad-lib/blocks/org/blockml/service/` — the same `blocks/` structure as all other pre-rendered blocks, following the FQN package convention:

```text
scad-lib/blocks/org/blockml/service/
  Math.scad
  Math.scad
  Strings.scad
  Numbers.scad
  Lists.scad
```

Import paths are always relative and computed from the output file's directory.

---

## SCAD Native Mapping

The SCAD BlockProcessor reads a declarative JSON mapping file (`scad-native-mappings.json`) that maps `#built-in` Capability calls to native SCAD functions where a 1:1 equivalent exists. This avoids unnecessary helper function imports for trivial cases.

### File Location

```text
machineblocks-v3-scad-target/
  scad-native-mappings.json
```

### Format

```json
{
  "org.blockml.service.Math": {
    "min":     { "native": "min",   "arity": 2 },
    "max":     { "native": "max",   "arity": 2 },
    "floor":   { "native": "floor", "arity": 1 },
    "ceil":    { "native": "ceil",  "arity": 1 },
    "round":   { "native": "round", "arity": 1 },
    "abs":     { "native": "abs",   "arity": 1 },
    "pow":     { "native": "pow",   "arity": 2 },
    "sqrt":    { "native": "sqrt",  "arity": 1 },
    "round_n": { "native": null },
    "clamp":   { "native": null }
  },
  "org.blockml.service.Strings": {
    "length":  { "native": "len",   "arity": 1 },
    "concat":  { "native": "str",   "arity": -1 }
  }
}
```

`native: null` — no direct SCAD equivalent. The processor emits the FQN-prefixed function call and adds a `use` import for the service file.

`arity: -1` — variadic function.

### Resolution Logic

For each `#built-in` call in a Block's expressions or SCAD implementations:

```text
#math.min(a, b)
  → native mapping found: min(a, b)     → emit directly, no import needed

#math.round_n(x, 1)
  → native: null
  → emit: bom__org__blockml__service__Math__round_n(x, 1)
  → add:  use <.../blocks/org/blockml/service/Math.scad>

#strings.length(s)
  → native mapping found: len(s)        → emit directly, no import needed
```

### SCAD Built-in Service Function Naming

Functions in the service SCAD files use the `bom__` prefix followed by the full FQN with `__` as separator:

```scad
// Math.scad
function bom__org__blockml__service__Math__min(a, b) = min(a, b);
function bom__org__blockml__service__Math__max(a, b) = max(a, b);
function bom__org__blockml__service__Math__floor(x) = floor(x);
function bom__org__blockml__service__Math__ceil(x) = ceil(x);
function bom__org__blockml__service__Math__round(x) = round(x);
function bom__org__blockml__service__Math__round_n(x, n) = round(x * pow(10, n)) / pow(10, n);
function bom__org__blockml__service__Math__abs(x) = abs(x);
function bom__org__blockml__service__Math__pow(b, e) = pow(b, e);
function bom__org__blockml__service__Math__sqrt(x) = sqrt(x);
function bom__org__blockml__service__Math__clamp(x, lo, hi) = min(max(x, lo), hi);
```

---

## SCAD File Structure

Every generated SCAD file follows the standard MachineBlocks Block File structure:

```scad
/**
 * MachineBlocks.com Block File
 *
 * Name: Wall
 * Filename: Wall.scad
 * Package: com.martianmicro.anyclosure.Wall
 * Generated by: bom <version>
 */

/* Imports */

/* Customization */

/* Main Module Call */

/* Main Module Definition */

/* Optional Sub Modules */

/* Optional Helper Modules */

/* Optional Global Functions */
```

The header is mandatory. All section comments are mandatory even if the section is empty.

---

## Property Renderer

The Property Renderer maps MBOM property values to SCAD settings array entries:

```scad
["paramName", value]
```

### Mapping Configuration

All mappings are defined in `09_mbom_properties.yml` and are fully configurable. The renderer reads the mapping config at startup — no mappings are hardcoded.

Each property definition specifies:

```text
name        — MBOM property name (camelCase)
scadName    — SCAD parameter name (camelCase, usually identical)
type        — MBOM type FQN
serializer  — serialization rule (from 04_types.md)
default     — default value
```

### Native vs. Custom Properties

**Native properties** map to dedicated SCAD getters in the generated module body:

```scad
size      = mb_param_size(config, settings, [1, 8, 9]);
baseColor = mb_param_baseColor(config, settings);
```

**Custom properties** map to the generic getter:

```scad
wallThickness  = mb_param(config, settings, "wallThickness", 1);
cornerRounding = mb_param(config, settings, "cornerRounding", 0.5);
```

The renderer determines native vs. custom by checking `09_mbom_properties.yml`.

---

## Expression Renderer

Expressions in BOM are stored as typed Expression AST nodes. The Expression Renderer serializes AST nodes into SCAD-compatible expressions.

### Static Resolution

If an expression can be fully resolved at compile time (no runtime-dependent roots), the renderer emits the resolved value directly:

```text
Expression: ${ [1, 1, 1] }   →   SCAD: [1, 1, 1]
```

### Dynamic Rendering

If an expression references block properties or `bml:with` variables, the renderer emits a SCAD expression:

```text
Expression: ${ [size[0], size[1], size[2] - 1] }
SCAD:       [size[0], size[1], size[2] - 1]

Expression: ${ #math.max(size[2] - 1, 0) }
SCAD:       max(size[2] - 1, 0)
```

### Expression Root Mapping

```text
myProperty          →  SCAD local variable <name>
myProperty.x        →  SCAD: <name>[0] or <name>.x depending on type
withVariable        →  SCAD local variable (from bml:with scope)
#math.min(a, b)     →  SCAD: min(a, b)
#math.max(a, b)     →  SCAD: max(a, b)
```

`@bean` expressions (user-defined ServiceBlock calls and model bindings) are resolved at compile time where possible. Runtime behavior for `@bean` expressions in SCAD output is to be defined.

---

## Assembly Pattern Mapper

Assembly patterns are SCAD-level constructs that have no equivalent in BML/BOM. The renderer resolves them automatically based on the semantic MBOM value and the block's composition structure.

All assembly pattern mappings are declarative and configurable — not hardcoded.

### Patterns

| MBOM Semantic Value | SCAD Output |
|---|---|
| `baseCutoutType = "groove"` (on top part) | `mb_assembly_groove(assembly, renderGroups, group_top)` |
| `tongue = true` (on bottom part) | `mb_assembly_tongue(assembly, renderGroups, group_bottom)` |
| `offset` (on assembly-dependent part) | `mb_assembly_offset([x, y, z], assembly, renderGroups, group_top)` |
| `render` (per part) | `mb_group_render(renderGroups, group_bottom)` |
| `id` (per part) | `mb_block_id(blockId, part_bottom)` |
| `baseAdjustment` (namespace-filtered) | `mb_params_filter(baseSideAdjustment, ns_bottom)` |

### Part Variables

For each composition child, the renderer generates SCAD part variables:

```scad
part_bottom  = "bottom";
group_bottom = part_bottom;
ns_bottom    = part_bottom;
```

These are emitted as SCAD local variables inside the wrapper `mb_block()` children block.

---

## ScadBlockRenderer — Leaf-Only Block Optimization

Some Block types are effectively a **single NativeBlock** — all properties map 1:1 to native MB settings, no Sub-Blocks, no multi-child composition (e.g. `com.machineblocks.bricks.Standard`).

For **standalone compile** of such blocks, the processor emits a **direct `mb_block()` main call** with Customizer variables as settings — no typed wrapper module, no `mb_param_*` extraction layer:

```scad
// Optimized output (Standard.mbml standalone)
mb_block(
    config = mb_config,
    settings = [
        ["size", size],
        ["studs", studs],
        ...
    ]
);
```

This avoids the extra module call and duplicate parameter forwarding present in hand-maintained scad-lib artifacts. Composite blocks with real inner structure (Wall, Calibrator) still emit typed modules. See `14_compiler_runtime.md` — Leaf-only blocks.

---

## ScadBlockRenderer — Composite Block Rendering

A MBOM Composite Block (a Block with a non-empty Composition) is rendered as a wrapper `mb_block()` call with nested child calls.

### Generated Structure

```scad
module mb__com__martianmicro__anyclosure__Wall(config = undef, settings = undef){
    // Native parameters
    blockId    = mb_param_id(config, settings, "com.martianmicro.anyclosure.Wall");
    size       = mb_param_size(config, settings, [1, 8, 9]);
    offset     = mb_param_offset(config, settings);
    direction  = mb_param_direction(config, settings);
    align      = mb_param_align(config, settings);
    baseColor  = mb_param_baseColor(config, settings);

    // Custom parameters
    wallThickness = mb_param(config, settings, "wallThickness", 1);

    // Assembly resolution
    assembly     = mb_assembly(config, settings, size, direction);
    renderGroups = mb_param_renderGroups(config, settings);

    // Wrapper block
    mb_block(
        config = config,
        settings = [
            ["id",        blockId],
            ["base",      false],
            ["studs",     false],
            ["size",      size],
            ["align",     align],
            ["offset",    offset],
            ["direction", direction]
        ]
    ){
        // Child: bottom
        part_bottom  = "bottom";
        group_bottom = part_bottom;
        ns_bottom    = part_bottom;

        mb_block(
            config = config,
            settings = [
                ["id",             mb_block_id(blockId, part_bottom)],
                ["render",         mb_group_render(renderGroups, group_bottom)],
                ["size",           [size[0], size[1], size[2] - 1]],
                ["recess",         true],
                ["tongue",         mb_assembly_tongue(assembly, renderGroups, group_bottom)],
                ["recessWallGaps", "x+"],
                ["baseColor",      baseColor],
                ["baseAdjustment", mb_params_filter(baseSideAdjustment, ns_bottom)]
            ]
        );

        // Child: top
        part_top  = "top";
        group_top = part_top;
        ns_top    = part_top;

        mb_block(
            config = config,
            settings = [
                ["id",             mb_block_id(blockId, part_top)],
                ["render",         mb_group_render(renderGroups, group_top)],
                ["size",           [size[0], size[1], 1]],
                ["offset",         mb_assembly_offset([0, 0, size[2] - 1], assembly, renderGroups, group_top)],
                ["baseCutoutType", mb_assembly_groove(assembly, renderGroups, group_top)],
                ["recessWallGaps", "x+"],
                ["baseColor",      baseColor],
                ["baseAdjustment", mb_params_filter(baseSideAdjustment, ns_top)]
            ]
        );
    }
}
```

---

## ScadSetRenderer — Set Rendering

A MBOM Block whose `baseType` chain includes `com.machineblocks.core.Set` is rendered by `ScadSetRenderer` as a SCAD file with a STEPS array and four view submodules.

A MachineBlocks Set uses three conventional Aggregations to separate concerns:

```text
_blocks     — Block configurations (what exists, how it is parameterized)
_placement  — placed instances (where each block is; id becomes the SCAD instance id)
_steps      — assembly order (optional; defaults to document order of _placement)
```

### STEPS Array

The STEPS array is generated from the set's placement list. Each entry:

```scad
STEPS = [
    ["00001", [16, 16, 1], "west", [0, 0, 0]],
    ["00002", [4, 4, 9],   "west", [0, 0, 1]],
    ...
];
```

Fields per entry:

```text
[0]  instanceId   — string (from Place id)
[1]  boundingBox  — [x, y, z] (from referenced Block configuration size)
[2]  direction    — "west" | "north" | "east" | "south" (from Place direction)
[3]  offset       — [x, y, z] (from Place offset)
```

### Bounding Box

The set bounding box is computed at SCAD render time using the SCAD helper function:

```scad
["size", mb_set_bounding_box(STEPS)]
```

The compiler does not precompute the bounding box.

### View Submodules

Four submodules are generated, each as a PascalCase subclass of the set module:

```scad
mb__com__martianmicro__anyclosure__DefaultEnclosure__Total
mb__com__martianmicro__anyclosure__DefaultEnclosure__Print
mb__com__martianmicro__anyclosure__DefaultEnclosure__Step
mb__com__martianmicro__anyclosure__DefaultEnclosure__Instance
```

### Instance Dispatcher

The Instance submodule dispatches to per-instance submodules via if/else chain:

```scad
module mb__com__martianmicro__anyclosure__DefaultEnclosure__Instance(config = undef, settings = undef){
    instanceId = mb_param(config, settings, "instanceId");
    if(instanceId == "00001"){
        mb__com__martianmicro__anyclosure__DefaultEnclosure__Instance_00001(...);
    }
    else if(instanceId == "00002"){
        mb__com__martianmicro__anyclosure__DefaultEnclosure__Instance_00002(...);
    }
    ...
}
```

Per-instance submodule names use the instance ID appended with an underscore:

```scad
mb__com__martianmicro__anyclosure__DefaultEnclosure__Instance_00001
```

### Customizer Variables

The set customizer section exposes:

```scad
mode       = "total"; // [total:Total, print:3D Print, step:Step, instance:Instance]
step       = 0;       // [0:9]
instanceId = "00001";
assembly   = "merged"; // [unassembled:Unassembled, assembled:Assembled, merged:Merged]
baseColor  = "#EAC645";
```

---

## Customizer Generator

The Customizer Generator produces the OpenSCAD Customizer section for block and set files.

For each exposed property:

```text
- Variable declaration with default value
- Inline comment with OpenSCAD Customizer dropdown syntax where applicable
- Group comment (/* [Group Name] */) for property groups
```

Hidden section (`/* [Hidden] */`) contains derived variables that combine customizer inputs for passing to the module. Internal module computations are never placed in the hidden section.

### Complex Type Serialization

OpenSCAD Customizer only supports flat primitives — no arrays, no compound types. The BlockProcessor splits complex properties into multiple Customizer variables and recombines them in the `[Hidden]` section. The splitting rules are defined per property in `09_mbom_properties.yml` via the `scad_customizer` field:

**`split: [x, y, z]`** — splits a vector/array property into named scalar variables:

```scad
// Customizer variables (visible):
baseRoundingRadiusX = 0.5; // [0:0.1:2]
baseRoundingRadiusY = 0.5;
baseRoundingRadiusZ = 0.5;

/* [Hidden] */
baseRoundingRadius = [baseRoundingRadiusX, baseRoundingRadiusY, baseRoundingRadiusZ];
```

**`auto_toggle: true`** — splits a `NoneOr<T>` property into a boolean toggle + a value:

```scad
// Customizer variables (visible):
recessDepthAuto = true;
recessDepth = 0.5;

/* [Hidden] */
recessDepthResolved = recessDepthAuto ? "auto" : recessDepth;
```

**`suggestions`** — generates a Customizer dropdown comment from `<suggestions>` on the Property:

```scad
textColor = "#303D4E"; // [#303D4E:Midnight Blue, #EAC645:Sun Flower, #58B99D:Turquoise]
```

### Wrapper mb_block() Logic

The ScadBlockProcessor automatically decides whether to emit a wrapper `mb_block()`:

```text
Composition has 0 children:
  → no wrapper — custom Processor logic handles rendering
  → 0 Compositions without custom Processor → MB_EMPTY_BLOCK

Composition has exactly 1 child:
  → no wrapper — child is rendered directly

Composition has 2+ children:
  → automatic wrapper mb_block() with Block Properties as settings
  → children rendered inside the wrapper as mb_block() children
```

**Wrapper always gets `base=false` and `studs=false`** — regardless of the Block's own `base` and `studs` property values. The wrapper is a layout container only; geometry is rendered entirely by the children.

The Block's `base` and `studs` properties are passed to the NativeBlock children — not to the wrapper:

```text
Cross.studs = true
  → wrapper mb_block():   studs=false  (always, hardcoded by Processor)
  → NativeBlock children: studs=true   (from Block property)

Cross.studs = false
  → wrapper mb_block():   studs=false  (always)
  → NativeBlock children: studs=false  (from Block property)
```

This means CompositeBlocks never need to declare `base=false` or `studs=false` explicitly for the wrapper — those are always set by the Processor. The `base` and `studs` properties retain their normal meaning for the children.

Nested NativeBlocks or other Blocks within a Composition are true instances — not wrappers. The automatic wrapper is only ever the outermost container, set once by the Processor.

---

## Preset File Rendering

A `<blockPresets>` document is rendered to an OpenSCAD Customizer JSON file. The Customizer JSON uses the Preset **name** as the key — it is the human-readable label shown in the OpenSCAD UI:

```json
{
  "fileFormatVersion": "1",
  "parameterSets": {
    "Brick 2x4": {
      "size": "[2, 4, 3]",
      "baseColor": "#EAC645",
      "studs": "true"
    },
    "Brick 1x1": {
      "size": "[1, 1, 3]",
      "baseColor": "#EAC645"
    }
  }
}
```

All parameter values are serialized as strings (OpenSCAD Customizer requirement). Only properties specified in the preset are included. Whether missing properties are filled with block defaults is to be verified against OpenSCAD Customizer fallback behavior.

---

## Source Map Generation

The renderer generates a Source Map V3 file alongside each SCAD output file:

```text
Wall.scad      — generated SCAD
Wall.scad.map  — Source Map V3
```

The source map records the BML source file, line, and column for every generated SCAD line. This allows compiler errors and validation messages to reference the original BML source position rather than the generated SCAD.

Source Map V3 format is used as-is (it is language-agnostic). Applicability to SCAD output is to be verified in practice.

---

## SCAD Helper Function Strategy

Several SCAD helper functions compute values at SCAD render time rather than being precomputed by the compiler:

| Function | Strategy | Status |
|---|---|---|
| `mb_set_bounding_box(STEPS)` | SCAD runtime | Decided |
| `mb_parts_total_size(parts)` | To be decided | Open |
| `mb_assembly(config, settings, size, direction)` | SCAD runtime (render-dependent) | Tendency |
| `mb_assembly_tongue(assembly, renderGroups, group)` | SCAD runtime (render-dependent) | Tendency |
| `mb_assembly_groove(assembly, renderGroups, group)` | SCAD runtime (render-dependent) | Tendency |
| `mb_assembly_offset(offset, assembly, renderGroups, group)` | SCAD runtime (render-dependent) | Tendency |
| `mb_group_render(renderGroups, group)` | SCAD runtime (render-dependent) | Tendency |
| `mb_params_filter(baseSideAdjustment, ns)` | MBOM precomputed (structural) | Tendency |
| `mb_block_id(blockId, partId)` | To be decided | Open |

General rule: render-dependent values (assembly, renderGroups) are resolved at SCAD runtime. Structural/static values are precomputed in MBOM.
