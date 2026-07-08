# Type System — BML Definitions

version: 0.2.0

## Purpose of this Document

This document specifies how **value types**, **implementation languages**, and related structural types are defined in BlockML — as **BML files** in the same registry as composable Blocks.

For composable Block base types see `16_framework_base_types.md`.
For property parse/serialize rules (MB domain) see `04_types.md`.
For `TypeDescriptor` AST see `12_bom_object_model.md`.
For SCAD render mapping see `09_mbom_properties.yml`.
For WOT vision and motivation see `WOT_Reference_v26.md`.
For V1/V2/V3 scope and BML-vs-Markdown decisions see `01_system.md` — BML Self-Description Roadmap.

---

## Design Decision

BlockML must be able to describe **everything** that belongs to a World's grammar — not only composable Blocks, but also the types that Properties, Capabilities, and Presets use.

| Aspect | Decision |
|---|---|
| **Type SSOT** | BML files in `@blockml/core`, `@machineblocks/mbom`, domain packages |
| **Same mechanism** | Same `<block>` element · same parser · same TypeRegistry bootstrap |
| **Different rules** | Validator applies branch-specific rules via `baseType` chain |
| **Interpretation** | Renderers map type → target syntax (SCAD, React, Python, …) |
| **09_mbom_properties.yml** | Render mapping only — not type SSOT |
| **Block metadata** | Every `<block>` carries `<idea>` (semantic meaning) and `<documentation>` (technical detail) — see `02_mbml.md` |
| **Collections** | No `Array` type — multiplicity on any type reference (`T[]`, `T[3]`, `T[0..n]`) — see § Collections and Multiplicity |
| **Namespace separation** | `org.blockml.core.*`, `type.*`, `service.*`, `capability.*`, `language.*` = public BML grammar only; BOM/compiler types in `org.blockml.bom.*`, etc. — see `00_bom_core.md` |
| **04_types.md** | Parse/serialize behaviour per type · migration companion |
| **Domain XSD enums** | Deprecated as type SSOT — migrate to BML `EnumType` |

```text
BML (what the type IS)           →  TypeRegistry
04_types.md (how values parse)   →  Parser / validator value coercion
09_mbom_properties.yml (how     →  ScadBlockProcessor serializes property
  SCAD renders a property)
Renderer                         →  target-specific output
```

### WOT alignment

In the Web of Things, Blocks are the **grammar of a World**. Types are part of that grammar — not implementation detail.

```text
stud:// is how Things communicate.
BOM Core is how Things are structured.
Everything else is implementation.
```

Types are structure. They belong in BML — the same language humans, LLMs, and compilers use for Walls, Bricks, and ServiceBlocks. A MachineBlocks Set rendered to SCAD + a Martian Micro Device rendered to Python + React share **the same type FQNs**; only the render mapping differs.

---

## Semantic Layer vs Compiler Implementation

> **Block is the universal BML input concept — not a mandatory uniform runtime model.**

Two layers must be distinguished:

```text
Einlesen (Pflicht)         Der Compiler KENNT „Block“ als Konzept
                           — <block> root element · FQN · baseType · documentation
                           — ohne das kein Parser, kein Bootstrap, kein TypeRegistry

Abbilden (frei)            Der Compiler MUSS Block intern NICHT als einheitliches Objektmodell führen
                           — nach dem Parse: plain data, split interfaces, separate indexes
```

The statement „everything is a Block“ applies to the **authoring ontology** and the **WOT vocabulary**. It does not prescribe a single `Block` class hierarchy inside `@blockml/core`.

```text
BML / WOT layer          semantic · interpretable · human- and LLM-facing
                         „Block“ = named definable unit with FQN + baseType chain

Compiler — input         parser reads <block> · maps to BOM · validator walks baseType chain
                         (Block as concept is mandatory here)

Compiler — internals     pragmatic · free · implementation detail
                         may split storage · no uniform runtime „Block“ object required
```

| Layer | What it guarantees |
|---|---|
| **BML** | One syntax (`<block>`) · one bootstrap path · FQN identity · `baseType` inheritance |
| **Parser** | Understands `<block>` documents — **must** know the Block input concept |
| **BOM** | Abstract parse result — preserves authored structure; see `12_bom_object_model.md` |
| **Validator** | Walks `baseType` chain · applies branch rules · resolves effective members |
| **Renderer** | Interprets semantics for its target — SCAD, React, firmware, … |

The compiler **must** (input / pipeline):

- parse `<block>` root documents and map them to a BOM shape
- resolve `baseType` chains against the TypeRegistry
- apply branch-specific validation rules derived from framework BML

The compiler **does not** need to (internal representation):

- store all definitions in one homogeneous `Block` class hierarchy at runtime
- treat TypeBlocks and LanguageBlocks identically to other Blocks in memory
- expose „Block“ as a domain object API beyond parser/BOM/validator surfaces
- map BML 1:1 onto object-oriented domain models

The compiler **may** (V1 convenience example):

```text
registerDefinition(doc)     →  one bootstrap API for all .bml framework files
BlockDefinition interface   →  single parse result shape for all <block> documents
definitionBranch            →  derived at validate time from baseType chain — not stored in BML
TypeRegistry + TypeIndex    →  split internal indexes per branch if that is simpler
ScadBlockProcessor          →  knows property serializers · not „what is a Block philosophically“
```

**Interpretation is free.** A World’s renderer decides what a `Wall` or a `Size3D` *means* for its output. BML only ensures the description is **complete, typed, and addressable** — the WOT contract at the grammar level.

### Renderer freedom

The **Render Target** is free in **what** it produces and **how** it maps BML to output. No global rule requires:

```text
output must be „blocks“ in the target language
1:1 mapping input Block → one output artifact
NativeBlock / mb_block() pattern
any files at all (side effects-only targets are valid)
```

Cardinality, format, and semantics are **target-defined** — see `14_compiler_runtime.md` (C4).

**MachineBlocks SCAD — a common pattern, not a platform obligation:**

```text
BML Block (Idea)          →  ScadBlockProcessor
  composition leaves      →  nested mb_block() calls (SCAD „blocks“)
  NativeBlock             →  direct mb_block()  (explicit 1:1 at leaf)
  domain blocks (Wall, …) →  lowered to mb_block() settings (convention)
Set                       →  STEPS array + view submodules
```

The SCAD renderer **re-creates Blocks in the target language** — `mb_block()` is SCAD’s manifestation of the BML Block idea. That **blocks-beget-blocks** pattern may repeat in other Worlds (React components, Unity prefabs, firmware modules) — but each renderer chooses its own mapping.

```text
ScreenMachine (example)   →  React JSX · no mb_block · no SCAD blocks
EBOM (example)            →  KiCad symbols · different ontology entirely
MachineBlocks             →  mb_block() tree · Blocks in SCAD grammar
```

The renderer reads BML Blocks; it does **not** need to preserve „Block“ as a runtime concept in its internal pipeline — only to emit correct target output. Same separation as parser: **know the input semantics · free internal representation · free output shape**.

See `05_scad_renderer.md` · `14_compiler_runtime.md` — NativeBlock Render Model.

This matches WOT §0.5 pragmatism: ontological unity at the language layer, engineering freedom at the implementation layer. Without adoption, there is no WOT — and without internal freedom, there is no maintainable compiler.

### Platonic mapping (Idea · Manifestation)

The split is the WOT architecture applied to BlockML:

```text
Idea (Plato)              BML / semantic layer
  Urbild · unveränderlich   Block · TypeBlock · LanguageBlock · FQN
  existiert vor der Welt    beschreibbar ohne Render Target
  keine Substanz            keine SCAD · kein Python · kein 3D-Druck

Manifestation             Compiler · Renderer · Runtime
  Abbild · konkret          TypeScript-Interfaces · SCAD · ThingKit · Thing
  World liefert Deutung     MachineBlocks → SCAD mb_block() · ScreenMachine → React
  Runtime vervollständigt   Compiler übersetzt · Drucker druckt
  Renderer (optional)       may emit „blocks“ again in target grammar — not required
```

> *„Die Ideen stehen wie Urbilder da. Die anderen Dinge gleichen ihnen und sind Abbilder."* — Platon

BML hält die Idee stabil. Der Compiler ist Manifestor-Werkzeug — er darf die Idee intern beliebig repräsentieren, solange die Beschreibungssprache intakt bleibt. Die vollständige Manifestation kennt der Compiler nicht; das ist Sache des Renderers und der Runtime.

See `WOT_Reference_v26.md` §1 · The Idea · Manifestation.

---

## One Root: Everything is a Block

BOM Core defines Block as **„a parametric, reusable unit (definition / type)“** — not only as a composable physical object. TypeBlocks and LanguageBlocks are type definitions. They **are Blocks**.

**Class vs Object:** In familiar terms, every `<block>` document is a **Class** (declarative, semantic type). Every element in a `<composition>` is a **Block Instance** — an **Object** referencing that class by FQN. TypeBlocks (`Integer`, `Size3d`) are type-classes that may also appear as Block instances — interpretation is context-dependent. See `00_bom_core.md` — Block and Block Instance · Context-Dependent Interpretation (below).

All definitions use the BML `<block>` element, register in the same TypeRegistry, and inherit from **`org.blockml.core.Block`** — the sole inheritance root.

```text
org.blockml.core.Block                         abstract root · omits baseType · _customData aggregation
  ├── org.blockml.core.TypeBlock               property / payload types (Size3D, Integer, …)
  ├── org.blockml.core.LanguageBlock           capability implementation contract (OpenSCAD, …)
  ├── org.blockml.core.ServiceBlock          service branch
  ├── com.machineblocks.core.Block             domain base
  └── … user and domain Blocks
```

**One root · one registry · one parser.** Branch-specific rules come from the `baseType` chain — not from parallel ontologies. There is no separate ComposableBlock — all Blocks inherit directly from `org.blockml.core.Block` (or via domain/service branches).

Every Block instance carries the **meta property** `id` (may be empty). Properties must not be named `id`. Aggregation and association `type` attributes may reference **any Block FQN**. Property and Capability types must resolve to **TypeBlock** only.

### Literally everything — including the compiler's grammar

This is a **foundational decision**, not a naming convention:

```text
Wall              →  Block  (domain composable)
Integer           →  Block  (TypeBlock branch)
OpenSCAD          →  Block  (LanguageBlock branch)
Step              →  Block  (Set meta block)
IPlaceable        →  Block  (abstract — usable as contract / interface)
Library           →  Block  (publishable package descriptor; entry types as subBlocks)
Math · #strings   →  Block  (ServiceBlock branch)
org.blockml.core.Block itself  →  Block  (root)
```

There is no parallel type system in code, no hidden XSD ontology for framework concepts, no hardcoded list of „allowed languages“ outside BML. **The grammar describes itself in the same language it describes user content.**

Implications:

```text
LLM target structure     one shape — always <block> with FQN + baseType + idea + documentation
TypeRegistry bootstrap   framework .bml loaded before user .bml — same registerDefinition()
New primitive / language add a .bml file — not a compiler patch (V1 bootstrap set is fixed; mechanism is open)
WCMS / Blockiverse       framework Blocks are first-class publishable definitions
WOT Idea layer           compiler infrastructure is itself Ideas — not implementation exceptions
```

### Self-hosting on the compiler level

Before the compiler validates or renders **any** user file, it bootstraps the TypeRegistry from **its own BML packages**:

```text
@blockml/core BML
  Block.bml · TypeBlock.bml · LanguageBlock.bml · ServiceBlock.bml · FunctionBlock.bml
  Integer.bml · OpenSCAD.bml · …
  Math.bml · Strings.bml · …

@machineblocks/mbom BML
  Block.bml · CompositeBlock.bml · Set.bml · Step.bml · NativeBlock.bml · …

→  then  project srcDir
```

The compiler **uses BlockML to understand BlockML**. Framework semantics (`Integer`, `TypeBlock`, …) come from BML in the TypeRegistry — not from hardcoded FQN lists. The parser nonetheless **must** understand the `<block>` input format; only the **internal representation** after parse is free.

```text
Hardcoded in compiler     <block> parse contract · baseType chain walk · branch rules · diagnostics
Defined in BML            every named type · every framework branch · every language · every service
```

This is the WOT manifest principle applied to tooling: **the system manifesting itself** — the compiler is not outside the World grammar; it is the first consumer of that grammar. See `16_framework_base_types.md` — Bootstrap Order.

Internally the compiler may represent definitions as plain data (`BlockDefinition`, split indexes) — see § Semantic Layer vs Compiler Implementation. **Semantically** in BML there is only Block; **internally** there is no obligation to model it uniformly.

### Flat hierarchy under Block

`org.blockml.core.ComposableBlock` is **removed**. All framework and domain Blocks extend `org.blockml.core.Block` directly (or via intermediate branches like `TypeBlock`, `ServiceBlock`, `com.machineblocks.core.Block`):

```text
org.blockml.core.Block           root · _customData aggregation · meta property id on every instance
org.blockml.core.ServiceBlock baseType: org.blockml.core.Block
com.machineblocks.core.Block     baseType: Block · _presets · appliedPresets
com.machineblocks.core.CompositeBlock baseType: Block · _parts (default)
org.blockml.core.TypeBlock         baseType: Block · primitives · structs · enums · generics
org.blockml.core.LanguageBlock     baseType: Block (meta — no extra members in V1)
```

```text
com.machineblocks.core.Block     baseType: org.blockml.core.Block
org.blockml.core.ServiceBlock baseType: org.blockml.core.Block
com.machineblocks.type.Size3d    baseType: StructType → … → TypeBlock → Block
org.blockml.language.OpenSCAD    baseType: LanguageBlock → Block
```

**Member usage rules:**

```text
Aggregation / association type     — any Block FQN (composable Blocks, TypeBlocks, meta Blocks)
Property type                      — TypeBlock only (baseType chain includes org.blockml.core.TypeBlock)
Capability payloadType/returnType  — TypeBlock only (generic arguments substituted at validate time)
Meta property id                   — every Block instance; not declarable as <property name="id">
```

### Roles, not separate ontologies

The WOT Relativität Principle applies to types as well:

```text
com.machineblocks.type.Size3D   →  TypeBlock in MachineBlocks
                                →  payload struct in Expression signatures
                                →  serializer input in SCAD Renderer
                                →  layout constraint in ScreenMachine (future)
```

Same FQN · different role · one BML definition.

---

## TypeBlock Hierarchy

### Design Principles

The type system follows one metamodel — **everything is a Block**:

```text
Types are Blocks          — no separate type language construct
Primitives are Blocks     — value property + instance syntax (<Integer value="5"/>)
Structs are Blocks        — normal <properties>, no special struct syntax
Enums are Blocks          — _values aggregation + composition, no enumValues syntax
Contracts are Blocks      — abstract interfaces via <contracts>
Generics parametrize Blocks — <generics> + type arguments at reference sites
```

Semantics are decided by `baseType` and usage context — not by parallel XSD or compiler hardcoding.

---

All types inherit from **`org.blockml.core.TypeBlock`**. Types are not a separate language construct — they are normal BlockML Blocks. Meaning comes from `baseType` and usage context.

```text
org.blockml.core.TypeBlock              abstract
  ├── org.blockml.core.PrimitiveType    Integer · Float · String · Boolean · Null
  ├── org.blockml.core.StructType       Size3d · domain product types
  ├── org.blockml.core.EnumType         BaseCutoutType · Direction · …
  └── org.blockml.core.GenericType      user-defined parameterized types (Box&lt;T&gt;, …)
```

Only TypeBlocks may be used where a **type reference** is required (Property `type`, Capability `payloadType` / `returnType`). Any Block FQN is valid in aggregation and association `type` attributes — including TypeBlocks.

```text
Allowed:     type="org.blockml.type.Integer"
             payloadType="com.foo.Request"
Not allowed: type="com.machineblocks.core.NativeBlock"   → BML_INVALID_PROPERTY_TYPE
```

---

## Collections and Multiplicity

BlockML has **no separate `Array` type**. Any type may carry a **multiplicity** — how many instances of that type are permitted. Multiplicity is **not part of the type itself**; it is metadata on the type reference.

```text
Integer         → exactly one Integer
Integer[]       → 0..n Integers (shorthand for Integer[0..n])
Integer[0..n]   → 0..n Integers
Integer[3]      → exactly 3 Integers
Integer[1..5]   → 1 to 5 Integers
Integer[1..]    → at least one Integer (1..n)
Integer[1..1]   → exactly one Integer (explicit)
```

The FQN (`Integer`, `com.machineblocks.core.Block`, …) is unchanged. Bracket notation describes only the allowed instance count.

### Semantics, not implementation

BlockML describes the **semantics of a collection** — not how it is stored. Whether a renderer maps `Block[]` to a Java `List`, a `Set`, XML child elements, a JSON sequence, an SQL relation, graph edges, or a SCAD composition is **entirely target-defined**.

BlockML makes **no claim about ordered vs. unordered** collections. An ordered collection may always be interpreted as unordered by a target. XML composition yields ordered child lists by default; another platform may treat the same definition as a set.

### Terminology

Avoid **Array** in BlockML type documentation — it suggests a concrete implementation. Prefer:

```text
Collection · Sammlung · Menge · Multiplicity · Multiplizität
```

JSON `[1, 2, 3]` in property values remains a **literal sequence** in expression syntax — not a type named `Array`.

### WOT alignment

> **The World provides the interpretation.**

BlockML states what a collection *means*. The concrete data structure is part of the Manifestation — decided by the render target and runtime. See `WOT_Reference_v26.md` — The Idea.

### Where multiplicity applies

```text
Aggregation type=     com.machineblocks.core.Step[]
Association type=     _self[]
Property type=        (bare — exactly one value; collections rare on properties)
Capability payloadType=  { items: String[0..n] }   — named field with multiplicity
Composition children=   governed by parent aggregation multiplicity
```

See `00_bom_core.md` — Type Notation · `02_mbml.md` — Type notation · `12_bom_object_model.md` — Type Descriptors.

---

### PrimitiveType

Primitive types inherit from `org.blockml.core.PrimitiveType`. The branch declares:

```xml
<property name="value" type="_self"/>
```

Each concrete primitive (`Integer`, `Float`, …) inherits this member. A primitive value may appear:

**As a property value** (type reference):

```xml
<property name="count" type="Integer"/>
```

**As a Block instance** (literal):

```xml
<Integer value="5"/>
```

Interpretation is context-dependent — same TypeBlock, two roles.

V1 bootstrap primitives: `Integer`, `Float`, `String`, `Boolean`, `Null` in `@blockml/core`.

Unqualified names in BML (`type="Integer"`) resolve to `org.blockml.type.*` — unchanged from `02_mbml.md`.

---

### StructType

Complex values are described by **normal Properties** — no special struct syntax. A StructType is a TypeBlock with `<properties>`:

```xml
<block xmlns="http://blockml.org/schema/block"
       xmlns:type="com.machineblocks.type" ...>

  <name>Size3d</name>
  <type>com.machineblocks.type.Size3d</type>
  <baseType>org.blockml.core.StructType</baseType>
  <version>1.0.0</version>

  <properties>
    <property name="x" type="Float"/>
    <property name="y" type="Float"/>
    <property name="z" type="Float"/>
  </properties>

</block>
```

**Property declaration order is significant.** It defines positional array mapping when values are authored as array literals:

```text
size="[4, 2, 3]"   →  [x, y, z] in the order declared above (not alphabetical)
```

Render targets and expression coercion use this order for StructType values. The parser must preserve property order from BML — no reordering. See `12_bom_object_model.md` — Member Declaration Order.

**As type reference:**

```xml
<property name="size" type="com.machineblocks.type.Size3d"/>
```

**As Block instance:**

```xml
<Size3d x="10" y="5" z="2"/>
```

Anonymous struct syntax in Capability signatures (`{ a: Float, b: Float }`) remains valid at authoring time. The validator may suggest promoting repeated anonymous structs to named StructTypes.

---

### EnumType

Enums are normal TypeBlocks. The branch declares a default aggregation for enum values:

```xml
<aggregation name="_values" type="_self[]" default="true"/>
```

Enum values are **Block instances** in `<composition aggregation="_values">` — no special enum syntax:

```xml
<block ...>
  <name>BaseCutoutType</name>
  <type>com.machineblocks.type.BaseCutoutType</type>
  <baseType>org.blockml.core.EnumType</baseType>
  <version>1.0.0</version>

  <composition aggregation="_values">
    <BaseCutoutType id="NONE"     value="none"     />
    <BaseCutoutType id="STANDARD" value="standard" />
    <BaseCutoutType id="GROOVE"   value="groove"   />
  </composition>

</block>
```

Properties typed with an EnumType **must not** carry `<suggestions>` — valid values come from `_values` (`BML_SUGGESTIONS_ON_ENUM` unchanged).

**Enum value references in property values** (`defaultValue`, composition attributes, expressions):

When the property `type` is an EnumType, a qualified enum instance reference may omit the `{EnumTypeFQN}::` prefix:

```text
Property type:  com.machineblocks.type.BaseCutoutType

Qualified:      com.machineblocks.type.BaseCutoutType::STANDARD
Short:          STANDARD                              ← equivalent (type known from property)

Qualified form references the enum value's id (from _values composition).
```

```xml
<!-- NativeBlock.bml — property type is BaseCutoutType -->
<property name="baseCutoutType"
          type="com.machineblocks.type.BaseCutoutType"
          defaultValue="STANDARD" />

<!-- equivalent explicit form -->
<property name="baseCutoutType"
          type="com.machineblocks.type.BaseCutoutType"
          defaultValue="com.machineblocks.type.BaseCutoutType::STANDARD" />
```

The short form is valid only when the expected type is known from the property (or capability payload field) declaration — not for untyped strings. The validator resolves the token against `_values` by `id`.

**Value literal:** enum instances also carry a `value` property (e.g. `value="standard"` on id `STANDARD`). The runtime/serialization literal `standard` remains valid where a string enum literal is expected — see `04_types.md` · MBML examples. Id reference (`STANDARD` / `FQN::STANDARD`) and value literal (`standard`) are distinct surface forms; both must match a declared `_values` entry.

---

### Context-Dependent Interpretation

A TypeBlock may appear in different roles:

| Context | Example | Role |
|---|---|---|
| Property type | `type="com.machineblocks.type.Size3d"` | type reference |
| Block instance | `<Size3d x="10" y="5" z="2"/>` | value / object |
| Aggregation type | `type="org.blockml.type.Integer[]"` | collection of primitive instances |
| Composition child | `<Integer value="5"/>` inside an aggregation | transported value |

The renderer and validator decide semantics from `baseType` and usage context — not from separate metamodels.

---

### Generics

Blocks may declare generic type parameters:

```xml
<generics>
  <generic name="T" baseType="org.blockml.core.TypeBlock"/>
</generics>
```

Within the Block, the parameter is used as a type reference:

```xml
<property name="value" type="T"/>
```

Concrete use at reference sites:

```xml
<property name="values" type="com.foo.Box<org.blockml.type.Integer>"/>
```

At validate time the compiler substitutes each placeholder (`T`) with the concrete type argument. Each argument must inherit from the parameter's `baseType` constraint (`BML_GENERIC_CONSTRAINT_VIOLATION` on mismatch).

Generic type arguments are allowed wherever type references are allowed (Properties, Capabilities, aggregation/association types when referencing a generic Block).

Parameterized bootstrap types and user-defined generics (`Box<T>`, `Result<T, E>`) inherit from `org.blockml.core.GenericType`. Author syntax: `com.foo.Box<org.blockml.type.Integer>`, `type:AutoOr_Float` (domain).

User-defined generics (`Result<T, E>`, `Box<T>`) use the same mechanism — declare `<generics>` on the Block definition.

---

## Contracts

Blocks may implement zero or more **contracts** — abstract Block types whose member surface must be satisfied:

```xml
<contracts>
  <contract type="com.foo.Speaker"/>
  <contract type="com.foo.NetworkNode"/>
</contracts>
```

A contract is an abstract Block. All members declared on the contract (Properties, Aggregations, Associations, Capabilities — any subset) must be provided by the implementing Block's effective members. `subBlocks` and `compositions` on the contract type are ignored.

Contracts are orthogonal to `baseType` inheritance. See `00_bom_core.md` — Contracts.

---

## LanguageBlock

Implementation languages inherit from `org.blockml.core.Block` via `org.blockml.core.LanguageBlock`:

```text
org.blockml.core.Block
  └── org.blockml.core.LanguageBlock   abstract
        ├── org.blockml.language.TypeScript
        └── org.blockml.language.OpenSCAD
```

```xml
<block ...>
  <name>OpenSCAD</name>
  <type>org.blockml.language.OpenSCAD</type>
  <baseType>org.blockml.core.LanguageBlock</baseType>
  <version>1.0.0</version>
  <abstract>true</abstract>
</block>
```

Composable Blocks reference languages via `<implType type="org.blockml.language.OpenSCAD" />` — see `16_framework_base_types.md`. The language FQN must resolve to a registered LanguageBlock definition.

V1: two bootstrap languages in `@blockml/core`. Extensibility: domains register new LanguageBlock BML files.

---

## Root Exception

Only **`org.blockml.core.Block`** omits `<baseType>`. Every other definition must declare `<baseType>` — including `TypeBlock` and `LanguageBlock`.

---

## Validation Rules by Branch

Branch is derived by walking the `baseType` chain until a branch marker is found:

```text
… → TypeBlock → Block           type block branch
… → LanguageBlock → Block         language branch
… → Block (no TypeBlock/LanguageBlock ancestor)   general block branch
```

| Rule | General Block | TypeBlock | LanguageBlock |
|---|---|---|---|
| `<composition>` | allowed | EnumType: `_values` only; others: definition-level only | forbidden |
| `<capabilities>` | allowed | allowed on branch bases; uncommon on leaf types | forbidden |
| `<subTypes>` | allowed | allowed | forbidden |
| `<generics>` | allowed | allowed | forbidden |
| `<properties>` | allowed | StructType + PrimitiveType branch | forbidden |
| `<implTypes>` | allowed | forbidden | forbidden |
| Meta property `id` on instances | yes (always) | yes (always) | yes (always) |
| `<property name="id">` | forbidden | forbidden | forbidden |
| Used as composition instance typeFqn | if not abstract | if not abstract | forbidden |
| Used as aggregation/association `type` | any Block FQN | any Block FQN | — |
| Used as property `type` | forbidden | yes (+ generic substitution) | forbidden |
| Used as Capability payload/return type | forbidden | yes (+ generic substitution) | forbidden |
| Used as `<implementation type>` | forbidden | forbidden | yes |

Wrong branch usage → `BML_INVALID_DEFINITION_BRANCH`.

---

## TypeRegistry Resolution

At validate time, every `TypeDescriptor` named reference resolves against the registry:

```text
type="Integer"                              → org.blockml.type.Integer
type="type:Size3d"                          → com.machineblocks.type.Size3d
type="com.foo.Box<Integer>"                 → generic substitution at validate time
payloadType="{ a: Float, b: Float }"        → AnonymousStructType (inline)
capability implementation type="org.blockml.language.TypeScript"  → registry lookup
```

```text
Unknown FQN        → BML_UNKNOWN_TYPE
Wrong branch       → BML_INVALID_TYPE_REFERENCE  (e.g. Wall used as property type)
Generic constraint → BML_GENERIC_CONSTRAINT_VIOLATION
Version mismatch   → BML_UNKNOWN_VERSION         (external type refs — same rules as Blocks)
```

Effective type members (StructType properties, EnumType `_values`, generic parameters) are resolved via `baseType` chain — same lookup model as Block member inheritance.

---

## Bootstrap Order

Type definitions bootstrap **before** composable Blocks that reference them:

```text
1. @blockml/core — root + branches + bootstrap types
     org/blockml/core/Block.bml
     org/blockml/core/TypeBlock.bml · StructType.bml · EnumType.bml · …
     org/blockml/core/LanguageBlock.bml
     org/blockml/type/Integer.bml · …
     org/blockml/language/TypeScript.bml · OpenSCAD.bml
     org/blockml/core/ServiceBlock.bml · FunctionBlock.bml
     org/blockml/service/Math.bml · Strings.bml · …

2. @machineblocks/mbom
     com/machineblocks/type/Size3D.bml · …
     com/machineblocks/core/Block.bml                             ← baseType: Block
     …
```

Same `registerBlockDefinition(doc)` API — the registry inspects the `baseType` chain to index Block vs TypeBlock vs Language.

---

## Migration from XSD and 04_types.md

> **Note:** These phases are **type-migration steps within V1** — not the system-wide V1/V2/V3 roadmap. See `01_system.md` — BML Self-Description Roadmap.

```text
Phase 1 (this document)   Spec + bootstrap primitives + LanguageBlock BML
Phase 2                   Migrate com.machineblocks.type.* from 04_types.md → BML
Phase 3                   Remove enum SSOT from domain XSD files
Phase 4                   04_types.md becomes parse/serialize reference only
```

During migration, the validator accepts types from **either** registry BML **or** legacy XSD. BML wins on conflict. Legacy-only types emit `BML_LEGACY_TYPE_SOURCE` warning.

Property declarations on composable Blocks migrate from `09_mbom_properties.yml` → BML `<properties>` per `16_framework_base_types.md`. Type shape (StructType properties, EnumType `_values`) migrates from `04_types.md` → BML. YAML retains SCAD serializer hints keyed by property name.

---

## Package Layout (target)

```text
packages/core/src/
  org/blockml/core/
    Block.bml · TypeBlock.bml · ServiceBlock.bml · FunctionBlock.bml · LanguageBlock.bml · …
  org/blockml/type/
    Integer.bml · Float.bml · String.bml · Boolean.bml · Null.bml · …
  org/blockml/language/
    TypeScript.bml · OpenSCAD.bml
  org/blockml/service/
    Math.bml · Strings.bml · Numbers.bml · Lists.bml · Bools.bml

domains/machineblocks/mbom/src/
  com/machineblocks/type/
    Size3D.bml · Direction.bml · Color.bml · Face.bml · …
  com/machineblocks/core/
    Block.bml · NativeBlock.bml · Set.bml · …
```

Domain packages use the singular `.type` segment per `00_bom_core.md` FQN convention.

---

## Relationship to BlockDefinition BOM

BML uses one element (`<block>`) for all semantic units. The **BOM parse result** may use one interface (`BlockDefinition`) for convenience — this is a **transport shape**, not a claim that everything is the same kind of object at runtime.

The validator derives `definitionBranch` by walking the `baseType` chain:

```typescript
type DefinitionBranch = "composable" | "typeBlock" | "languageBlock"
```

Implementation is free to:

```text
keep BlockDefinition for all branches          →  V1 pragmatic default
split into ComposableDefinition · TypeDefinition · LanguageDefinition
use separate registries / indexes per branch
never expose „Block“ outside parser/BOM types
```

**Only BML semantics are normative.** Internal data structures may change without altering a single `.bml` file.

`TypeDescriptor` in `12_bom_object_model.md` remains the **reference syntax** for inline types (anonymous structs, multiplicity on references). Named types always resolve to registry FQNs.

---

## Related Documents

| Topic | Document |
|---|---|
| V1/V2/V3 scope · BML vs Markdown | `01_system.md` — BML Self-Description Roadmap |
| FQN namespaces | `00_bom_core.md` — Reserved Language Namespaces |
| Composable Block base types | `16_framework_base_types.md` |
| BML block syntax | `02_mbml.md` |
| TypeDescriptor AST | `12_bom_object_model.md` |
| Parse/serialize behaviour | `04_types.md` |
| Collections and Multiplicity | this document — § Collections and Multiplicity |
| Bootstrap mapping | `13_bml_to_bom_mapping.md` |
| SCAD property mapping | `09_mbom_properties.yml` |
| WOT vision | `WOT_Reference_v26.md` |
