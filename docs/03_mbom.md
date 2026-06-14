# MachineBlocks Compiler — MBOM

version: 1.0.0

## Purpose of this Document

This document defines the MBOM (MachineBlocks Object Model) — the canonical, typed internal representation of all MachineBlocks data. MBOM is the interface between the MBML parser and the SCAD renderer.

For the MBML authoring format see `02_mbml.md`.
For the MBOM type system and serialization rules see `04_types.md`.
For native property definitions see `09_mbom_properties.yml`.

---

## Overview

MBOM is the renderer-independent object model. It has no knowledge of SCAD syntax, parameters, or file formats. All block authoring, validation, composition, and expression evaluation operate on MBOM.

MBOM is strongly inspired by the SAPUI5 object model. Existing SAPUI5 concepts are adopted where they fit. Deviations are documented explicitly.

### SAPUI5 Analogy

```text
SAPUI5 Control            →  MBOM Block
SAPUI5 Composite Control  →  MBOM Composite Block
SAPUI5 View               →  MBOM Set
SAPUI5 Property           →  MBOM Property
SAPUI5 Aggregation        →  MBOM Aggregation
SAPUI5 Association        →  MBOM Association
SAPUI5 Event              →  MBOM Event
```

Key differences from SAPUI5:

```text
Expression syntax:  SpEL (not SAPUI5 binding syntax)
Block definition:   combines control definition + composition
                    (control definition + fragment/view in SAPUI5 terms)
Domain:             physical, parametric geometry objects
                    (not UI controls)
```

---

## Object Identity

Every MBOM object has a globally unique identity based on its FQN (Fully Qualified Name).

### Class Identity (FQN)

The FQN uniquely identifies a block class:

```text
com.machineblocks.core.Block
com.machineblocks.bricks.StandardBrick
com.martianmicro.anyclosure.Wall
com.martianmicro.anyclosure.Corner
```

FQN conventions:

```text
Package segments:  lowercase, dot-separated, reverse-domain
Class name:        PascalCase
Full FQN:          <reverse-domain-package>.<ClassName>
```

### Instance Identity

Block instances (within a set or composition) have an instance ID. Instance IDs are composed using `::` as separator:

```text
Format:    <instanceId>::<partId>::<subPartId>

Examples:
  00001::bottom
  00001::bottom::inner
  com.martianmicro.anyclosure.Wall::bottom   ← FQN as fallback (no instance ID)
```

Instance IDs can be specified explicitly or are auto-generated. Auto-generated IDs follow a deterministic scheme (details to be defined). The FQN is the fallback when no instance ID is present.

---

## Metadata Model

Every MBOM class has metadata that describes its structure. Metadata is defined in the block definition and used by the parser, validator, compiler, and editor.

```text
name               — short class name
fullQualifiedName  — FQN
baseType           — FQN of the parent class (default: com.machineblocks.core.Block)
version            — semantic version of this class definition
properties         — list of Property metadata
aggregations       — list of Aggregation metadata
associations       — list of Association metadata
events             — list of Event metadata
```

---

## Properties

Properties are typed parameters of a block. Every property has a name, a type, and a default value.

### Native vs. Custom Properties

**Native properties** are defined in `com.machineblocks.core.Block` and its base types. They are listed in `09_mbom_properties.yml` and have dedicated SCAD getters in the render target (`mb_param_size()`, `mb_param_baseColor()`, etc.).

**Custom properties** are defined inline in a block definition. They are specific to that block type and generate generic SCAD getters (`mb_param(config, settings, "wallThickness", 1)`).

The compiler determines whether a property is native or custom by checking `09_mbom_properties.yml`. No special markup is required in the block definition — both use the same `<property>` element.

Native properties only need to be declared in a block definition when their default value differs from the core default defined in `09_mbom_properties.yml`.

### Property Metadata

```text
name          — camelCase property name
type          — MBOM type FQN (e.g. com.machineblocks.types.Size3D)
defaultValue  — typed default value
group         — optional grouping for editor display
documentation — human-readable description
```

Unqualified type names in MBML are resolved against `com.machineblocks.types` by the parser before being stored in MBOM as full FQNs.

### Property Groups

Properties can be organized into named groups for editor display. Groups are metadata only — they have no effect on compiler behavior.

---

## Aggregations

Aggregations describe ownership relationships. An aggregation defines that a block can contain zero or more child objects of a given type.

### Implicit _parts Aggregation

When no `<aggregations>` section is present in a block definition, the MBML parser creates an implicit aggregation:

```text
name:        _parts
cardinality: 0..n
type:        com.machineblocks.bricks.StandardBrick
visibility:  hidden
```

This covers the vast majority of composite blocks. Explicit `<aggregations>` are only needed when a different name, type, cardinality, or visibility is required, or when multiple aggregations are needed.

### Aggregation Metadata

```text
name              — aggregation name
type              — FQN of the child type
cardinality       — "0..1" | "0..n" | "1..1" | "1..n"
visibility        — "public" | "hidden"
defaultAggregation — boolean, marks the default aggregation
documentation     — human-readable description
```

`visibility="hidden"` marks an aggregation as internal. It can only be filled by the block's own composition, not from outside.

### Example

```text
Wall
  _parts: com.machineblocks.bricks.StandardBrick [0..n] (hidden)
```

---

## Compositions

A composition fills an aggregation with concrete child instances. It is the internal structure definition of a composite block — the equivalent of a SAPUI5 Fragment embedded directly in a Control definition.

### Composition Structure

```text
aggregation   — name of the aggregation to fill (default: "_parts")
children      — ordered list of block instances
```

When no `aggregation` attribute is specified on a `<composition>`, the compiler fills the implicit (or sole) `_parts` aggregation. If multiple explicit aggregations exist, the `aggregation` attribute is required — the compiler reports an error if it is missing.

Each child instance in a composition:

```text
type          — FQN of the block class
id            — part ID (becomes part of the instance ID: parentId::bottom)
renderGroup   — render group name (optional, fallback = id)
namespace     — parameter filter namespace (optional, fallback = id)
version       — version of the referenced block type
properties    — property values (literals or expressions)
```

### renderGroup

Render groups control which parts of a composite block are rendered (e.g. only the top part, only the bottom part). They are user-defined — there is no automatic derivation.

Fallback: if no `renderGroup` is specified on a child instance, the child's `id` is used as the render group name.

### namespace

The namespace is used for parameter filtering (`mb_params_filter` in SCAD). It qualifies which part of a parent parameter applies to which child. Fallback = `id`.

Namespace-qualified parameter keys follow the pattern `<namespace>.<face>`:

```text
"bottom.y-"   — part "bottom", face "y-"
"top.y+"      — part "top", face "y+"
```

### Composition Example (MBOM internal representation)

```text
Wall._parts:
  [0] com.machineblocks.bricks.StandardBrick
      id:          "bottom"
      renderGroup: "bottom"
      namespace:   "bottom"
      properties:
        size:           Expression([size[0], size[1], size[2] - 1])
        recess:         true
        tongue:         true
        recessWallGaps: "x+"

  [1] com.machineblocks.bricks.StandardBrick
      id:          "top"
      renderGroup: "top"
      namespace:   "top"
      properties:
        size:           Expression([size[0], size[1], 1])
        offset:         Expression([0, 0, size[2] - 1])
        baseCutoutType: "groove"
        recessWallGaps: "x+"
```

---

## Associations

Associations describe loose references to other objects without ownership. They are defined for future use.

Planned use cases:

```text
PCB component reference
External device module
Connector partner
Instruction asset
Render profile
Material profile
```

Associations have no ownership relationship and do not affect geometry compilation.

---

## Events

Events are defined for future use. They are relevant when MachineBlocks describes interactive, editor-side, or device-side logic.

Planned events:

```text
onAssemble
onRender
onSelect
onParameterChange
onConnect
onValidate
```

Events are not part of the SCAD render target. They may be relevant in the editor or device system.

---

## Expression System

### Engine

Expressions use SpEL (Spring Expression Language) syntax, wrapped in `${}` in MBML.

### Expression Roots

All expressions are bound to named root variables. Direct variable access without a root is not permitted.

```text
parameters   — properties of the current block instance (read-only)
math         — mathematical functions
registry     — shared registry within the current composition (read/write)
```

Custom helper roots may be added (e.g. `myHelper.someFunction()`). Details to be defined.

### Available Operations

```text
Arithmetic:   +  -  *  /  %
Comparison:   >  <  ==  !=  >=  <=
Ternary:      condition ? valueIfTrue : valueIfFalse
math root:    math.min()  math.max()  math.ceil()  math.floor()  etc.
Array:        [a, b, c]  expr[0]
```

### Expression Scope Rules

```text
- Access only to properties of the current block instance (via parameters)
- No access to parent, grandparent, or sibling block properties
- Direction is always parent → child (top-down only)
- Registry scope is per composition — initialized on entry, not visible outside
```

### Expression AST

Expressions are not evaluated as raw JavaScript or SpEL strings. The MBML parser translates them into typed Expression AST nodes. The AST is part of MBOM — it is renderer-independent.

The SCAD Renderer serializes Expression AST nodes into SCAD-compatible output (variable references, arithmetic, ternary operators, etc.).

### Registry

The registry allows sibling child blocks within the same composition to share values:

```text
Write:  registry.totalHeight = value
Read:   registry.totalHeight
```

Registry scope: per composition. A registry is created when entering a composition and is not accessible outside it. Child blocks within the same composition share the same registry instance.

```xml
<!-- Child 1 writes -->
<SomeBlock registry.totalHeight="${parameters.size[2]}" ... />

<!-- Child 2 reads -->
<OtherBlock size="${[1, 1, registry.totalHeight - 1]}" ... />
```

---

## Set Model

A Set is an MBOM object that describes a concrete arrangement of block instances. It is the equivalent of a SAPUI5 View.

The set is structured around three clearly separated concerns:

```text
blocks    — block configurations (what exists, how it is configured)
placement — physical instances (where each block is, what its SCAD instance id is)
steps     — assembly order (optional, defaults to placement order)
```

### Set Structure

```text
name               — short name
fullQualifiedName  — FQN
version            — semantic version
properties         — set-level properties (e.g. baseColor, assembly)
blocks             — list of block configurations
placement          — list of placed instances
steps              — ordered list of placed instance IDs (optional)
```

### Block Configuration (in `blocks`)

Each entry in `blocks` defines a named block configuration:

```text
id        — MBML/MBOM internal identifier (not a SCAD instance id)
type      — FQN of the block class
version   — version of the block class
properties — property values (preset ref, inline, or both)
```

The `id` in `blocks` is a configuration handle only. Multiple `<place>` entries can reference the same block `id`, producing multiple physical instances from one configuration.

### Placement

Each entry in `placement` defines a physical instance of a block in the set:

```text
id        — SCAD instance id (used in STEPS array and instance dispatcher)
blockId   — references a block configuration from <blocks>
direction — orientation in the set
offset    — position in the set (grid units)
```

The `id` on a `<place>` entry is what becomes the SCAD instance id. It must be unique across all placements in the set.

### Assembly Steps

`steps` is optional. When present, it defines the assembly order as an ordered list of `placeId` references:

```text
steps: ["00001", "00002", "00003", ...]
```

When absent, the assembly order equals the document order of `placement` entries. This is the common case — authors typically write placements in assembly order.

### Block Configuration Modes

Three configuration modes, combinable:

```text
Option 1 — Inline:
  All properties defined directly on the block entry.

Option 2 — Preset reference:
  Block references a blockPresets document.
  All preset values apply.

Option 3 — Preset + inline override:
  Preset as base. Inline properties override individual values.
  Merge order: configProfile < blockPreset < inline property
```

---

## MBOM Class Hierarchy

```text
com.machineblocks.core.MBObject          — base for all MBOM objects
  com.machineblocks.core.Block           — base block (primitive)
    com.machineblocks.core.CompositeBlock — block with composition
    com.machineblocks.bricks.StandardBrick
    com.martianmicro.anyclosure.Wall
    com.martianmicro.anyclosure.Corner
    ...
  com.machineblocks.core.Set             — set of block instances
    com.martianmicro.anyclosure.DefaultEnclosure
    ...
```

---

## Versioning

Every block definition and set definition carries a semantic version. Sets must specify a version for every referenced block type:

```xml
<ac:Wall id="wall" version="1.0.0" size="[1, 8, 9]" />
```

No implicit `latest` references. Versions are always explicit.

Version resolution against a package registry is to be defined.
