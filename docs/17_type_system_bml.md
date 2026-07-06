# Type System — BML Definitions

version: 0.1.0

## Purpose of this Document

This document specifies how **value types**, **implementation languages**, and related structural types are defined in BlockML — as **BML files** in the same registry as composable Blocks.

For composable Block base types see `16_framework_base_types.md`.
For property parse/serialize rules (MB domain) see `04_types.md`.
For `TypeDescriptor` AST see `12_bom_object_model.md`.
For SCAD render mapping see `09_mbom_properties.yml`.
For WOT vision and motivation see `WOT_Reference_v26.md`.

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

## One Root: Everything is a Block

BOM Core defines Block as **„a parametric, reusable unit (definition / type)“** — not only as a composable physical object. TypeBlocks and LanguageBlocks are type definitions. They **are Blocks**.

All definitions use the BML `<block>` element, register in the same TypeRegistry, and inherit from **`org.blockml.core.Block`** — the sole inheritance root.

```text
org.blockml.core.Block                         abstract root · omits baseType
  ├── org.blockml.core.ComposableBlock         composable grammar (Wall, Brick, Math, …)
  ├── org.blockml.core.TypeBlock               property / payload types (Size3D, Integer, …)
  └── org.blockml.core.LanguageBlock           capability implementation contract (OpenSCAD, …)
```

**One root · one registry · one parser.** Branch-specific rules come from the `baseType` chain — not from parallel ontologies.

### Why ComposableBlock?

`org.blockml.core.Block` today carries composable-only members (`id` system property, `customData` aggregation). Those belong on **`ComposableBlock`**, not on the root:

```text
org.blockml.core.Block           identity · version · abstract · final · documentation
org.blockml.core.ComposableBlock   + id · aggregations · composition · capabilities
                                   + allowedSubBlockTypes · supportedImplementationTypes
org.blockml.core.TypeBlock         + fields · enumValues · type parameters
org.blockml.core.LanguageBlock   (meta — no extra members in V1)
```

`Integer` inheriting `Block` directly without inheriting `id` or `<composition>` is correct. `Wall` inheriting via `ComposableBlock` → `com.machineblocks.core.Block` gets composition semantics.

Existing framework BML updates `baseType`:

```text
com.machineblocks.core.Block     baseType: org.blockml.core.ComposableBlock  (was org.blockml.core.Block)
org.blockml.service.ServiceBlock baseType: org.blockml.core.ComposableBlock  (was org.blockml.core.Block)
com.machineblocks.type.Size3D    baseType: org.blockml.core.StructType       → … → org.blockml.core.TypeBlock → Block
org.blockml.language.OpenSCAD    baseType: org.blockml.core.LanguageBlock → Block
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

All TypeBlocks inherit from `org.blockml.core.Block` via `org.blockml.core.TypeBlock`:

```text
org.blockml.core.Block
  └── org.blockml.core.TypeBlock              abstract
        ├── org.blockml.core.PrimitiveType    Integer · Float · String · Boolean · Null
        ├── org.blockml.core.StructType       Size3D · promoted anonymous structs
        ├── org.blockml.core.EnumType         Direction · Face · BaseCutoutType
        └── org.blockml.core.GenericType      Array<T> · AutoOr<T> · future
```

### PrimitiveType

Bootstrap definitions in `@blockml/core`. Authors do not create new primitives — they extend StructType or EnumType.

```xml
<block xmlns="http://blockml.org/schema/block" ...>
  <name>Integer</name>
  <fullQualifiedName>org.blockml.type.Integer</fullQualifiedName>
  <baseType>org.blockml.core.PrimitiveType</baseType>
  <version>1.0.0</version>
  <abstract>true</abstract>
</block>
```

V1 bootstrap primitives: `Integer`, `Float`, `String`, `Boolean`, `Null`.

`Array<T>` is a **GenericType** bootstrap — not a PrimitiveType.

Unqualified names in BML (`type="Integer"`) resolve to `org.blockml.type.*` — unchanged from `02_mbml.md`.

### StructType

Named product type with ordered fields. Field order is significant for positional serialization where applicable.

```xml
<block xmlns="http://blockml.org/schema/block"
       xmlns:type="com.machineblocks.type" ...>

  <name>Size3D</name>
  <fullQualifiedName>com.machineblocks.type.Size3D</fullQualifiedName>
  <baseType>org.blockml.core.StructType</baseType>
  <version>1.0.0</version>

  <fields>
    <field name="x" type="Float" />
    <field name="y" type="Float" />
    <field name="z" type="Float" />
  </fields>

</block>
```

StructTypes **must not** declare `<properties>`, `<aggregations>`, `<composition>`, or `<capabilities>`.

Anonymous struct syntax in Capability signatures (`{ a: Float, b: Float }`) remains valid at authoring time. The validator may suggest promoting repeated anonymous structs to named Sub-Types — same pattern as Sub-Blocks.

### EnumType

Closed set of named values. Replaces domain XSD enum definitions as SSOT.

```xml
<block ...>
  <name>Direction</name>
  <fullQualifiedName>com.machineblocks.type.Direction</fullQualifiedName>
  <baseType>org.blockml.core.EnumType</baseType>
  <version>1.0.0</version>

  <enumValues>
    <enumValue name="West" />
    <enumValue name="North" />
    <enumValue name="East" />
    <enumValue name="South" />
  </enumValues>

</block>
```

Properties typed with an EnumType **must not** carry `<suggestions>` — valid values come from the type definition (`BML_SUGGESTIONS_ON_ENUM` unchanged).

### GenericType (V1 bootstrap · V2 extensibility)

Parameterized types. V1 ships bootstrap definitions only:

```text
org.blockml.type.Array<T>       — element type parameter T
com.machineblocks.type.AutoOr<T> — domain generic · T constrained to numeric or Auto sentinel
```

Author syntax unchanged: `Array<Integer>`, `type:AutoOr_Float`.

User-defined generics (e.g. `Result<T, E>`) are **deferred** — mechanism is the same GenericType branch.

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
  <fullQualifiedName>org.blockml.language.OpenSCAD</fullQualifiedName>
  <baseType>org.blockml.core.LanguageBlock</baseType>
  <version>1.0.0</version>
  <abstract>true</abstract>
</block>
```

Composable Blocks reference languages via `<supportedImplementationType type="org.blockml.language.OpenSCAD" />` — see `16_framework_base_types.md`. The language FQN must resolve to a registered LanguageBlock definition.

V1: two bootstrap languages in `@blockml/core`. Extensibility: domains register new LanguageBlock BML files.

---

## Root Exception

Only **`org.blockml.core.Block`** omits `<baseType>`. Every other definition must declare `<baseType>` — including `ComposableBlock`, `TypeBlock`, and `LanguageBlock`.

---

## Validation Rules by Branch

Branch is derived by walking the `baseType` chain until a branch marker is found:

```text
… → ComposableBlock → Block     composable branch
… → TypeBlock → Block           type block branch
… → LanguageBlock → Block   language branch
```

| Rule | ComposableBlock | TypeBlock | LanguageBlock |
|---|---|---|---|
| `<composition>` | allowed | forbidden | forbidden |
| `<capabilities>` | allowed | forbidden | forbidden |
| `<allowedSubBlockTypes>` | allowed | forbidden | forbidden |
| `<fields>` | forbidden | StructType only | forbidden |
| `<enumValues>` | forbidden | EnumType only | forbidden |
| `<supportedImplementationTypes>` | allowed | forbidden | forbidden |
| `id` system property (inherited) | yes | no | no |
| Used as composition `typeFqn` | if not abstract | forbidden | forbidden |
| Used as property `type` | — | yes | forbidden |
| Used as `<implementation type>` | — | forbidden | yes |

Wrong branch usage → `BML_INVALID_DEFINITION_BRANCH`.

---

## TypeRegistry Resolution

At validate time, every `TypeDescriptor` named reference resolves against the registry:

```text
type="Integer"                              → org.blockml.type.Integer
type="type:Size3D"                          → com.machineblocks.type.Size3D
payloadType="{ a: Float, b: Float }"        → AnonymousStructType (inline)
capability implementation type="org.blockml.language.TypeScript"  → registry lookup
```

```text
Unknown FQN        → BML_UNKNOWN_TYPE
Wrong branch       → BML_INVALID_TYPE_REFERENCE  (e.g. Wall used as property type)
Version mismatch   → BML_UNKNOWN_VERSION         (external type refs — same rules as Blocks)
```

Effective type members (StructType fields, EnumType values) are resolved via `baseType` chain — same lookup model as Block member inheritance.

---

## Bootstrap Order

Type definitions bootstrap **before** composable Blocks that reference them:

```text
1. @blockml/core — root + branches + bootstrap types
     org/blockml/core/Block.bml
     org/blockml/core/ComposableBlock.bml
     org/blockml/core/TypeBlock.bml · StructType.bml · EnumType.bml · …
     org/blockml/core/LanguageBlock.bml
     org/blockml/type/Integer.bml · …
     org/blockml/language/TypeScript.bml · OpenSCAD.bml
     org/blockml/service/ServiceBlock.bml · FunctionBlock.bml   ← baseType: ComposableBlock

2. @machineblocks/mbom
     com/machineblocks/type/Size3D.bml · …
     com/machineblocks/core/Block.bml                             ← baseType: ComposableBlock
     …
```

Same `registerBlockDefinition(doc)` API — the registry inspects the `baseType` chain to index Block vs TypeBlock vs Language.

---

## Migration from XSD and 04_types.md

```text
Phase 1 (this document)   Spec + bootstrap primitives + LanguageBlock BML
Phase 2                   Migrate com.machineblocks.type.* from 04_types.md → BML
Phase 3                   Remove enum SSOT from domain XSD files
Phase 4                   04_types.md becomes parse/serialize reference only
```

During migration, the validator accepts types from **either** registry BML **or** legacy XSD. BML wins on conflict. Legacy-only types emit `BML_LEGACY_TYPE_SOURCE` warning.

Property declarations on composable Blocks migrate from `09_mbom_properties.yml` → BML `<properties>` per `16_framework_base_types.md`. Type shape (StructType fields) migrates from `04_types.md` → BML. YAML retains SCAD serializer hints keyed by property name.

---

## Package Layout (target)

```text
packages/core/src/
  org/blockml/core/
    Block.bml · ComposableBlock.bml · TypeBlock.bml · LanguageBlock.bml · StructType.bml · …
  org/blockml/type/
    Integer.bml · Float.bml · String.bml · Boolean.bml · Array.bml · …
  org/blockml/language/
    TypeScript.bml · OpenSCAD.bml

domains/machineblocks/mbom/src/
  com/machineblocks/type/
    Size3D.bml · Direction.bml · Color.bml · Face.bml · …
  com/machineblocks/core/
    Block.bml · NativeBlock.bml · Set.bml · …
```

Domain packages use the singular `.type` segment per `00_bom_core.md` FQN convention.

---

## Relationship to BlockDefinition BOM

V1 stores all definitions in the existing `BlockDefinition` interface. The validator derives `definitionBranch` by walking the `baseType` chain:

```typescript
type DefinitionBranch = "composable" | "typeBlock" | "languageBlock"
```

A future `TypeDefinition` interface may split the BOM model when implementation begins — parse result shape unchanged at BML level.

`TypeDescriptor` in `12_bom_object_model.md` remains the **reference syntax** for inline types (anonymous structs, arrays). Named types always resolve to registry FQNs.

---

## Related Documents

| Topic | Document |
|---|---|
| Composable Block base types | `16_framework_base_types.md` |
| BML block syntax | `02_mbml.md` |
| TypeDescriptor AST | `12_bom_object_model.md` |
| Parse/serialize behaviour | `04_types.md` |
| Bootstrap mapping | `13_bml_to_bom_mapping.md` |
| SCAD property mapping | `09_mbom_properties.yml` |
| WOT vision | `WOT_Reference_v26.md` |
