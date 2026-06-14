# MachineBlocks Compiler — MBML

version: 1.0.0

## Purpose of this Document

This document defines the MBML (MachineBlocks Markup Language) format — the declarative authoring language for MachineBlocks blocks, sets, and presets.

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

MBML defines three core document types:

```text
<block>        — Block Definition
<set>          — Set Definition
<blockPresets> — Parameter Presets for a specific block
```

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
<ac:Wall id="00003" size="[1, 8, 9]" />
```

is resolved by the Namespace Resolver to the FQN:

```text
com.martianmicro.anyclosure.Wall
```

The MBOM always uses the full FQN. Namespace prefixes are a MBML authoring convenience only.

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
<baseType>          — FQN of the parent type
<version>           — semantic version of this block definition
```

### Structure

```xml
<block xmlns="http://www.machineblocks.com/mbml/block.xsd"
       xmlns:bricks="com.machineblocks.bricks">

  <name>Wall</name>
  <fullQualifiedName>com.martianmicro.anyclosure.Wall</fullQualifiedName>
  <baseType>com.machineblocks.core.Block</baseType>
  <version>1.0.0</version>

  <properties>
    <!-- Native properties (inherited from baseType, listed for documentation) -->
    <property name="size" type="com.machineblocks.types.Size" defaultValue="[1, 8, 9]">
      <documentation>The size of the block.</documentation>
    </property>

    <!-- Custom properties (defined inline, specific to this block) -->
    <property name="wallThickness" type="Integer" defaultValue="1">
      <documentation>Thickness of the wall in grid units.</documentation>
    </property>
  </properties>

  <aggregations>
    <aggregation name="_parts"
                 cardinality="0..n"
                 type="com.machineblocks.bricks.StandardBrick"
                 visibility="hidden">
      <documentation>Internal block parts.</documentation>
    </aggregation>
  </aggregations>

  <compositions>
    <composition aggregation="_parts">

      <bricks:StandardBrick
          id="bottom"
          renderGroup="bottom"
          namespace="bottom"
          size="${[size[0], size[1], size[2] - 1]}"
          recess="true"
          tongue="true"
          recessWallGaps="x+" />

      <bricks:StandardBrick
          id="top"
          renderGroup="top"
          namespace="top"
          size="${[size[0], size[1], 1]}"
          baseCutoutType="groove"
          recessWallGaps="x+" />

    </composition>
  </compositions>

</block>
```

### Properties

Properties are typed parameters of the block. Two kinds exist:

**Native properties** are defined in `com.machineblocks.core.Block` and its base types. They have dedicated SCAD getters (`mb_param_size()`, etc.) and are listed in `09_mbom_properties.yml`.

**Custom properties** are defined inline in the block definition. They are specific to this block type and are not part of the core. They generate generic SCAD getters (`mb_param(config, settings, "wallThickness", 1)`).

Both kinds use the same `<property>` element. The compiler determines whether a property is native or custom by checking `09_mbom_properties.yml`.

### Aggregations

Aggregations describe ownership relationships between a block and its child objects.

```text
name          — aggregation name (convention: leading underscore for internal)
cardinality   — "0..1" | "0..n" | "1..1" | "1..n"
type          — FQN of the child type
visibility    — "public" | "hidden"
```

`visibility="hidden"` marks an aggregation as internal — it is not directly fillable from outside the block definition.

### Compositions

A composition fills an aggregation with concrete child instances directly inside the block definition. It is the internal structure of a composite block.

```text
aggregation   — name of the aggregation to fill
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

## Set Definition (`<set>`)

A set definition describes a concrete arrangement of block instances. It is conceptually equivalent to a SAPUI5 View.

### Structure

```xml
<set xmlns="http://www.machineblocks.com/mbml/set.xsd"
     xmlns:ac="com.martianmicro.anyclosure">

  <name>DefaultEnclosureSet</name>
  <fullQualifiedName>com.martianmicro.anyclosure.DefaultEnclosureSet</fullQualifiedName>
  <version>1.0.0</version>

  <properties>
    <property name="baseColor" type="com.machineblocks.types.Color" defaultValue="#EAC645" />
    <property name="assembly" type="com.machineblocks.types.AssemblyMode" defaultValue="merged" />
  </properties>

  <instances>
    <ac:Floor     id="00001" version="1.0.0" size="[16, 16, 1]" />
    <ac:Corner    id="00002" version="1.0.0" size="[4, 4, 9]"   direction="west"  offset="[0, 0, 1]" />
    <ac:Wall      id="00003" version="1.0.0" size="[1, 8, 9]"   direction="west"  offset="[0, 4, 1]" />
    <ac:Corner    id="00004" version="1.0.0" size="[4, 4, 9]"   direction="north" offset="[0, 12, 1]" />
    <ac:Lid       id="0000A" version="1.0.0" size="[16, 16, 1]" offset="[0, 0, 10]" />
  </instances>

  <steps>
    <step instanceId="00001" />
    <step instanceId="00002" />
    <step instanceId="00003" />
    <step instanceId="00004" />
    <step instanceId="0000A" />
  </steps>

</set>
```

### Instance Attributes

```text
id          — instance ID (used in :: separated full ID)
version     — version of the referenced block type (required)
size        — bounding box
direction   — orientation in the set
offset      — position in the set (grid units)
assembly    — assembly mode for this instance
<property>  — any property of the referenced block type
```

Block instances in a set can be configured in three ways:

**Option 1 — Inline:** All properties defined directly on the instance element.

**Option 2 — Preset reference:** Instance references a `<blockPresets>` document.

**Option 3 — Preset + inline override:** Preset as base, inline properties override individual values. Merge order: preset < inline.

### SCAD Set Output

The SCAD Renderer generates the following views from a set:

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
  "baseType": "com.machineblocks.core.Block",
  "version": "1.0.0",
  "properties": [
    {
      "name": "size",
      "type": "com.machineblocks.types.Size",
      "defaultValue": [1, 8, 9]
    },
    {
      "name": "wallThickness",
      "type": "Integer",
      "defaultValue": 1,
      "documentation": "Thickness of the wall in grid units."
    }
  ],
  "aggregations": [
    {
      "name": "_parts",
      "cardinality": "0..n",
      "type": "com.machineblocks.bricks.StandardBrick",
      "visibility": "hidden"
    }
  ],
  "compositions": [
    {
      "aggregation": "_parts",
      "children": [
        {
          "type": "com.machineblocks.bricks.StandardBrick",
          "id": "bottom",
          "renderGroup": "bottom",
          "namespace": "bottom",
          "size": "${[size[0], size[1], size[2] - 1]}",
          "recess": true,
          "tongue": true,
          "recessWallGaps": "x+"
        },
        {
          "type": "com.machineblocks.bricks.StandardBrick",
          "id": "top",
          "renderGroup": "top",
          "namespace": "top",
          "size": "${[size[0], size[1], 1]}",
          "baseCutoutType": "groove",
          "recessWallGaps": "x+"
        }
      ]
    }
  ]
}
```

---

## MBML→MBOM Mapping

The MBML→MBOM mapping is defined once per root type and applies uniformly to all documents of that type. It is configurable and extensible for new root types.

```text
<block>        → Block mapping rule
<set>          → Set mapping rule
<blockPresets> → BlockPresets mapping rule
<device>       → Device mapping rule (external package)
```

The mapping rules define how XML attributes and elements translate to MBOM properties, aggregations, and compositions. They are not hardcoded in the parser — they are registered per root type.
