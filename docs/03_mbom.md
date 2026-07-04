# BOM Compiler — MBOM

version: 2.0.0

## Purpose of this Document

This document defines the MBOM (MachineBlocks Object Model) — the canonical, typed internal representation of all MachineBlocks data. MBOM is the interface between the BML parser and the SCAD Renderer.

MBOM is a domain-specific specialization of BOM Core (`00_bom_core.md`). BOM Core defines the abstract structural foundation — Block, Member (Properties, Aggregations, Associations, Capabilities), Preset, Library, Catalog, and the Expression system. MBOM extends these with MachineBlocks-specific types, properties, and the SCAD render target. Concepts already defined in BOM Core are not repeated here — this document covers only MBOM-specific extensions and decisions.

For the BML authoring format see `02_mbml.md`.
For the MBOM type system and serialization rules see `04_types.md`.
For native property definitions see `09_mbom_properties.yml`.

---

## Overview

MBOM is the renderer-independent object model. It has no knowledge of SCAD syntax, parameters, or file formats. All block authoring, validation, composition, and expression evaluation operate on MBOM.

MBOM specializes BOM Core for the MachineBlocks domain — adding MB-specific property types (`Size3D`, `WallGap`, `Direction`, ...), the native property set (`09_mbom_properties.yml`), and the SCAD render target interface.

MBOM is strongly inspired by the SAPUI5 object model. Existing SAPUI5 concepts are adopted where they fit. Deviations are documented explicitly.

### SAPUI5 Analogy

```text
SAPUI5 Control            →  MBOM Block
SAPUI5 Composite Control  →  MBOM Composite Block
SAPUI5 Property           →  MBOM Property
SAPUI5 Aggregation        →  MBOM Aggregation
SAPUI5 Association        →  MBOM Association
SAPUI5 Event              →  MBOM Outbound Capability
SAPUI5 Control Renderer   →  MBOM Block Renderer (inside a Target)
```

Key differences from SAPUI5:

```text
Expression syntax:  BOM Expression system (see 00_bom_core.md)
                    (not SAPUI5 binding syntax)
Block definition:   combines control definition + composition
                    (control definition + fragment/view in SAPUI5 terms)
Capabilities:       three types: inbound, outbound, synchronous
                    (SAPUI5 only has events / outbound)
Domain:             physical, parametric geometry objects
                    (not UI controls)
```

---

## Object Identity

Every MBOM object has a globally unique identity based on its FQN.

### Class Identity (FQN)

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

Block instances (within a Composition) have an instance ID composed with `::` as separator:

```text
Format:    <instanceId>::<partId>::<subPartId>

Examples:
  00001::bottom
  00001::bottom::inner
  com.martianmicro.anyclosure.Wall::bottom   ← FQN as fallback (no instance ID)
```

---

## Metadata Model

Every MBOM Block class has metadata describing its structure. Metadata is defined in the Block definition and used by the parser, validator, compiler, and editor.

```text
name               — short class name
fullQualifiedName  — FQN
baseType           — FQN of the parent class (default: com.machineblocks.core.Block)
version            — semantic version of this class definition
members            — shared namespace: Properties, Aggregations, Associations, Capabilities
compositions       — list of Composition definitions
```

All Members share one namespace per Block. Names must be unique across Properties, Aggregations, Associations, and Capabilities within the same Block definition. This is enforced at parse time.

---

## Properties

Properties are typed parameters of a Block. Every Property has a name, a type, and a default value.

### Native vs. Custom Properties

**Native properties** are defined in `com.machineblocks.core.Block` and its base types. They are listed in `09_mbom_properties.yml` and have dedicated SCAD getters in the render target (`mb_param_size()`, `mb_param_baseColor()`, etc.).

Native properties include (non-exhaustive): `size`, `offset`, `direction`, `align`, `baseColor`, `studs`, `base`, `recess`, `tongue`, `baseCutoutType`, `rotation`, `alignChildren`, `sizeMod`, `baseCrop`, `baseAdjustment`, `baseWallThickness`, `topPlateHelpers`. See `09_mbom_properties.yml` for the full authoritative list.

**Custom properties** are defined inline in a Block definition. They generate generic SCAD getters (`mb_param(config, settings, "wallThickness", 1)`).

The compiler determines native vs. custom by checking `09_mbom_properties.yml`. Both use the same `<property>` element in BML. Native properties only need to be declared when their default value differs from the core default.

### Property Metadata

```text
name          — camelCase member name (unique within the Block's member namespace)
type          — MBOM type FQN (e.g. com.machineblocks.types.Size3D)
defaultValue  — typed default value (literal or expression)
group         — optional grouping for editor display
documentation — human-readable description
```

Unqualified type names in BML are resolved against `com.machineblocks.types` by the parser before being stored in MBOM as full FQNs.

**Computed default values:** `defaultValue` may be an Expression referencing other Properties of the same Block. See `10_expression_language.md` — Expressions in defaultValue.

### Property Groups

Properties can be organized into named groups for editor display. Groups are metadata only — no effect on compiler behavior.

---

## Aggregations

Aggregations describe ownership relationships. An Aggregation defines that a Block can contain zero or more child objects of a given type.

### Implicit `_parts` Aggregation

When no `<aggregations>` section is present, the BML parser creates an implicit Aggregation:

```text
name:        _parts
cardinality: 0..n
type:        com.machineblocks.bricks.StandardBrick
visibility:  hidden
```

This covers the vast majority of Composite Blocks. Explicit `<aggregations>` are only needed when a different name, type, cardinality, or visibility is required, or when multiple Aggregations are needed.

### Aggregation Metadata

```text
name               — member name (unique within the Block's member namespace)
type               — FQN of the child type
cardinality        — "0..1" | "0..n" | "1..1" | "1..n"
visibility         — "public" | "hidden"
defaultAggregation — boolean, marks the default aggregation
beanName           — optional; marks this Aggregation as a ServiceBlock binding
documentation      — human-readable description
```

`visibility="hidden"` marks an Aggregation as internal. It can only be filled by the Block's own Composition, not from outside.

When `beanName` is set, the Aggregation is a ServiceBlock binding. The bean is accessible in Expressions via `@beanName`.

### Example

```text
Wall
  _parts:  com.machineblocks.bricks.StandardBrick [0..n] (hidden)
  myModel: com.bom.service.JSONModel [0..1] (hidden, beanName="myModel")
```

---

## Associations

Associations describe loose references to other objects without ownership. Defined for future use.

Planned use cases in MachineBlocks:

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

## Capabilities

Capabilities describe how a Block communicates — externally via async messaging or internally via synchronous calls in Expressions. Capabilities are Members and share the namespace with Properties, Aggregations, and Associations.

Like Properties, Capabilities are declared with a name and a class (FQN). Their value in a Composition is the address or binding — set as an attribute on the child instance, exactly like a Property value.

> **Capability package TBD** — placeholder `com.bom.capability.*`. Candidate: `bom.foundation`.

### AsyncInbound

Receives a message from an external sender. Asynchronous.

```text
name         — camelCase member name (unique within the Block's member namespace)
class        — com.bom.capability.AsyncInbound
payloadType  — declared payload type (see Payload Types)
returnType   — optional; type of the asynchronous reply (for replyTo scenarios)
visibility   — "public" | "hidden" (default: "public")
documentation
```

### AsyncOutbound

Sends a message to an external receiver. Triggered by the Block in response to domain-specific conditions. Asynchronous.

```text
name         — camelCase member name
class        — com.bom.capability.AsyncOutbound
payloadType  — declared payload type
returnType   — optional; type of the asynchronous reply (for replyTo scenarios)
visibility   — "public" | "hidden" (default: "public")
documentation
```

### Sync

Called directly within an Expression. Has a return value. No address. Not reachable via async messaging. This constraint is current — future use cases may relax it.

```text
name         — camelCase member name
class        — com.bom.capability.Sync
payloadType  — declared payload type
returnType   — required; FQN of the return type
visibility   — "public" | "hidden" (default: "public")
documentation
```

### Payload Types

```text
com.bom.types.Integer            — primitive
com.bom.types.String             — primitive
com.myDomain.MyClass             — Object (named fields)
Array<com.bom.types.Integer>     — Array of primitives
Array<com.myDomain.MyClass>      — Array of objects
```

Unqualified names resolve against the domain's default type namespace (determined by the Block's `baseType`). For MachineBlocks that is `com.machineblocks.types.*`; for primitives `com.bom.types.*`.

### Payload Call Syntax

```text
Primitive:        myCapa(size[0])                  — single value
Object payload:   myCapa(a = 4, b = size[0])       — named parameters (shorthand)
                  myCapa({a: 4, b: size[0]})       — object literal (equivalent)
Array payload:    myCapa(4, size[0])               — positional arguments
                  myCapa([4, size[0]])             — array literal (equivalent)
```

Named parameters and object literal are interchangeable for Object payloads. A mismatch between declared `payloadType` and call syntax is a parse-time error.

### Capability Value in Compositions

The address or binding is the Capability's value on a child Block instance:

```text
stud://domain/path                  — Absolute URI (AsyncOutbound routing)
/path/to/resource                   — Relative path (context-resolved, TBD)
${ @myService.otherCapa }           — Capability linking (no parentheses)
${ @myService.getAddress() }        — Dynamic address (Sync returnType must be String)
```

### Inheritance

Capabilities are inherited via `baseType`, identical to Properties and Aggregations.

### MachineBlocks Built-in ServiceBlocks

Built-in ServiceBlocks are defined in `com.machineblocks.core.Block` and accessible in all MachineBlocks Blocks via the `#` prefix:

```text
#math    — Sync capabilities: min, max, ceil, floor, abs, round, ...
#string  — Sync capabilities: format, trim, padStart, ...
```

Shared across all MachineBlocks Blocks. Cannot be overridden. The `#` namespace is reserved.

---

## Compositions

A Composition fills an Aggregation with concrete child instances. It is the internal structure definition of a Composite Block.

### Composition Structure

```text
aggregation   — name of the Aggregation to fill (default: "_parts")
children      — ordered list of Block instances
```

Each child instance:

```text
type          — FQN of the Block class
id            — part ID (becomes part of the instance ID: parentId::partId)
renderGroup   — render group name (optional, fallback = id)
namespace     — parameter filter namespace (optional, fallback = id)
version       — version of the referenced Block type
(members)     — member values: Properties and Capabilities (literals or Expressions)
```

### renderGroup

Render groups control which parts of a Composite Block are rendered (e.g. only the top part). They are user-defined — no automatic derivation. Fallback: child's `id`.

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
      members:
        size:           Expression([ size[0], size[1], size[2] - 1 ])
        recess:         true
        tongue:         true
        recessWallGaps: "x+"

  [1] com.machineblocks.bricks.StandardBrick
      id:          "top"
      renderGroup: "top"
      namespace:   "top"
      members:
        size:           Expression([ size[0], size[1], 1 ])
        offset:         Expression([ 0, 0, size[2] - 1 ])
        baseCutoutType: "groove"
        recessWallGaps: "x+"
```

---

## Expression System

### Expression Syntax

Inside `${ }`, the content is **extended JSON** — standard JSON extended with property references, model bindings, and bean calls. See `00_bom_core.md` — Expression System for the full specification.

```text
myProperty            — Property reference (no prefix)
myProperty.x          — Attribute access
myProperty[0]         — Index access
[size[0], size[1], 1] — Array literal with expressions
{x: size[0], y: 1}    — Object literal with expressions
mySyncCapa()          — Own Block: Sync Capability call (no prefix)
mySyncCapa(a=1)       — Own Block: Sync call with payload
myInbound             — Own Block: AsyncInbound linking (no prefix, no parentheses)
#math.min(a, b)       — Built-in Sync Capability call
@bean.capa(a=4, b=size[0])     — Named parameters (Object payload shorthand)
@bean.capa({a: 4, b: size[0]}) — Object literal (equivalent)
@bean.capa(4, size[0])         — Positional arguments (Array payload)
@bean.capa([4, size[0]])       — Array literal (equivalent)
@bean.capa                     — External Capability linking (no parentheses)
@model:/absolute/path          — Absolute Model binding
@model:relAttr                 — Relative Model binding
size[0] + 1                    — Arithmetic
size[0] > 2 ? "a" : "b"       — Ternary
```

**Outside `${ }`** (raw attribute values): pure JSON only — no property references, no model bindings. `[1, 8, 9]` and `{x: 1, y: 0}` are valid; `[size[0], 1]` is not.

**Disambiguation — own Block vs. bean:**

Property access, own Sync call, and own AsyncInbound linking all use no prefix. The parser resolves by checking the member namespace:

```text
foo     → Property in namespace? → yes: property access
foo()   → Sync Capability in namespace? → yes: own Sync call
foo     → AsyncInbound in namespace? → yes (in Capability binding context): own linking
@foo    → always a bean reference
```

### Available Operations

```text
Arithmetic:   +  -  *  /  %
Comparison:   >  <  ==  !=  >=  <=
Ternary:      condition ? valueIfTrue : valueIfFalse
```

### Expression Scope Rules

```text
- Property access: current Block instance only (no prefix)
- Own Sync Capability call: current Block only (no prefix, with parentheses)
- Own AsyncInbound linking: current Block only (no prefix, no parentheses)
- No access to parent, grandparent, or sibling Block properties
- Direction is always parent → child (top-down only)
- Registry scope is per Composition — initialized on entry, not accessible outside
- @bean references: resolved by walking up Composition hierarchy (scope="context" beans)
- #built-in references: always available (inherited via baseType)
- Model binding context: inherited from parent Aggregation
```

### Expression AST

Expressions are parsed into typed Expression AST nodes at parse time — not evaluated as raw strings. The AST is part of MBOM and is renderer-independent. The SCAD Renderer serializes AST nodes into SCAD-compatible output.

### Registry

Sibling child Blocks within the same Composition can share values:

```text
Write:  registry.totalHeight = value
Read:   registry.totalHeight
```

Registry scope is per Composition. Created on entry, not visible outside.

---

## MachineBlocks Set Model

A MachineBlocks Set is a Block whose `baseType` is `com.machineblocks.core.Set`. It is not a separate MBOM class — it is a Block that the SCAD Renderer dispatches to `ScadSetRenderer` based on its base type.

A Set uses three conventional Aggregations:

```text
_blocks     — Block configurations (what exists, how it is parameterized)
_placement  — placed instances (where each block is; id becomes the SCAD instance id)
_steps      — assembly order (optional; defaults to document order of _placement)
```

### com.machineblocks.core.Place

A lightweight MachineBlocks Block type used as children in the `_placement` Aggregation.

```text
Members:
  id         — instance ID (becomes the SCAD instance id in STEPS and dispatcher)
  blockId    — references a Block configuration from _blocks
  direction  — orientation in the set (Direction)
  offset     — position in the set in grid units (GridPosition3D)
```

The `id` on a Place must be unique across all placements in the Set.

### com.machineblocks.core.Step

A lightweight MachineBlocks Block type used as children in the `_steps` Aggregation.

```text
Members:
  placeId    — references a Place in _placement
```

When `_steps` is absent or empty, assembly order equals the document order of `_placement` entries.

---

## MBOM Class Hierarchy

```text
com.bom.core.Block                              ← BOM Core (00_bom_core.md)
  com.machineblocks.core.Block                  ← MBOM base (native properties, #math, #string)
    com.machineblocks.core.Set                  ← dispatched to ScadSetRenderer
      com.martianmicro.anyclosure.DefaultEnclosure
      ...
    com.machineblocks.core.Place                ← used in Set _placement
    com.machineblocks.core.Step                 ← used in Set _steps
    com.machineblocks.bricks.StandardBrick
    com.martianmicro.anyclosure.Wall
    com.martianmicro.anyclosure.Corner
    ...
```

Note: `com.machineblocks.core.Place` and `com.machineblocks.core.Step` are Blocks like any other — they inherit from `com.machineblocks.core.Block` and are processed by the same pipeline. They are not special-cased in BOM Core.

---

## Versioning

Every Block definition carries a semantic version. Compositions must specify a version for every referenced Block type:

```xml
<ac:Wall id="wall" version="1.0.0" size="[1, 8, 9]" />
```

No implicit `latest` references. Versions are always explicit. Version resolution against a package registry is to be defined.
