# MachineBlocks Compiler — MBML

version: 1.0.0

## Purpose of this Document

This document defines the MBML (MachineBlocks Markup Language) format — the declarative authoring language for MachineBlocks blocks, sets, and presets.

MBML is a serialization of MBOM, which is itself a domain-specific specialization of BOM Core. For the abstract object model see `00_bom_core.md`.
For the MBOM object model see `03_mbom.md`.
For the MBOM type system see `04_types.md`.
For native property definitions see `09_mbom_properties.yml`.

---

## Overview

MBML is the human- and editor-friendly authoring format for MachineBlocks. It describes semantic MachineBlocks objects — blocks, sets, and presets — without any knowledge of SCAD syntax or parameters.

MBML is parsed and validated by `@machineblocks/mbml`, which produces MBOM as output. The MBOM is then compiled to SCAD by `@machineblocks/scad-renderer`.

---

## Serialization Formats

MBML supports two serialization formats. Both are semantically equivalent and produce identical MBOM output.

**XML** is the reference format. It supports namespaces, structured documents, and schema validation via XSD.

**JSON** is an equally supported alternative. It uses JSON Schema for validation.

The document type is determined by the root element (XML) or the `type` field (JSON) — not by the file extension or path.

---

## Document Types

MBML defines two core document types:

```text
<block>        — Block Definition (includes Sets, which are Blocks with baseType=com.bom.core.Set)
<blockPresets> — Parameter Presets for a specific Block
```

A **Set** is not a separate document type in MBML. It is a `<block>` document with `<baseType>com.machineblocks.core.Set</baseType>`. The SCAD Renderer detects the Set base type and produces STEPS-based output instead of a composite `mb_block()`. See the Set Definition section below.

Extension document types (defined in external packages, not in core):

```text
<device>   — Electronic device (set + electronics + software) — separate package
<sign>     — Dynamic sign (draft)
<game>     — Board game (draft)
```

Extension types register their own MBML→MBOM mapping rule with the parser. The core defines the registration mechanism, not the extension types themselves.

---

## Namespaces

MBML uses XML namespaces to resolve block type references. Namespace prefixes map to FQN package prefixes.

```xml
xmlns:core="com.machineblocks.core"
xmlns:bricks="com.machineblocks.bricks"
xmlns:ac="com.martianmicro.anyclosure"
```

A type reference using a prefix:

```xml
<ac:Wall id="wall" size="[1, 8, 9]" />
```

is resolved by the Namespace Resolver to the FQN:

```text
com.martianmicro.anyclosure.Wall
```

The MBOM always uses the full FQN. Namespace prefixes are a MBML authoring convenience only.

### Type Namespace Shorthand

Property `type` attributes do not require the full FQN. Unqualified type names are implicitly resolved against `com.machineblocks.types`:

```text
type="Size3D"    →  com.machineblocks.types.Size3D
type="Color"     →  com.machineblocks.types.Color
type="Boolean"   →  com.machineblocks.types.Boolean
```

Explicit FQNs and namespace-prefixed types are always supported for types outside `com.machineblocks.types`.

---

## Schema Validation

Each document type has its own schema:

```text
XML:   XSD schema  (http://www.machineblocks.com/mbml/<type>.xsd)
JSON:  JSON Schema
```

Extension document types bring their own schema. The schema location and management details are to be defined.

---

## Block Definition (`<block>`)

A block definition describes a reusable block type. It combines a control definition (properties, aggregations) with an optional composition (internal structure).

### Required Fields

```text
<name>              — short class name (PascalCase)
<fullQualifiedName> — FQN (e.g. com.martianmicro.anyclosure.Wall)
<version>           — semantic version of this block definition
```

### Optional Fields

```text
<baseType>      — FQN of the parent type. Default: com.machineblocks.core.Block
<properties>    — property declarations. Omit if no custom properties or default overrides needed.
<aggregations>  — aggregation declarations. Omit to use the implicit _parts aggregation.
<composition>   — internal structure. Omit for primitive (leaf) blocks.
```

### Conventions

**`baseType`** defaults to `com.machineblocks.core.Block` when omitted. Specify explicitly only when inheriting from a non-default base type:

```xml
<baseType>com.martianmicro.anyclosure.Wall</baseType>
```

**`<aggregations>`** when omitted, an implicit hidden aggregation `_parts` is created:

```text
name:        _parts
cardinality: 0..n
type:        com.machineblocks.bricks.StandardBrick
visibility:  hidden
```

Specify `<aggregations>` explicitly only when you need a different aggregation name, type, cardinality, or visibility — or multiple aggregations.

**`<composition>`** when no `aggregation` attribute is specified, the composition fills the implicit (or sole) `_parts` aggregation. Specify `aggregation` explicitly only when multiple aggregations exist.

### Minimal Block Example

```xml
<block xmlns="http://www.machineblocks.com/mbml/block.xsd"
       xmlns:bricks="com.machineblocks.bricks">

  <name>Wall</name>
  <fullQualifiedName>com.martianmicro.anyclosure.Wall</fullQualifiedName>
  <version>1.0.0</version>

  <composition>
    <bricks:StandardBrick
        id="bottom"
        size="${[size[0], size[1], size[2] - 1]}"
        recess="true"
        tongue="true"
        recessWallGaps="x+" />

    <bricks:StandardBrick
        id="top"
        size="${[size[0], size[1], 1]}"
        offset="${[0, 0, size[2] - 1]}"
        recessWallGaps="x+"
        baseCutoutType="groove" />
  </composition>

</block>
```

### Full Block Example

```xml
<block xmlns="http://www.machineblocks.com/mbml/block.xsd"
       xmlns:bricks="com.machineblocks.bricks">

  <name>Wall</name>
  <fullQualifiedName>com.martianmicro.anyclosure.Wall</fullQualifiedName>
  <baseType>com.machineblocks.core.Block</baseType>
  <version>1.0.0</version>

  <properties>
    <!-- Native properties with non-default values -->
    <property name="size"      type="Size3D"       defaultValue="[1, 8, 8]" />
    <property name="baseColor" type="Color"        defaultValue="#303D4E" />
    <property name="assembly"  type="AssemblyMode" defaultValue="Merged" />

    <!-- Custom properties -->
    <property name="wallThickness" type="Integer" defaultValue="1">
      <documentation>Thickness of the wall in grid units.</documentation>
    </property>
  </properties>

  <aggregations>
    <aggregation name="_parts"
                 cardinality="0..n"
                 type="com.machineblocks.bricks.StandardBrick"
                 visibility="hidden" />
  </aggregations>

  <composition aggregation="_parts">
    <bricks:StandardBrick
        id="bottom"
        size="${[size[0], size[1], size[2] - 1]}"
        recess="true"
        tongue="true"
        recessWallGaps="x+" />

    <bricks:StandardBrick
        id="top"
        size="${[size[0], size[1], 1]}"
        offset="${[0, 0, size[2] - 1]}"
        recessWallGaps="x+"
        baseCutoutType="groove" />
  </composition>

</block>
```

### Properties

Properties are typed parameters of the block. Two kinds exist:

**Native properties** are defined in `com.machineblocks.core.Block` and its base types. They have dedicated SCAD getters (`mb_param_size()`, etc.) and are listed in `09_mbom_properties.yml`.

**Custom properties** are defined inline in the block definition. They are specific to this block type and are not part of the core. They generate generic SCAD getters (`mb_param(config, settings, "wallThickness", 1)`).

Both kinds use the same `<property>` element. The compiler determines whether a property is native or custom by checking `09_mbom_properties.yml`.

Native properties only need to be listed in `<properties>` when their default value differs from the core default.

### Aggregations

Aggregations describe ownership relationships between a block and its child objects.

```text
name          — aggregation name (convention: leading underscore for internal)
cardinality   — "0..1" | "0..n" | "1..1" | "1..n"
type          — FQN of the child type
visibility    — "public" | "hidden"
```

`visibility="hidden"` marks an aggregation as internal — it is not directly fillable from outside the block definition.

When `<aggregations>` is omitted, the compiler creates an implicit `_parts` aggregation (hidden, 0..n). This covers the vast majority of composite blocks.

### Composition

A composition fills an aggregation with concrete child instances directly inside the block definition. It is the internal structure of a composite block.

```text
aggregation   — name of the aggregation to fill (optional, defaults to "_parts")
```

Child elements inside `<composition>` are block instances. Each instance:

```text
Tag name      — class name (with namespace prefix)
id            — part ID (used for instance ID: parentId::bottom)
renderGroup   — optional, fallback = id
namespace     — optional, fallback = id
version       — optional, version of the referenced block type
<properties>  — any property of the referenced block type (camelCase)
```

**Expressions** in property values use SpEL syntax wrapped in `${}`:

```xml
size="${[size[0], size[1], size[2] - 1]}"
```

See `03_mbom.md` for expression scope and rules.

---

## Set Definition

A Set is a Block whose `baseType` is `com.machineblocks.core.Set` (which extends `com.bom.core.Set`). It uses the standard `<block>` document type — there is no separate `<set>` root element.

A Set uses Multi-Aggregation to separate three concerns into distinct Compositions. The aggregation names `_blocks`, `_placement`, and `_steps` are conventional for Sets.

```text
_blocks     — Block configurations (what exists, how it is parameterized)
_placement  — placed instances (where each block is; id becomes the SCAD instance id)
_steps      — assembly order (optional; defaults to document order of _placement)
```

### Structure

```xml
<block xmlns="http://www.machineblocks.com/mbml/block.xsd"
       xmlns:core="com.machineblocks.core"
       xmlns:ac="com.martianmicro.anyclosure">

  <name>DefaultEnclosure</name>
  <fullQualifiedName>com.martianmicro.anyclosure.DefaultEnclosure</fullQualifiedName>
  <baseType>com.machineblocks.core.Set</baseType>
  <version>1.0.0</version>

  <properties>
    <property name="baseColor"      type="Color"        defaultValue="#EAC645" />
    <property name="highlightColor" type="Color"        defaultValue="#55AB68" />
    <property name="assembly"       type="AssemblyMode" defaultValue="Merged"  />
  </properties>

  <aggregations>
    <aggregation name="_blocks"    cardinality="0..n" type="com.machineblocks.core.Block" visibility="hidden" />
    <aggregation name="_placement" cardinality="0..n" type="com.machineblocks.core.Place" visibility="hidden" />
    <aggregation name="_steps"     cardinality="0..n" type="com.machineblocks.core.Step"  visibility="hidden" />
  </aggregations>

  <composition aggregation="_blocks">
    <ac:Floor  id="floor"  version="1.0.0" size="[16, 16, 1]" />
    <ac:Corner id="corner" version="1.0.0" size="[4, 4, 9]"   />
    <ac:Wall   id="wall"   version="1.0.0" size="[1, 8, 9]"   />
    <ac:Lid    id="lid"    version="1.0.0" size="[16, 16, 1]" />
  </composition>

  <composition aggregation="_placement">
    <core:Place id="00001" blockId="floor"  direction="West"  offset="[0, 0, 0]"   />
    <core:Place id="00002" blockId="corner" direction="West"  offset="[0, 0, 1]"   />
    <core:Place id="00003" blockId="wall"   direction="West"  offset="[0, 4, 1]"   />
    <core:Place id="00004" blockId="corner" direction="North" offset="[0, 12, 1]"  />
    <core:Place id="00005" blockId="wall"   direction="North" offset="[4, 15, 1]"  />
    <core:Place id="00006" blockId="corner" direction="East"  offset="[12, 12, 1]" />
    <core:Place id="00007" blockId="wall"   direction="East"  offset="[15, 4, 1]"  />
    <core:Place id="00008" blockId="corner" direction="South" offset="[12, 0, 1]"  />
    <core:Place id="00009" blockId="wall"   direction="South" offset="[4, 0, 1]"   />
    <core:Place id="0000A" blockId="lid"    direction="West"  offset="[0, 0, 10]"  />
  </composition>

  <!-- _steps omitted → assembly order = document order of _placement -->

</block>
```

### Place and Step

`com.machineblocks.core.Place` and `com.machineblocks.core.Step` are lightweight Block types defined in MBOM. They are used as children in their respective Compositions exactly like any other Block type — resolved via namespace prefix, instantiated by the MBOM Mapper.

`Place` properties:

```text
id         — instance ID (becomes the SCAD instance id)
blockId    — references a Block configuration from _blocks
direction  — orientation in the set
offset     — position in the set (grid units)
```

`Step` properties:

```text
placeId    — references a Place in _placement
```

When `_steps` is omitted, assembly order equals the document order of `_placement` entries.

### Block Reuse

Because `_blocks` and `_placement` are separated, one Block configuration can be placed multiple times without duplication:

```xml
<composition aggregation="_blocks">
  <ac:Wall id="wall" version="1.0.0" size="[1, 8, 9]" baseColor="#303D4E" />
</composition>

<composition aggregation="_placement">
  <core:Place id="00003" blockId="wall" direction="West"  offset="[0, 4, 1]"  />
  <core:Place id="00005" blockId="wall" direction="North" offset="[4, 15, 1]" />
  <core:Place id="00007" blockId="wall" direction="East"  offset="[15, 4, 1]" />
  <core:Place id="00009" blockId="wall" direction="South" offset="[4, 0, 1]"  />
</composition>
```

### Block Configuration in a Set

Three configuration modes, combinable:

```text
Option 1 — Inline:
  All properties defined directly on the Block entry in _blocks.

Option 2 — Preset reference:
  Block references a blockPresets document.
  All preset values apply.

Option 3 — Preset + inline override:
  Preset as base. Inline properties override individual values.
  Merge order: configProfile < blockPreset < inline property
```

### SCAD Set Output

The SCAD Renderer detects `baseType = com.machineblocks.core.Set` and generates the following views:

```text
total     — all instances assembled at their positions
print     — all instances laid out for 3D printing
step      — step-by-step assembly instruction
instance  — single instance in isolation
```

Bounding box is computed at SCAD render time via `mb_set_bounding_box(STEPS)` — not precomputed by the compiler.

---

## Block Presets (`<blockPresets>`)

A `<blockPresets>` document defines named parameter presets for a specific block type. It is the source for OpenSCAD Customizer preset files (`.json`).

### Structure

```xml
<blockPresets xmlns="http://www.machineblocks.com/mbml/blockPresets.xsd">

  <fullQualifiedName>com.machineblocks.bricks.StandardBrickPresets</fullQualifiedName>
  <blockType>com.machineblocks.bricks.StandardBrick</blockType>
  <version>1.0.0</version>

  <preset name="Brick 2x4">
    <size>[2, 4, 3]</size>
    <baseColor>#EAC645</baseColor>
    <studs>true</studs>
  </preset>

  <preset name="Brick 1x1">
    <size>[1, 1, 3]</size>
    <baseColor>#EAC645</baseColor>
  </preset>

</blockPresets>
```

### SCAD Output

A `<blockPresets>` document compiles to a `.json` file in OpenSCAD Customizer format:

```text
MBML:  src/com/machineblocks/bricks/StandardBrickPresets.mbml
JSON:  scad/com/machineblocks/bricks/StandardBrick.json
```

The output filename matches the referenced block's SCAD file, with `.json` extension. The output sits in the same directory as the block's `.scad` file.

Only properties that differ from the block's defaults are required in a preset. Whether the compiler fills missing properties with defaults or relies on OpenSCAD's own fallback is to be verified against OpenSCAD Customizer behavior.

---

## Config Profiles

Config profiles use the same format as `<blockPresets>` and share the same property namespace as block properties. They define project-wide hardware or rendering defaults (printer calibration, filament shrinkage, scale, etc.).

```text
src/config/prusa_pla.mbml   — printer + filament profile
src/config/scale_2x.mbml    — scale profile
```

Only one config profile is active at a time (set via `mbc activate-config`). Merge priority:

```text
configProfile < blockPreset < inline property
```

---

## Expressions

Property values in compositions and sets can contain SpEL expressions wrapped in `${}`:

```xml
size="${[size[0], size[1], size[2] - 1]}"
condition="${parameters.size[0] > 2 ? true : false}"
offset="${[0, 0, math.max(parameters.size[2] - 1, 0)]}"
```

Expression roots available in a composition child instance:

```text
parameters   — properties of the current block instance (read-only)
math         — math.min(), math.max(), math.ceil(), math.floor(), etc.
registry     — shared registry within the current composition (read/write)
```

Registry usage:

```xml
<!-- write -->
<SomeBlock registry.totalHeight="${parameters.size[2]}" ... />

<!-- read -->
<OtherBlock size="${[1, 1, registry.totalHeight - 1]}" ... />
```

Expression scope rules:

```text
- Access only to properties of the current block instance (via parameters)
- No access to parent, grandparent, or sibling blocks
- Direction is always parent → child (top-down only)
- Registry scope is per composition (not global, not per set)
```

See `03_mbom.md` for the Expression AST definition.

---

## JSON Format

The JSON format is semantically equivalent to XML. The document type is determined by the `type` field.

### Block Definition (JSON)

```json
{
  "type": "block",
  "name": "Wall",
  "fullQualifiedName": "com.martianmicro.anyclosure.Wall",
  "version": "1.0.0",
  "properties": [
    {
      "name": "size",
      "type": "Size3D",
      "defaultValue": [1, 8, 8]
    },
    {
      "name": "baseColor",
      "type": "Color",
      "defaultValue": "#303D4E"
    },
    {
      "name": "wallThickness",
      "type": "Integer",
      "defaultValue": 1,
      "documentation": "Thickness of the wall in grid units."
    }
  ],
  "compositions": [
    {
      "children": [
        {
          "type": "com.machineblocks.bricks.StandardBrick",
          "id": "bottom",
          "size": "${[size[0], size[1], size[2] - 1]}",
          "recess": true,
          "tongue": true,
          "recessWallGaps": "x+"
        },
        {
          "type": "com.machineblocks.bricks.StandardBrick",
          "id": "top",
          "size": "${[size[0], size[1], 1]}",
          "offset": "${[0, 0, size[2] - 1]}",
          "baseCutoutType": "groove",
          "recessWallGaps": "x+"
        }
      ]
    }
  ]
}
```

### Set Definition (JSON)

```json
{
  "type": "block",
  "name": "DefaultEnclosure",
  "fullQualifiedName": "com.martianmicro.anyclosure.DefaultEnclosure",
  "baseType": "com.machineblocks.core.Set",
  "version": "1.0.0",
  "properties": [
    { "name": "baseColor",      "type": "Color",        "defaultValue": "#EAC645" },
    { "name": "highlightColor", "type": "Color",        "defaultValue": "#55AB68" },
    { "name": "assembly",       "type": "AssemblyMode", "defaultValue": "Merged"  }
  ],
  "aggregations": [
    { "name": "_blocks",    "cardinality": "0..n", "type": "com.machineblocks.core.Block", "visibility": "hidden" },
    { "name": "_placement", "cardinality": "0..n", "type": "com.machineblocks.core.Place", "visibility": "hidden" },
    { "name": "_steps",     "cardinality": "0..n", "type": "com.machineblocks.core.Step",  "visibility": "hidden" }
  ],
  "compositions": [
    {
      "aggregation": "_blocks",
      "children": [
        { "type": "com.martianmicro.anyclosure.Floor",  "id": "floor",  "version": "1.0.0", "size": [16, 16, 1] },
        { "type": "com.martianmicro.anyclosure.Corner", "id": "corner", "version": "1.0.0", "size": [4, 4, 9]   },
        { "type": "com.martianmicro.anyclosure.Wall",   "id": "wall",   "version": "1.0.0", "size": [1, 8, 9]   },
        { "type": "com.martianmicro.anyclosure.Lid",    "id": "lid",    "version": "1.0.0", "size": [16, 16, 1] }
      ]
    },
    {
      "aggregation": "_placement",
      "children": [
        { "type": "com.machineblocks.core.Place", "id": "00001", "blockId": "floor",  "direction": "West",  "offset": [0, 0, 0]   },
        { "type": "com.machineblocks.core.Place", "id": "00002", "blockId": "corner", "direction": "West",  "offset": [0, 0, 1]   },
        { "type": "com.machineblocks.core.Place", "id": "00003", "blockId": "wall",   "direction": "West",  "offset": [0, 4, 1]   },
        { "type": "com.machineblocks.core.Place", "id": "00004", "blockId": "corner", "direction": "North", "offset": [0, 12, 1]  },
        { "type": "com.machineblocks.core.Place", "id": "00005", "blockId": "wall",   "direction": "North", "offset": [4, 15, 1]  },
        { "type": "com.machineblocks.core.Place", "id": "00006", "blockId": "corner", "direction": "East",  "offset": [12, 12, 1] },
        { "type": "com.machineblocks.core.Place", "id": "00007", "blockId": "wall",   "direction": "East",  "offset": [15, 4, 1]  },
        { "type": "com.machineblocks.core.Place", "id": "00008", "blockId": "corner", "direction": "South", "offset": [12, 0, 1]  },
        { "type": "com.machineblocks.core.Place", "id": "00009", "blockId": "wall",   "direction": "South", "offset": [4, 0, 1]   },
        { "type": "com.machineblocks.core.Place", "id": "0000A", "blockId": "lid",    "direction": "West",  "offset": [0, 0, 10]  }
      ]
    }
  ]
}
```

---

## MBML→MBOM Mapping

The MBML→MBOM mapping is defined once per root type and applies uniformly to all documents of that type. It is configurable and extensible for new root types.

```text
<block>        → Block mapping rule (covers all Blocks, including Sets)
<blockPresets> → BlockPresets mapping rule
<device>       → Device mapping rule (external package)
```

The mapping rules define how XML attributes and elements translate to MBOM properties, aggregations, and compositions. They are not hardcoded in the parser — they are registered per root type.

There is no separate mapping rule for Sets. The `<block>` mapping rule handles Sets identically to any other Block. The SCAD Renderer detects `baseType = com.machineblocks.core.Set` and switches to STEPS-based output.

### Default Resolution for Block Definitions

```text
baseType missing        → com.machineblocks.core.Block
<aggregations> missing  → implicit _parts aggregation (hidden, 0..n)
<composition> without aggregation attribute
  + implicit _parts exists → fills _parts
  + explicit aggregations  → compiler error: aggregation attribute required
type="Foo" (unqualified) → com.machineblocks.types.Foo
```

### Default Resolution for Set Definitions

```text
baseType = com.machineblocks.core.Set  → SCAD Renderer produces STEPS + view submodules
_steps aggregation missing or empty    → assembly order = document order of _placement entries
```
