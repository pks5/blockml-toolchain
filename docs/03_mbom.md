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
                   infrastructure segments singular (.type, .service, .core)
Class name:        PascalCase
Full FQN:          <reverse-domain-package>.<ClassName>
```

`com.machineblocks.bricks` is a **documented exception** — plural library package for the brick Block family. See `00_bom_core.md` — FQN Convention.

### Instance Identity

Block instances (within a Composition) are identified by the **`id` system property** on `org.blockml.core.Block`. Nested paths use `::`:

```text
Format:    <parentPartId>::<childPartId>::<subPartId>

Examples:
  00001::bottom
  00001::bottom::inner
  wall::a3f7c2                 — auto-generated part under explicit parent
```

No FQN fallback. See `00_bom_core.md` and `12_bom_object_model.md` — Instance ID Rules.

---

## Metadata Model

Every MBOM Block class has metadata describing its structure. Metadata is defined in the Block definition and used by the parser, validator, compiler, and editor.

```text
name               — short class name
fullQualifiedName  — FQN
baseType           — FQN of the parent class. Required — no default.
version            — semantic version of this class definition
members            — shared namespace: Properties, Aggregations, Associations, Capabilities
compositions       — list of Composition definitions
```

All Members share one namespace per Block. Names must be unique across Properties, Aggregations, Associations, and Capabilities within the same Block definition. This is enforced at parse time.

---

## Properties

Properties are typed parameters of a Block. Every Property has a name, a type, and a default value.

### Native vs. Custom Properties

**System properties** are defined on `org.blockml.core.Block` and inherited by all Blocks — notably `id` (instance identity). They are system-relevant: the compiler, validator, and renderer treat them with dedicated logic. In MachineBlocks, `id` is also listed in `09_mbom_properties.yml` for SCAD serialization (`mb_block_id`). See `00_bom_core.md` — System Properties.

**Domain native properties** are defined in `com.machineblocks.core.Block` and its base types. They are listed in `09_mbom_properties.yml` and have dedicated SCAD getters in the render target (`mb_param_size()`, `mb_param_baseColor()`, etc.).

Domain native properties include (non-exhaustive): `size`, `offset`, `direction`, `align`, `baseColor`, `studs`, `base`, `recess`, `tongue`, `baseCutoutType`, `rotation`, `alignChildren`, `sizeMod`, `baseCrop`, `baseAdjustment`, `baseWallThickness`, `topPlateHelpers`, `render`, `debug`. See `09_mbom_properties.yml` for the full authoritative list. (`id` is a system property — listed there for SCAD mapping, not a domain-native geometry parameter.)

**Custom properties** are defined inline in a Block definition. They generate generic SCAD getters (`mb_param(config, settings, "wallThickness", 1)`).

The compiler determines native vs. custom by checking `09_mbom_properties.yml`. Both use the same `<property>` element in BML. Native properties only need to be declared when their default value differs from the core default.

### Property Metadata

```text
name          — camelCase member name (unique within the Block's member namespace)
type          — MBOM type FQN (e.g. com.machineblocks.type.Size3D)
defaultValue  — typed default value (literal or expression)
group         — optional grouping for editor display
documentation — human-readable description
```

Unqualified type names in BML are resolved against `com.machineblocks.type` by the parser before being stored in MBOM as full FQNs.

**Computed default values:** `defaultValue` may be an Expression referencing other Properties of the same Block. See `10_expression_language.md` — Expressions in defaultValue.

### Property Groups

Properties can be organized into named groups for editor display. Groups are metadata only — no effect on compiler behavior.

---

## Aggregations

Aggregations describe ownership relationships. An Aggregation defines that a Block can contain zero or more child objects of a given type.

BlockML (`org.blockml.core.Block`) defines only the implicit `customData` aggregation. Domain-specific aggregations are declared on domain base types.

### `_parts` on `com.machineblocks.core.Block`

`_parts` is **not** a BlockML feature. It is a base aggregation declared on `com.machineblocks.core.Block`, which extends `org.blockml.core.Block`. All MachineBlocks Blocks inherit it via `baseType` — resolved at validate time through the Type Registry, not materialized by the parser.

```text
com.machineblocks.core.Block  (extends org.blockml.core.Block)
  _parts:
    cardinality:        0..n
    type:               com.machineblocks.core.Block
    visibility:         hidden
    defaultAggregation: true
```

When a Block's `baseType` chain includes `com.machineblocks.core.Block` and the author omits `<aggregations>`, `_parts` is still present in the effective member set. The parser stores only **declared** aggregations in the BOM; inherited `_parts` appears via `resolveEffectiveMembers()`.

Declare `<aggregations>` explicitly only when **adding** aggregations beyond the inherited set (e.g. `_blocks`, `_placement`, `_steps` on `Set`). Redeclaring `_parts` to change its type is not permitted — inherited members cannot be overridden.

This covers the vast majority of Composite Blocks. Explicit `<aggregations>` are needed when multiple Aggregations are required or when the Block does not inherit `_parts`.

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
Wall  (baseType: com.machineblocks.core.Block)
  _parts:  com.machineblocks.core.Block [0..n] (hidden, inherited)
  myModel: org.blockml.service.JSONModel [0..1] (hidden, beanName="myModel", declared)
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

> **Capability package TBD** — placeholder `org.blockml.capability.*`. Candidate: `bom.foundation`.

### AsyncInbound

Receives a message from an external sender. Asynchronous.

```text
name         — camelCase member name (unique within the Block's member namespace)
class        — org.blockml.capability.AsyncInbound
payloadType  — declared payload type (see Payload Types)
returnType   — optional; type of the asynchronous reply (for replyTo scenarios)
visibility   — "public" | "hidden" (default: "public")
documentation
```

### AsyncOutbound

Sends a message to an external receiver. Triggered by the Block in response to domain-specific conditions. Asynchronous.

```text
name         — camelCase member name
class        — org.blockml.capability.AsyncOutbound
payloadType  — declared payload type
returnType   — optional; type of the asynchronous reply (for replyTo scenarios)
visibility   — "public" | "hidden" (default: "public")
documentation
```

### Sync

Called directly within an Expression. Has a return value. No address. Not reachable via async messaging. This constraint is current — future use cases may relax it.

```text
name         — camelCase member name
class        — org.blockml.capability.Sync
payloadType  — declared payload type
returnType   — required; FQN of the return type
visibility   — "public" | "hidden" (default: "public")
documentation
```

### Payload Types

```text
org.blockml.type.Integer            — primitive
org.blockml.type.String             — primitive
com.myDomain.MyClass             — Object (named fields)
Array<org.blockml.type.Integer>     — Array of primitives
Array<com.myDomain.MyClass>      — Array of objects
```

Unqualified names resolve against the domain's default type namespace (determined by the Block's `baseType`). For MachineBlocks that is `com.machineblocks.type.*`; for primitives `org.blockml.type.*`.

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
#strings  — Sync capabilities: format, trim, padStart, ...
```

Shared across all MachineBlocks Blocks. Cannot be overridden. The `#` namespace is reserved.

---

## Compositions

A Composition fills an Aggregation with concrete child instances. It is the internal structure definition of a Composite Block.

### Composition Structure

```text
aggregation   — name of the Aggregation to fill (default: inherited default aggregation — `_parts` for com.machineblocks.core.Block)
children      — ordered list of Block instances
```

Each child instance:

```text
type          — FQN of the Block class
id            — system property (org.blockml.core.Block). Required when referenced or on bml:each.
                Anonymous static children receive auto-ID after directive expansion.
renderGroup   — render group name (optional, fallback = id)
namespace     — parameter filter namespace (optional, fallback = id)
version       — version of the referenced Block type (required for external references only)
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

Expressions are parsed into typed **`ExpressionNode`** trees — not evaluated as raw strings. Stored as `ExpressionValue` on the BOM. The SCAD Renderer serializes AST nodes. See `10_expression_language.md` — Expression AST.

### Sharing Values Between Siblings

Sibling child Blocks within the same Composition share computed values via **`bml:with`** on `<composition>` or a wrapping `<bml:block>` — not via a separate registry. See `02_mbml.md` — `bml:with`.

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
  id         — instance ID (becomes the SCAD instance id in STEPS and dispatcher); must be explicit
  blockId    — references explicit `id` of a Block in _blocks (BML_MISSING_ID / BML_UNRESOLVABLE_INSTANCE_REF)
  direction  — orientation in the set (Direction)
  offset     — position in the set in grid units (GridPosition3D)
```

The `id` on a Place must be unique across all placements in the Set.

### com.machineblocks.core.Step

A lightweight MachineBlocks Block type used as children in the `_steps` Aggregation.

```text
Members:
  placeId    — references explicit `id` of a Place in _placement
```

When `_steps` is absent or empty, assembly order equals the document order of `_placement` entries.

---

## MBOM Class Hierarchy

```text
org.blockml.core.Block                                  ← BOM Core (abstract)
  com.machineblocks.core.Block                          ← MBOM base (native MB properties + _parts)
    com.machineblocks.core.NativeBlock                  ← final, 1:1 mb_block() mapping
    com.machineblocks.core.Set                          ← STEPS + View Submodules
      com.martianmicro.anyclosure.DefaultEnclosure
      ...
    com.machineblocks.core.Place                        ← used in Set _placement
    com.machineblocks.core.Step                         ← used in Set _steps
    com.machineblocks.bricks.StandardBrick              ← CompositeBlock, uses NativeBlock
    com.martianmicro.anyclosure.Wall                    ← CompositeBlock, uses NativeBlock
    com.martianmicro.anyclosure.Corner
    ...
```

### com.machineblocks.core.Block

MachineBlocks domain base type. Extends `org.blockml.core.Block` with native MB properties (see `09_mbom_properties.yml`) and the `_parts` aggregation.

```text
Extends:        org.blockml.core.Block
Properties:     native MB properties (size, offset, direction, baseColor, ...)
Aggregations:   _parts (0..n, hidden, defaultAggregation, type: com.machineblocks.core.Block)
                customData (inherited from org.blockml.core.Block)
Composition:    allowed — _parts children become SCAD block children
```

### com.machineblocks.core.NativeBlock

`NativeBlock` is the direct BML representation of a raw `mb_block()` call. It is **final** — it cannot be used as `baseType` in any Block definition. It can only appear as a child element in Compositions.

```text
Properties:     native MB3 properties only (from 09_mbom_properties.yml)
                no custom properties allowed — BML_NATIVE_BLOCK_CUSTOM_PROPERTY
Capabilities:   none
Aggregations:   _parts (0..n, hidden, inherited from com.machineblocks.core.Block)
Composition:    allowed — _parts children become mb_block() children
Final:          baseType = com.machineblocks.core.NativeBlock → BML_FINAL_BASE_TYPE
```

The ScadBlockProcessor renders `NativeBlock` directly as `mb_block()` with all declared settings.

### com.machineblocks.core.Set

`Set` is a sibling of `NativeBlock` — both extend `com.machineblocks.core.Block`. Unlike `NativeBlock`, `Set` is derivable:

```text
Derivable:  baseType = com.machineblocks.core.Set  ✓
Processor:  ScadSetProcessor → STEPS array + 4 view submodules
```

### allowedSubBlockTypes

```text
com.machineblocks.core.Block:
  allowedSubBlockTypes: [com.machineblocks.core.Block,
                         org.blockml.service.FunctionBlock]

com.machineblocks.core.NativeBlock:
  allowedSubBlockTypes: []  (final — no Sub-Blocks)

com.machineblocks.core.Set:
  allowedSubBlockTypes: [com.machineblocks.core.Block,
                         org.blockml.service.FunctionBlock]
```

### supportedImplementationLanguages

```text
com.machineblocks.core.Block:
  supportedImplementationLanguages: ["scad"]

org.blockml.service.FunctionBlock:
  supportedImplementationLanguages: ["scad", "typescript"]
```

### Validation

```text
BML_FINAL_BASE_TYPE             — NativeBlock used as baseType
BML_NATIVE_BLOCK_CUSTOM_PROPERTY — custom property declared on NativeBlock
BML_INVALID_SUBBLOCK_TYPE       — Sub-Block baseType not in allowedSubBlockTypes
MB_EMPTY_BLOCK                  — Block has no Composition and no registered custom Processor
                                   (MB_* prefix = MachineBlocks-specific, not BML Core)
```

Note: `com.machineblocks.core.Place` and `com.machineblocks.core.Step` are regular Blocks — they inherit from `com.machineblocks.core.Block` and are processed by the same pipeline. They are not special-cased in BOM Core.

---

## Versioning

Every Block definition carries a semantic version. External composition references are dependencies — each must specify an exact version. Same-document Sub-Block references do not.

```xml
<ac:Wall id="wall" version="1.0.0" size="[1, 8, 9]" />
<Base id="base_stud" offset="[0, 0, 0]" ... />   <!-- no version — Sub-Block, same file -->
```

Strict from V1: missing `version` on an external reference → `BML_MISSING_VERSION`. Unknown version → `BML_UNKNOWN_VERSION`. No implicit `latest`, no registry default. Legacy scad-lib files must be updated before they compile.
