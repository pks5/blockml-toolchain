# BOM Compiler — BML

version: 2.0.0

## Purpose of this Document

This document defines the BML (Block Markup Language) format — the universal declarative authoring language for BOM Blocks, Composite Blocks, and Presets.

BML is a serialization of BOM, which is itself built on BOM Core. For the abstract object model see `00_bom_core.md`. For the MBOM object model (MachineBlocks domain) see `03_mbom.md`. For the MBOM type system see `04_types.md`. For native MBOM property definitions see `09_mbom_properties.yml`.

---

## Overview

BML is the human- and editor-friendly authoring format for BOM. It describes semantic BOM objects — Blocks, Composite Blocks, and Presets — without any knowledge of render target syntax or parameters.

BML is parsed and validated by `@bom/parser`, which produces a BOM document as output. The BOM is then compiled to the selected render target by `@bom/compiler`.

File extension: `.mbml` (for tooling compatibility). Content-type: `bml`.

---

## Serialization Formats

BML supports two serialization formats. Both are semantically equivalent and produce identical BOM output.

**XML** is the reference format. It supports namespaces, structured documents, and schema validation via XSD.

**JSON** is an equally supported alternative. It uses JSON Schema for validation.

The document type is determined by the root element (XML) or the `type` field (JSON) — not by the file extension or path.

---

## Document Types

BML defines two core document types:

```text
<block>        — Block Definition
<blockPresets> — Property Presets for a specific Block
```

Extension document types (defined in domain packages, not in core):

```text
<device>   — Electronic device (electronics + software) — separate package
<sign>     — Dynamic sign (draft)
<game>     — Board game (draft)
```

Extension types register their own BML→BOM mapping rule with the parser. The core defines the registration mechanism, not the extension types themselves.

---

## Namespaces

BML uses XML namespaces to resolve Block type references. Namespace prefixes map to FQN package prefixes.

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

The BOM always uses the full FQN. Namespace prefixes are a BML authoring convenience only.

### Type Namespace Shorthand

Property `type` attributes do not require the full FQN. Unqualified type names are implicitly resolved against the domain's default type namespace. For MachineBlocks that is `com.machineblocks.types`:

```text
type="Size3D"    →  com.machineblocks.types.Size3D
type="Color"     →  com.machineblocks.types.Color
type="Integer"   →  com.bom.types.Integer
```

Explicit FQNs and namespace-prefixed types are always supported.

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

A Block definition describes a reusable Block type. It declares Members (Properties, Aggregations, Associations, Capabilities) and an optional Composition (internal structure).

### Required Fields

```text
<name>              — short class name (PascalCase)
<fullQualifiedName> — FQN (e.g. com.martianmicro.anyclosure.Wall)
<version>           — semantic version of this Block definition
```

### Optional Fields

```text
<baseType>      — FQN of the parent type. Default: com.machineblocks.core.Block
<properties>    — Property declarations. Omit if no custom properties or default overrides needed.
<aggregations>  — Aggregation declarations. Omit to use the implicit _parts aggregation.
<associations>  — Association declarations.
<capabilities>  — Capability declarations.
<composition>   — internal structure. Omit for Leaf Blocks.
```

### Member Namespace

All Members — Properties, Aggregations, Associations, and Capabilities — share a single namespace per Block. Names must be unique across all member types. A parse-time error is raised for duplicates.

### Conventions

**`baseType`** defaults to `com.machineblocks.core.Block` when omitted. Specify explicitly only when inheriting from a non-default base type:

```xml
<baseType>com.martianmicro.anyclosure.Wall</baseType>
```

**`<aggregations>`** when omitted, an implicit hidden Aggregation `_parts` is created (MachineBlocks domain default):

```text
name:        _parts
cardinality: 0..n
type:        com.machineblocks.bricks.StandardBrick
visibility:  hidden
```

Specify `<aggregations>` explicitly only when you need a different name, type, cardinality, visibility, or multiple Aggregations.

**`<composition>`** when no `aggregation` attribute is specified, the Composition fills the implicit (or sole) `_parts` Aggregation. If multiple explicit Aggregations exist, the `aggregation` attribute is required — the compiler reports an error if it is missing.

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
        size="${ [size[0], size[1], size[2] - 1] }"
        recess="true"
        tongue="true"
        recessWallGaps="x+" />

    <bricks:StandardBrick
        id="top"
        size="${ [size[0], size[1], 1] }"
        offset="${ [0, 0, size[2] - 1] }"
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
        size="${ [size[0], size[1], size[2] - 1] }"
        recess="true"
        tongue="true"
        recessWallGaps="x+" />

    <bricks:StandardBrick
        id="top"
        size="${ [size[0], size[1], 1] }"
        offset="${ [0, 0, size[2] - 1] }"
        recessWallGaps="x+"
        baseCutoutType="groove" />
  </composition>

</block>
```

---

## Members

### Properties

Properties are typed parameters of the Block. Two kinds exist:

**Native properties** are defined in `com.machineblocks.core.Block` and its base types. They have dedicated SCAD getters (`mb_param_size()`, etc.) and are listed in `09_mbom_properties.yml`.

**Custom properties** are defined inline in the Block definition. They generate generic SCAD getters (`mb_param(config, settings, "wallThickness", 1)`).

Both use the same `<property>` element. The compiler determines native vs. custom by checking `09_mbom_properties.yml`. Native properties only need to be declared when their default value differs from the core default.

```xml
<properties>
  <property name="size"          type="Size3D"  defaultValue="[1, 8, 8]" />
  <property name="wallThickness" type="Integer" defaultValue="1" />
</properties>
```

### Aggregations

Aggregations describe ownership relationships. An Aggregation defines that a Block can contain zero or more child objects of a given type.

```xml
<aggregations>
  <aggregation name="_parts"
               cardinality="0..n"
               type="com.machineblocks.bricks.StandardBrick"
               visibility="hidden" />
</aggregations>
```

```text
name          — member name (unique within the Block's member namespace)
cardinality   — "0..1" | "0..n" | "1..1" | "1..n"
type          — FQN of the child type
visibility    — "public" | "hidden"
```

**ServiceBlock Aggregations** bind named service beans into the Block. Once declared, the bean is accessible in Expressions via `@beanName`. The `scope` attribute controls visibility to child Blocks:

```xml
<aggregations>
  <!-- local: only accessible in this Block (default) -->
  <aggregation name="fmt"
               type="com.bom.service.Formatter"
               beanName="fmt"
               cardinality="0..1"
               scope="local"
               visibility="hidden" />

  <!-- context: passed down to all child Blocks in Compositions, overridable -->
  <aggregation name="data"
               type="com.bom.service.JSONModel"
               beanName="data"
               cardinality="0..1"
               scope="context"
               visibility="hidden" />
</aggregations>
```

`scope="context"` beans are resolved by walking up the Composition hierarchy — a child Block sees the nearest `@data` with `scope="context"` in any ancestor.

### Associations

Associations describe loose references without ownership. Defined for future use.

```xml
<associations>
  <association name="targetDevice"
               type="com.electronics.core.Component"
               cardinality="0..1" />
</associations>
```

### Capabilities

Capabilities describe how a Block communicates. Like Properties, they are declared with a name and a class (FQN). Their value in a Composition is the address or binding — set as an attribute on the child Block instance, just like a Property value.

> **Capability package TBD** — placeholder `com.bom.capability.*`. Candidate: `bom.foundation`.

```xml
<capabilities>

  <!-- AsyncInbound: receives a message asynchronously -->
  <capability name="resize"
              class="com.bom.capability.AsyncInbound"
              payloadType="com.myDomain.ResizePayload">
    <documentation>Resize the block to the given dimensions.</documentation>
  </capability>

  <!-- AsyncInbound with optional returnType (for replyTo) -->
  <capability name="query"
              class="com.bom.capability.AsyncInbound"
              payloadType="com.myDomain.QueryPayload"
              returnType="com.myDomain.QueryResult">
    <documentation>Query and receive an async reply.</documentation>
  </capability>

  <!-- AsyncOutbound: sends a message asynchronously -->
  <capability name="resized"
              class="com.bom.capability.AsyncOutbound"
              payloadType="com.myDomain.ResizedPayload">
  </capability>

  <!-- Sync: callable within Expressions only, returnType required -->
  <capability name="computeArea"
              class="com.bom.capability.Sync"
              payloadType="Array&lt;Integer&gt;"
              returnType="Integer">
    <documentation>Returns width * height.</documentation>
  </capability>

</capabilities>
```

**Payload type forms:**

```text
com.bom.types.Integer            — primitive
com.myDomain.MyClass             — Object (named fields)
Array&lt;Integer&gt;             — Array of primitives  (XML-escaped: Array<Integer>)
Array&lt;com.myDomain.MyClass&gt; — Array of objects
```

Unqualified type names resolve against the domain's default type namespace (determined by the Block's `baseType`).

**`AsyncInbound`** and **`AsyncOutbound`**: `returnType` is optional (for async reply via `replyTo`).
**`Sync`**: `returnType` is required. No address — only callable within Expressions.

**`visibility="hidden"`**: Capability is internal — cannot be bound from outside the Block's Composition. Accessible within the Block's own Expressions and internal Compositions only.

---

## Composition

A Composition fills an Aggregation with concrete child Block instances. It is the internal structure of a Composite Block.

```text
aggregation   — name of the Aggregation to fill (optional if only one exists)
```

Child elements inside `<composition>` are Block instances. Each instance:

```text
Tag name      — class name (with namespace prefix)
id            — part ID (used for instance ID: parentId::partId)
renderGroup   — optional, fallback = id
namespace     — optional, fallback = id
version       — optional, version of the referenced Block type
(attributes)  — any Member value of the referenced Block type (camelCase)
```

Member values on child instances may be literals or Expressions.

### Expressions in Compositions

Property values:

```xml
<!-- Array literal (pure) -->
size="[1, 8, 9]"

<!-- Object literal (pure) -->
config="{mode: 'groove', depth: 2}"

<!-- Expression: property reference -->
size="${ [size[0], size[1], size[2] - 1] }"

<!-- Expression: object with property reference and model binding -->
config="${ {mode: baseCutoutType, label: @myModel:/config/label} }"

<!-- Expression: built-in service call -->
size="${ [size[0], size[1], #math.max(size[2] - 1, 0)] }"

<!-- Expression: bean call, named parameters (Object payload) -->
label="${ @myFormatter.format(value = size[0], unit = 'mm') }"

<!-- Expression: bean call, object literal (equivalent) -->
label="${ @myFormatter.format({value: size[0], unit: 'mm'}) }"

<!-- Expression: model binding (absolute) -->
label="${ @myModel:/config/label }"

<!-- Expression: model binding (relative — requires binding context on parent aggregation) -->
label="${ @myModel:label }"

<!-- Expression: ternary -->
baseCutoutType="${ size[2] > 2 ? 'groove' : 'standard' }"
```

Capability values:

```xml
<!-- Absolute URI → AsyncOutbound routing -->
<ac:MyBlock onResized="stud://enclosure/blocks/resized" />

<!-- Relative path → context-resolved (TBD) -->
<ac:MyBlock onResized="/blocks/resized" />

<!-- Capability linking: AsyncOutbound → AsyncInbound, or Sync → Sync -->
<ac:MyBlock onResized="${ @myService.resizeHandler }" />

<!-- Dynamic address: Sync Capability returns the address String -->
<ac:MyBlock onResized="${ @myService.getAddress() }" />
```

See `00_bom_core.md` — Expression System for the full specification.

### Registry

Sibling child Blocks within the same Composition can share values via the registry:

```xml
<!-- Child 1 writes -->
<SomeBlock registry.totalHeight="${ size[2] }" ... />

<!-- Child 2 reads -->
<OtherBlock size="${ [1, 1, registry.totalHeight - 1] }" ... />
```

Registry scope is per Composition.

---

## MachineBlocks Set Definition

A MachineBlocks Set is a Block whose `baseType` is `com.machineblocks.core.Set`. It uses the standard `<block>` document type — there is no separate root element for Sets.

A Set uses three conventional Aggregations to separate concerns:

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

`com.machineblocks.core.Place` and `com.machineblocks.core.Step` are lightweight MachineBlocks Block types. They are used as children in their respective Compositions exactly like any other Block type — resolved via namespace prefix, instantiated by the BOM Mapper.

`Place` members:

```text
id         — instance ID (becomes the SCAD instance id)
blockId    — references a Block configuration from _blocks
direction  — orientation in the set
offset     — position in the set (grid units)
```

`Step` members:

```text
placeId    — references a Place in _placement
```

When `_steps` is omitted, assembly order equals the document order of `_placement` entries.

### Block Reuse

Because `_blocks` and `_placement` are separated, one Block configuration can be referenced by multiple placements without duplication:

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

### Block Configuration Modes

Three modes, combinable:

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

The SCAD Renderer detects `baseType = com.machineblocks.core.Set` and generates four view submodules:

```text
total     — all instances assembled at their positions
print     — all instances laid out for 3D printing
step      — step-by-step assembly instruction
instance  — single instance in isolation
```

---

## Block Presets (`<blockPresets>`)

A `<blockPresets>` document defines named property presets for a specific Block type. Presets apply only to Properties. For complex structures, define a Composite Block and apply a Preset to that.

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
BML:   src/com/machineblocks/bricks/StandardBrickPresets.mbml
JSON:  scad/com/machineblocks/bricks/StandardBrick.json
```

The output filename matches the referenced Block's SCAD file, with `.json` extension.

Only Properties that differ from the Block's defaults are required in a preset. Whether the compiler fills missing properties with defaults or relies on OpenSCAD's own fallback is to be verified against OpenSCAD Customizer behavior.

---

## Config Profiles

Config profiles use the same format as `<blockPresets>` and share the same property namespace as Block properties. They define project-wide hardware or rendering defaults.

```text
src/config/prusa_pla.mbml   — printer + filament profile
src/config/scale_2x.mbml    — scale profile
```

Only one config profile is active at a time (set via `bom activate-config`). Merge priority:

```text
configProfile < blockPreset < inline property
```

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
    { "name": "size",          "type": "Size3D",  "defaultValue": [1, 8, 8] },
    { "name": "baseColor",     "type": "Color",   "defaultValue": "#303D4E" },
    { "name": "wallThickness", "type": "Integer", "defaultValue": 1,
      "documentation": "Thickness of the wall in grid units." }
  ],
  "compositions": [
    {
      "children": [
        {
          "type": "com.machineblocks.bricks.StandardBrick",
          "id": "bottom",
          "size": "${ [size[0], size[1], size[2] - 1] }",
          "recess": true,
          "tongue": true,
          "recessWallGaps": "x+"
        },
        {
          "type": "com.machineblocks.bricks.StandardBrick",
          "id": "top",
          "size": "${ [size[0], size[1], 1] }",
          "offset": "${ [0, 0, size[2] - 1] }",
          "baseCutoutType": "groove",
          "recessWallGaps": "x+"
        }
      ]
    }
  ]
}
```

### MachineBlocks Set Definition (JSON)

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

## BML→BOM Mapping

The BML→BOM mapping is defined once per root type and applies uniformly to all documents of that type. It is configurable and extensible for new root types.

```text
<block>        → Block mapping rule
<blockPresets> → BlockPresets mapping rule
<device>       → Device mapping rule (external package)
```

Mapping rules are not hardcoded in the parser — they are registered per root type.

There is no separate mapping rule for MachineBlocks Sets. The `<block>` mapping rule handles them identically to any other Block. The SCAD Renderer detects `baseType = com.machineblocks.core.Set` and switches to STEPS-based output.

### Default Resolution

```text
baseType missing              → com.machineblocks.core.Block
<aggregations> missing        → implicit _parts aggregation (hidden, 0..n)
<composition> without aggregation attribute
  + implicit _parts exists    → fills _parts
  + explicit aggregations     → compiler error: aggregation attribute required
type="Foo" (unqualified)      → resolved against domain default type namespace
_steps missing or empty       → assembly order = document order of _placement
```
