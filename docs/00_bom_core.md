# BOM Core

version: 2.0.0

## Purpose of this Document

This document defines BOM Core — a domain-agnostic abstract object model for parametric, composable units. BOM Core is the foundation from which domain-specific object models are derived.

BOM Core is not tied to any render target, serialization format, or domain. It defines only structural concepts: what a Block is, how Blocks relate to each other, how Members are organized, how Presets, Libraries, and Catalogs work, and how Targets are registered and dispatched.

Known specializations:

```text
MBOM  — MachineBlocks Object Model (physical, parametric geometry blocks → SCAD)
EBOM  — Electronics Object Model (electronic components → KiCad / Schematic)
UBOM  — Unity Object Model (game objects → Unity Prefabs)
SBOM  — Service / Logic Object Model (service beans → runtime)
UIBOM — UI Object Model (UI controls → UI framework)
KBOM  — Knowledge Object Model (knowledge graph → graph DB)
```

New domain BOMs can be added without modifying BOM Core. The architecture is designed to accommodate domain BOMs that are not yet known.

---

## Core Concepts

BOM Core defines four first-class concepts:

```text
Block        — a parametric, reusable unit (definition / type)
Preset       — a named, concrete property set for a Block
Library      — a collection of Block definitions
Catalog      — a collection of top-level composite Block definitions
```

Everything else — assemblies, placements, steps, scenes, views — is defined by domain-specific BOMs as specialized Block types.

### Relationships

```text
Library   contains   Block(s)
Block     has        Member(s)   — Properties, Aggregations, Associations, Capabilities
Block     has        Preset(s)
Block     has        Composition(s)
Catalog   contains   Block(s)   — top-level composite Blocks (finished products / assemblies)
```

---

## Object Identity

Every BOM object is identified by a globally unique **Fully Qualified Name (FQN)**.

### FQN Convention

```text
Format:   <reverse-domain-package>.<ClassName>
Package:  lowercase, dot-separated, reverse-domain
Class:    PascalCase

Examples:
  com.bom.core.Block
  com.machineblocks.core.Block
  com.machineblocks.bricks.StandardBrick
  com.electronics.core.Component
  com.ui.core.Control
```

### Instance Identity

Instances within a Composition are identified by an instance ID. Nested IDs are composed with `::` as separator:

```text
Format:    <instanceId>::<partId>::<subPartId>

Examples:
  00001
  00001::bottom
  00001::bottom::inner
```

The FQN is the fallback identifier when no explicit instance ID is present.

---

## Block

A Block is the fundamental unit of BOM Core. It is a parametric, typed, reusable definition — analogous to a class in object-oriented programming.

### Metadata

```text
name               — short class name (PascalCase)
fullQualifiedName  — globally unique FQN
baseType           — FQN of the parent Block (default: com.bom.core.Block)
version            — semantic version of this definition
members            — named members: Properties, Aggregations, Associations, Capabilities
compositions       — list of Composition definitions
```

### Inheritance

Blocks inherit from other Blocks via `baseType`. Inheritance is single — each Block has exactly one base type. The root of all inheritance is `com.bom.core.Block`.

Domain-specific specializations extend this root:

```text
com.bom.core.Block
  com.machineblocks.core.Block   — adds size, color, offset, direction, ...
  com.electronics.core.Component — adds footprint, schematic symbol, ...
  com.ui.core.Control            — adds layout, style, events, ...
  com.service.core.Bean          — adds lifecycle, dependencies, ...
```

### Composite Blocks

A Block with a non-empty Composition is a **Composite Block**. It defines internal structure by filling one or more of its Aggregations with child Block instances.

A Block without a Composition is a **Leaf Block** — it has no internal structure defined at the BOM level. Domain-specific Block Renderers handle its output directly.

---

## Member Namespace

Properties, Aggregations, Associations, and Capabilities all share a single namespace per Block. Member names must be unique across all member types within a Block definition.

This is a deliberate design decision: authors think in names, not in member categories. Bindings, expressions, and presets all reference members by name without needing to know the category. It also prevents naming conflicts between member types.

```text
Block: MyBlock
  size        — Property      (name must be unique)
  parts       — Aggregation   (cannot also be a Property name)
  target      — Association   (cannot also be a Property or Aggregation name)
  assemble    — Capability    (cannot also be any other member name)
```

Members are inherited via `baseType`. Derived Blocks inherit all Members of their base type and may add their own. Overriding inherited members is not permitted — this is enforced at parse time.

---

## Properties

Properties are typed parameters of a Block. Every Property has a name, a type, and a default value.

### Property Metadata

```text
name          — camelCase property name (unique within the Block's member namespace)
type          — FQN of the BOM type
defaultValue  — typed default value
group         — optional grouping hint (for editors)
documentation — human-readable description
```

### Resolution Order

Property values are resolved in this order (highest priority first):

```text
1. Inline value    — set directly on a Block instance in a Composition
2. Preset value    — from the active Preset
3. Config value    — from the active Config profile (domain-specific)
4. Default value   — from the Block definition
```

---

## Aggregations

An Aggregation describes an ownership relationship: a Block can contain zero or more child objects of a given type.

### Aggregation Metadata

```text
name               — member name (unique within the Block's member namespace)
type               — FQN of the child type
cardinality        — "0..1" | "0..n" | "1..1" | "1..n"
visibility         — "public" | "hidden"
defaultAggregation — boolean
documentation      — human-readable description
```

`visibility="hidden"` marks an Aggregation as internal — it can only be filled by the Block's own Composition, not from outside.

### Implicit Default Aggregation

When no Aggregations are declared, a domain-specific default Aggregation is created implicitly. BOM Core does not prescribe the name or child type — that is the domain's responsibility.

### ServiceBlock Aggregations

A ServiceBlock is a special Block type that provides named, reusable services — such as data models, math utilities, or formatters. ServiceBlocks are bound into a Block via Aggregations with a bean name. Once bound, they are accessible in Expressions via their bean name using the `@` prefix.

Built-in ServiceBlocks are defined in the `baseType` hierarchy and accessible via the `#` prefix. They are shared across all Blocks in the same domain and cannot be overridden.

```text
#math    — built-in math service (min, max, ceil, floor, ...)
#string  — built-in string utilities (format, trim, ...)
```

User-defined ServiceBlocks are declared as Aggregations and given a bean name:

```text
@myModel   — user-defined JSONModel, bound as bean "myModel"
@myService — user-defined service Block, bound as bean "myService"
```

The distinction between `#` (built-in) and `@` (user-defined) is enforced at parse time. `#`-prefixed names are reserved and cannot be used as bean names.

---

## Associations

Associations describe loose references between objects without ownership. They are defined for future use across all BOM specializations.

```text
name          — member name (unique within the Block's member namespace)
type          — FQN of the referenced type
cardinality   — "0..1" | "0..n"
documentation — human-readable description
```

Associations carry no ownership and do not affect rendering.

---

## Capabilities

Capabilities describe how a Block communicates — with the outside world or internally within a Composition. A Capability is a named member of a Block, sharing the member namespace with Properties, Aggregations, and Associations.

### Capability Types

BOM Core defines three Capability types:

**Inbound** — receives a message from an external sender. Activated by an incoming message at a registered address. Asynchronous.

**Outbound** — sends a message to an external receiver. Triggered by the Block in response to domain-specific conditions. Asynchronous.

**Synchronous** — called directly within an Expression. Has a return value. No address. Not reachable via messaging protocols.

### Capability Metadata

All Capabilities share these base fields:

```text
name           — camelCase capability name (unique within the Block's member namespace)
type           — "inbound" | "outbound" | "synchronous"
payloadType    — declared payload type: Object schema or Array schema
documentation  — human-readable description
```

**Inbound** adds:

```text
address        — path pattern that activates this capability
                 path variables use {variableName} syntax
                 e.g. /blocks/{id}/resize
```

**Outbound** adds:

```text
address        — receiver address as a protocol URI
                 e.g. stud://enclosure/nfc/tag-detected
```

**Synchronous** adds:

```text
returnType     — declared return type (primitive, Object, or Array)
```

### Payload

Every Capability declares a payload type. The payload is either an Object or an Array. The call syntax in Expressions determines which form is used:

```text
Object payload:  myCapa(a = 4, b = 5)   →  { a: 4, b: 5 }
Array payload:   myCapa(4, 5)           →  [4, 5]
```

The declared payload type must match the call syntax. A mismatch is a parse-time error.

### Inheritance

Capabilities are inherited via `baseType`, identical to Properties and Aggregations. A derived Block inherits all Capabilities of its base type and may add its own.

### Synchronous Capabilities and Expressions

Synchronous Capabilities are the only Capability type accessible via Expressions. They have no address and cannot be reached via messaging protocols. This constraint is current — future use cases may relax it.

Inbound and Outbound Capabilities can be linked in a Composition via Expressions (see Expression System). Whether Capability linking is permitted in Presets is to be defined.

### Address Schemes

BOM Core uses `protocol://` as a generic placeholder. Domain specializations define concrete schemes:

```text
stud://    — MachineBlocks physical block network
http://    — REST / WebHook
mqtt://    — MQTT broker topic
wot://     — Web of Things device hub
```

### Message Model

BOM Core defines a minimal abstract message model for Inbound and Outbound Capabilities:

```text
Message
  address   — URI identifying the target capability
  headers   — key-value metadata
    replyTo — optional; address to send a response to
  payload   — Object or Array; structure declared by the Capability
```

All messaging is asynchronous. An Inbound Capability may reply using the `replyTo` header. BOM Core does not prescribe when or whether a response is sent.

---

## Compositions

A Composition fills an Aggregation with concrete child Block instances. It defines the internal structure of a Composite Block.

```text
aggregation   — name of the target Aggregation
children      — ordered list of child Block instances
```

Each child instance carries:

```text
type          — FQN of the child Block class
id            — instance ID (used for nested identity: parentId::childId)
version       — version of the referenced Block type
members       — member values (literals or expressions) for Properties and Capabilities
```

### Model Binding Context

When a child instance's Aggregation is bound to a ServiceBlock Model, all children within that Aggregation inherit the Model binding context. Relative Model paths are resolved against this context:

```xml
<List items="{@myModel:/path/to/array}">
    <ListItem label="{@myModel:relAttr}" />
</List>
```

`:` separates the bean name from the path. An absolute path starts with `/`. A relative path is resolved against the binding context established by the parent Aggregation.

---

## Preset

A Preset is a named, concrete property set for a specific Block type. Presets apply only to Properties — not to Aggregations, Associations, or Capabilities.

```text
name        — human-readable preset name
blockType   — FQN of the Block this preset applies to
version     — semantic version of this preset definition
parameters  — map of property name → concrete value
```

Only Properties that differ from the Block's defaults need to be listed. Missing Properties fall back through the resolution order.

A Block can have multiple Presets. Only one Preset is active at a time per Block instance. For complex structures, define a Composite Block and apply a Preset to that.

---

## Library

A Library is a named collection of Block definitions.

```text
name              — short library name
fullQualifiedName — FQN of the library
version           — semantic version
blocks            — list of Block FQNs contained in this library
```

A Library answers: *"What Block types are available?"*

---

## Catalog

A Catalog is a named collection of top-level composite Block definitions — finished products or assemblies intended for direct use.

```text
name              — short catalog name
fullQualifiedName — FQN of the catalog
version           — semantic version
blocks            — list of Block FQNs contained in this catalog
```

A Catalog answers: *"What finished assemblies are available?"*

Where a Library contains reusable types, a Catalog contains concrete finished compositions. The relationship mirrors the distinction between a component library and a product catalog in manufacturing.

---

## Expression System

BOM Core defines an expression system for dynamic member values. Expressions are used in Compositions to derive child Block property values from the parent Block's members, or to bind to ServiceBlock Models and Capabilities.

### Syntax

Expressions are wrapped in `${ }`:

```text
${ myProperty }                            — Property of the current Block
${ myProperty.x }                          — Object attribute of a Property
${ #math.min(myProperty.x, myProperty.y) } — Built-in ServiceBlock capability
${ @myBean.hello(z = myProperty.x) }       — User Bean: synchronous capability, Object payload
${ @myBean.hello(myProperty.x, 5) }        — User Bean: synchronous capability, Array payload
${ @myBean.hello2 }                        — Capability linking (see below)
${ @myModel:/some/path }                   — Absolute Model binding path
${ @myModel:relAttr }                      — Relative Model binding path
${ @myBean.format(@myModel:attr, @myModel:/a/b/attr2) } — Combined: bean call with model bindings as arguments
```

### Expression Prefixes

```text
(no prefix)   — Property or member of the current Block instance
#name         — Built-in ServiceBlock (defined in baseType hierarchy, reserved)
@name         — User-defined Bean (bound via Aggregation in the current Block)
```

### Property Access

```text
${ myProperty }       — direct property value
${ myProperty.x }     — attribute access on structured property (e.g. Size2D.x)
${ myProperty[0] }    — index access on list property
```

### Built-in ServiceBlock Calls (`#`)

```text
${ #math.min(a, b) }       — synchronous capability, Array payload → primitive return
${ #math.max(a, b) }
${ #string.format(tpl, v) }
```

Built-in ServiceBlocks are defined in the `baseType` hierarchy. Their Capabilities must be `synchronous`. The `#` namespace is reserved — user-defined beans cannot use `#`.

### User Bean Calls (`@`)

```text
${ @myBean.myCapa(a = 4, b = 5) }   — Object payload: { a: 4, b: 5 }
${ @myBean.myCapa(4, 5) }           — Array payload: [4, 5]
```

The referenced bean must be declared as an Aggregation on the current Block. The Capability must be `synchronous`. The return type is used as the expression value.

### Capability Linking

```text
${ @myBean.myOutbound }
```

Links an Outbound Capability of a Bean to a member of the current Block. The target member must be an Inbound Capability. The payload is forwarded without transformation. This form is only valid when the target is a Capability — using it on a Property is a parse-time error.

Whether Capability linking is permitted in Presets is to be defined.

### Model Binding

```text
${ @myModel:/absolute/path }      — absolute path from Model root
${ @myModel:relativeAttr }        — relative path, resolved against binding context
```

The binding context is established by the parent Aggregation (see Compositions → Model Binding Context). Relative paths are only valid when a binding context exists — otherwise a parse-time error.

### Ternary and Arithmetic

```text
${ myProperty > 2 ? "groove" : "standard" }
${ myProperty.x + myProperty.y - 1 }
${ myProperty.z * 2 }
```

Standard arithmetic (`+`, `-`, `*`, `/`, `%`) and comparison (`>`, `<`, `==`, `!=`, `>=`, `<=`) operators are supported.

### Registry

A shared registry is available within a Composition for sibling child Blocks to exchange values:

```text
Write:  registry.totalHeight = value
Read:   registry.totalHeight
```

Registry scope is per Composition. It is initialized on entry and not accessible outside.

### Scope Rules

```text
- Direct property access: current Block instance only
- No access to parent, grandparent, or sibling Block properties
- Direction is always parent → child (top-down only)
- Registry scope is per Composition
- @bean references: only beans declared as Aggregations on the current Block
- #built-in references: always available (inherited via baseType)
- Model binding context: inherited from parent Aggregation
```

### Expression AST

Expressions are parsed into a typed Expression AST at parse time — not evaluated as raw strings. The AST is part of BOM Core and is renderer-independent. Domain-specific renderers serialize the AST into their target format.

---

## Type System

BOM Core defines a minimal set of primitive types. Domain specializations extend this with domain-specific types. The type registry is dynamic — new types can be registered at runtime without modifying BOM Core.

### BOM Core Primitive Types

```text
com.bom.types.Boolean
com.bom.types.Integer
com.bom.types.Float
com.bom.types.String
```

### Generic Container Types

```text
com.bom.types.List<T>
com.bom.types.AutoOr<T>    — "auto" | T
com.bom.types.NoneOr<T>    — "none" | T
com.bom.types.FalseOr<T>   — false  | T
```

### Domain Type Namespaces

Each domain BOM defines its own type namespace:

```text
com.machineblocks.types.*   — Size3D, Direction, WallGap, Color, ...
com.electronics.types.*     — Voltage, Resistance, Footprint, ...
com.ui.types.*              — Color, Length, FontSize, ...
```

Types are never shared across domain namespaces unless explicitly defined in `com.bom.types`. This is intentional — domain-specific types carry domain-specific semantics even when they share a name.

### Type Resolution Shorthand

Unqualified type names in serialization formats are resolved against the domain's default type namespace. BOM Core does not prescribe the namespace — that is the domain's responsibility.

---

## Versioning

Every Block, Library, and Catalog definition carries a semantic version. All instance references in Compositions must specify a version explicitly. There are no implicit `latest` references.

```text
version: "1.0.0"   — on every definition
version="1.0.0"    — on every instance reference
```

Version resolution against a package registry is domain-specific and outside BOM Core.

---

## Target System

The Target System is the bridge between BOM Core and domain-specific output formats. It defines how Blocks are rendered, and how the compiler dispatches rendering to the correct Target.

### Target Types

**Atomic Target** — handles one domain's base types. Declares which `baseType` FQNs it supports. Contains one or more Block Renderers.

**Composite Target** — delegates across multiple Atomic Targets. Used when a BOM file contains Blocks from multiple domains. Has no Block Renderers of its own — it resolves per Block which Atomic Target is responsible and delegates.

### Target Registry

Targets are registered centrally in the compiler before compilation begins. The CLI selects the active Target by name:

```bash
bom compile my-file.mbml scad
bom compile my-file.mbml device   # composite target
```

The Target Registry is the single point of dispatch. It maps target names to Target implementations and resolves Block Renderer lookup.

### Target Interface

Every Target implements the following interface:

```typescript
interface BomTarget {
  name:                  string
  supportsBaseType(fqn: string): boolean
  getBlockRenderer(fqn:  string): BlockRenderer
}
```

For Composite Targets, `getBlockRenderer` delegates to the appropriate registered Atomic Target.

If no registered Target supports a Block's `baseType`, the compiler emits a diagnostic error and does not produce output for that Block.

### Block Renderer

A Block Renderer is the component within a Target that serializes a specific Block into the target format. The SCAD Target may have one generic renderer for all `com.machineblocks.core.Block` instances. A UI Target may have one renderer per Control FQN — analogous to UI5 Control Renderers.

```typescript
interface BlockRenderer {
  render(block: Block, context: RenderContext): RenderOutput
}
```

BOM Core has no knowledge of what `RenderOutput` contains. Domain-specific Targets define it:

```text
SCAD Target:    RenderOutput = { scadFiles: ScadFile[], sourceMaps: SourceMap[] }
Unity Target:   RenderOutput = { prefabFiles: PrefabFile[] }
UI Target:      RenderOutput = { componentFiles: ComponentFile[] }
```

### Composite Target Example

```text
bom compile my-device.mbml device

device (Composite Target)
  com.machineblocks.core.Block  →  scad (Atomic)    →  Wall.scad
  com.electronics.core.Component → kicad (Atomic)  →  board.kicad_pcb
  com.ui.core.Control           →  ui (Atomic)      →  Panel.jsx
```

---

## Package

BOM Core is published as a standalone package with no domain dependencies:

```text
@bom/core
```

Domain BOMs declare it as a dependency:

```text
@machineblocks/mbom   depends on   @bom/core
@electronics/ebom     depends on   @bom/core
@ui/uibom             depends on   @bom/core
```

BOM Core is browser and Node compatible. It contains no render logic, no file system access, and no domain-specific types.
