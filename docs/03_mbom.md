# BOM Compiler — MBOM

version: 2.0.0

## Purpose of this Document

This document defines the MBOM (MachineBlocks Object Model) — the MachineBlocks domain specialization of BOM Core. MBOM extends the lossless BOM transport model with MachineBlocks-specific types, properties, and render-target conventions.

MBOM is a domain-specific specialization of BOM Core (`00_bom_core.md`). BOM Core defines the abstract structural foundation — Block, Member (Properties, Aggregations, Associations, Capabilities), Preset, Library, Catalog, and the Expression system. MBOM extends these with MachineBlocks-specific types, properties, and the SCAD render target. Concepts already defined in BOM Core are not repeated here — this document covers only MBOM-specific extensions and decisions.

For the BML authoring format see `02_mbml.md`.
For the MBOM type system and serialization rules see `04_types.md`.
For native property definitions see `com.machineblocks.bml.core.NativeBlock` (`NativeBlock.bml`) — **SSOT** for MBML / SCAD parameters. Type shapes: `com.machineblocks.bml.type.*`. Conventions: `04_types.md`. Transitional SCAD hints only: `09_mbom_properties.yml` (must follow NativeBlock).

---

## Overview

MBOM is the renderer-independent domain model layered on BOM Core. It has no knowledge of SCAD syntax, parameters, or file formats. Validation operates on the lossless BOM; rendering interprets it for the target.

MBOM specializes BOM Core for the MachineBlocks domain — adding MB-specific property types (`SizeXYZ`, `WallGap`, `Direction`, ...), the native property set on `NativeBlock.bml` (SSOT), and the SCAD render target interface.

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
com.machineblocks.bml.core.Block
com.machineblocks.bml.bricks.StandardBrick
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

`com.machineblocks.bml.bricks` is a **documented exception** — plural library package for the brick Block family. See `00_bom_core.md` — FQN Convention.

### Instance Identity

Block instances (within a Composition) are identified by **`bml:id`**. Nested paths use `::`:

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

Properties are typed parameters of a Block. Every Property has a name, a type, and a defined value.

### Native vs. Custom Properties

**System properties** are defined on `org.blockml.bml.core.Block` and inherited by all Blocks — notably `id` (instance identity). They are system-relevant: the compiler, validator, and renderer treat them with dedicated logic. In MachineBlocks, `id` is also emitted for SCAD (`mb_block_id`) via NativeBlock / render mapping. See `00_bom_core.md` — System Properties.

**Domain native properties** are declared on `com.machineblocks.bml.core.NativeBlock` (`NativeBlock.bml`) — the **sole SSOT** for MachineBlocks MBML and SCAD parameters (names, types, documentation, defaults, `scad:value`). Type shapes live under `com.machineblocks.bml.type.*` (`mbt:`). Dedicated SCAD getters: `mb_param_size()`, `mb_param_baseColor()`, etc.

The full authoritative list is the `<properties>` section of `NativeBlock.bml` (not Markdown tables, not `09_mbom_properties.yml`). Axis conventions (XY / XYZ vs AB): `04_types.md`.

**Custom properties** are defined inline in a Block definition. They generate generic SCAD getters (`mb_param(config, settings, "wallThickness", 1)`).

The compiler treats members declared on NativeBlock (and inherited through the domain Block chain) as native; custom members are everything else authored on a concrete Block. Both use the same property element syntax in BML. Native properties only need to be declared on an instance when their value differs from the inherited default.

### Property Metadata

```text
name          — camelCase member name (unique within the Block's member namespace)
type          — MBOM type FQN (e.g. com.machineblocks.bml.type.SizeXYZ)
value  — typed defined value (literal or expression)
group         — optional grouping for editor display
documentation — human-readable description
```

Unqualified type names on Property `type` resolve via context-bound implicit namespace `org.blockml.bml.type.*` — see `02_mbml.md` — § Context-Bound Implicit Namespace. Domain types require `type:` prefix or full FQN.

**Computed values:** `value` may be an Expression referencing other Properties of the same Block. See `10_expression_language.md` — Expressions in `value`.

### Property Groups

Properties can be organized into named groups for editor display. Groups are metadata only — no effect on compiler behavior.

---

## Aggregations

Aggregations describe ownership relationships. An Aggregation defines that a Block can contain zero or more child objects of a given type. Domain-specific aggregations are declared on domain base types.

### `_presets` and `_parts` on MachineBlocks Blocks

MachineBlocks declares two domain aggregations on the base type chain:

```text
com.machineblocks.bml.core.Block  (extends org.blockml.bml.core.Block)
  _presets:
    type:    com.machineblocks.bml.core.Block[]
  basePresets:
    type:    bml:Self[]   (association — references ids in enclosing Block's _presets)

com.machineblocks.bml.core.CompositeBlock  (extends Block)
  _parts:
    type:    com.machineblocks.bml.core.Block[]
    default: true
```

Every MachineBlocks Block inherits `_presets` and `basePresets`. Composite blocks additionally inherit `_parts` as the default composition aggregation.

**Presets are not a BlockML core feature.** Preset instances are ordinary Block instances in `_presets`. The `basePresets` association references preset ids (local or `{BlockFQN}::{id}`). Preset merge is compiler logic; Customizer JSON is render-target logic.

When a Block's `baseType` chain includes `com.machineblocks.bml.core.CompositeBlock` and the author omits `<aggregations>`, `_parts` is still present in the effective member set. The parser stores only **declared** aggregations in the BOM; inherited members appear via `resolveEffectiveMembers()`.

Declare `<aggregations>` explicitly when **adding** aggregations beyond the inherited set (e.g. `_steps` on `Set`), when **overriding** inherited aggregations (`override="true"` required; partial override — type may be omitted), or when filling an aggregation with a nested `<composition>`.

### Example

```text
Wall  (baseType: com.machineblocks.bml.core.CompositeBlock)
  _presets:  com.machineblocks.bml.core.Block[] (inherited)
  _parts:    com.machineblocks.bml.core.Block[] (inherited, default)
  _myModel:  org.blockml.bml.service.JSONModel (protected, declared)
```

### Aggregation Metadata

```text
name          — member name (unique within the Block's member namespace)
type          — FQN of the child type, optionally with occurrence brackets (see 02_mbml.md — Type Notation)
default       — boolean; marks the primary aggregation (tooling / render targets)
documentation — human-readable description
```

Member visibility follows the three-level naming convention in `02_mbml.md` — § Member Visibility (`__` private, `_` protected, plain public). Visibility is a BlockML access rule only; renderers have full BOM access. Protected members are accessible in derived Blocks and by the direct composition owner.

Service beans are registered on Block instances via `bml:bean` (see `02_mbml.md` — Service beans). The bean is accessible in Expressions via `@beanName`.

---

## Associations

Associations describe loose references to other objects without ownership.

MachineBlocks uses `basePresets` on `com.machineblocks.bml.core.Block` — an association (`bml:Self[]`) referencing preset ids in the enclosing Block's `_presets` aggregation. Local ids resolve within the same Block; cross-file entries use `{BlockFQN}::{id}`.

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

Like Properties, Capabilities are declared with a name and a type (FQN). Their value in a Composition is the address or binding — set as an attribute on the child instance, exactly like a Property value.

> **Capability package TBD** — placeholder `org.blockml.bml.capability.*`. Candidate: `bom.foundation`.

### Inbound

Receives data/messages from an external sender. Asynchronous.

```text
name         — camelCase member name (unique within the Block's member namespace)
type         — org.blockml.bml.capability.Inbound
inputType    — required; declared input type (see Type Descriptors)
documentation
```

Member visibility: see `02_mbml.md` — § Member Visibility.

### Outbound

Sends/emits data/messages to an external receiver. Triggered by the Block in response to domain-specific conditions. Asynchronous.

```text
name         — camelCase member name
type         — org.blockml.bml.capability.Outbound
outputType   — required; declared output type
documentation
```

Member visibility: see `02_mbml.md` — § Member Visibility.

### Transformation

Called directly within an Expression. Transforms `inputType` to `outputType`. No address. Not reachable via async messaging. This constraint is current — future use cases may relax it.

```text
name         — camelCase member name
type         — org.blockml.bml.capability.Transformation
inputType    — required; declared input type
outputType   — required; declared output type
documentation
```

Member visibility: see `02_mbml.md` — § Member Visibility.

### Type Descriptors

```text
org.blockml.bml.type.Integer            — primitive
org.blockml.bml.type.Text             — primitive
com.myDomain.MyClass             — Object (named fields)
{ items: org.blockml.bml.type.Integer[0..n] }  — collection field
```

On Property `type` reference sites, unqualified primitives resolve to `org.blockml.bml.type.*`. Domain types require `type:` prefix (`com.machineblocks.bml.type.*`) or full FQN — see `02_mbml.md` — § Context-Bound Implicit Namespace.

### Payload Call Syntax

```text
Primitive:        myCapa(size[0])                  — single value
Object input:   myCapa(a = 4, b = size[0])       — named parameters (shorthand)
                  myCapa({a: 4, b: size[0]})       — object literal (equivalent)
Collection field input:  myCapa([4, size[0]])   — sequence literal (positional values)
```

Named parameters and object literal are interchangeable for Object input types. A mismatch between declared `inputType` and call syntax is a parse-time error.

### Capability Value in Compositions

The address or binding is the Capability's value on a child Block instance:

```text
stud://domain/path                  — Absolute URI (Outbound routing)
/path/to/resource                   — Relative path (context-resolved, TBD)
${ @myService.otherCapa }           — Capability linking (no parentheses)
${ @myService.getAddress() }        — Dynamic address (Transformation outputType must be String)
```

### Inheritance

Capabilities are inherited via `baseType`, identical to Properties and Aggregations.

### MachineBlocks Built-in services

Built-in services are defined in `com.machineblocks.bml.core.Block` and accessible in all MachineBlocks Blocks via the `#` prefix:

```text
#math    — Transformation capabilities: min, max, ceil, floor, abs, round, ...
#strings  — Transformation capabilities: format, trim, padStart, ...
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
bml:id        — composition instance identity. Required when referenced or on bml:each.
                Anonymous static children receive auto-ID after directive expansion.
bml:bean      — optional; registers this instance as a named service bean
bml:scope     — optional; "local" | "context" (service instances only; default: "local")
renderGroup   — render group name (optional, fallback = resolved bml:id)
namespace     — parameter filter namespace (optional, fallback = resolved bml:id)
bml:version   — version pin when type refers to an external block (required for external references only)
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
  [0] com.machineblocks.bml.bricks.StandardBrick
      id:          "bottom"
      renderGroup: "bottom"
      namespace:   "bottom"
      members:
        size:           Expression([ size[0], size[1], size[2] - 1 ])
        recess:         true
        tongue:         true
        recessWallGaps: "x+"

  [1] com.machineblocks.bml.bricks.StandardBrick
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
myTransform()         — Own Block: Transformation Capability call (no prefix)
myTransform(a=1)      — Own Block: Transformation call with input
myInbound             — Own Block: Inbound linking (no prefix, no parentheses)
#math.min(a, b)       — Built-in Transformation Capability call
@bean.capa(a=4, b=size[0])     — Named parameters (Object input)
@bean.capa({a: 4, b: size[0]}) — Object literal (equivalent)
@bean.capa(4, size[0])         — Positional arguments (Array input)
@bean.capa([4, size[0]])       — Array literal (equivalent)
@bean.capa                     — External Capability linking (no parentheses)
@model:/absolute/path          — Absolute Model binding
@model:relAttr                 — Relative Model binding
size[0] + 1                    — Arithmetic
size[0] > 2 ? "a" : "b"       — Ternary
```

**Outside `${ }`** (raw attribute values): pure JSON only — no property references, no model bindings. `[1, 8, 9]` and `{x: 1, y: 0}` are valid; `[size[0], 1]` is not.

**Disambiguation — own Block vs. bean:**

Property access, own Transformation call, and own Inbound linking all use no prefix. The parser resolves by checking the member namespace:

```text
foo     → Property in namespace? → yes: property access
foo()   → Transformation Capability in namespace? → yes: own Transformation call
foo     → Inbound in namespace? → yes (in Capability binding context): own linking
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
- Own Transformation Capability call: current Block only (no prefix, with parentheses)
- Own Inbound linking: current Block only (no prefix, no parentheses)
- No access to parent, grandparent, or sibling Block properties
- Direction is always parent → child (top-down only)
- Registry scope is per Composition — initialized on entry, not accessible outside
- @bean references: resolved by walking up Composition hierarchy (`bml:scope="context"` beans)
- #built-in references: always available (inherited via baseType)
- Model binding context: inherited from parent Aggregation
```

### Expression AST

Expressions are parsed into typed **`ExpressionNode`** trees — not evaluated as raw strings. Stored as `ExpressionValue` on the BOM. The SCAD Renderer serializes AST nodes. See `10_expression_language.md` — Expression AST.

### Sharing Values Between Siblings

Sibling child Blocks within the same Composition share computed values via **`bml:with`** on `<composition>` or a wrapping `<bml:container>` — not via a separate registry. See `02_mbml.md` — `bml:with`.

---

## MachineBlocks Set Model

A MachineBlocks Set is a Block whose `baseType` is `com.machineblocks.bml.core.Set`. It is not a separate MBOM class — it is a Block that the SCAD Renderer dispatches to `ScadSetRenderer` based on its base type.

A Set uses three conventional Aggregations — `_presets` and `_parts` inherited from the base type chain, `_steps` declared on Set:

```text
_presets    — block palette (configurations referenced by basePresets on _parts entries; inherited from Block)
_parts      — placed block instances (direction, offset, basePresets; inherited from CompositeBlock, default)
_steps      — assembly order (optional; defaults to document order of _parts)
```

There is no separate Placement meta-block. Placed instances are real Block instances in `_parts` with `basePresets`, `direction`, and `offset` as properties.

### com.machineblocks.bml.core.Step

Framework BML: `com/machineblocks/bml/core/Step.bml`. Extends `org.blockml.bml.core.Block` — a framework Block for Set assembly order.

```text
Extends:        org.blockml.bml.core.Block
Final:          true
Members:
  part           — association com.machineblocks.bml.core.Block: references bml:id of a placed instance in _parts
  description    — optional human-readable step label
Composition:    none — leaf meta Block
```

Step instances in `_steps` use **`bml:id`** when referenced; `part` points at a sibling's **`bml:id`** in `_parts`.

When `_steps` is absent or empty, assembly order equals the document order of `_parts` entries.

---

## MBOM Class Hierarchy

Framework types are **BML files** — see `16_framework_base_types.md`. Interpretation (SCAD mapping, processors) lives in render targets only.

```text
org.blockml.bml.core.Block                                  ← packages/core/…/Block.bml (abstract, root)
    com.machineblocks.bml.core.Step                         ← mbom/…/Step.bml (final)
  org.blockml.bml.core.ValueType                            ← ValueType.bml (abstract)
  org.blockml.bml.core.Language                             ← Language.bml (abstract)
    org.blockml.bml.core.ProgrammingLanguage                ← ProgrammingLanguage.bml (abstract)
      org.blockml.bml.language.TypeScript · OpenSCAD · PseudoCode · …
    org.blockml.bml.core.MarkupLanguage                       ← MarkupLanguage.bml (abstract)
      org.blockml.bml.language.XML · JSON · YML · Markdown
    org.blockml.bml.language.English · German · French · Spanish · Chinese · Japanese · Russian
  org.blockml.bml.core.Entity                               ← Entity.bml (abstract)
      org.blockml.bml.service.Math                          ← core/…/service/Math.bml
  com.machineblocks.bml.core.Block                          ← mbom/…/Block.bml (abstract)
    com.machineblocks.bml.core.CompositeBlock               ← CompositeBlock.bml (abstract)
      com.machineblocks.bml.core.Set                        ← Set.bml (abstract)
        com.martianmicro.anyclosure.DefaultEnclosure   ← user BML
      com.machineblocks.bml.bricks.StandardPresets          ← preset block (_presets)
    com.machineblocks.bml.core.NativeBlock                  ← NativeBlock.bml (final)
    com.machineblocks.bml.bricks.Standard                   ← user BML
    com.martianmicro.anyclosure.Wall
    …
```

### com.machineblocks.bml.core.Block

MachineBlocks domain base type. Defined in `domains/machineblocks/mbom/blocks/com/machineblocks/bml/core/Block.bml`. Extends `org.blockml.bml.core.Entity`.

```text
Extends:        org.blockml.bml.core.Entity
Properties:     name (String)
Associations:   basePresets (bml:Self[] — references ids in _presets)
Aggregations:   _presets (type: com.machineblocks.bml.core.Block[])
```

Domain native properties (size, offset, direction, …) are declared on `NativeBlock.bml` (SSOT) and inherited by concrete brick types (e.g. `com.machineblocks.bml.bricks.Standard`). `09_mbom_properties.yml` may hold transitional render hints only and must follow NativeBlock.

### com.machineblocks.bml.core.CompositeBlock

Defined in `CompositeBlock.bml`. Extends `Block`. Adds `_parts` as the default composition aggregation.

```text
Extends:        com.machineblocks.bml.core.Block
Aggregations:   _parts (type: com.machineblocks.bml.core.Block[], default)
```

### com.machineblocks.bml.core.NativeBlock

`NativeBlock` is the direct BML representation of a raw `mb_block()` call. It is **final** — it cannot be used as `baseType` in any Block definition. It can only appear as a child element in Compositions.

```text
Properties:     native MB properties (declared on concrete types or via basePresets)
                no custom properties allowed — BML_NATIVE_BLOCK_CUSTOM_PROPERTY
Capabilities:   none
Aggregations:   children (type: com.machineblocks.bml.core.Block[], default — mb_block() sub-geometry)
Composition:    allowed — children become mb_block() children
Final:          baseType = com.machineblocks.bml.core.NativeBlock → BML_FINAL_BASE_TYPE
```

The ScadBlockProcessor renders `NativeBlock` directly as `mb_block()` with all declared settings. V1 emits settings as pseudo-map `[["key", value], …]` — see `05_scad_renderer.md` — Settings Format.

**All leaf geometry in compositions renders as `mb_block()`.** Domain-typed composition children (e.g. `bricks:StandardBrick`) are **lowered** to the same `mb_block()` settings — they are not rendered via typed block modules or `use` imports of dependency SCAD files.

For **standalone compile**, leaf-only Block types (e.g. `com.machineblocks.bml.bricks.Standard` — effectively one NativeBlock) are **optimized to a direct `mb_block()` main call**, skipping typed module indirection and duplicate `mb_param_*` extraction. See `14_compiler_runtime.md` — Leaf-only blocks.

### com.machineblocks.bml.core.Set

`Set` extends `com.machineblocks.bml.core.CompositeBlock` and inherits `_presets` (palette) and `_parts` (placed instances). Unlike `NativeBlock`, `Set` is derivable:

```text
Aggregations:   _presets (type: com.machineblocks.bml.core.Block[] — inherited from Block)
                _parts  (type: com.machineblocks.bml.core.Block[], default — inherited from CompositeBlock)
                _steps  (type: com.machineblocks.bml.core.Step[] — declared on Set.bml)
Derivable:      baseType = com.machineblocks.bml.core.Set  ✓
Processor:      ScadSetProcessor → STEPS array + 4 view submodules
```

### Validation

```text
BML_FINAL_BASE_TYPE             — NativeBlock used as baseType
BML_NATIVE_BLOCK_CUSTOM_PROPERTY — custom property declared on NativeBlock
MB_EMPTY_BLOCK                  — Block has no Composition and no registered custom Processor
                                   (MB_* prefix = MachineBlocks-specific, not BML Core)
```

Note: `com.machineblocks.bml.core.Step` is a framework Block extending `org.blockml.bml.core.Block`. The SCAD Set renderer interprets its `part` association for STEPS assembly output.

---

## Versioning

Every Block definition has an effective version (own `<version>` or library inheritance). External composition references resolve from TypeRegistry context; `bml:version` is an optional exact-version assert.

```xml
<ac:Wall bml:id="wall" size="[1, 8, 9]" />
<ac:Wall bml:id="wall" bml:version="1.0.0" size="[1, 8, 9]" />  <!-- optional assert -->
<Base bml:id="base_stud" offset="[0, 0, 0]" ... />   <!-- no bml:version — Sub-Block, same file -->
```

Standalone block without `<version>` and not in a Library → `BML_MISSING_VERSION`. Unknown `bml:version` assert → `BML_UNKNOWN_VERSION`. Library TypeReferenceEntity sugar may carry optional `bml:version` (exact-version assert against the referenced type).
