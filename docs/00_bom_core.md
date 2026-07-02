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

### Bean Scope

Every ServiceBlock Aggregation declares a `scope` that controls visibility to child Blocks:

```text
scope   — "local" | "context"    default: "local"
```

`local` — the bean is only accessible within the Block that declares it. Child Blocks in Compositions cannot see it.

`context` — the bean is passed down to all child Blocks in Compositions. A child Block can declare a bean with the same name to override it for its own children.

**Scope resolution in Expressions:**

When an Expression references `@myBean`, the resolver walks up the Composition hierarchy:

```text
1. Current Block — has a bean named "myBean" with scope="context"? → use it
2. Not found → go one level up
3. Repeat until root
4. Not found → parse-time error: bean "myBean" not in scope
```

A bean with `scope="local"` is invisible to children — it is skipped during the upward walk.

**Override example:**

```text
App       @data scope="context"  ← ODataModel (visible to all descendants)
  View    @data scope="context"  ← JSONModel  (overrides App @data for this View and its children)
    Table                        ← sees JSONModel via @data
  Sidebar                        ← sees ODataModel via @data (no override here)
```

This is analogous to Spring Bean scoping (`@ApplicationScope`, `@RequestScope`) — but scope is declared on the Aggregation, not on the ServiceBlock type itself. The same ServiceBlock type can have different scopes in different contexts.

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

Like Properties, Capabilities are declared with a name and a class (type). Like Properties, their value in a Composition is set directly on the child Block instance as an attribute. For Capabilities, this value is the address or binding — not a data value.

### Capability Classes

Capabilities use FQN classes instead of string type values. The class determines the communication pattern.

> **Package TBD** — placeholder `com.bom.capability.*`. Candidate: `bom.foundation` (domain to be confirmed).

```text
com.bom.capability.AsyncInbound   — receives a message asynchronously
com.bom.capability.AsyncOutbound  — sends a message asynchronously
com.bom.capability.Sync           — called synchronously within an Expression
```

### Capability Metadata

All Capabilities share these base fields:

```text
name           — camelCase member name (unique within the Block's member namespace)
class          — FQN of the Capability class (AsyncInbound | AsyncOutbound | Sync)
payloadType    — declared payload type (see Payload Types below)
visibility     — "public" | "hidden" (default: "public")
documentation  — human-readable description
```

`visibility="hidden"` marks a Capability as internal — it cannot be bound from outside the Block's own Composition. Hidden Capabilities are only accessible within the Block itself, either via Expressions or internal Composition bindings.

**`AsyncInbound`** adds:

```text
returnType     — optional; type of the asynchronous reply (for replyTo scenarios)
```

**`AsyncOutbound`** adds:

```text
returnType     — optional; type of the asynchronous reply (for replyTo scenarios)
```

**`Sync`** adds:

```text
returnType     — required; declared return type of the synchronous call
```

### Payload Types

Every Capability declares a `payloadType`. Supported forms:

```text
com.bom.types.Integer          — primitive
com.bom.types.String           — primitive
com.myDomain.MyClass           — Object (named fields)
Array<com.bom.types.Integer>   — Array of primitives
Array<com.myDomain.MyClass>    — Array of objects
```

Unqualified type names are resolved against the domain's default type namespace (determined by the Block's `baseType`). Array shorthand: `Array<Integer>` resolves identically to `Array<com.bom.types.Integer>` in a domain that defaults to `com.bom.types`.

### Payload Call Syntax

The payload type determines how the Capability is called in Expressions:

```text
Primitive:        myCapa(5)                    →  single value
Object payload:   myCapa(a = 4, b = 5)         →  named parameters (shorthand)
                  myCapa({a: 4, b: 5})         →  object literal (equivalent)
Array payload:    myCapa(4, 5)                 →  positional arguments
                  myCapa([4, 5])               →  array literal (equivalent)
```

Named parameters `(a=4, b=5)` and object literal `({a:4, b:5})` produce identical AST nodes. The parser accepts both forms for Object payloads. A mismatch between declared `payloadType` and call syntax is a parse-time error.

### Capability Value in Compositions

Capabilities do not have an `address` attribute in their definition. The address or binding is set as the Capability's value on a child Block instance in a Composition — exactly like a Property value.

Four value patterns are recognized:

```text
Absolute URI      — outbound routing to a fixed address
  stud://domain/path

Relative path     — context-resolved address (TBD: resolved against nearest App/Area Block)
  /path/to/resource

Capability linking — forward to another Capability (via Expression)
  ${ @myService.otherCapa }
  Valid for: AsyncOutbound → AsyncInbound (payload forwarded), Sync → Sync (payload + returnType must match)

Dynamic address   — synchronous Capability call produces the address string
  ${ @myService.getAddress() }
  returnType of the Sync Capability must be String
```

### Inheritance

Capabilities are inherited via `baseType`, identical to Properties and Aggregations. A derived Block inherits all Capabilities of its base type and may add its own.

### Sync Capabilities in Expressions

`Sync` Capabilities are the only Capability class callable within Expressions. `AsyncInbound` and `AsyncOutbound` Capabilities appear in Compositions as address/binding values only — they are not callable in Expressions directly.

### Direct Capability Access in Own Block

A Block can reference its own Capabilities in Expressions without a prefix — identical to how Properties are accessed:

```text
${ mySyncCapa() }             — call own Sync Capability, return value is used
${ mySyncCapa(a = 1, b = 2) } — with payload
${ myInbound }                — link own AsyncInbound Capability (no parentheses)
```

The rule mirrors external access: with `()` = Sync call, without `()` = AsyncInbound linking.

`AsyncOutbound` Capabilities of the same Block cannot be referenced in Expressions — they are triggered by the Block's internal logic, not bound.

Whether Capability linking in Presets is permitted is to be defined.

### Address Schemes

BOM Core uses `protocol://` as a generic placeholder. Domain specializations define concrete schemes:

```text
stud://    — MachineBlocks physical block network
http://    — REST / WebHook
mqtt://    — MQTT broker topic
wot://     — Web of Things device hub
```

### Message Model

BOM Core defines a minimal abstract message model for AsyncInbound and AsyncOutbound Capabilities:

```text
Message
  address   — URI identifying the target capability
  headers   — key-value metadata
    replyTo — optional; address to send an asynchronous response to
  payload   — structure declared by the Capability's payloadType
```

All async messaging is asynchronous. A Capability may reply using the `replyTo` header. BOM Core does not prescribe when or whether a response is sent.

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
members       — member values for Properties and Capabilities (see below)
```

**Property values** are literals or Expressions:

```text
"groove"              — String literal
2                     — Number literal
true                  — Boolean literal
[1, 8, 9]             — Array literal (pure literals only outside ${ })
{x: 1, y: 0}         — Object literal (pure literals only outside ${ })
${ size[0] + 1 }      — Expression
```

**Capability values** are addresses or bindings (see Capabilities → Capability Value in Compositions):

```text
stud://domain/path            — Absolute URI
/path/to/resource             — Relative path (context-resolved, TBD)
${ @myService.otherCapa }     — Capability linking
${ @myService.getAddress() }  — Dynamic address
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

### Preset Document Metadata

```text
fullQualifiedName — FQN of this Presets document
blockType         — FQN of the Block this document applies to
version           — semantic version of this Presets document
presets           — list of named property sets
```

A Presets document has its own FQN and is a first-class BOM object. Multiple Presets documents can target the same Block type — from different authors or packages.

### Preset Reference Syntax

Presets are referenced using the `::` separator — consistent with the instance ID convention:

```text
{PresetsDocumentFQN}::{PresetName}

Example:
  com.machineblocks.bricks.StandardBrickPresets::Brick 2x4
```

This reference is always fully qualified. There is no implicit lookup by preset name alone.

### Preset in Compositions

A child Block instance in a Composition may reference a Preset. Inline property values override Preset values:

```xml
<!-- Preset only -->
<bricks:StandardBrick
    preset="com.machineblocks.bricks.StandardBrickPresets::Brick 2x4" />

<!-- Preset + inline override: baseColor overrides the Preset value -->
<bricks:StandardBrick
    preset="com.machineblocks.bricks.StandardBrickPresets::Brick 2x4"
    baseColor="#303D4E" />
```

### Merge Order

```text
configProfile < preset < inline property
```

Inline properties always win over Preset values. Preset values always win over Config profile values. Only Properties that differ from the Block's defaults need to be listed in a Preset.

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

Expressions are wrapped in `${ }`. The content inside `${ }` is **extended JSON** — standard JSON syntax extended with three additions: property references, model bindings, and bean calls.

```text
${ myProperty }                                    — Property reference
${ myProperty.x }                                  — Attribute access
${ myProperty[0] }                                 — Index access
${ [size[0], size[1], 1] }                         — Array with expressions
${ {x: size[0], y: 1} }                            — Object with expressions
${ size[0] + 1 }                                   — Arithmetic
${ size[0] > 2 ? "groove" : "standard" }           — Ternary
${ mySyncCapa() }                                  — Own Block: Sync Capability call
${ mySyncCapa(a = 1, b = size[0]) }               — Own Block: Sync call with payload
${ myInbound }                                     — Own Block: AsyncInbound linking (no parentheses)
${ #math.min(size[0], size[1]) }                   — Built-in ServiceBlock call
${ @myBean.format(value = size[0], unit = "mm") }  — Bean call, named params (Object payload)
${ @myBean.format({value: size[0], unit: "mm"}) }  — Bean call, object literal (equivalent)
${ @myBean.compute(size[0], size[1]) }             — Bean call, positional (Array payload)
${ @myBean.compute([size[0], size[1]]) }           — Bean call, array literal (equivalent)
${ @myBean.otherCapa }                             — External Capability linking (no parentheses)
${ @myModel:/some/path }                           — Absolute Model binding
${ @myModel:relAttr }                              — Relative Model binding
${ @myBean.format(@myModel:attr, size[0]) }        — Bean call with mixed arguments
```

### Extended JSON Rules

Inside `${ }`, the following extensions to JSON are permitted:

```text
Property reference:    size   size[0]   size.x        — unquoted, resolves to current Block member
Model binding:         @myModel:/path   @myModel:rel  — @ prefix, : separator
Bean call:             @myBean.capa(...)               — @ prefix, dot notation
Built-in call:         #math.min(...)                  — # prefix, reserved namespace
```

Everything else follows JSON rules: strings in quotes, numbers as-is, booleans `true`/`false`, `null`, arrays `[...]`, objects `{...}`.

Object and array literals may contain expressions as values:

```text
${ [size[0], size[1], 1] }              ✓  array with property references
${ {x: size[0], y: @model:/y} }        ✓  object with property reference and model binding
${ {label: @myBean.format(size[0])} }  ✓  object with bean call as value
```

Outside `${ }` (as raw attribute values), only pure JSON literals are allowed:

```text
size="[1, 8, 9]"          ✓  pure array literal
config="{x: 1, y: 0}"    ✓  pure object literal
size="${ [size[0], 1] }"  ✓  expression (dynamic)
config="${ {x: size[0]} }" ✓  expression (dynamic)
```

### Expression Prefixes

```text
(no prefix)   — Property or member of the current Block instance
#name         — Built-in ServiceBlock (defined in baseType hierarchy, reserved)
@name         — User-defined Bean (bound via Aggregation) or Model binding
```

### Built-in ServiceBlock Calls (`#`)

Built-in ServiceBlocks are defined in the `baseType` hierarchy. Their Capabilities must be `Sync`. The `#` namespace is reserved — user-defined beans cannot use `#`.

```text
${ #math.min(size[0], size[1]) }   — Sync Capability, Array payload → primitive return
${ #math.max(a, b) }
${ #string.format(tpl, v) }
```

### User Bean Calls (`@`)

The referenced bean must be declared as an Aggregation with a `beanName` on the current Block. Only `Sync` Capabilities are callable in Expressions. The return value is used as the expression result.

```text
Object payload — two equivalent forms:
  ${ @myBean.capa(a = 4, b = size[0]) }    — named parameters
  ${ @myBean.capa({a: 4, b: size[0]}) }    — object literal

Array payload — two equivalent forms:
  ${ @myBean.capa(4, size[0]) }            — positional arguments
  ${ @myBean.capa([4, size[0]]) }          — array literal

Primitive payload:
  ${ @myBean.capa(size[0]) }               — single value

Mixed arguments (passing model binding as argument):
  ${ @myBean.format(@myModel:attr, size[0]) }
  ${ @myBean.format(@myModel:/abs/path, "mm") }
```

### Capability Linking

```text
${ @myBean.myOutbound }   — no parentheses; links without calling
```

Links an `AsyncOutbound` Capability of a Bean to an `AsyncInbound` Capability of the current Block. The payload is forwarded without transformation. Both Capabilities must have compatible `payloadType`.

For `Sync → Sync` linking: payload type and return type must both match.

This form is only valid when the target member is a Capability — using it on a Property is a parse-time error. Whether Capability linking is permitted in Presets is to be defined.

### Model Binding

```text
${ @myModel:/absolute/path }   — absolute path from Model root
${ @myModel:relativeAttr }     — relative path, resolved against binding context
```

The binding context is established by the parent Aggregation (see Compositions → Model Binding Context). Relative paths are only valid when a binding context exists — otherwise a parse-time error.

### Arithmetic and Ternary

```text
${ myProperty.x + myProperty.y - 1 }
${ myProperty.z * 2 }
${ myProperty > 2 ? "groove" : "standard" }
```

Operators: arithmetic `+  -  *  /  %`, comparison `>  <  ==  !=  >=  <=`.

### Registry

A shared registry is available within a Composition for sibling child Blocks to exchange values:

```text
Write:  registry.totalHeight = value
Read:   registry.totalHeight
```

Registry scope is per Composition. It is initialized on entry and not accessible outside.

### Scope Rules

```text
- Property references: current Block instance only (no prefix)
- No access to parent, grandparent, or sibling Block properties
- Direction is always parent → child (top-down only)
- Registry scope is per Composition
- @bean references: only beans declared as Aggregations on the current Block
- #built-in references: always available (inherited via baseType)
- Model binding context: inherited from parent Aggregation
- Array/Object literals outside ${ }: pure JSON only (no expressions)
- Array/Object literals inside ${ }: expressions allowed as values
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
