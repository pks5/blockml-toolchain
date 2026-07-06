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
  org.blockml.core.Block
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
  wall                         — explicit, top-level
  wall::bottom                 — explicit, nested
  wall::bottom::inner          — explicit, deeply nested
  a3f7c2                       — auto-generated, top-level
  wall::a3f7c2                 — auto-generated, nested under explicit parent
```

**Explicit IDs** are defined by the author in the Composition. They are stable, human-readable, and the preferred form for any instance that needs to be referenced externally (e.g. `Place.blockId` in a MachineBlocks Set).

**Auto-generated IDs** are assigned when no explicit ID is given. They are short deterministic hashes — 6 hex characters derived from the Block's FQN, its position in the Composition, and its parent ID:

```text
Hash inputs:
  - FQN of the Block type
  - Index in the Composition
  - Parent instance ID

Result:  6 hex characters  (e.g. "a3f7c2")
         16^6 = ~16.7 million possibilities — collision probability negligible
         for typical Composition sizes (2–50 children)
```

Auto-generated IDs are deterministic — the same Block at the same position always produces the same ID across compile runs. This keeps generated output diffs clean.

Auto-generated IDs are not "private" — they may appear in generated output (e.g. as SCAD instance IDs). They are simply not intended for external cross-document references. If a collision occurs at 6 characters, the hash length is extended automatically.

Not every child instance requires an ID in BML. If omitted, the compiler assigns an auto-generated ID. If an instance must be referenced by another element (e.g. a `Place` referencing a block by ID), an explicit ID is required — the compiler emits a diagnostic error if a reference targets an auto-generated ID.

---

## Block

A Block is the fundamental unit of BOM Core. It is a parametric, typed, reusable definition — analogous to a class in object-oriented programming.

### Metadata

```text
name               — short class name (PascalCase). Required. See naming convention below.
fullQualifiedName  — globally unique FQN
baseType           — FQN of the parent Block. Required — no default.
version            — semantic version of this definition
members            — named members: Properties, Aggregations, Associations, Capabilities
compositions       — list of Composition definitions
```

### Block Name Convention

The `name` field is a class name — not a label or a description:

```text
Format:  PascalCase — starts with uppercase letter, letters and digits only
Regex:   [A-Z][a-zA-Z0-9]*
Valid:   Wall, StandardBrick, Calibrator, DefaultEnclosure, NfcPlayer
Invalid: my-wall, wall_v2, 2Wall, My Wall

Error:   BML_INVALID_BLOCK_NAME
```

PascalCase is required because:
- Sub-Block short-name references (`<Base />`) are unambiguous — no Property name starts with an uppercase letter
- Block names map directly to SCAD module names without transformation
- Consistent with class naming conventions in Java and TypeScript

### Inheritance

Blocks inherit from other Blocks via `baseType`. Inheritance is single — each Block has exactly one base type. The root of all inheritance is `org.blockml.core.Block`.

`baseType` is mandatory on every Block definition. Omitting it is a parse-time error (`BML_MISSING_BASE_TYPE`). There is no implicit default — the author must always make an explicit choice about which domain the Block belongs to.

Domain-specific specializations extend this root:

```text
org.blockml.core.Block
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
defaultValue  — typed default value (literal or expression)
group         — optional grouping hint (for editors)
documentation — human-readable description
suggestions   — optional list of suggested values (see below)
```

### Suggestions

A Property may declare a list of suggested values. Suggestions are purely metadata — they do not affect type validation or compilation. The Property type remains unchanged. Editors display the property as a combobox; the SCAD BlockProcessor generates an OpenSCAD Customizer dropdown comment.

```text
suggestions:
  - value: "#303D4E"   label: "Midnight Blue"
  - value: "#EAC645"   label: "Sun Flower"
  - value: "#58B99D"   label: "Turquoise"
```

The author can always enter any value regardless of suggestions.

### Computed Default Values

A `defaultValue` may be a static literal or an Expression. Expressions in `defaultValue` allow a Property's default to be derived from other Properties of the same Block:

```xml
<property name="numberOfSamples" type="Integer" defaultValue="5" />
<property name="labelSize"       type="Integer" defaultValue="5" />
<property name="size"            type="Size3D"
          defaultValue="${ [#math.max(2 * numberOfSamples + 1, labelSize), 12, 2] }" />
```

**Allowed expression roots in `defaultValue`:**

```text
✓  Other Properties of the same Block
✓  #built-in functions (#math.*, #strings.*, etc.)
✗  @bean references
✗  @model bindings
✗  bml: directives
✗  registry
```

**Cycle detection:** The compiler performs a topological sort of all Property dependencies before resolving defaults. If Property A's `defaultValue` references Property B and B's `defaultValue` references A — directly or transitively — a `BML_PROPERTY_CYCLE` error is emitted and compilation stops.

### Resolution Order

Property values are resolved in this order (highest priority first):

```text
1. Inline value    — set directly on a Block instance in a Composition
2. Preset value    — from the active Preset
3. Config value    — from the active Config profile (domain-specific)
4. Default value   — from the Block definition (literal or computed expression)
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

### ServiceBlock Class Hierarchy

```text
org.blockml.core.Block
  org.blockml.service.ServiceBlock          — base for all service types
    org.blockml.service.ModelBlock          — holds data (JSONModel, ODataModel, XMLModel)
    org.blockml.service.FunctionBlock       — binds TypeScript functions to Sync Capabilities
```

**`org.blockml.service.ServiceBlock`** — the abstract base. All service types extend this.

**`org.blockml.service.ModelBlock`** — provides data access via path-based Sync Capabilities. Specializations: `org.blockml.service.JSONModel`, `org.blockml.service.ODataModel`, `org.blockml.service.XMLModel`.

**`org.blockml.service.FunctionBlock`** — binds TypeScript arrow functions to Sync Capabilities via `<implementation language="typescript">`. The BlockProcessor transpiles to the target language or executes at compile time when all arguments are literals. This is the pragmatic escape hatch for logic that no built-in covers yet — and a natural transition path: once a built-in is available, the `<implementation>` is replaced with a `#built-in` call while the Capability signature remains unchanged.

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

### Custom Data

Every Block has an implicit hidden Aggregation `customData` of type `org.blockml.core.CustomData`. This allows arbitrary key-value metadata to be attached to Block definitions and Composition instances without affecting rendering.

```text
org.blockml.core.CustomData
  key:   String  — metadata key
  value: String  — metadata value
```

In BML, `data:*` attributes are syntactic sugar for `customData` entries. The parser expands them automatically:

```xml
<!-- BML authoring shortform: -->
<bricks:StandardBrick
    id="strip"
    data:role="structural"
    data:group="calibration-row-0" />

<!-- Equivalent BOM representation: -->
StandardBrick._customData: [
    CustomData { key: "role",  value: "structural" }
    CustomData { key: "group", value: "calibration-row-0" }
]
```

`customData` has no effect on compilation or rendering. It is passed through to the BOM for use by tooling, editors, documentation generators, and CI systems.

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

> **Package TBD** — placeholder `org.blockml.capability.*`. Candidate: `bom.foundation` (domain to be confirmed).

```text
org.blockml.capability.AsyncInbound   — receives a message asynchronously
org.blockml.capability.AsyncOutbound  — sends a message asynchronously
org.blockml.capability.Sync           — called synchronously within an Expression
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

Every Capability declares a `payloadType`. A Capability is a **messaging concept** — it has a payload, not a parameter list. The payload is an abstract message; its structure is irrelevant to the transport layer.

```text
org.blockml.type.Integer          — primitive
org.blockml.type.String           — primitive
{ a: Float, b: Float }            — anonymous Object with named keys
com.myDomain.MyClass              — typed Object (named fields)
Array<org.blockml.type.Integer>   — Array of primitives (variable length)
Array<com.myDomain.MyClass>       — Array of objects
```

Unqualified type names are resolved against the domain's default type namespace (determined by the Block's `baseType`).

### Object Payload as Function Signature

When a `FunctionBlock` Capability uses a structured Object as `payloadType`, the Object's keys serve as the function signature:

```text
payloadType: { a: Float, b: Float }
  → Arity:       2  (number of keys)
  → Parameter names: a, b  (key names in declaration order)
  → Positional call: #math.max(size[0], labelSize)
  → Named call:      #math.max(a=size[0], b=labelSize)
```

Both call syntaxes are always valid for Object payloads. This is the standard pattern for all `#math.*`, `#strings.*`, `#lists.*` built-ins.

`Array<T>` payloads are **not** suitable as FunctionBlock signatures — arity is undefined. Use a structured Object for any Capability with fixed parameters.

### Payload Call Syntax

The payload type determines how the Capability is called in Expressions:

```text
Primitive:
  myCapa(5)                        →  single value

Object payload { a: T, b: T }:
  myCapa(a = 4, b = 5)            →  named parameters
  myCapa({a: 4, b: 5})            →  object literal (equivalent)
  myCapa(4, 5)                    →  positional (key order)

Array payload Array<T>:
  myCapa([4, 5])                  →  array literal
```

Named parameters `(a=4, b=5)`, object literal `({a:4, b:5})`, and positional `(4, 5)` all produce identical payloads for Object payloads. A mismatch between declared `payloadType` and call syntax is a parse-time error.

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

### Sync Capability Implementations

A `Sync` Capability may carry an `<implementation>` element that provides a target-language function body. This is only permitted when the Block's `baseType` declares support for that implementation language.

```text
baseType declares:
  supportedImplementationLanguages: ["scad"]           — e.g. com.machineblocks.core.Block
  supportedImplementationLanguages: ["scad","typescript"] — e.g. org.blockml.service.FunctionBlock
```

If a Block carries an `<implementation language="scad">` but its `baseType` does not list `"scad"` in `supportedImplementationLanguages`, the compiler emits `BML_IMPLEMENTATION_NOT_SUPPORTED`.

A Sync Capability implementation can live directly on any Block whose `baseType` supports it — not only on `FunctionBlock` Sub-Blocks. The Sub-Block approach is a convention for grouping related utilities, not a requirement:

```xml
<!-- Direct on Block — valid if baseType supports "scad" -->
<capabilities>
  <capability name="formatValue" type="org.blockml.capability.Sync" ...>
    <implementation language="scad"><![CDATA[
function formatValue(x) = ...;
    ]]></implementation>
  </capability>
</capabilities>
```

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

## BML Directives

BML Directives are special attributes in the `bml:` namespace that control the structure and flow of a Composition. They are not Block properties — they are instructions to the BML processor. Whether a directive is pre-processed at compile time or translated 1:1 into target-specific constructs is the BlockProcessor's decision.

The `bml:` prefix is the canonical namespace. It is analogous to `th:` in Thymeleaf.

### `bml:each` — Loop

Repeats a Block instance for each element in a collection or for a numeric count. An optional second variable provides iteration status:

```xml
<!-- Numeric loop: i runs from 0 to n-1 -->
<bricks:StandardBrick
    bml:each="i : ${ numberOfSamples }"
    offset="${ [2 * i, 0, 0] }" />

<!-- Numeric loop with stat -->
<bricks:StandardBrick
    bml:each="i, stat : ${ numberOfSamples }"
    offset="${ [2 * stat.index, 0, 0] }"
    baseCutoutType="${ stat.last ? 'groove' : 'none' }" />

<!-- Collection loop -->
<bricks:StandardBrick
    bml:each="item, stat : ${ @myModel:/items }"
    size="${ item.size }"
    offset="${ [stat.index * 2, 0, 0] }" />
```

**Stat variables:**

```text
stat.index   — 0-based position
stat.count   — 1-based position
stat.size    — total count
stat.first   — boolean
stat.last    — boolean
stat.even    — boolean (based on 0-based index)
stat.odd     — boolean (based on 0-based index)
```

For numeric loops, the loop variable `i` equals `stat.index`. `stat.size` equals the numeric value. The stat variable is optional — omit it when not needed.

### `bml:if` and `bml:unless` — Conditional

Includes a Block instance only when the condition is true (`bml:if`) or false (`bml:unless`):

```xml
<bricks:StandardBrick
    bml:if="${ numberOfSamples > 3 }"
    size="[2, 2, 1]" />

<bricks:StandardBrick
    bml:unless="${ compact }"
    size="[4, 4, 1]" />
```

### `bml:block` — Virtual Container

A container that produces no Block output itself but allows directives to apply to a group of child Blocks:

```xml
<bml:block bml:each="i, stat : ${ numberOfSamples }">
    <Calibrator.Base
        offset="${ [0, i * -3, 0] }"
        label="${ rows[i].label }" />
    <Calibrator.StudDiameter
        offset="${ [0, i * -3, 0] }" />
</bml:block>

<bml:block bml:if="${ showOptional }">
    <ac:Corner offset="[0, 0, 0]" />
    <ac:Corner offset="[12, 0, 0]" />
</bml:block>
```

### `bml:id` — Dynamic ID

Sets the instance ID from an Expression:

```xml
<bricks:StandardBrick
    bml:each="i : ${ numberOfSamples }"
    bml:id="${ 'sample_' + i }"
    offset="${ [2 * i, 0, 0] }" />
```

---

## Sub-Blocks

Sub-Blocks are Block definitions nested inside a parent Block definition. They are analogous to static inner classes in Java — they belong to the parent Block conceptually and share its FQN prefix.

Sub-Blocks are declared in a `<subBlocks>` section within the parent Block definition. Each Sub-Block is a full Block definition with its own properties, aggregations, capabilities, and composition.

### Allowed Sub-Block Types

The `baseType` of the parent Block declares which Sub-Block base types are permitted via `allowedSubBlockTypes`. This is defined on concrete domain base types — not on `org.blockml.core.Block` which is abstract and domain-agnostic.

```text
org.blockml.core.Block
  → no allowedSubBlockTypes defined (abstract)

com.machineblocks.core.Block
  → allowedSubBlockTypes: [com.machineblocks.core.Block,
                            org.blockml.service.FunctionBlock]

org.blockml.service.FunctionBlock
  → allowedSubBlockTypes: []  (no Sub-Blocks)
```

**Default when not defined:** no Sub-Blocks allowed.

If a Sub-Block's `baseType` is not in the parent's `allowedSubBlockTypes`, the compiler emits `BML_INVALID_SUBBLOCK_TYPE`.

### FQN Convention

```text
Parent:    com.machineblocks.calibration.Calibrator
Sub-Block: com.machineblocks.calibration.Calibrator.Base
           com.machineblocks.calibration.Calibrator.StudDiameter
```

The Sub-Block `<fullQualifiedName>` is never declared — it is always derived from the parent FQN + `<name>`. Sub-Blocks can be nested recursively:

```text
com.machineblocks.calibration.Calibrator.Base.Strip
```

### Short-Name Reference

Within the parent Block's own Composition, Sub-Blocks are referenced by short name without namespace prefix:

```xml
<Base id="base_stud" ... />
<StudDiameter id="samples_stud" ... />
```

### SCAD Mapping

```text
com.machineblocks.calibration.Calibrator.Base
→  mb__com__machineblocks__calibration__Calibrator__Base
```

### Visibility

Sub-Blocks are full BOM objects referenceable via full FQN from outside the parent Block. External use is possible but uncommon.

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

Each Preset has:

```text
id    — stable kebab-case identifier (used for references, thumbnail filenames)
name  — human-readable display name (used in SCAD Customizer, editor UI)
```

The `id` is the canonical reference key. The `name` is display-only and may change without breaking references. The `id` must be unique within a Presets document.

A Presets document has its own FQN and is a first-class BOM object. Multiple Presets documents can target the same Block type — from different authors or packages.

### Preset Reference Syntax

Presets are referenced by `id` using the `::` separator:

```text
{PresetsDocumentFQN}::{preset-id}

Example:
  com.machineblocks.bricks.StandardBrickPresets::brick-2x4
```

This reference is always fully qualified and ID-based. Renaming a Preset's `name` never breaks references.

### Preset in Compositions

```xml
<!-- Preset only -->
<bricks:StandardBrick
    preset="com.machineblocks.bricks.StandardBrickPresets::brick-2x4" />

<!-- Preset + inline override: baseColor overrides the Preset value -->
<bricks:StandardBrick
    preset="com.machineblocks.bricks.StandardBrickPresets::brick-2x4"
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

### Object vs. Array — Mandatory Rule

**If a value has named attributes, it must be written as an Object `{ }` — never as an Array `[ ]`.**

This rule is enforced regardless of how the target language (e.g. SCAD) represents the value internally. The translation from Object to target format is always the BlockProcessor's responsibility.

```text
CORRECT — structured value with named keys → Object:
  { face: 'x-', axis: 'z', type: 'female' }
  { 'z+': -0.5 }
  { x: size[0], y: size[1] }

WRONG — array used as object substitute:
  ['x-', 'z', 'female']    ✗  has implicit positional semantics — not allowed
  [['z+', -0.5]]           ✗  SCAD-style array — not allowed in BML
```

The distinction:
```text
Array  → homogeneous sequence, no named structure: [1, 2, 3], [size[0], 0, 0]
Object → named attributes, structured: { face: 'x-', axis: 'z', type: 'female' }
```

If the SCAD representation uses arrays internally (e.g. `[["z+", -0.5]]`), the BML must still use Object syntax. The Processor translates.

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
org.blockml.type.Boolean
org.blockml.type.Integer
org.blockml.type.Float
org.blockml.type.String
```

### Generic Container Types

```text
org.blockml.type.List<T>
org.blockml.type.AutoOr<T>    — "auto" | T
org.blockml.type.NoneOr<T>    — "none" | T
org.blockml.type.FalseOr<T>   — false  | T
```

### Domain Type Namespaces

Each domain BOM defines its own type namespace:

```text
com.machineblocks.type.*   — Size3D, Direction, WallGap, Color, ...
com.electronics.types.*     — Voltage, Resistance, Footprint, ...
com.ui.types.*              — Color, Length, FontSize, ...
```

Types are never shared across domain namespaces unless explicitly defined in `org.blockml.type`. This is intentional — domain-specific types carry domain-specific semantics even when they share a name.

### Type Resolution Shorthand

Unqualified type names in serialization formats are resolved against the domain's default type namespace. BOM Core does not prescribe the namespace — that is the domain's responsibility.

---

## Versioning

Every Block, Library, and Catalog definition carries a semantic version. External instance references in Compositions must specify a version explicitly — same-document Sub-Block references do not. There are no implicit `latest` references.

```text
version: "1.0.0"   — on every Block definition (root and Sub-Block)
version="1.0.0"    — on external block instance references only
```

See `12_bom_object_model.md` — Instance Version Rules.

Version resolution against a package registry is domain-specific and outside BOM Core.

---

## Target System

The Target System is the bridge between BOM Core and domain-specific output formats. It defines how Blocks are processed, and how the compiler dispatches processing to the correct RenderTarget.

### Concepts

**RenderTarget** — defines the output system. Its name is the full stack identifier used on the CLI. It has a RenderEngine, zero or more BlockProcessors, and zero or more delegates to other RenderTargets.

**RenderEngine (CompilerEngine)** — provides the processing infrastructure for BlockProcessors. **CompilerEngine** is the generic term; BOM Core defines the contract as the TypeScript `RenderEngine` interface. A BlockProcessor chooses which engine methods to use — compile, renderTemplate, copyTemplate, or callLLM. Each BlockProcessor within the same target may use a different strategy. New CompilerEngine implementations can always be built and published as independent packages. **MakerEngine** (`@blockml/engine-maker`) is the first implementation.

**BlockProcessor** — a sub-unit of the RenderTarget registered for a specific `baseType`. Uses the RenderEngine as infrastructure and chooses its own rendering strategy. A single BlockProcessor can handle many Block types internally, or a target may have one specialized BlockProcessor per Block type, or any combination.

### RenderEngine Interface (CompilerEngine)

A CompilerEngine provides methods for all rendering strategies. BlockProcessors call whichever method fits their needs. The TypeScript interface name is `RenderEngine`:

```typescript
interface RenderEngine {
  // Deterministic code transformation (compile strategy)
  compile(block: Block, processor: BlockProcessor, context: RenderContext): RenderOutput

  // Template loading + variable substitution (template strategy)
  renderTemplate(block: Block, templatePath: string): RenderOutput
  renderTemplates(block: Block, templatePaths: string[]): RenderOutput

  // Pure file copy — no transformation (copy strategy)
  copyTemplate(sourcePath: string, targetPath: string): RenderOutput

  // LLM-based generation (llm strategy — future)
  callLLM(block: Block, prompt: string, context: RenderContext): RenderOutput
}
```

BOM Core defines only this interface. Each engine package implements it in its own way.

### RenderTarget Interface

```typescript
interface RenderTarget {
  name:       string             // e.g. "machineblocks-v3-scad"
  engine?:    RenderEngine       // optional if target only delegates
  processors: BlockProcessor[]   // 0..n own processors
  delegates:  RenderTarget[]     // 0..n other targets for delegation
}

interface BlockProcessor {
  baseType: string
  process(block: Block, engine: RenderEngine): RenderOutput
}
```

### Dispatch Logic

For each Block in the BOM document:

```text
1. Own processors: exact FQN match
2. Own processors: baseType-chain fallback (most specific wins)
3. Delegates: same logic applied recursively
4. No match → BML_NO_TARGET diagnostic error
```

More specific processors always win over generic ones — analogous to CSS selector specificity.

### Target Types

A RenderTarget is not categorized as "atomic" or "composite" — the combination of processors and delegates determines its behavior:

```text
Only own processors              — handles everything itself
Only delegates                   — pure delegation (e.g. MartianMicro targets)
Own processors + delegates       — mixed: handles some blocks, delegates others
```

### BlockProcessor Strategies

A BlockProcessor chooses its rendering strategy by calling the appropriate engine method. Multiple strategies can coexist within a single RenderTarget:

**Compile strategy** — deterministic code transformation:

```typescript
class ScadBlockProcessor implements BlockProcessor {
  baseType = "com.machineblocks.core.Block"
  process(block: Block, engine: RenderEngine): RenderOutput {
    return engine.compile(block, this, context)
  }
}
```

**Template strategy** — template file + variable substitution:

```typescript
class NfcPlayerProcessor implements BlockProcessor {
  baseType = "com.pimachine.nfc.NfcPlayer"
  process(block: Block, engine: RenderEngine): RenderOutput {
    return engine.renderTemplates(block, ["nfc_player.py.tpl", "config.json.tpl"])
  }
}
```

**Copy strategy** — pure file copy, no transformation:

```typescript
class MathServiceProcessor implements BlockProcessor {
  baseType = "org.blockml.service.MathService"
  process(block: Block, engine: RenderEngine): RenderOutput {
    return engine.copyTemplate("lib/math_service.scad", "lib/math_service.scad")
  }
}
```

**Mixed within one target:**

```text
machineblocks-v3-scad-target
  ScadBlockProcessor      → compile strategy    (com.machineblocks.core.Block)
  ScadSetProcessor        → compile strategy    (com.machineblocks.core.Set)
  MathServiceProcessor    → copy strategy       (org.blockml.service.MathService)
  FunctionBlockProcessor  → compile strategy    (org.blockml.service.FunctionBlock)
```

### Built-in ServiceBlocks as BML

Built-in ServiceBlocks (`#math`, `#string`, etc.) are defined as BML Block files in a dedicated package. This makes their Capabilities formally typed, editor-discoverable, and extensible:

```text
@blockml/core-services/
  src/
    com/bom/service/
      MathService.mbml       — defines all #math Sync Capabilities
      StringService.mbml     — defines all #string Sync Capabilities
      NumbersService.mbml    — defines all #numbers Sync Capabilities
      ListsService.mbml      — defines all #lists Sync Capabilities
```

Each domain target registers a corresponding BlockProcessor that renders these ServiceBlocks into the target-appropriate form (e.g. `MathServiceProcessor` for SCAD copies or generates the required SCAD helper functions).

### Delegate-Only Targets

A target with no processors and no engine — only delegates. Used for domain libraries that build entirely on existing targets:

```text
martianmicro-anyclosure-target
  engine: —
  processors: —
  delegates: [machineblocks-v3-scad-target]
```

MartianMicro defines only its Block types as MBML files. All rendering is handled by the MB SCAD target. The target itself is a thin declaration — no rendering logic needed.

### RenderOutput

`RenderOutput` is defined by each RenderTarget — the compiler treats it as opaque:

```typescript
interface ScadRenderOutput {
  files: { path: string; content: string; sourceMap: string }[]
}
```

---

## Package

BOM Core is published as a standalone package with no domain dependencies:

```text
@blockml/core
```

Domain BOMs declare it as a dependency:

```text
@machineblocks/mbom   depends on   @blockml/core
@electronics/ebom     depends on   @blockml/core
@ui/uibom             depends on   @blockml/core
```

BOM Core is browser and Node compatible. It contains no render logic, no file system access, and no domain-specific types.
