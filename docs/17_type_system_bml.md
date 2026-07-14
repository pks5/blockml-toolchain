# Type System — BML Definitions

version: 0.3.0

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
| **Block metadata** | Every `<block>` carries `<idea>` (semantic meaning) and `<documentation>` (technical detail only); optional `<since>`, `<changelog>`, `<examples>`, `<references>` with `<see>` entries (`block`, `file`, or `url`) — see `02_mbml.md` |
| **Strict type/value separation** | ValueTypes never store data — Properties own all concrete values |
| **Four ValueType kinds** | PrimitiveType · StructType · EnumType · ConstantType — EnumType is a specialized StructType |
| **Struct property access** | Named access only (`size.x`) — no numeric index on StructType members; positional function calls use FunctionMapping — see `18_function_mapping.md` |
| **Collections** | No `Array` type — multiplicity on any type reference (`T[]`, `T[3]`, `T[0..n]`) — see § Type Expressions |
| **Mandatory BML namespace** | All BML definitions under `<domain>.bml.*` (e.g. `org.blockml.bml.core.*`, `org.blockml.bml.compiler.*`); TypeScript BOM interfaces in `@blockml/parser` — see `00_bom_core.md` |
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

All definitions use the BML `<block>` element, register in the same TypeRegistry, and inherit from **`org.blockml.bml.core.Block`** — the sole inheritance root.

```text
org.blockml.bml.core.Block                         abstract root · omits baseType
  ├── org.blockml.bml.core.ValueType               value blocks — Property types · Capability input/output (Size3D, Integer, …)
  ├── org.blockml.bml.core.Language                capability implementation contract
  │     ├── org.blockml.bml.language.NaturalLanguage   documentation prose · example titles
  │     │     ├── org.blockml.bml.language.English · German · French · Spanish · Chinese · Japanese · Russian
  │     ├── org.blockml.bml.language.ProgrammingLanguage   TypeScript · OpenSCAD · PseudoCode · …
  │     └── org.blockml.bml.language.MarkupLanguage        XML · JSON · YML
  ├── org.blockml.bml.core.Entity                general entities — built-in services, domain blocks
  ├── com.machineblocks.bml.core.Block             domain base
  └── … user and domain Blocks
```

**One root · one registry · one parser.** Branch-specific rules come from the `baseType` chain — not from parallel ontologies. There is no separate ComposableBlock — all Blocks inherit directly from `org.blockml.bml.core.Block` (or via domain/service branches).

Every sub-type is free to declare its own members — `org.blockml.bml.core.Block` declares `language` (NaturalLanguage, default English). Composition instance identity uses **`bml:id`** (may be empty); external references may use optional **`bml:version`** as an exact-version assert (forbidden inside Library files). Aggregation and association `type` attributes may reference **any Block FQN**. Property and Capability types must resolve to **ValueType** only (Property `type` · Capability `inputType` · Capability `outputType`).

### Literally everything — including the compiler's grammar

This is a **foundational decision**, not a naming convention:

```text
Wall              →  Block  (domain composable)
Integer           →  Block  (ValueType branch)
OpenSCAD          →  Block  (Language branch)
Step              →  Block  (Set meta block)
IPlaceable        →  Block  (abstract — typical contract / partial definition)
Library           →  Block  (publishable package descriptor; entry types as subBlocks)
Math · #strings   →  Block  (org.blockml.bml.service.* · baseType Entity)
org.blockml.bml.core.Block itself  →  Block  (root)
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

### Type and value separation

BlockML distinguishes strictly between **types** and **values**:

```text
Property
    type = Decimal
    value = 5.3
```

A `ValueType` never stores data. All concrete values are stored exclusively in **Properties**. The type describes the nature of the value; the Property owns the value. There is no Java-style `new BigDecimal(5)` in BlockML.

When a primitive value must exist as an **Entity** inside composition or aggregation, use a concrete `*Entity` type (for example `org.blockml.bml.type.IntegerEntity`) — not by adding a `value` member to the PrimitiveType.

### Capabilities — no special lifecycle types

BlockML has no special concepts for constructor, getter, or setter. All behaviour is expressed as ordinary **Capabilities** (`init()`, `getValue()`, `setValue()`, `render()`, …). The Renderer decides how to interpret each Capability for the target system. See `00_bom_core.md` — Semantics remain in BML.

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

`org.blockml.bml.core.ComposableBlock` is **removed**. All framework and domain Blocks extend `org.blockml.bml.core.Block` directly (or via intermediate branches like `ValueType`, `Entity`, `com.machineblocks.bml.core.Block`):

```text
org.blockml.bml.core.Block           root · declares no members · bml:id / bml:version on composition instances
org.blockml.bml.core.Entity          baseType: Block · built-in services · utility Sub-Blocks
com.machineblocks.bml.core.Block     baseType: Entity · _presets · basePresets
com.machineblocks.bml.core.CompositeBlock baseType: Block · _parts (default)
org.blockml.bml.core.ValueType         baseType: Block · primitives · structs · enums
org.blockml.bml.core.Language          baseType: Block (meta — no extra members in V1)
org.blockml.bml.core.ProgrammingLanguage baseType: Language
org.blockml.bml.core.MarkupLanguage    baseType: Language
```

```text
com.machineblocks.bml.core.Block     baseType: org.blockml.bml.core.Entity
org.blockml.bml.service.Math         baseType: org.blockml.bml.core.Entity
com.machineblocks.bml.type.Size3d    baseType: StructType → … → ValueType → Block
org.blockml.bml.language.OpenSCAD    baseType: ProgrammingLanguage → Language → Block
```

**Member usage rules:**

```text
Aggregation / association type     — any Block FQN (composable Blocks, ValueTypes, meta Blocks)
Property type                      — ValueType only (baseType chain includes org.blockml.bml.core.ValueType)
Capability inputType/outputType  — ValueType only (generic arguments substituted at validate time)
Meta property id                   — every Block instance; not declarable as <property name="id">
```

### Roles, not separate ontologies

The WOT Relativität Principle applies to types as well:

```text
com.machineblocks.bml.type.Size3D   →  ValueType in MachineBlocks
                                →  input struct in Expression signatures
                                →  serializer input in SCAD Renderer
                                →  layout constraint in ScreenMachine (future)
```

Same FQN · different role · one BML definition.

---

## ValueType Hierarchy

**`org.blockml.bml.core.ValueType`** is the abstract branch for all **value blocks** — Blocks whose `baseType` chain includes ValueType and that may appear wherever a typed payload is required: Property `type`, Capability `inputType`, and Capability `outputType`. Composable Blocks, built-in services, and other general Blocks are **not** ValueTypes; they may appear in aggregations and associations, but not as property or Capability payload types.

### Design Principles

The type system follows one metamodel — **everything is a Block**:

```text
Types are Blocks          — no separate type language construct
Primitives are pure types — semantics only; no value member on PrimitiveType
StructTypes describe layout — properties define data structure; values live in Properties
Enums are StructTypes     — _values aggregation adds finite allowed values
Contracts are Blocks      — reusable partial definitions merged via <contracts>
Generics parametrize Blocks — `<genericTypes>` + type arguments at reference sites
PrimitiveEntity defines the abstract generic base — concrete *Entity types wrap primitives in composition
```

Semantics are decided by `baseType` and usage context — not by parallel XSD or compiler hardcoding.

---

All types inherit from **`org.blockml.bml.core.ValueType`**. Types are not a separate language construct — they are normal BlockML Blocks. Meaning comes from `baseType` and usage context.

```text
org.blockml.bml.core.ValueType              abstract — never stores data
  ├── org.blockml.bml.type.PrimitiveType    abstract
  │     ├── org.blockml.bml.type.Text         abstract — textual primitives
  │     │     ├── org.blockml.bml.type.FullyQualifiedName
  │     │     ├── org.blockml.bml.type.Version
  │     │     ├── org.blockml.bml.type.URL
  │     │     ├── org.blockml.bml.type.URI
  │     │     ├── org.blockml.bml.type.FilePath
  │     │     ├── org.blockml.bml.type.MimeType
  │     │     └── …
  │     ├── org.blockml.bml.type.Number       abstract — numeric primitives
  │     │     ├── org.blockml.bml.type.Integer
  │     │     ├── org.blockml.bml.type.Decimal   — default for non-integer numbers
  │     │     └── org.blockml.bml.type.Float     — binary float — special-purpose only
  │     └── org.blockml.bml.type.Boolean      — neither textual nor numeric
  ├── org.blockml.bml.type.StructType         Size3D · Color · Address · …
  ├── org.blockml.bml.type.EnumType           extends StructType — BaseCutoutType · Direction · …
  └── org.blockml.bml.type.ConstantType       singleton value domains
        └── org.blockml.bml.type.Constant     Constant(T){value=…}
```

**BlockML knows four ValueType kinds at language level** — each names a semantic meaning:

| Branch | Role | Examples |
|---|---|---|
| **PrimitiveType** | Atomic scalar semantics — no stored values | `Boolean`, `Integer`, `Decimal`, `Float`, `Text`, `URL`, `Version` |
| **StructType** | Custom value objects — structure via properties | `Size3D`, `Color`, `Address`, `Transform` |
| **EnumType** | StructType + finite allowed values | `Direction`, `Face`, `StudType`, `BaseCutoutType` |
| **ConstantType** | Singleton value domain — one configured literal | `Constant(Text){value="auto"}`, `Constant(Integer){value=5}` |

`StructType` is the basis for all complex custom value objects. Parameterized value types (e.g. `Box<T>`) are **StructTypes** that declare `<genericTypes>` — not a separate ValueType branch.

There is **no** `GenericType`, `UnionType`, `Array<T>`, `AutoOr<T>`, or similar as language-level ValueType branches.

---

## Type Expressions

Everything beyond the four ValueType kinds is a **type expression** — a use or combination of named types, not a new BlockML type class.

```text
ValueType        = named semantic meaning     (Primitive · Enum · Struct · Constant)
TypeExpression   = usage or combination       (multiplicity · union · generic application · instance configuration · bml:Self · T)
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
bml:Self
T                   — generic parameter reference
```

In **`type="..."` XML attributes**, generic applications use **round parentheses** — not angle brackets — so values stay valid XML without escaping. See § Generics — BML attribute syntax.

The compiler may build internal structures in `org.blockml.bml.bom.*` (e.g. `UnionTypeDescriptor`, `CollectionTypeDescriptor`, `GenericApplicationDescriptor`, `SelfTypeReference`, `GenericParameterReference`). **BML does not define these as Block classes.**

### Obsolete wrapper types — write unions directly

Legacy domain wrapper types are replaced by union syntax:

```text
Obsolete                    Write instead
AutoOr<T>                   Constant(Text){value="auto"} | T
FalseOr<T>                  Constant(Boolean){value=false} | T
NoneOr<T>                   Constant(Text){value="none"} | T
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

The FQN (`Integer`, `com.machineblocks.bml.core.Block`, …) is unchanged. Bracket notation describes only the allowed instance count.

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
Aggregation type=     com.machineblocks.bml.core.Step[]
Association type=     bml:Self[]
Property type=        (bare — exactly one value; collections rare on properties)
Capability inputType=  { items: String[0..n] }   — named field with multiplicity
Composition children=   governed by parent aggregation multiplicity
```

See `00_bom_core.md` — Type Notation · `02_mbml.md` — Type notation · `12_bom_object_model.md` — Type Expressions.

### Unions

Union type expressions combine alternatives with `|`:

```text
Boolean | Constant(Text){value="auto"}   — boolean or singleton "auto" (canonical)
Float | Constant(Text){value="auto"}     — float or auto sentinel
false | Size3D                           — false or struct
Boolean | StudType                       — boolean or enum
Integer | Text                           — primitive union
```

Singleton alternatives use **Constant** — a generic configured ValueType (`21_constant_value_type.md`). Each Constant application binds `T` via `(...)` and supplies the allowed value via `{value=…}`.

**Future literal shorthand** — JSON literals in union positions desugar to Constant:

```text
Boolean | "auto"    ≡    Boolean | Constant(Text){value="auto"}
```

Until that shorthand is enabled, author the explicit Constant form. Legacy literal union syntax (`"auto" | Float`) remains parseable; normalization to Constant is recommended at map time.

---

Only ValueTypes may be used where a **bare type name** is required (Property `type`, Capability `inputType` / `outputType`). Type expressions (multiplicity, unions, generic application) extend those references. Any Block FQN is valid in aggregation and association `type` attributes — including ValueTypes when used as composition children.

```text
Allowed:     type="org.blockml.bml.type.Integer"
             type="Boolean | Constant(Text){value=&quot;auto&quot;}"
             type="Integer[]"
             type="Text{maxLength=100}"
             type="Decimal{precision=10, scale=2}"
             inputType="com.foo.Request"
             outputType="com.foo.Response"
Not allowed: type="com.machineblocks.bml.core.NativeBlock"   → BML_INVALID_PROPERTY_TYPE
```

---

### PrimitiveType

Primitive types inherit from `org.blockml.bml.type.PrimitiveType`. They are **pure type definitions** — no `value` property.

```text
org.blockml.bml.type.PrimitiveType
  org.blockml.bml.type.Text           — abstract
    org.blockml.bml.type.FullyQualifiedName
    org.blockml.bml.type.Version
    org.blockml.bml.type.URL · URI · FilePath · MimeType · …
  org.blockml.bml.type.Number         — abstract
    org.blockml.bml.type.Integer      — whole numbers
    org.blockml.bml.type.Decimal      — default for non-integer numeric values
    org.blockml.bml.type.Float        — binary float — special-purpose only
  org.blockml.bml.type.Boolean        — neither textual nor numeric
```

**Invalid:**

```xml
<type:Integer value="5"/>
```

**Valid — value on Property:**

```xml
<properties>
  <count type="Integer">
    <value>5</value>
  </count>
  <label type="Text">
    <value>Hello</value>
  </label>
</properties>
```

On Block instances, primitive values are inline literals on Properties or attributes:

```xml
<bricks:Standard columns="5" studs="true" text="ABC" />
```

#### Text replaces String

The public BlockML text primitive is **`Text`** (FQN `org.blockml.bml.type.Text`), not `String`. BlockML describes semantic types, not implementation data structures. Renderers map `Text` to Java `String`, TypeScript `string`, Python `str`, etc.

#### Decimal vs Float

**Decimal** is the default type for all non-integer numeric values (`3.5`, `12.75`, `0.1`). **Float** is only used when binary floating-point semantics are explicitly required (GPU, OpenGL, IEEE754 APIs, native C APIs, binary protocols).

#### PrimitiveEntity

`org.blockml.bml.core.PrimitiveEntity(T)` is an **abstract generic** Block — it follows the general rule in § Generic resolution through inheritance. It cannot be instantiated directly; concrete `*Entity` types bind `T` via `baseType`.

It defines the common structure for primitive value Entities:

```text
PrimitiveEntity<T extends PrimitiveType>
  abstract
  property value : T
```

Every primitive that should appear as an Entity in composition or aggregation requires a **concrete specialization** that binds all generic parameters:

```text
IntegerEntity
  baseType = PrimitiveEntity(Integer)
  → T = Integer; effective: value : Integer
```

When a primitive must appear as a Block instance in composition or aggregation:

```xml
<values>
  <composition>
    <type:IntegerEntity value="5"/>
    <type:IntegerEntity value="10"/>
    <type:IntegerEntity value="15"/>
  </composition>
</values>
```

Properties continue to store primitive values directly (`width : Integer`) — `*Entity` types exist only when the primitive value itself must become an identifiable Block instance (ordered collections, referencable values, metadata-bearing primitives).

V1 bootstrap: `IntegerEntity`, `DecimalEntity`, `FloatEntity`, `TextEntity`, `BooleanEntity`, `VersionEntity`, `URLEntity`, `URIEntity`, `FilePathEntity`, `MimeTypeEntity`, `FullyQualifiedNameEntity` in `@blockml/core`.

### Properties are always Optional

Every Property behaves as an **Optional** — it has a value or has no value. There is no `null`. Internally the BOM represents `Optional<Value>` instead of `Value | null`.

Required values are declared via the `org.blockml.bml.constraint.ValuePresent` constraint:

```xml
<count type="Integer">
  <value>5</value>
  <constraints>
    <constraint:ValuePresent validation="Error"/>
  </constraints>
</count>
```

When a Property carries `ValuePresent` with `validation="Error"`, the Property must contain an authored value in BlockML — otherwise the Validator reports `BML_CONSTRAINT_VIOLATION`. When no ValuePresent constraint is enforced, the Property may remain empty; the Renderer decides how to interpret missing values.

**Validation timing:** `ValuePresent` is checked only in **Stage 2 (Validator)** — never in Stage 1 (Parser / XSD). Enforcement runs **after** the Block is fully resolved, as part of `validateConstraints()`:

```text
1. baseType chain merge        — resolveEffectiveMembers() · generic substitution
2. contract merge              — contracts[] in declaration order
3. local member merge          — Block declarations override all
4. instance value resolution   — definition <value> · instance attribute · <property><value>
5. constraint validation       — validateConstraints() · including ValuePresent
```

The validator reads constraints from the **effective** `PropertyDefinition` (merged result), not from a single declaration layer in isolation. A contract or baseType may declare `ValuePresent`; a child override may supply the `<value>` — the merged effective member satisfies the check.

When no value is present after merge and instance binding → `BML_CONSTRAINT_VIOLATION`. Expression evaluation does not satisfy `ValuePresent` — only authored values count (Stage 2 does not evaluate expressions).

### EMPTY — not a type

BlockML has **no `Null` type** and **no `null` literal** in expressions or type positions. A parameter or property has a declared type (or union of types) and may be **absent** or **empty** — that is not a separate type.

```text
Omitted attribute / member     — absent (no value authored)
defaultValue="" on Text       — empty string (still typed as Text)
Optional association           — no target id set
```

**`null` is target interpretation.** When a renderer or runtime needs JSON `null`, SQL `NULL`, or TypeScript `undefined`, the compiler maps from **absent/empty** authoring — BML does not expose `null` as a language concept.

Union sentinels like `"none" | T` or `false | T` are typed alternatives — not null.

Unqualified names in BML (`type="Integer"` on Property.type) resolve via context-bound implicit namespace — see `02_mbml.md` — § Context-Bound Implicit Namespace.

---

## Struct Property Access

StructType members are accessed **exclusively by property name**:

```text
${ size.x }    ${ size.y }    ${ size.z }
```

Numeric index access on StructType values is **not valid**:

```text
${ size[0] }   — invalid (BML_EXPR_UNKNOWN_PROPERTY or index-not-supported diagnostic)
```

A StructType is a typed object with named properties. Declaration order does not create general index semantics. See `18_function_mapping.md` for how positional **function-parameter** syntax maps to struct fields at capability call sites.

Nested access uses member names throughout:

```text
${ items[0].size.x }     — collection index on array; member access on struct
${ config.mode }
```

The underlying `size` member value in BOM remains in **authored form** (`[5,5,6]` or `{x:5,…}`). Expression access does not expand or normalize it. See `10_expression_language.md` — Property Access · Expression vs BOM Data Layer.

---

## Declaration Order

Field declaration order in StructType definitions remains significant for purposes **other than** general index access:

| Use | Rule |
|---|---|
| **Positional array literals** | `size="[4, 2, 3]"` maps values to properties by declaration order |
| **FunctionMapping** | Positional capability call parameters map by declaration order — see `18_function_mapping.md` |
| **Compatibility** | Existing field order must not change across versions; append new fields only at the end |

This applies uniformly to named StructTypes (`<properties>` on a StructType) and anonymous struct `inputType` values (`{ a: Float, b: Float }`).

### Serialization

Struct values may be authored in multiple equivalent forms. **Each form is preserved in BOM** — see `00_bom_core.md` — Fundamental Architecture Principles.

```text
Authored as array:   size="[4, 2, 3]"              → BOM: [4, 2, 3]
Authored as object:  size="{ x: 4, y: 2, z: 3 }"    → BOM: { x: 4, y: 2, z: 3 }
Authored as element: <Size3d x="4" y="2" z="3"/>   → BOM: nested BlockInstance
```

All three are **type-equivalent** for validation. Renderers use field-order metadata to emit target form (e.g. SCAD `[4, 2, 3]`). The validator does **not** normalize one form into another.

### Compiler and BOM

The parser stores each field with its **name** and its **declaration ordinal**:

* Named StructTypes — position in `BlockDefinition.members[]` among `<property>` elements (see `12_bom_object_model.md` — Member Declaration Order)
* Anonymous structs — position in `AnonymousStructType.fields[]` (see `12_bom_object_model.md` — Type Descriptors)

The parser **must not reorder** fields or **rewrite** literal shapes at parse, map, or validate time.

Render targets choose their preferred representation at **render time**:

```text
size.x    — named access in expressions (all targets)
[4, 2, 3] — positional serialization output (SCAD settings bundles)
```

### Capability parameter mapping

Positional and named capability call syntax is handled by **FunctionMapping**, not by StructType index semantics. See `18_function_mapping.md` — Canonical Call Form.

```text
inputType: { a: Float, b: Float }

  #math.max(4, 5)              — positional (FunctionMapping: param 0 = a, param 1 = b)
  #math.max(a=4, b=5)          — named
  #math.max({a: 4, b: 5})      — canonical object literal
```

### Compatibility rule

Because declaration order is part of the **public contract** of a struct type:

* The order of existing fields **must not change** across versions.
* New fields may be appended **only at the end** to preserve backward compatibility.
* Removing or reordering fields is an **incompatible breaking change** (requires a new type FQN or major version bump).

This applies to named StructTypes (`Size3d`, `Color`, …) and to anonymous struct signatures on Capabilities.

---

<!-- Former "Ordered Struct Fields" section superseded by Struct Property Access, Declaration Order, and 18_function_mapping.md -->

### StructType

Complex values are described by **normal Properties** — no special struct syntax. A StructType is a ValueType with `<properties>`:

```xml
<block xmlns="http://blockml.org/schema/block"
       xmlns:type="com.machineblocks.bml.type" ...>

  <name>Size3d</name>
  <type>com.machineblocks.bml.type.Size3d</type>
  <baseType>org.blockml.bml.core.StructType</baseType>
  <version>1.0.0</version>

  <properties>
    <x type="Float"/>
    <y type="Float"/>
    <z type="Float"/>
  </properties>

</block>
```

StructType properties follow **Struct Property Access** and **Declaration Order** (§ above): named member access only; declaration order used for array literal authoring, FunctionMapping, and compatibility constraints.

**As type reference:**

```xml
<property name="size" type="com.machineblocks.bml.type.Size3d"/>
```

**As Block instance:**

```xml
<Size3d x="10" y="5" z="2"/>
```

Anonymous struct syntax in Capability signatures (`{ a: Float, b: Float }`) follows the same declaration-order contract for FunctionMapping. The validator may suggest promoting repeated anonymous structs to named StructTypes. See `18_function_mapping.md`.

**ConstantType — Constant** — singleton union alternative (`21_constant_value_type.md`):

```text
Constant<T extends ValueType>   —  value : T   (internal configuration only)
Constant(Text){value="auto"}    —  external value: "auto"  (not { value: "auto" })
                                —  used in Boolean | Constant(Text){value="auto"}
```

ConstantType is a dedicated ValueType branch — not a StructType and not a PrimitiveType. A
PrimitiveType defines a value domain; a StructType defines the shape of the external value; a
ConstantType defines a singleton value domain validated against the underlying generic type T
and the configured constant value.

---

### EnumType

EnumType is a **specialized StructType** — it adds a finite list of allowed values. It is not a separate top-level ValueType category alongside PrimitiveType, StructType, and ConstantType; the four categories remain PrimitiveType, StructType, EnumType, and ConstantType.

Enums are normal ValueTypes extending `org.blockml.bml.type.StructType`. The branch declares a default aggregation for enum values:

```xml
<aggregation name="_values" type="bml:Self[]" default="true"/>
```

Enum values are **Block instances** in `<composition aggregation="_values">` — no special enum syntax:

```xml
<block ...>
  <name>BaseCutoutType</name>
  <type>com.machineblocks.bml.type.BaseCutoutType</type>
  <baseType>org.blockml.bml.type.EnumType</baseType>
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
Property type:  com.machineblocks.bml.type.BaseCutoutType

Qualified:      com.machineblocks.bml.type.BaseCutoutType::STANDARD
Short:          STANDARD                              ← equivalent (type known from property)

Qualified form references the enum value's id (from _values composition).
```

```xml
<!-- NativeBlock.bml — property type is BaseCutoutType -->
<property name="baseCutoutType"
          type="com.machineblocks.bml.type.BaseCutoutType"
          defaultValue="STANDARD" />

<!-- equivalent explicit form -->
<property name="baseCutoutType"
          type="com.machineblocks.bml.type.BaseCutoutType"
          defaultValue="com.machineblocks.bml.type.BaseCutoutType::STANDARD" />
```

The short form is valid only when the expected type is known from the property (or capability input field) declaration — not for untyped strings. The validator resolves the token against `_values` by `id`.

**Resolution semantics:** the token is a **resolution key**, not a link to the `_values` entry. The effective property value is materialized as a **deep copy** of the enum instance's properties (e.g. `value="standard"`) — never as a reference to another instance. See `12_bom_object_model.md` — Property Value Semantics.

**Value literal:** enum instances also carry a `value` property (e.g. `value="standard"` on id `STANDARD`). The runtime/serialization literal `standard` remains valid where a string enum literal is expected — see `04_types.md` · MBML examples. Id reference (`STANDARD` / `FQN::STANDARD`) and value literal (`standard`) are distinct surface forms; both must match a declared `_values` entry.

---

### Context-Dependent Interpretation

A ValueType may appear in different roles:

| Context | Example | Role |
|---|---|---|
| Property type | `type="org.blockml.bml.type.Integer"` | type reference — value stored on Property |
| Property value on instance | `columns="5"` | inline literal on Property |
| Suggestion | Block instance in `<suggestions>` | metadata — same type as property |
| Aggregation type | `type="org.blockml.bml.type.IntegerEntity[]"` | collection of integer Entities |
| Composition child | `<Size3d x="10" y="5" z="2"/>` | StructType Block instance |

**Primitive values in composition:** use `IntegerEntity`, `TextEntity`, or another concrete `*Entity` type when a primitive must be an Entity — not `<Integer value="5"/>`. Properties always store values directly.

The renderer and validator decide semantics from `baseType`, branch, and usage context — not from separate metamodels.

---

### Generics

#### Generic resolution through inheritance

Generic parameters belong exclusively to the Block that declares them. They are **never inherited implicitly** by derived Blocks.

Whenever a generic Block is used as `baseType`, the derived Block must **explicitly specify how each generic parameter is handled**. Each parameter must be either:

```text
bound     — to a concrete type argument in baseType (for example Integer)
forwarded — to a generic parameter declared by the derived Block (for example T)
```

The derived Block becomes **concrete** (non-generic) when all parameters are bound. It **remains generic** when one or more parameters are forwarded.

Generic parameter resolution runs during **inheritance resolution**: every occurrence of a bound parameter in the inherited definition is substituted with its concrete type.

**Example — closed (all parameters bound):**

```text
PrimitiveEntity<T extends PrimitiveType>
  ↓
IntegerEntity
  baseType = PrimitiveEntity(Integer)

Validator resolves T = Integer
  value : T  →  value : Integer

IntegerEntity has no remaining generic parameters.
```

**Example — open (parameter forwarded):**

```text
NamedPrimitiveEntity<T>
  baseType = PrimitiveEntity(T)
  genericTypes: T

T is forwarded — NamedPrimitiveEntity remains generic.
```

**Example — partial binding:**

```text
Pair<K, V>
  ↓
TextKeyPair<V>
  baseType = Pair(Text, V)
  genericTypes: V

K = Text (bound); V forwarded — TextKeyPair remains generic.
```

During inheritance resolution the validator verifies:

```text
every generic parameter of the baseType is accounted for (bound or forwarded)
argument count matches the baseType declaration
each bound argument satisfies the declared baseType constraint
forwarded parameters are declared on the derived Block
```

#### Abstract generic Blocks

An **abstract generic Block** cannot be instantiated directly. If a generic Block should appear as a concrete XML element, a derived Block must first **bind all open generic parameters**.

`PrimitiveEntity<T>` is one instance of this rule — not the only one. It applies to **all** generic Blocks (`Box<T>`, `Constraint<T>`, `FullyQualifiedName<B, D>`, …):

```text
PrimitiveEntity<T>     abstract — not instantiable
  ↓
IntegerEntity          baseType = PrimitiveEntity(Integer)   — concrete
TextEntity             baseType = PrimitiveEntity(Text)       — concrete
DecimalEntity          baseType = PrimitiveEntity(Decimal)   — concrete
BooleanEntity          baseType = PrimitiveEntity(Boolean)   — concrete
…
```

Each concrete derived type finalizes every generic parameter through `baseType` and becomes a normal, instantiable Block. See § PrimitiveEntity for the primitive-Entity use case.

#### Generic declarations

Generic type parameters are declared on **StructType** (or other Block) definitions — not via a separate `GenericType` branch:

```xml
<block ...>
  <name>Box</name>
  <type>com.foo.Box</type>
  <baseType>org.blockml.bml.core.StructType</baseType>

  <genericTypes>
    <T baseType="org.blockml.bml.core.ValueType"/>
  </genericTypes>

  <properties>
    <value type="T"/>
  </properties>
</block>
```

Multiple parameters:

```xml
<genericTypes>
  <T baseType="org.blockml.bml.core.ValueType"/>
  <D baseType="org.blockml.bml.core.Definition" defaultType="def:RootBlockDefinition"/>
</genericTypes>
```

The parameter name is derived from the XML element name — `<T baseType="…"/>` maps internally to `{ name: "T", baseType: "org.blockml.bml.core.ValueType" }`. The internal BOM `GenericType` shape is unchanged; only the BML syntax is simplified.

**Generic application** (`Box<Integer>`) is a **type expression** — not a ValueType.

#### BML attribute syntax

In `type="..."` attributes, write generic applications with **round parentheses** instead of angle brackets. Angle brackets would require XML escaping (`&lt;` / `&gt;`); round parentheses keep attribute values plain and readable.

```text
Conceptual / internal     BML attribute (type="...")
─────────────────────     ───────────────────────────
Box<Integer>              Box(Integer)
FullyQualifiedName<T>     FullyQualifiedName(core:Block)
MyBlock<abc.A, xyz.B>     mynamespace:MyBlock(abc:A, xyz:B)
```

Resolution rules:

```text
mynamespace:MyBlock(abc:A, xyz:B)  →  com.mynamespace.MyBlock<abc.A, xyz.B>
core:FullyQualifiedName(core:Block) → org.blockml.bml.core.FullyQualifiedName<core.Block>
```

Each parenthesized argument binds one generic type parameter (in declaration order). When multiple parameters are present, the argument label (`abc`, `xyz`, …) matches the generic parameter name (the XML element name inside `<genericTypes>`) and qualifies the type argument as a namespace prefix (`abc:A` → `abc.A`). With a single generic parameter, the label may be omitted — only the type reference is written.

#### ValueType instance configuration

Curly braces configure the Property's owned ValueType instance — orthogonal to generic `(...)` binding:

```text
Conceptual              BML attribute (type="...")
────────────────        ───────────────────────────
Text maxLength=100      Text{maxLength=100}
Decimal p=10, s=2       Decimal{precision=10, scale=2}
Decimal 10, 2           Decimal{10, 2}     — positional by ValueType property order
```

Named and positional configuration must not be mixed in one `{...}` block. Positional mapping follows the same declaration-order rules as FunctionMapping — see `18_function_mapping.md` · `20_value_type_instance_configuration.md`.

**Constant** — `Constant(T){value=…}` configures a singleton ValueType for union alternatives. Generic `(...)` binds `T`; `{…}` supplies the required `value`. See `21_constant_value_type.md`.

Examples from core Block definitions:

```xml
<type type="core:FullyQualifiedName(core:Block)"/>
<baseType type="core:FullyQualifiedName(def:NestedBlockDefinition)"/>
```

At reference sites:

```xml
<property name="values" type="com.foo.Box(org.blockml.bml.type.Integer)"/>
```

At validate time the compiler substitutes each placeholder (`T`) with the concrete type argument. Each argument must satisfy the parameter's `baseType` constraint (`BML_GENERIC_CONSTRAINT_VIOLATION` on mismatch).

Generic parameters (`T`) and `bml:Self` in type positions are type-expression references — resolved from the defining Block's `<genericTypes>` or effective Block type respectively.

**Constraint generic binding** — `org.blockml.bml.core.Constraint` and its sub-types also declare `<genericTypes>`. Unlike StructType generics, constraint type arguments are **never authored** — the compiler binds `T` from the enclosing property's type context at validate time:

```text
Scalar property (Integer)     → Min/Max: T = Integer
Collection property (String[]) → MinItems/MaxItems: T = Text[]
                               → MinLength/MaxLength: T = Text (element type)
```

Binding rules per constraint FQN are defined in each constraint Block's `<documentation>`. See `18_constraints_and_suggestions.md`.

**Constraint vs Validation** — `org.blockml.bml.core.Constraint` describes the condition; `org.blockml.bml.core.Validation` describes how BlockML enforces it. Every constraint carries an optional `validation` property referencing a Validation block. When omitted, the BlockML validator ignores value enforcement — the constraint remains metadata. Standard Validation blocks: `org.blockml.bml.validation.Error`, `Warning`, `Information`.

### Generic parameter naming

Generic parameter names are declared on the root Block only (`<genericTypes>` on Sub-Blocks → `BML_GENERIC_NOT_ON_ROOT`). The parser rejects name collisions:

```text
<name>Box</name>
<genericTypes>
  <Box baseType="…"/>     → BML_GENERIC_BLOCK_NAME_COLLISION
</genericTypes>

<name>Library</name>
<subBlocks>
  <block><name>Schema</name>…</block>
</subBlocks>
<genericTypes>
  <Schema baseType="…"/>  → BML_GENERIC_SUBBLOCK_NAME_COLLISION
</genericTypes>
```

```text
BML_GENERIC_BLOCK_NAME_COLLISION    — generic parameter element name equals the Block's <name>
BML_GENERIC_SUBBLOCK_NAME_COLLISION — generic parameter element name equals a Sub-Block <name> in the same file
BML_DUPLICATE_GENERIC               — duplicate generic parameter element name
```

A generic parameter name must be a distinct identifier — not the Block name, not any Sub-Block name in the same document, and not duplicated among `<genericTypes>` entries.

---

## Contracts

Blocks may compose zero or more **contracts** — reusable partial Block definitions whose member fragments are merged into the effective definition:

```xml
<contracts>
  <com.foo:IIdentifiable/>
  <com.foo:IPlaceable/>
</contracts>
```

A contract Block may declare any subset of Properties, Aggregations, Associations, Capabilities, Constraints, Suggestions, documentation, examples, references, and optional default Capability implementations. Members may be **partial** — e.g. a contract supplies only `type`, and the concrete Block adds defaults, constraints, and documentation.

Effective members are resolved by merging in order: `baseType` chain → contracts (declaration order) → local Block declarations. Later contracts override earlier ones; the Block overrides all. Only explicitly specified attributes are replaced; `final` members cannot be overridden. `subBlocks`, `embeddedBlocks`, and `compositions` on contract types are ignored.

See `00_bom_core.md` — Contracts.

---

## Language

Implementation languages inherit from `org.blockml.bml.core.Block` via `org.blockml.bml.core.Language`:

```text
org.blockml.bml.core.Block
  └── org.blockml.bml.core.Language                    abstract
        ├── org.blockml.bml.language.NaturalLanguage   abstract — documentation prose · example titles
        │     ├── org.blockml.bml.language.English · German · French · Spanish · Chinese · Japanese · Russian
        ├── org.blockml.bml.language.ProgrammingLanguage   abstract
        │     ├── org.blockml.bml.language.TypeScript · OpenSCAD · PseudoCode · JavaScript · Python · …
        │     └── org.blockml.bml.language.CSharp
        │           └── org.blockml.bml.language.Unity
        ├── org.blockml.bml.language.MarkupLanguage          abstract
        │     ├── org.blockml.bml.language.XML
        │     ├── org.blockml.bml.language.JSON
        │     └── org.blockml.bml.language.YML
```

```xml
<block ...>
  <name>OpenSCAD</name>
  <type>org.blockml.bml.language.OpenSCAD</type>
  <baseType>org.blockml.bml.core.ProgrammingLanguage</baseType>
  <version>1.0.0</version>
  <abstract />
</block>
```

Every Capability inherits an optional `<implementation>` member from `org.blockml.bml.core.CapabilityType`. The element **`language`** attribute must reference a registered Language FQN. Composable Blocks may additionally restrict permitted languages via `<languages>` — see `16_framework_base_types.md`.

Capability references inside an `<implementation>` body use **BML Embedded Expression** syntax (`<$ … $>`) — see `10_expression_language.md` — BML Embedded Expressions.

**PseudoCode** is free-form program code that must be internally consistent but is otherwise unconstrained — an LLM may interpret it.

V1 bootstrap languages in `@blockml/core`: TypeScript, OpenSCAD, English, German, French, Spanish, Chinese, Japanese, Russian, PseudoCode, XML, JSON, YML, JavaScript, Python, CSharp, Unity, CPP, C, Java. Extensibility: domains register new Language BML files.

---

## Root Exception

Only **`org.blockml.bml.core.Block`** omits `<baseType>`. Every other definition must declare `<baseType>` — including `ValueType` and `Language`.

---

## Validation Rules by Branch

Branch is derived by walking the `baseType` chain until a branch marker is found:

```text
… → ValueType → Block           value type branch
… → Constraint → Block            constraint branch
… → Validation → Block            validation branch
… → Language → Block              language branch
… → Block (no ValueType/Language/Constraint/Validation ancestor)   general block branch
```

| Rule | General Block | ValueType | Constraint | Validation | Language |
|---|---|---|---|---|---|
| `<composition>` | allowed | EnumType: `_values` only; others: definition-level only | forbidden | forbidden | forbidden |
| `<capabilities>` | allowed | allowed on branch bases; uncommon on leaf types | forbidden | forbidden | forbidden |
| `<subTypes>` | allowed | allowed | forbidden | forbidden | forbidden |
| `<genericTypes>` | allowed | allowed | allowed | forbidden | forbidden |
| `<properties>` | allowed | StructType + PrimitiveType branch | allowed | forbidden | forbidden |
| `<languages>` | allowed | forbidden | forbidden | forbidden | forbidden |
| Meta property `id` on instances | yes (always) | yes (always) | yes (always) | yes (always) | yes (always) |
| `<property name="id">` | forbidden | forbidden | forbidden | forbidden | forbidden |
| Used as composition instance typeFqn | if not abstract | if not abstract | if not abstract | if not abstract | forbidden |
| Used as aggregation/association `type` | any Block FQN | any Block FQN | any Block FQN | any Block FQN | — |
| Used as property `type` | forbidden | yes (+ generic substitution) | forbidden | forbidden | forbidden |
| Used as property `<constraints>` child | forbidden | forbidden | yes (Constraint sub-type) | forbidden | forbidden |
| Used as Constraint `validation` property | forbidden | forbidden | forbidden | yes (Validation sub-type) | forbidden |
| Used as property `<suggestions>` child | yes (same type as property) | yes | forbidden | forbidden | forbidden |
| Used as Capability input/output type | forbidden | yes (+ generic substitution) | forbidden | forbidden | forbidden |
| Used as `<implementation language>` | forbidden | forbidden | forbidden | forbidden | yes |

Wrong branch usage → `BML_INVALID_DEFINITION_BRANCH`.

---

## TypeRegistry Resolution

At validate time, every `TypeDescriptor` named reference resolves against the registry:

```text
type="Integer"                              → org.blockml.bml.type.Integer
type="type:Size3d"                          → com.machineblocks.bml.type.Size3d
type="com.foo.Box(org.blockml.bml.type.Integer)"  → generic substitution at validate time
inputType="{ a: Float, b: Float }"        → AnonymousStructType (inline)
capability implementation language="org.blockml.bml.language.TypeScript"  → registry lookup
```

```text
Unknown FQN        → BML_UNKNOWN_TYPE
Wrong branch       → BML_INVALID_TYPE_REFERENCE  (e.g. Wall used as property type)
Generic constraint → BML_GENERIC_CONSTRAINT_VIOLATION
Version mismatch   → BML_UNKNOWN_VERSION         (external type refs — same rules as Blocks)
```

Effective type members (StructType properties, EnumType `_values`) are resolved via `baseType` chain — same lookup model as Block member inheritance. Generic parameters are **not** inherited; each is bound or forwarded explicitly through `baseType` (see § Generic resolution through inheritance).

---

## Bootstrap Order

Type definitions bootstrap **before** composable Blocks that reference them:

```text
1. @blockml/core — root + branches + bootstrap types
     org/blockml/bml/core/Block.bml
     org/blockml/bml/core/ValueType.bml · StructType.bml · EnumType.bml · Constraint.bml · Validation.bml · …
     org/blockml/bml/constraint/Min.bml · Max.bml · …
     org/blockml/bml/validation/Error.bml · Warning.bml · Information.bml · …
     org/blockml/bml/core/Language.bml · ProgrammingLanguage.bml · MarkupLanguage.bml
     org/blockml/bml/type/Integer.bml · …
     org/blockml/bml/language/TypeScript.bml · OpenSCAD.bml · English.bml · German.bml · PseudoCode.bml
     org/blockml/bml/service/Math.bml · Strings.bml · …

2. @machineblocks/mbom
     com/machineblocks/bml/type/Size3D.bml · …
     com/machineblocks/bml/core/Block.bml                             ← baseType: Block
     …
```

Same `registerBlockDefinition(doc)` API — the registry inspects the `baseType` chain to index Block vs ValueType vs Language vs Constraint vs Validation.

---

## Migration from XSD and 04_types.md

> **Note:** These phases are **type-migration steps within V1** — not the system-wide V1/V2/V3 roadmap. See `01_system.md` — BML Self-Description Roadmap.

```text
Phase 1 (this document)   Spec + bootstrap primitives + Language BML
Phase 2                   Migrate com.machineblocks.bml.type.* from 04_types.md → BML
Phase 3                   Remove enum SSOT from domain XSD files
Phase 4                   04_types.md becomes parse/serialize reference only
```

During migration, the validator accepts types from **either** registry BML **or** legacy XSD. BML wins on conflict. Legacy-only types emit `BML_LEGACY_TYPE_SOURCE` warning.

Property declarations on composable Blocks migrate from `09_mbom_properties.yml` → BML `<properties>` per `16_framework_base_types.md`. Type shape (StructType properties, EnumType `_values`) migrates from `04_types.md` → BML. YAML retains SCAD serializer hints keyed by property name.

---

## Package Layout (target)

```text
packages/core/blocks/
  org/blockml/bml/core/
    Block.bml · ValueType.bml · Language.bml · ProgrammingLanguage.bml · MarkupLanguage.bml · …
  org/blockml/bml/type/
    Integer.bml · Float.bml · Decimal.bml · Number.bml · Text.bml · Boolean.bml · …
  org/blockml/bml/language/
    TypeScript.bml · OpenSCAD.bml · English.bml · German.bml · PseudoCode.bml · XML.bml · …
  org/blockml/bml/service/
    Math.bml · Strings.bml · Numbers.bml · Lists.bml · Bools.bml

domains/machineblocks/mbom/blocks/
  com/machineblocks/bml/type/
    Size3D.bml · Direction.bml · Color.bml · Face.bml · …
  com/machineblocks/bml/core/
    Block.bml · NativeBlock.bml · Set.bml · …
```

Domain packages use the singular `.type` segment per `00_bom_core.md` FQN convention.

---

## Relationship to BlockDefinition BOM

BML uses one element (`<block>`) for all semantic units. The **BOM parse result** may use one interface (`BlockDefinition`) for convenience — this is a **transport shape**, not a claim that everything is the same kind of object at runtime.

The validator derives `definitionBranch` by walking the `baseType` chain:

```typescript
type DefinitionBranch = "composable" | "typeBlock" | "languageBlock" | "definitionBlock"
```

Blocks under `org.blockml.bml.core.Definition` (`org.blockml.bml.definition.*`) are **definitionBlock** — meta-model for BML structure and `bml:xml` serialization. See `19_definition_blocks_and_bml_xml.md`.

Implementation is free to:

```text
keep BlockDefinition for all branches          →  V1 pragmatic default
split into ComposableDefinition · TypeDefinition · LanguageDefinition
use separate registries / indexes per branch
never expose „Block“ outside parser/BOM types
```

**Only BML semantics are normative.** Internal data structures may change without altering a single `.bml` file.

`TypeExpression` in `12_bom_object_model.md` (V1 alias `TypeDescriptor`) is the **reference syntax** for type expressions — anonymous structs, unions, multiplicity, generic application, instance configuration. Named ValueTypes always resolve to registry FQNs.

---

## Related Documents

| Topic | Document |
|---|---|
| V1/V2/V3 scope · BML vs Markdown | `01_system.md` — BML Self-Description Roadmap |
| FQN namespaces | `00_bom_core.md` — Mandatory BML namespace |
| Composable Block base types | `16_framework_base_types.md` |
| Definition blocks · bml:xml | `19_definition_blocks_and_bml_xml.md` |
| BML block syntax | `02_mbml.md` |
| Type expressions · four ValueType kinds | `17_type_system_bml.md` — Type Expressions |
| TypeExpression AST | `12_bom_object_model.md` |
| ValueType instance configuration | `20_value_type_instance_configuration.md` |
| Constant singleton ValueType | `21_constant_value_type.md` |
| Parse/serialize behaviour | `04_types.md` |
| Synthetic accessors · Capability interpretation | `08_managed_object.md` |
| Collections and Multiplicity | this document — § Collections and Multiplicity |
| Bootstrap mapping | `13_bml_to_bom_mapping.md` |
| SCAD property mapping | `09_mbom_properties.yml` |
| WOT vision | `WOT_Reference_v26.md` |
