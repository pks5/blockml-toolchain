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
| **Three ValueType kinds** | PrimitiveType · EnumType · StructType only — everything else is a type expression |
| **Ordered struct fields** | Field declaration order is semantically significant — defines implicit index, dual named/positional access, positional serialization; applies to StructType properties and anonymous struct `inputType` — see § Ordered Struct Fields |
| **Collections** | No `Array` type — multiplicity on any type reference (`T[]`, `T[3]`, `T[0..n]`) — see § Type Expressions |
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

Types are structure. They belong in BML — the same language humans, LLMs, and compilers use for Walls, Bricks, and built-in services. A MachineBlocks Set rendered to SCAD + a Martian Micro Device rendered to Python + React share **the same type FQNs**; only the render mapping differs.

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
- treat ValueTypes and Languages identically to other Blocks in memory
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
  Urbild · unveränderlich   Block · ValueType · Language · FQN
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

BOM Core defines Block as **„a parametric, reusable unit (definition / type)“** — not only as a composable physical object. ValueTypes and Languages are type definitions. They **are Blocks**.

**Class vs Object:** In familiar terms, every `<block>` document is a **Class** (declarative, semantic type). Every element in a `<composition>` is a **Block Instance** — an **Object** referencing that class by FQN. ValueTypes (`Integer`, `Size3d`) are type-classes that may also appear as Block instances — interpretation is context-dependent. See `00_bom_core.md` — Block and Block Instance · Context-Dependent Interpretation (below).

All definitions use the BML `<block>` element, register in the same TypeRegistry, and inherit from **`org.blockml.core.Block`** — the sole inheritance root.

```text
org.blockml.core.Block                         abstract root · omits baseType
  ├── org.blockml.core.ValueType               value blocks — Property types · Capability input/output (Size3D, Integer, …)
  ├── org.blockml.core.Language                capability implementation contract (OpenSCAD, English, …)
  ├── org.blockml.core.Entity                general entities — built-in services, domain blocks
  ├── com.machineblocks.core.Block             domain base
  └── … user and domain Blocks
```

**One root · one registry · one parser.** Branch-specific rules come from the `baseType` chain — not from parallel ontologies. There is no separate ComposableBlock — all Blocks inherit directly from `org.blockml.core.Block` (or via domain/service branches).

Every sub-type is free to declare its own members — `org.blockml.core.Block` declares **none**. Composition instance identity uses **`bml:id`** (may be empty); external references use **`bml:version`**. Aggregation and association `type` attributes may reference **any Block FQN**. Property and Capability types must resolve to **ValueType** only (Property `type` · Capability `inputType` · Capability `outputType`).

### Literally everything — including the compiler's grammar

This is a **foundational decision**, not a naming convention:

```text
Wall              →  Block  (domain composable)
Integer           →  Block  (ValueType branch)
OpenSCAD          →  Block  (Language branch)
Step              →  Block  (Set meta block)
IPlaceable        →  Block  (abstract — usable as contract / interface)
Library           →  Block  (publishable package descriptor; entry types as subBlocks)
Math · #strings   →  Block  (org.blockml.service.* · baseType Entity)
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
  Block.bml · ValueType.bml · Language.bml · ProgrammingLanguage.bml
  Integer.bml · TypeScript.bml · OpenSCAD.bml · English.bml · German.bml · PseudoCode.bml · …
  Math.bml · Strings.bml · …

@machineblocks/mbom BML
  Block.bml · CompositeBlock.bml · Set.bml · Step.bml · NativeBlock.bml · …

→  then  project srcDir
```

The compiler **uses BlockML to understand BlockML**. Framework semantics (`Integer`, `ValueType`, …) come from BML in the TypeRegistry — not from hardcoded FQN lists. The parser nonetheless **must** understand the `<block>` input format; only the **internal representation** after parse is free.

```text
Hardcoded in compiler     <block> parse contract · baseType chain walk · branch rules · diagnostics
Defined in BML            every named type · every framework branch · every language · every service
```

This is the WOT manifest principle applied to tooling: **the system manifesting itself** — the compiler is not outside the World grammar; it is the first consumer of that grammar. See `16_framework_base_types.md` — Bootstrap Order.

Internally the compiler may represent definitions as plain data (`BlockDefinition`, split indexes) — see § Semantic Layer vs Compiler Implementation. **Semantically** in BML there is only Block; **internally** there is no obligation to model it uniformly.

### Flat hierarchy under Block

`org.blockml.core.ComposableBlock` is **removed**. All framework and domain Blocks extend `org.blockml.core.Block` directly (or via intermediate branches like `ValueType`, `Entity`, `com.machineblocks.core.Block`):

```text
org.blockml.core.Block           root · declares no members · bml:id / bml:version on composition instances
org.blockml.core.Entity          baseType: Block · built-in services · utility Sub-Blocks
com.machineblocks.core.Block     baseType: Entity · _presets · basePresets
com.machineblocks.core.CompositeBlock baseType: Block · _parts (default)
org.blockml.core.ValueType         baseType: Block · primitives · structs · enums
org.blockml.core.Language          baseType: Block (meta — no extra members in V1)
org.blockml.core.ProgrammingLanguage baseType: Language
org.blockml.core.MarkupLanguage    baseType: Language
```

```text
com.machineblocks.core.Block     baseType: org.blockml.core.Entity
org.blockml.service.Math         baseType: org.blockml.core.Entity
com.machineblocks.type.Size3d    baseType: StructType → … → ValueType → Block
org.blockml.language.OpenSCAD    baseType: ProgrammingLanguage → Language → Block
```

**Member usage rules:**

```text
Aggregation / association type     — any Block FQN (composable Blocks, ValueTypes, meta Blocks)
Property type                      — ValueType only (baseType chain includes org.blockml.core.ValueType)
Capability inputType/outputType  — ValueType only (generic arguments substituted at validate time)
Meta property id                   — every Block instance; not declarable as <property name="id">
```

### Roles, not separate ontologies

The WOT Relativität Principle applies to types as well:

```text
com.machineblocks.type.Size3D   →  ValueType in MachineBlocks
                                →  input struct in Expression signatures
                                →  serializer input in SCAD Renderer
                                →  layout constraint in ScreenMachine (future)
```

Same FQN · different role · one BML definition.

---

## ValueType Hierarchy

**`org.blockml.core.ValueType`** is the abstract branch for all **value blocks** — Blocks whose `baseType` chain includes ValueType and that may appear wherever a typed payload is required: Property `type`, Capability `inputType`, and Capability `outputType`. Composable Blocks, built-in services, and other general Blocks are **not** ValueTypes; they may appear in aggregations and associations, but not as property or Capability payload types.

### Design Principles

The type system follows one metamodel — **everything is a Block**:

```text
Types are Blocks          — no separate type language construct
Primitives are Blocks     — value property + instance syntax (<Integer value="5"/>)
Structs are Blocks        — normal <properties>, no special struct syntax
Enums are Blocks          — _values aggregation + composition, no enumValues syntax
Contracts are Blocks      — abstract interfaces via <contracts>
Generics parametrize Blocks — `<genericTypes>` + type arguments at reference sites
```

Semantics are decided by `baseType` and usage context — not by parallel XSD or compiler hardcoding.

---

All types inherit from **`org.blockml.core.ValueType`**. Types are not a separate language construct — they are normal BlockML Blocks. Meaning comes from `baseType` and usage context.

```text
org.blockml.core.ValueType              abstract
  ├── org.blockml.core.PrimitiveType    Integer · Float · String · Boolean
  ├── org.blockml.core.EnumType         BaseCutoutType · Direction · …
  └── org.blockml.core.StructType       Size3D · Color · domain value objects
```

**BlockML knows only three ValueType kinds at language level** — each names a semantic meaning:

| Branch | Role | Examples |
|---|---|---|
| **PrimitiveType** | Atomic scalar values | `Boolean`, `Integer`, `Float`, `String` |
| **EnumType** | Named finite value sets | `Direction`, `Face`, `StudType`, `BaseCutoutType` |
| **StructType** | Custom value objects from properties | `Size3D`, `Color`, `Address`, `Transform` |

`StructType` is the basis for all complex custom value objects. Parameterized value types (e.g. `Box<T>`) are **StructTypes** that declare `<genericTypes>` — not a separate ValueType branch.

There is **no** `GenericType`, `UnionType`, `Array<T>`, `AutoOr<T>`, or similar as language-level ValueType branches.

---

## Type Expressions

Everything beyond the three ValueType kinds is a **type expression** — a use or combination of named types, not a new BlockML type class.

```text
ValueType        = named semantic meaning     (Primitive · Enum · Struct)
TypeExpression   = usage or combination       (multiplicity · union · generic application · _self · T)
```

### Not ValueTypes — type expressions only

```text
Integer[]           — collection / multiplicity
Integer[3]
Integer[0..n]
Size3D[1..3]
Boolean | Integer   — union
"auto" | Float
false | Size3D
Box<Integer>        — generic application (Box is a StructType with <genericTypes>)
_self
T                   — generic parameter reference
```

The compiler may build internal structures in `org.blockml.bom.*` (e.g. `UnionTypeDescriptor`, `CollectionTypeDescriptor`, `GenericApplicationDescriptor`, `SelfTypeReference`, `GenericParameterReference`). **BML does not define these as Block classes.**

### Obsolete wrapper types — write unions directly

Legacy domain wrapper types are replaced by union syntax:

```text
Obsolete                    Write instead
AutoOr<T>                   "auto" | T
FalseOr<T>                  false | T
NoneOr<T>                   "none" | T
BooleanOr<T>                Boolean | T
Array<T>                    T[]
UnionType                   A | B | C
```

See `04_types.md` for parse/serialize migration per MBOM type.

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
Capability inputType=  { items: String[0..n] }   — named field with multiplicity
Composition children=   governed by parent aggregation multiplicity
```

See `00_bom_core.md` — Type Notation · `02_mbml.md` — Type notation · `12_bom_object_model.md` — Type Expressions.

### Unions

Union type expressions combine alternatives with `|`:

```text
"auto" | Float              — auto sentinel or float value
"none" | T                  — none sentinel or T
false | Size3D              — false or struct
Boolean | StudType          — boolean or enum
Integer | String            — primitive union
```

Literal alternatives use JSON literal syntax (`"auto"`, `"none"`, `false`, `true`). Type alternatives reference ValueTypes or nested type expressions.

---

Only ValueTypes may be used where a **bare type name** is required (Property `type`, Capability `inputType` / `outputType`). Type expressions (multiplicity, unions, generic application) extend those references. Any Block FQN is valid in aggregation and association `type` attributes — including ValueTypes when used as composition children.

```text
Allowed:     type="org.blockml.type.Integer"
             type='"auto" | Float'
             type="Integer[]"
             inputType="com.foo.Request"
             outputType="com.foo.Response"
Not allowed: type="com.machineblocks.core.NativeBlock"   → BML_INVALID_PROPERTY_TYPE
```

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

Interpretation is context-dependent — same ValueType, two roles.

V1 bootstrap primitives: `Integer`, `Float`, `String`, `Boolean` in `@blockml/core`.

### EMPTY — not a type

BlockML has **no `Null` type** and **no `null` literal** in expressions or type positions. A parameter or property has a declared type (or union of types) and may be **absent** or **empty** — that is not a separate type.

```text
Omitted attribute / member     — absent (no value authored)
defaultValue="" on String      — empty string (still typed as String)
Optional association           — no target id set
```

**`null` is target interpretation.** When a renderer or runtime needs JSON `null`, SQL `NULL`, or TypeScript `undefined`, the compiler maps from **absent/empty** authoring — BML does not expose `null` as a language concept.

Union sentinels like `"none" | T` or `false | T` are typed alternatives — not null.

Unqualified names in BML (`type="Integer"`) resolve to `org.blockml.type.*` — unchanged from `02_mbml.md`.

---

## Ordered Struct Fields

Field order in any structured value type is **semantically significant**. It defines the implicit numeric index of each field. This rule applies uniformly to:

| Form | Where declared | BOM representation |
|---|---|---|
| **Named StructType** | `<properties>` on a StructType ValueType | `PropertyDefinition` entries in `members[]` (declaration order) |
| **Anonymous struct** | `{ a: Float, b: Float }` in Capability `inputType` / `outputType` | `AnonymousStructType.fields[]` (key order in type string) |

Both forms share the same contract — only the declaration surface differs.

### Dual access

Every field has two equivalent access paths:

* **Named access** — field name: `size.x`, `input.a`
* **Positional access** — implicit index: `size[0]`, `input[0]`

```text
Size3d with properties x, y, z (in that order):

  size.x == size[0]
  size.y == size[1]
  size.z == size[2]
```

Named and positional access resolve to the same field. The index is derived from **declaration order**, not from alphabetical name order.

### Serialization

Struct values serialize positionally — array order always matches field declaration order:

```text
Size3d { x: 4, y: 2, z: 3 }   →   [4, 2, 3]
{ a: 4, b: 2 }                 →   [4, 2]
```

Equivalent authoring forms for a named StructType:

```text
size="[4, 2, 3]"              — positional array literal
size="{ x: 4, y: 2, z: 3 }"   — named object literal
<Size3d x="4" y="2" z="3"/>    — attribute syntax on StructType instance
```

All three produce the same canonical value. Array literals map by **declaration order**, not by name.

### Compiler and BOM

The parser stores each field with its **name** and its **declaration ordinal** (implicit index):

* Named StructTypes — position in `BlockDefinition.members[]` among `<property>` elements (see `12_bom_object_model.md` — Member Declaration Order)
* Anonymous structs — position in `AnonymousStructType.fields[]` (see `12_bom_object_model.md` — Type Descriptors)

The parser **must not reorder** fields at parse, map, or validate time.

Render targets choose their preferred representation freely — no per-target field mapping is required:

```text
size[0]   — index access (OpenSCAD, generic array renderers)
size.x    — named access (TypeScript, object-native targets)
[4, 2, 3] — positional serialization (SCAD settings bundles)
```

The index is always derivable from the type definition; renderers do not maintain separate field-order tables.

### Capability parameter mapping

When a `utility Sub-Block` Capability declares a structured Object as `inputType`, the Object is an anonymous struct. **Field order defines positional parameter order** — the same rule as StructType properties:

```text
inputType: { a: Float, b: Float }

  #math.max(4, 5)              — positional: index 0 = a, index 1 = b
  #math.max(a=4, b=5)          — named
  #math.max({a: 4, b: 5})      — object literal (equivalent)
```

All call syntaxes produce identical input values. Positional arguments map to fields by **key order in the `inputType` declaration**, not alphabetically. See `00_bom_core.md` — Object Input as Function Signature · `10_expression_language.md` — Capability Input Types and Function Parameters.

### Expression access

In `${ }` expressions, StructType property values support both access forms:

```text
${ size.x }      — named field access
${ size[0] }     — positional access (same field)
${ size[1] }     — positional access (y)
${ [size[0], size[1], size[2] - 1] }   — index access in array literals
```

Nested access chains both forms: `items[0].size.x` ≡ `items[0].size[0]`. See `10_expression_language.md` — Property Access.

### Compatibility rule

Because field index is part of the **public contract** of a struct type:

* The order of existing fields **must not change** across versions.
* New fields may be appended **only at the end** to preserve backward compatibility.
* Removing or reordering fields is an **incompatible breaking change** (requires a new type FQN or major version bump).

This applies to named StructTypes (`Size3d`, `Color`, …) and to anonymous struct signatures on Capability.

---

### StructType

Complex values are described by **normal Properties** — no special struct syntax. A StructType is a ValueType with `<properties>`:

```xml
<block xmlns="http://blockml.org/schema/block"
       xmlns:type="com.machineblocks.type" ...>

  <name>Size3d</name>
  <type>com.machineblocks.type.Size3d</type>
  <baseType>org.blockml.core.StructType</baseType>
  <version>1.0.0</version>

  <properties>
    <x type="Float"/>
    <y type="Float"/>
    <z type="Float"/>
  </properties>

</block>
```

StructType properties follow the **Ordered Struct Fields** rule (§ above): declaration order defines implicit index, dual named/positional access, positional serialization, and compatibility constraints.

**As type reference:**

```xml
<property name="size" type="com.machineblocks.type.Size3d"/>
```

**As Block instance:**

```xml
<Size3d x="10" y="5" z="2"/>
```

Anonymous struct syntax in Capability signatures (`{ a: Float, b: Float }`) follows the same **Ordered Struct Fields** rule. The validator may suggest promoting repeated anonymous structs to named StructTypes.

---

### EnumType

Enums are normal ValueTypes. The branch declares a default aggregation for enum values:

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

Properties typed with an EnumType **must not** carry `<suggestions>` — valid values come from `_values` (`BML_SUGGESTIONS_ON_ENUM` unchanged). Properties may carry `<constraints>` on any type where a compatible Constraint sub-type exists — see `18_constraints_and_suggestions.md`.

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

The short form is valid only when the expected type is known from the property (or capability input field) declaration — not for untyped strings. The validator resolves the token against `_values` by `id`.

**Value literal:** enum instances also carry a `value` property (e.g. `value="standard"` on id `STANDARD`). The runtime/serialization literal `standard` remains valid where a string enum literal is expected — see `04_types.md` · MBML examples. Id reference (`STANDARD` / `FQN::STANDARD`) and value literal (`standard`) are distinct surface forms; both must match a declared `_values` entry.

---

### Context-Dependent Interpretation

A ValueType may appear in different roles:

| Context | Example | Role |
|---|---|---|
| Property type | `type="com.machineblocks.type.Size3d"` | type reference |
| Block instance | `<Size3d x="10" y="5" z="2"/>` | value / object |
| Aggregation type | `type="org.blockml.type.Integer[]"` | collection of primitive instances |
| Composition child | `<Integer value="5"/>` inside an aggregation | transported value |

The renderer and validator decide semantics from `baseType` and usage context — not from separate metamodels.

---

### Generics

Generic type parameters are declared on **StructType** (or other ValueType) definitions — not via a separate `GenericType` branch:

```xml
<block ...>
  <name>Box</name>
  <type>com.foo.Box</type>
  <baseType>org.blockml.core.StructType</baseType>

  <genericTypes>
    <genericType name="T" baseType="org.blockml.core.ValueType"/>
  </genericTypes>

  <properties>
    <value type="T"/>
  </properties>
</block>
```

**Generic application** (`Box<Integer>`) is a **type expression** — not a ValueType. At reference sites:

```xml
<property name="values" type="com.foo.Box<org.blockml.type.Integer>"/>
```

At validate time the compiler substitutes each placeholder (`T`) with the concrete type argument. Each argument must satisfy the parameter's `baseType` constraint (`BML_GENERIC_CONSTRAINT_VIOLATION` on mismatch).

Generic parameters (`T`) and `_self` in type positions are type-expression references — resolved from the defining Block's `<genericTypes>` or effective Block type respectively.

**Constraint generic binding** — `org.blockml.core.Constraint` and its sub-types also declare `<genericTypes>`. Unlike StructType generics, constraint type arguments are **never authored** — the compiler binds `T` from the enclosing property's type context at validate time:

```text
Scalar property (Integer)     → Min/Max: T = Integer
Collection property (String[]) → MinItems/MaxItems: T = String[]
                               → MinLength/MaxLength: T = String (element type)
```

Binding rules per constraint FQN are defined in each constraint Block's `<documentation>`. See `18_constraints_and_suggestions.md`.

### Generic parameter naming

Generic parameter names are declared on the root Block only (`<genericTypes>` on Sub-Blocks → `BML_GENERIC_NOT_ON_ROOT`). The parser rejects name collisions:

```text
<name>Box</name>
<genericTypes>
  <genericType name="Box" …/>     → BML_GENERIC_BLOCK_NAME_COLLISION
</genericTypes>

<name>Library</name>
<subBlocks>
  <block><name>Schema</name>…</block>
</subBlocks>
<genericTypes>
  <genericType name="Schema" …/>  → BML_GENERIC_SUBBLOCK_NAME_COLLISION
</genericTypes>
```

```text
BML_GENERIC_BLOCK_NAME_COLLISION    — genericType name equals the Block's <name>
BML_GENERIC_SUBBLOCK_NAME_COLLISION — genericType name equals a Sub-Block <name> in the same file
BML_DUPLICATE_GENERIC               — duplicate genericType name (existing)
```

A generic parameter name must be a distinct identifier — not the Block name, not any Sub-Block name in the same document, and not duplicated among `<genericType>` entries.

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

## Language

Implementation languages inherit from `org.blockml.core.Block` via `org.blockml.core.Language`:

```text
org.blockml.core.Block
  └── org.blockml.core.Language                    abstract
        ├── org.blockml.core.ProgrammingLanguage   abstract
        │     ├── org.blockml.language.TypeScript · OpenSCAD · PseudoCode · JavaScript · Python · …
        │     └── org.blockml.language.CSharp
        │           └── org.blockml.language.Unity
        ├── org.blockml.core.MarkupLanguage          abstract
        │     ├── org.blockml.language.XML
        │     ├── org.blockml.language.JSON
        │     └── org.blockml.language.YML
        ├── org.blockml.language.English · German · French · Spanish · Chinese · Japanese · Russian
```

```xml
<block ...>
  <name>OpenSCAD</name>
  <type>org.blockml.language.OpenSCAD</type>
  <baseType>org.blockml.core.ProgrammingLanguage</baseType>
  <version>1.0.0</version>
  <abstract />
</block>
```

Every Capability inherits an optional `<implementation>` member from `org.blockml.core.CapabilityType`. The element **`type`** attribute must reference a registered Language FQN. Composable Blocks may additionally restrict permitted languages via `<languages>` — see `16_framework_base_types.md`.

**PseudoCode** is free-form program code that must be internally consistent but is otherwise unconstrained — an LLM may interpret it.

V1 bootstrap languages in `@blockml/core`: TypeScript, OpenSCAD, English, German, French, Spanish, Chinese, Japanese, Russian, PseudoCode, XML, JSON, YML, JavaScript, Python, CSharp, Unity, CPP, C, Java. Extensibility: domains register new Language BML files.

---

## Root Exception

Only **`org.blockml.core.Block`** omits `<baseType>`. Every other definition must declare `<baseType>` — including `ValueType` and `Language`.

---

## Validation Rules by Branch

Branch is derived by walking the `baseType` chain until a branch marker is found:

```text
… → ValueType → Block           value type branch
… → Constraint → Block            constraint branch
… → Language → Block              language branch
… → Block (no ValueType/Language/Constraint ancestor)   general block branch
```

| Rule | General Block | ValueType | Constraint | Language |
|---|---|---|---|---|
| `<composition>` | allowed | EnumType: `_values` only; others: definition-level only | forbidden | forbidden |
| `<capabilities>` | allowed | allowed on branch bases; uncommon on leaf types | forbidden | forbidden |
| `<subTypes>` | allowed | allowed | forbidden | forbidden |
| `<genericTypes>` | allowed | allowed | allowed | forbidden |
| `<properties>` | allowed | StructType + PrimitiveType branch | allowed | forbidden |
| `<languages>` | allowed | forbidden | forbidden | forbidden |
| Meta property `id` on instances | yes (always) | yes (always) | yes (always) | yes (always) |
| `<property name="id">` | forbidden | forbidden | forbidden | forbidden |
| Used as composition instance typeFqn | if not abstract | if not abstract | if not abstract | forbidden |
| Used as aggregation/association `type` | any Block FQN | any Block FQN | any Block FQN | — |
| Used as property `type` | forbidden | yes (+ generic substitution) | forbidden | forbidden |
| Used as property `<constraints>` child | forbidden | forbidden | yes (Constraint sub-type) | forbidden |
| Used as property `<suggestions>` child | yes (same type as property) | yes | forbidden | forbidden |
| Used as Capability input/output type | forbidden | yes (+ generic substitution) | forbidden | forbidden |
| Used as `<implementation type>` | forbidden | forbidden | forbidden | yes |

Wrong branch usage → `BML_INVALID_DEFINITION_BRANCH`.

---

## TypeRegistry Resolution

At validate time, every `TypeDescriptor` named reference resolves against the registry:

```text
type="Integer"                              → org.blockml.type.Integer
type="type:Size3d"                          → com.machineblocks.type.Size3d
type="com.foo.Box<Integer>"                 → generic substitution at validate time
inputType="{ a: Float, b: Float }"        → AnonymousStructType (inline)
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
     org/blockml/core/ValueType.bml · StructType.bml · EnumType.bml · Constraint.bml · …
     org/blockml/constraint/Min.bml · Max.bml · …
     org/blockml/core/Language.bml · ProgrammingLanguage.bml · MarkupLanguage.bml
     org/blockml/type/Integer.bml · …
     org/blockml/language/TypeScript.bml · OpenSCAD.bml · English.bml · German.bml · PseudoCode.bml
     org/blockml/service/Math.bml · Strings.bml · …

2. @machineblocks/mbom
     com/machineblocks/type/Size3D.bml · …
     com/machineblocks/core/Block.bml                             ← baseType: Block
     …
```

Same `registerBlockDefinition(doc)` API — the registry inspects the `baseType` chain to index Block vs ValueType vs Language.

---

## Migration from XSD and 04_types.md

> **Note:** These phases are **type-migration steps within V1** — not the system-wide V1/V2/V3 roadmap. See `01_system.md` — BML Self-Description Roadmap.

```text
Phase 1 (this document)   Spec + bootstrap primitives + Language BML
Phase 2                   Migrate com.machineblocks.type.* from 04_types.md → BML
Phase 3                   Remove enum SSOT from domain XSD files
Phase 4                   04_types.md becomes parse/serialize reference only
```

During migration, the validator accepts types from **either** registry BML **or** legacy XSD. BML wins on conflict. Legacy-only types emit `BML_LEGACY_TYPE_SOURCE` warning.

Property declarations on composable Blocks migrate from `09_mbom_properties.yml` → BML `<properties>` per `16_framework_base_types.md`. Type shape (StructType properties, EnumType `_values`) migrates from `04_types.md` → BML. YAML retains SCAD serializer hints keyed by property name.

---

## Package Layout (target)

```text
packages/core/blocks/
  org/blockml/core/
    Block.bml · ValueType.bml · Language.bml · ProgrammingLanguage.bml · MarkupLanguage.bml · …
  org/blockml/type/
    Integer.bml · Float.bml · String.bml · Boolean.bml · …
  org/blockml/language/
    TypeScript.bml · OpenSCAD.bml · English.bml · German.bml · PseudoCode.bml · XML.bml · …
  org/blockml/service/
    Math.bml · Strings.bml · Numbers.bml · Lists.bml · Bools.bml

domains/machineblocks/mbom/blocks/
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

`TypeExpression` in `12_bom_object_model.md` (V1 alias `TypeDescriptor`) is the **reference syntax** for type expressions — anonymous structs, unions, multiplicity, generic application. Named ValueTypes always resolve to registry FQNs.

---

## Related Documents

| Topic | Document |
|---|---|
| V1/V2/V3 scope · BML vs Markdown | `01_system.md` — BML Self-Description Roadmap |
| FQN namespaces | `00_bom_core.md` — Reserved Language Namespaces |
| Composable Block base types | `16_framework_base_types.md` |
| BML block syntax | `02_mbml.md` |
| Type expressions · three ValueType kinds | `17_type_system_bml.md` — Type Expressions |
| TypeExpression AST | `12_bom_object_model.md` |
| Parse/serialize behaviour | `04_types.md` |
| Collections and Multiplicity | this document — § Collections and Multiplicity |
| Bootstrap mapping | `13_bml_to_bom_mapping.md` |
| SCAD property mapping | `09_mbom_properties.yml` |
| WOT vision | `WOT_Reference_v26.md` |
