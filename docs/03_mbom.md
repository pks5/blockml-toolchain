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

Block instances (within a Composition) are identified by the **`id` meta property**. Nested paths use `::`:

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
type  — FQN
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

Aggregations describe ownership relationships. An Aggregation defines that a Block can contain zero or more child objects of a given type. Domain-specific aggregations are declared on domain base types.

### `_presets` and `_parts` on MachineBlocks Blocks

MachineBlocks declares two domain aggregations on the base type chain:

```text
com.machineblocks.core.Block  (extends org.blockml.core.Block)
  _presets:
    type:    com.machineblocks.core.Block[]
  appliedPresets:
    type:    _self[]   (association — references ids in enclosing Block's _presets)

com.machineblocks.core.CompositeBlock  (extends Block)
  _parts:
    type:    com.machineblocks.core.Block[]
    default: true
```

Every MachineBlocks Block inherits `_presets` and `appliedPresets`. Composite blocks additionally inherit `_parts` as the default composition aggregation.

**Presets are not a BlockML core feature.** Preset instances are ordinary Block instances in `_presets`. The `appliedPresets` association references preset ids (local or `{BlockFQN}::{id}`). Preset merge is compiler logic; Customizer JSON is render-target logic.

When a Block's `baseType` chain includes `com.machineblocks.core.CompositeBlock` and the author omits `<aggregations>`, `_parts` is still present in the effective member set. The parser stores only **declared** aggregations in the BOM; inherited members appear via `resolveEffectiveMembers()`.

Declare `<aggregations>` explicitly only when **adding** aggregations beyond the inherited set (e.g. `_steps` on `Set`). Redeclaring inherited members to change their type is not permitted.

### Example

```text
Wall  (baseType: com.machineblocks.core.CompositeBlock)
  _presets:  com.machineblocks.core.Block[] (inherited)
  _parts:    com.machineblocks.core.Block[] (inherited, default)
  _myModel:  org.blockml.service.JSONModel (hidden, beanName="myModel", declared)
```

### Aggregation Metadata

```text
name          — member name (unique within the Block's member namespace)
type          — FQN of the child type, optionally with occurrence brackets (see 02_mbml.md — Type Notation)
default       — boolean; marks the default aggregation for bare <composition>
beanName      — optional; marks this Aggregation as a ServiceBlock binding
documentation — human-readable description
```

Member visibility is determined by naming convention: names starting with `_` are hidden (internal). Hidden Aggregations can only be filled by the Block's own Composition, not from outside.

When `beanName` is set, the Aggregation is a ServiceBlock binding. The bean is accessible in Expressions via `@beanName`.

---

## Associations

Associations describe loose references to other objects without ownership.

MachineBlocks uses `appliedPresets` on `com.machineblocks.core.Block` — an association (`_self[]`) referencing preset ids in the enclosing Block's `_presets` aggregation. Local ids resolve within the same Block; cross-file entries use `{BlockFQN}::{id}`.

Other planned use cases in MachineBlocks:

```text
PCB component reference
External device module
Connector partner
Instruction asset
Render profile
Material profile
Step.part — references a placed block instance in a Set's _parts
```

Associations have no ownership relationship and do not affect geometry compilation directly — preset merge is resolved by the compiler before rendering.

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
documentation
```

Member visibility: names starting with `_` are hidden.

### AsyncOutbound

Sends a message to an external receiver. Triggered by the Block in response to domain-specific conditions. Asynchronous.

```text
name         — camelCase member name
class        — org.blockml.capability.AsyncOutbound
payloadType  — declared payload type
returnType   — optional; type of the asynchronous reply (for replyTo scenarios)
documentation
```

Member visibility: names starting with `_` are hidden.

### Sync

Called directly within an Expression. Has a return value. No address. Not reachable via async messaging. This constraint is current — future use cases may relax it.

```text
name         — camelCase member name
class        — org.blockml.capability.Sync
payloadType  — declared payload type
returnType   — required; FQN of the return type
documentation
```

Member visibility: names starting with `_` are hidden.

### Payload Types

```text
org.blockml.type.Integer            — primitive
org.blockml.type.String             — primitive
com.myDomain.MyClass             — Object (named fields)
{ items: org.blockml.type.Integer[0..n] }  — collection field
```

Unqualified names resolve against the domain's default type namespace (determined by the Block's `baseType`). For MachineBlocks that is `com.machineblocks.type.*`; for primitives `org.blockml.type.*`.

### Payload Call Syntax

```text
Primitive:        myCapa(size[0])                  — single value
Object payload:   myCapa(a = 4, b = size[0])       — named parameters (shorthand)
                  myCapa({a: 4, b: size[0]})       — object literal (equivalent)
Collection field payload:  myCapa([4, size[0]])   — sequence literal (positional values)
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
aggregation   — name of the Aggregation to fill (default: inherited default aggregation — `_parts` for CompositeBlock, `_presets` for preset palette)
children      — ordered list of Block instances
```

Each child instance:

```text
type          — FQN of the Block class
id            — meta property. Required when referenced or on bml:each.
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

A Set uses three conventional Aggregations — `_presets` and `_parts` inherited from the base type chain, `_steps` declared on Set:

```text
_presets    — block palette (configurations referenced by appliedPresets on _parts entries; inherited from Block)
_parts      — placed block instances (direction, offset, appliedPresets; inherited from CompositeBlock, default)
_steps      — assembly order (optional; defaults to document order of _parts)
```

There is no separate Placement meta-block. Placed instances are real Block instances in `_parts` with `appliedPresets`, `direction`, and `offset` as properties.

### com.machineblocks.core.Step

Framework BML: `com/machineblocks/core/Step.bml`. Extends `org.blockml.core.Block` — a framework Block for Set assembly order.

```text
Extends:        org.blockml.core.Block
Final:          true
Members:
  id             — optional meta property when referenced
  part           — association com.machineblocks.core.Block: references explicit id of a placed instance in _parts
  description    — optional human-readable step label
Composition:    none — leaf meta Block
```

When `_steps` is absent or empty, assembly order equals the document order of `_parts` entries.

---

## MBOM Class Hierarchy

Framework types are **BML files** — see `16_framework_base_types.md`. Interpretation (SCAD mapping, processors) lives in render targets only.

```text
org.blockml.core.Block                                  ← packages/core/…/Block.bml (abstract, root)
    com.machineblocks.core.Step                         ← mbom/…/Step.bml (final)
  org.blockml.core.TypeBlock                            ← TypeBlock.bml (abstract)
  org.blockml.core.LanguageBlock                        ← LanguageBlock.bml (abstract)
  org.blockml.core.ServiceBlock                         ← core/…/ServiceBlock.bml
    org.blockml.core.FunctionBlock                      ← core/…/FunctionBlock.bml
      org.blockml.service.Math                          ← core/…/service/Math.bml
  com.machineblocks.core.Block                          ← mbom/…/Block.bml (abstract)
    com.machineblocks.core.CompositeBlock               ← CompositeBlock.bml (abstract)
      com.machineblocks.core.Set                        ← Set.bml (abstract)
        com.martianmicro.anyclosure.DefaultEnclosure   ← user BML
      com.machineblocks.bricks.StandardPresets          ← preset block (_presets)
    com.machineblocks.core.NativeBlock                  ← NativeBlock.bml (final)
    com.machineblocks.bricks.Standard                   ← user BML
    com.martianmicro.anyclosure.Wall
    …
```

### com.machineblocks.core.Block

MachineBlocks domain base type. Defined in `domains/machineblocks/mbom/src/com/machineblocks/core/Block.bml`. Extends `org.blockml.core.Block`.

```text
Extends:        org.blockml.core.Block
Properties:     name (String)
Associations:   appliedPresets (_self[] — references ids in _presets)
Aggregations:   _presets (type: com.machineblocks.core.Block[])
```

Domain native properties (size, offset, direction, …) are declared on concrete block types (e.g. `com.machineblocks.bricks.Standard`), not on the abstract base. SCAD mapping in `09_mbom_properties.yml` (render only).

### com.machineblocks.core.CompositeBlock

Defined in `CompositeBlock.bml`. Extends `Block`. Adds `_parts` as the default composition aggregation.

```text
Extends:        com.machineblocks.core.Block
Aggregations:   _parts (type: com.machineblocks.core.Block[], default)
subTypes: Block, FunctionBlock
implTypes: OpenSCAD
```

### com.machineblocks.core.NativeBlock

`NativeBlock` is the direct BML representation of a raw `mb_block()` call. It is **final** — it cannot be used as `baseType` in any Block definition. It can only appear as a child element in Compositions.

```text
Properties:     native MB properties (declared on concrete types or via appliedPresets)
                no custom properties allowed — BML_NATIVE_BLOCK_CUSTOM_PROPERTY
Capabilities:   none
Aggregations:   children (type: com.machineblocks.core.Block[], default — mb_block() sub-geometry)
Composition:    allowed — children become mb_block() children
Final:          baseType = com.machineblocks.core.NativeBlock → BML_FINAL_BASE_TYPE
```

The ScadBlockProcessor renders `NativeBlock` directly as `mb_block()` with all declared settings. V1 emits settings as pseudo-map `[["key", value], …]` — see `05_scad_renderer.md` — Settings Format.

**All leaf geometry in compositions renders as `mb_block()`.** Domain-typed composition children (e.g. `bricks:StandardBrick`) are **lowered** to the same `mb_block()` settings — they are not rendered via typed block modules or `use` imports of dependency SCAD files.

For **standalone compile**, leaf-only Block types (e.g. `com.machineblocks.bricks.Standard` — effectively one NativeBlock) are **optimized to a direct `mb_block()` main call**, skipping typed module indirection and duplicate `mb_param_*` extraction. See `14_compiler_runtime.md` — Leaf-only blocks.

### com.machineblocks.core.Set

`Set` extends `com.machineblocks.core.CompositeBlock` and inherits `_presets` (palette) and `_parts` (placed instances). Unlike `NativeBlock`, `Set` is derivable:

```text
Aggregations:   _presets (type: com.machineblocks.core.Block[] — inherited from Block)
                _parts  (type: com.machineblocks.core.Block[], default — inherited from CompositeBlock)
                _steps  (type: com.machineblocks.core.Step[] — declared on Set.bml)
Derivable:      baseType = com.machineblocks.core.Set  ✓
Processor:      ScadSetProcessor → STEPS array + 4 view submodules
```

### subTypes

**Default:** `[]` — Sub-Blocks forbidden until explicitly enabled via `<subTypes>`.

**Omit** `<subTypes>` to inherit the effective list from the `baseType` chain. **Declare** `<subTypes>` only when overriding (enable or restrict).

Declared on `CompositeBlock.bml` (enables Sub-Blocks for composites):

```xml
<subTypes>
  <subType type="com.machineblocks.core.Block" />
  <subType type="org.blockml.core.FunctionBlock" />
</subTypes>
```

```text
org.blockml.core.Block                — omitted → effective []
com.machineblocks.core.Block          — omitted → inherits []
com.machineblocks.core.CompositeBlock — explicit → Block, FunctionBlock
com.machineblocks.core.Set            — omitted → inherits CompositeBlock
com.machineblocks.core.NativeBlock    — omitted → inherits [] (final leaf)
org.blockml.core.FunctionBlock     — omitted → inherits []
```

To close Sub-Blocks on a type whose parent enabled them: `<subTypes/>` (explicit empty override).

### implTypes

Declared on `CompositeBlock.bml`:

```xml
<implTypes>
  <implType type="org.blockml.language.OpenSCAD" />
</implTypes>
```

```text
com.machineblocks.core.CompositeBlock — OpenSCAD
org.blockml.core.FunctionBlock       — OpenSCAD, TypeScript
```

### Validation

```text
BML_FINAL_BASE_TYPE             — NativeBlock used as baseType
BML_NATIVE_BLOCK_CUSTOM_PROPERTY — custom property declared on NativeBlock
BML_INVALID_SUBBLOCK_TYPE       — Sub-Block baseType not in subTypes
MB_EMPTY_BLOCK                  — Block has no Composition and no registered custom Processor
                                   (MB_* prefix = MachineBlocks-specific, not BML Core)
```

Note: `com.machineblocks.core.Step` is a framework Block extending `org.blockml.core.Block`. The SCAD Set renderer interprets its `part` association for STEPS assembly output.

---

## Versioning

Every Block definition carries a semantic version. External composition references are dependencies — each must specify an exact version. Same-document Sub-Block references do not.

```xml
<ac:Wall id="wall" version="1.0.0" size="[1, 8, 9]" />
<Base id="base_stud" offset="[0, 0, 0]" ... />   <!-- no version — Sub-Block, same file -->
```

Strict from V1: missing `version` on an external reference → `BML_MISSING_VERSION`. Unknown version → `BML_UNKNOWN_VERSION`. No implicit `latest`, no registry default. Legacy scad-lib files must be updated before they compile.
