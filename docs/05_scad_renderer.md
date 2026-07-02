# SCAD Renderer — Render Target

version: 2.0.0

## Purpose of this Document

This document defines the SCAD Renderer — the MachineBlocks Atomic Render Target that serializes MBOM Blocks into MachineBlocks V3 SCAD files. It covers the Target registration, Block Renderer and Set Renderer, FQN→SCAD naming, MBOM→SCAD property mapping, assembly pattern resolution, and source map generation.

For the MBOM object model see `03_mbom.md`.
For the MBOM type system and serialization rules see `04_types.md`.
For the Target system see `06_compiler.md`.
For the MachineBlocks V3 SCAD Library specification see `machineblocks-lib/docs/scad-reference/`.

---

## Overview

The SCAD Renderer is implemented in `@machineblocks/scad-renderer`. It is browser and Node compatible — no Node-only APIs.

The renderer is an **Atomic Target** registered with `@bom/compiler` under the name `"scad"`. It has no knowledge of BML syntax. All MBOM→SCAD mappings are declarative and configurable — no mappings are hardcoded in the renderer logic.

### V1 Scope

The SCAD Renderer V1 supports exactly two base types:

```text
com.machineblocks.core.Block  →  ScadBlockRenderer  (standard SCAD block module)
com.machineblocks.core.Set    →  ScadSetRenderer    (STEPS-based set with view submodules)
```

All user-defined Block types that inherit from `com.machineblocks.core.Block` or `com.machineblocks.core.Set` are handled by the same two renderers respectively. There are no per-FQN Block Renderers in V1.

---

## Target Registration

The SCAD Renderer registers itself as an Atomic Target:

```typescript
import { registerTarget } from "@bom/compiler";
import { ScadTarget } from "@machineblocks/scad-renderer";

registerTarget(new ScadTarget());
```

The `ScadTarget` implements `BomTarget`:

```typescript
class ScadTarget implements BomTarget {
  name = "scad"

  supportsBaseType(fqn: string): boolean {
    return isSubtypeOf(fqn, "com.machineblocks.core.Block")
        || isSubtypeOf(fqn, "com.machineblocks.core.Set")
  }

  getBlockRenderer(fqn: string): BlockRenderer {
    if (isSubtypeOf(fqn, "com.machineblocks.core.Set")) {
      return new ScadSetRenderer()
    }
    return new ScadBlockRenderer()
  }
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
SCAD:  mb_block__com__martianmicro__anyclosure__Wall

FQN:   com.martianmicro.anyclosure.Wall  (subclass Bottom)
SCAD:  mb_block__com__martianmicro__anyclosure__Wall__Bottom

FQN:   com.martianmicro.anyclosure.Wall  (private helper)
SCAD:  mb_block__com__martianmicro__anyclosure__Wall__help__myHelper

FQN:   com.martianmicro.anyclosure.Wall  (private function)
SCAD:  mb_block__com__martianmicro__anyclosure__Wall__func__myFunc
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
use <{relative_path_to_mbLibPath}/lib/block.scad>;
include <{relative_path_to_config}/mb_config.scad>;
```

### Block-to-Block Imports

When a composite block references another block class, the renderer generates a `use` import for that block's SCAD file:

```scad
use <../wall/Wall.scad>;
use <../corner/Corner.scad>;
```

Import paths are always relative and computed from the output file's directory.

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

If an expression references block properties or the registry, the renderer emits a SCAD expression:

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
#math.min(a, b)     →  SCAD: min(a, b)
#math.max(a, b)     →  SCAD: max(a, b)
registry.<name>     →  SCAD local variable registry_<name>  (to be defined)
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

## ScadBlockRenderer — Composite Block Rendering

A MBOM Composite Block (a Block with a non-empty Composition) is rendered as a wrapper `mb_block()` call with nested child calls.

### Generated Structure

```scad
module mb_block__com__martianmicro__anyclosure__Wall(config = undef, settings = undef){
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
mb_block__com__martianmicro__anyclosure__DefaultEnclosure__Total
mb_block__com__martianmicro__anyclosure__DefaultEnclosure__Print
mb_block__com__martianmicro__anyclosure__DefaultEnclosure__Step
mb_block__com__martianmicro__anyclosure__DefaultEnclosure__Instance
```

### Instance Dispatcher

The Instance submodule dispatches to per-instance submodules via if/else chain:

```scad
module mb_block__com__martianmicro__anyclosure__DefaultEnclosure__Instance(config = undef, settings = undef){
    instanceId = mb_param(config, settings, "instanceId");
    if(instanceId == "00001"){
        mb_block__com__martianmicro__anyclosure__DefaultEnclosure__Instance_00001(...);
    }
    else if(instanceId == "00002"){
        mb_block__com__martianmicro__anyclosure__DefaultEnclosure__Instance_00002(...);
    }
    ...
}
```

Per-instance submodule names use the instance ID appended with an underscore:

```scad
mb_block__com__martianmicro__anyclosure__DefaultEnclosure__Instance_00001
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

---

## Preset File Rendering

A `<blockPresets>` document is rendered to an OpenSCAD Customizer JSON file:

```json
{
  "fileFormatVersion": "1",
  "parameterSets": {
    "Brick 2x4": {
      "size": "[2, 4, 3]",
      "baseColor": "#EAC645",
      "studs": "true"
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
