# BOM Core

version: 1.0.0

## Purpose of this Document

This document defines BOM Core — a domain-agnostic abstract object model for parametric, composable units and their assemblies. BOM Core is the foundation from which domain-specific object models are derived.

BOM Core is not tied to any render target, serialization format, or domain. It defines only structural concepts: what a Block is, how Blocks relate to each other, how Presets, Sets, Libraries, and Catalogs are organized.

Known specializations:

```text
MBOM  — MachineBlocks Object Model (physical, parametric geometry blocks → SCAD)
WoT   — Web of Things Object Model (connected devices → Thing Description)
```

---

## Core Concepts

BOM Core defines six first-class concepts:

```text
Block    — a parametric, reusable unit (definition / type)
Preset   — a named, concrete parameter set for a Block
Set      — a concrete assembly of Block instances with resolved parameters
Place    — a positioned instance reference within a Set
Step     — an ordered assembly instruction referencing a Place
Library  — a collection of Block definitions
Catalog  — a collection of Set definitions
```

### Relationships

```text
Library   contains   Block(s)
Block     has        Preset(s)
Set       is a       Block (baseType = com.bom.core.Set)
Set       contains   Place(s)  via _placement aggregation
Set       contains   Step(s)   via _steps aggregation  (optional)
Place     references Block     via blockId
Step      references Place     via placeId
Catalog   contains   Set(s)
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
  com.bom.core.Set
  com.machineblocks.bricks.StandardBrick
  com.wot.core.Device
```

### Instance Identity

Instances within a Set or Composition are identified by an instance ID. Nested IDs are composed with `::` as separator:

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
properties         — list of Property definitions
aggregations       — list of Aggregation definitions
associations       — list of Association definitions
events             — list of Event definitions
```

### Inheritance

Blocks inherit from other Blocks via `baseType`. Inheritance is single — each Block has exactly one base type. The root of all inheritance is `com.bom.core.Block`.

Domain-specific specializations extend this root:

```text
com.bom.core.Block
  com.machineblocks.core.Block   — adds size, color, offset, direction, ...
  com.wot.core.Device            — adds connectivity, firmware, sensors, ...
```

### Composite Blocks

A Block with a non-empty Composition is a **Composite Block**. It defines internal structure by filling one or more of its aggregations with child Block instances.

A Block without a Composition is a **Leaf Block** — it has no internal structure defined at the BOM level. Domain-specific renderers handle its output directly.

---

## Properties

Properties are typed parameters of a Block. Every property has a name, a type, and a default value.

### Property Metadata

```text
name          — camelCase property name
type          — FQN of the BOM type
defaultValue  — typed default value
group         — optional grouping hint (for editors)
documentation — human-readable description
```

### Resolution Order

Property values are resolved in this order (highest priority first):

```text
1. Inline value        — set directly on a Block instance
2. Preset value        — from the active Preset
3. Config value        — from the active Config profile (domain-specific)
4. Default value       — from the Block definition
```

---

## Aggregations

An Aggregation describes an ownership relationship: a Block can contain zero or more child objects of a given type.

### Aggregation Metadata

```text
name              — aggregation name (convention: leading _ for internal)
type              — FQN of the child type
cardinality       — "0..1" | "0..n" | "1..1" | "1..n"
visibility        — "public" | "hidden"
defaultAggregation — boolean
documentation     — human-readable description
```

`visibility="hidden"` marks an aggregation as internal — it can only be filled by the Block's own Composition, not from outside.

### Implicit Default Aggregation

When no `<aggregations>` section is present, a domain-specific default aggregation is created implicitly. BOM Core does not prescribe the name or child type — that is the domain's responsibility.

---

## Compositions

A Composition fills an Aggregation with concrete child Block instances. It defines the internal structure of a Composite Block.

```text
aggregation   — name of the target aggregation
children      — ordered list of child Block instances
```

Each child instance carries:

```text
type          — FQN of the child Block class
id            — instance ID (used for nested identity: parentId::childId)
properties    — property values (literals or expressions)
```

---

## Set

A Set is a Block whose `baseType` is `com.bom.core.Set`. It describes a concrete assembly of Block instances.

A Set uses Multi-Aggregation to separate three concerns:

```text
_blocks     — Block configurations (what exists, how it is parameterized)
_placement  — placed instances (what is placed where, id becomes the instance id)
_steps      — assembly order (optional; defaults to document order of _placement)
```

`_blocks`, `_placement`, and `_steps` are conventional aggregation names for Sets. Domain specializations may rename or extend them.

### Place

`com.bom.core.Place` is a lightweight Block type that represents a positioned instance reference within a Set's `_placement` aggregation.

```text
id        — instance ID (the identity of this physical placement)
blockId   — references a Block configuration from _blocks
```

Domain specializations extend Place with positioning properties relevant to their domain (e.g. `direction` + `offset` for MachineBlocks, `location` + `ipAddress` for WoT).

### Step

`com.bom.core.Step` is a lightweight Block type that represents a single ordered assembly instruction within a Set's `_steps` aggregation.

```text
placeId   — references a Place in _placement
```

When `_steps` is empty or absent, assembly order equals the document order of `_placement` entries.

### Set as Block

Because a Set is a Block, it:

- has Properties
- can be placed inside another Set (Sets of Sets)
- can define its own Presets
- can appear in a Catalog
- inherits from other Sets via `baseType`

---

## Preset

A Preset is a named, concrete parameter set for a specific Block type. It assigns values to a subset of the Block's Properties.

```text
name        — human-readable preset name
blockType   — FQN of the Block this preset applies to
version     — semantic version of this preset definition
parameters  — map of property name → concrete value
```

Only properties that differ from the Block's defaults need to be listed. Missing properties fall back through the resolution order.

A Block can have multiple Presets. Only one Preset is active at a time per Block instance (in the context of a Set or direct instantiation).

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

Libraries are the distribution unit for Block definitions. A domain ecosystem typically publishes one or more Libraries (e.g. `com.machineblocks.bricks`, `com.machineblocks.closure`).

---

## Catalog

A Catalog is a named collection of Set definitions.

```text
name              — short catalog name
fullQualifiedName — FQN of the catalog
version           — semantic version
sets              — list of Set FQNs contained in this catalog
```

A Catalog answers: *"What assemblies / products are available?"*

Where a Library contains reusable types, a Catalog contains concrete, finished assemblies ready for use. The relationship mirrors the distinction between a component library and a product catalog in manufacturing.

---

## Associations

Associations describe loose references between objects without ownership. They are defined for future use across all BOM specializations.

```text
name          — association name
type          — FQN of the referenced type
cardinality   — "0..1" | "0..n"
documentation — human-readable description
```

Associations carry no ownership and do not affect rendering or assembly.

---

## Events

Events are defined for future use. They describe lifecycle hooks relevant when BOM objects participate in interactive, editor-side, or runtime logic.

```text
onAssemble
onRender
onSelect
onParameterChange
onConnect
onValidate
```

Events are not part of any render target. Their semantics are domain-specific.

---

## Expression System

BOM Core defines an expression system for dynamic property values. Expressions allow child Block instances in a Composition to derive their property values from the parent Block's properties.

### Syntax

Expressions use SpEL (Spring Expression Language) syntax, wrapped in `${}`:

```text
${parameters.size[2] - 1}
${math.max(parameters.size[0], 2)}
${parameters.size[0] > 2 ? "groove" : "standard"}
```

### Expression Roots

```text
parameters   — properties of the current Block instance (read-only)
math         — mathematical functions (min, max, ceil, floor, ...)
registry     — shared value store within the current Composition (read/write)
```

### Scope Rules

```text
- Access only to properties of the current Block instance
- No access to parent, grandparent, or sibling instances
- Direction is always parent → child (top-down only)
- Registry scope is per Composition
```

### Expression AST

Expressions are parsed into a typed Expression AST at parse time — not evaluated as raw strings. The AST is part of BOM Core and is renderer-independent. Domain-specific renderers serialize the AST into their target format.

---

## Type System

BOM Core defines a minimal set of primitive types. Domain specializations extend this with domain-specific types.

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

### Type Resolution Shorthand

Unqualified type names in serialization formats are resolved against the domain's default type namespace. BOM Core does not prescribe the namespace — that is the domain's responsibility.

---

## Versioning

Every Block, Set, Library, and Catalog definition carries a semantic version. All instance references (in Compositions and Sets) must specify a version explicitly. There are no implicit `latest` references.

```text
version: "1.0.0"   — on every definition
version="1.0.0"    — on every instance reference
```

Version resolution against a package registry is domain-specific and outside BOM Core.

---

## Render Target Interface

BOM Core defines a minimal interface that domain-specific renderers implement:

```text
render(block: Block): RenderOutput
```

BOM Core has no knowledge of what `RenderOutput` contains. Domain specializations define:

```text
MBOM:  RenderOutput = { scadFiles: ScadFile[], sourceMaps: SourceMap[] }
WoT:   RenderOutput = { thingDescription: ThingDescription }
```

The render dispatch is based on `baseType`:

```text
baseType ⊆ com.bom.core.Block  →  domain Block renderer
baseType ⊆ com.bom.core.Set    →  domain Set renderer
```

---

## Package

BOM Core is published as a standalone package with no domain dependencies:

```text
@bom/core
```

Domain specializations declare it as a dependency:

```text
@machineblocks/mbom   depends on   @bom/core
@wot/bom              depends on   @bom/core
```

BOM Core is browser and Node compatible. It contains no render logic, no file system access, and no domain-specific types.
