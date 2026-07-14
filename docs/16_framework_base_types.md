# Framework Base Types — BML Definitions

version: 0.1.0

## Purpose of this Document

This document specifies how **framework base types** (`org.blockml.bml.core.Block`, `com.machineblocks.bml.core.Block`, `org.blockml.bml.core.Entity`, …) are defined — as **BML files**, not code or YAML.

For BML block syntax see `02_mbml.md`.
For MBOM hierarchy see `03_mbom.md`.
For TypeRegistry bootstrap see `13_bml_to_bom_mapping.md`.
For SCAD property mapping (render-only) see `09_mbom_properties.yml`.
For value types and implementation languages as BML see `17_type_system_bml.md`.
For property constraints and suggestions see `18_constraints_and_suggestions.md`.
For FunctionMapping and capability call semantics see `18_function_mapping.md`.
For Definition blocks and `bml:xml` self-description see `19_definition_blocks_and_bml_xml.md`.
For V1/V2/V3 scope and BML-vs-Markdown decisions see `01_system.md` — BML Self-Description Roadmap.

---

## Design Decision

| Aspect | Decision |
|---|---|
| **Base type SSOT** | BML files in `@blockml/core`, `@machineblocks/mbom` |
| **Interpretation** | Renderers / validators only — no type semantics hardcoded outside BML + registry; **renderers free in output** — see `17_type_system_bml.md` — Renderer freedom |
| **Compiler internals** | Parser **must** know `<block>` as input concept; internal representation **free** — see `17_type_system_bml.md` |
| **09_mbom_properties.yml** | **Render mapping only** (serializer, scad_name, customizer) — not type SSOT |
| **User blocks** | Same mechanism — `<baseType>` → chain to framework BML |
| **Block idea** | Every `<block>` carries `<idea>` as first child — what this Block semantically represents |
| **Block documentation** | Every root `<block>` carries `<documentation>` as second child — technical description; optional `<since>`, `<changelog>`, `<examples>`, `<references>` follow |
| **Everything is a Block** | Framework types, primitives, languages, services, Set meta blocks — one `<block>` element, one registry; see `17_type_system_bml.md` |
| **ValueType branch** | `org.blockml.bml.core.ValueType` — abstract base for all value blocks used in Property `type` and Capability `inputType` / `outputType`; four kinds: PrimitiveType · StructType · EnumType · ConstantType |
| **Mandatory BML namespace** | All BML definitions under `<domain>.bml.*` — see `00_bom_core.md` |
| **Self-hosting bootstrap** | Compiler loads `@blockml/core` + domain framework BML **before** user content — TypeRegistry bootstrap in V1; full toolchain self-description is V3 — see `01_system.md` |

```text
BML (what the type IS)          →  TypeRegistry
09_mbom_properties.yml (how     →  ScadBlockProcessor maps property → SCAD
  SCAD serializes a property)
BlockProcessor (when/how        →  Render pipeline
  to render)
```

---

## Type Modifiers (BML)

Optional elements on any `<block>` definition and on member declarations (properties, aggregations,
associations, capabilities). Declared in the meta-model on
`org.blockml.bml.definition.StructuralDefinition` and inherited by `NestedBlockDefinition`,
`RootBlockDefinition`, and `MemberDefinition`.

On **block definitions**, render as child elements (`<abstract>`, `<final>`). On **members**,
render as optional attributes (`abstract="…"`, `final="…"`).

### `<abstract>`

```xml
<abstract />
```

Equivalent to `<abstract>true</abstract>`. Omit or use `<abstract>false</abstract>` for concrete types.

```text
true   — type exists for inheritance and validation; must not be used as
         composition instance typeFqn (except as baseType on definitions)
false  — default when omitted; concrete derivable type
```

Prefer the self-closing form for root flags set once and not overridable by children.

Framework types `org.blockml.bml.core.Block`, `org.blockml.bml.service.*` (abstract bases), `com.machineblocks.bml.core.Block` are `abstract=true`.

Concrete blocks (`Wall`, `StandardBrick`, `Math`) omit `<abstract>` or set `false`.

### `<final>`

```xml
<final />
```

Equivalent to `<final>true</final>`. Omit or use `<final>false</final>` when the type may be extended.

```text
true   — no Block definition may use this type as baseType
         (BML_FINAL_BASE_TYPE)
false  — default when omitted
```

Prefer the self-closing form for root flags set once and not overridable by children.

`com.machineblocks.bml.core.NativeBlock` is `final=true`.

### `<subTypes>`

```xml
<subTypes>
  <core:Block />
  <bcore:Entity />
</subTypes>
```

```text
Lists Block type references permitted as baseType on Sub-Blocks in <subBlocks>.
Each child element is a direct Block reference (element name = FQN via xmlns prefix).

Default (no declaration on this block):  [] — Sub-Blocks forbidden until explicitly enabled
Omitted <subTypes>:                      inherit effective subTypes from baseType chain
Explicit <subTypes>…</subTypes>:          override inherited list (enable or restrict Sub-Blocks)
Explicit empty <subTypes/>:              override — close Sub-Blocks even when parent allowed them

Declare <subTypes> only when overriding the inherited list. Do not emit an empty element
merely to restate the default — omit the element instead.

Sub-Block baseType not in effective subTypes → BML_INVALID_SUBBLOCK_TYPE
```

### `<languages>`

```xml
<languages>
  <lang:OpenSCAD />
  <lang:TypeScript />
</languages>
```

```text
Lists Language references permitted on <implementation language="...">.
Each child element is a direct Language reference (element name = FQN via xmlns prefix).
Type-reference interpretation follows from the Block-definition role — same pattern as Library _blocks.
Omitted = inherit from baseType
Unknown language on capability → BML_IMPLEMENTATION_NOT_SUPPORTED
```

### `<contracts>`

```xml
<contracts>
  <ac:Wall />
  <core:Identifiable />
</contracts>
```

```text
Lists contract Block references merged into this Block (root block only).
Each child element is a direct Block reference (element name = FQN via xmlns prefix).
Same container pattern as <languages> and <subTypes> — no wrapper <contract> element.
Omitted = inherit from baseType at validate
Duplicate reference → BML_DUPLICATE_CONTRACT
<contracts> on Sub-Block → BML_CONTRACT_NOT_ON_ROOT
```

See `02_mbml.md` — Contracts · `00_bom_core.md` — Contracts.

### `<genericTypes>`

```xml
<genericTypes>
  <T baseType="org.blockml.bml.core.ValueType"/>
</genericTypes>
```

```text
Declares type parameters on this Block (root block only)
Element name  — parameter identifier used in type references (e.g. type="T")
baseType      — FQN constraint; concrete type arguments must inherit from this branch
Usage         — com.foo.Box<org.blockml.bml.type.Integer> at reference sites
Validator     — substitutes parameters at validate time; BML_GENERIC_CONSTRAINT_VIOLATION on mismatch

Generic parameters belong exclusively to the declaring Block — they are never inherited
implicitly. When a generic Block is used as baseType, the derived Block must bind or forward
each parameter explicitly (for example baseType = PrimitiveEntity(Integer) binds T = Integer).
Resolution substitutes bound parameters in the inherited definition during validate time.
See 17_type_system_bml.md — § Generic resolution through inheritance.

Naming (parse time):
  element name must differ from the Block's <name>           → BML_GENERIC_BLOCK_NAME_COLLISION
  element name must differ from every Sub-Block <name>       → BML_GENERIC_SUBBLOCK_NAME_COLLISION
  duplicate element name among genericTypes entries          → BML_DUPLICATE_GENERIC
  <genericTypes> on Sub-Block                                → BML_GENERIC_NOT_ON_ROOT
```

See `17_type_system_bml.md` — Generics · `12_bom_object_model.md` — GenericType.

---

## Definition Branch (Meta-Model)

**FQN:** `org.blockml.bml.core.Definition` — abstract base for blocks that describe **block structure** in BlockML's own language.

```text
org.blockml.bml.core.Block
  org.blockml.bml.core.Definition                    ← abstract; bml:xml placement allowed
    org.blockml.bml.definition.StructuralDefinition
      org.blockml.bml.definition.NestedBlockDefinition  ← shared <block> shape; generic NestedBlockDefinition<B>
        org.blockml.bml.definition.RootBlockDefinition  ← root <block>; definition, subBlocks, embeddedBlocks
    org.blockml.bml.definition.PropertyDefinition
    org.blockml.bml.definition.AggregationDefinition
    org.blockml.bml.definition.AssociationDefinition
    org.blockml.bml.definition.CapabilityDefinition
    org.blockml.bml.definition.GenericTypeDefinition
    org.blockml.bml.definition.ChangeDefinition      ← one <change> in <changelog>
    org.blockml.bml.definition.DocumentationDefinition ← <documentation> on Definition elements
    org.blockml.bml.definition.ExampleDefinition     ← one <example> in <examples>
    org.blockml.bml.definition.ReferenceDefinition   ← one <see> in <references>
    …
```

`org.blockml.bml.definition.StructuralDefinition` declares the shared documentation model and type modifiers:

```text
Properties:    since · status · documentation · abstract · final
Aggregations:  changelog (Change[]) · examples (Example[]) · references (Reference[])
Sub-blocks:    Documentation · Change · Example · Reference
```

`abstract` and `final` on block definitions control type instantiability and extensibility. On member
declarations, `abstract` allows an incomplete definition. `override="true"` requires a same-named
parent member; abstract on the override is optional — refining an abstract parent without explicitly
lifting it to `abstract="false"` keeps the member abstract for descendants. A transition
`abstract: true → false` on a local redeclaration is the explicit implementation event and must be
locally complete for the member kind. Concrete blocks must implement inherited abstract members.
`final` prevents any redeclaration in child Blocks.

`org.blockml.bml.core.Block` declares `language` (NaturalLanguage) — root default English. Library descriptors inherit via BlockLibrary.

`org.blockml.bml.definition.NestedBlockDefinition` declares `language` (NaturalLanguage element) — per-block override.

`org.blockml.bml.definition.RootBlockDefinition` declares `definition` (Definition meta-model type FQN; default `org.blockml.bml.definition.RootBlockDefinition`), `subBlocks`, and `embeddedBlocks` (Inline Library — a library co-located within a single Block document).

`org.blockml.bml.definition.ReferenceDefinition` — cross-reference to a related Block, definition element, or documentation source:

```text
bml:xml         see                — renders as <see> inside <references>
block           QName (prefix:Name) — Block or Definition via xmlns prefix; XML block attribute
file            String             — repository markdown file; XML file attribute
url             String             — external URL; XML url attribute
language        NaturalLanguage    — optional; prose language override for context text
context         String (required)  — relationship note; XML text content
```

Exactly one of `block`, `file`, or `url` must be set. Authoring: list only targets **relevant to the current definition**; text body describes the relationship. All cross-links belong in `<references>` — never in `<documentation>`. See `02_mbml.md` — `<documentation>` · `<references>`.

`org.blockml.bml.definition.ChangeDefinition` — one changelog entry in a `<changelog>` container:

```text
bml:xml         change             — renders as <change> inside <changelog>
version         Version (required) — XML version attribute
language        NaturalLanguage    — optional; prose language override for description text
description     String (required)  — trimmed text body
```

`org.blockml.bml.definition.ExampleDefinition` — one usage example in an `<examples>` container:

```text
bml:xml         example            — renders as <example> inside <examples>
title           String (required)  — XML title attribute; always in block natural language
language        Language FQN       — optional; implementation dialect for CDATA content only
content         String (required)  — CDATA body
```

Each Definition block may declare **`bml:xml`** — how instances serialize to canonical BML XML (root element name, member as attribute/element/text/cdata). The meta-model is **work in progress**; full specification in `19_definition_blocks_and_bml_xml.md`.

`org.blockml.bml.core.Block` itself carries `<bml:xml>${ bml:Self }</bml:xml>` — composable instances render under their declared type tag. Definition blocks describe the grammar; ordinary domain blocks consume it.

### Definition Addressing

Definition elements are addressed via **canonical structural paths** within the Block FQN. The path mirrors the BML document structure:

```text
com.foo.Bar.name                    →  Block metadata
com.foo.Bar.documentation           →  inherited from org.blockml.bml.core.Definition
com.foo.Bar.version                 →  Block version
com.foo.Bar.properties.width        →  PropertyDefinition
com.foo.Bar.aggregations.children   →  AggregationDefinition
com.foo.Bar.associations.parent     →  AssociationDefinition
com.foo.Bar.capabilities.render     →  CapabilityDefinition
com.foo.Bar.genericTypes.T          →  GenericTypeDefinition (described Block's type parameter)
com.foo.Bar.definition              →  Definition meta-model type FQN (root block only)
com.foo.Bar.subBlocks.Inner         →  nested BlockDefinition (FQN derived from parent)
com.other.ForeignBlock              →  embedded BlockDefinition (FQN = embedded block &lt;type&gt;)
com.other.ForeignBlock.properties.width →  PropertyDefinition on embedded block
com.foo.Bar.contracts               →  contract references
```

`org.blockml.bml.definition.NestedBlockDefinition` is itself a Block with generic type parameter `B extends org.blockml.bml.core.Block` — conceptually `NestedBlockDefinition<com.foo.Bar>` when describing `com.foo.Bar`. The described Block's own `<genericTypes>` aggregation (e.g. `T` on `Box<T>`) is separate from this meta-type parameter. Root blocks use `org.blockml.bml.definition.RootBlockDefinition`, which adds `definition`, `subBlocks`, and `embeddedBlocks`.

No special definition-reference constructs (`bml:Def`, flat `com.foo.Bar.memberName`) are used. `bml:Self` remains available for **type references** only (`type="bml:Self"`), not for definition navigation.

BML member containers map to a flat `members: MemberDefinition[]` in the BOM (tagged by `kind`). Reflection resolves canonical paths via the structural containers at query time.

Definition blocks may declare their own Capabilities — enabling domain-specific definition types with additional behaviour (for example `validateDefinition()`, `generateDocumentation()`) without core changes.

---

## Root Type Exception

`org.blockml.bml.core.Block` is the **sole inheritance root**. It **omits `<baseType>`** — the only definition allowed to do so.

All other definitions must declare `<baseType>`. Framework branches inherit via `org.blockml.bml.core.ValueType`, `org.blockml.bml.core.Language`, or domain bases — all ultimately extend `org.blockml.bml.core.Block`. See `17_type_system_bml.md`.

---

## Bootstrap Order

The compiler **bootstraps from its own BML** — self-hosting at the TypeRegistry level. Framework packages are not special-cased in code; they are loaded first because later definitions depend on them.

```text
1. @blockml/core BML                    ← BlockML describes BlockML
     org/blockml/bml/core/Block.bml
     org/blockml/bml/core/Status.bml
     org/blockml/bml/core/ValueType.bml · PrimitiveType.bml · StructType.bml · EnumType.bml · ConstantType.bml · …
     org/blockml/bml/status/Stable.bml · Draft.bml · Stub.bml · Deprecated.bml
     org/blockml/bml/core/Constraint.bml
     org/blockml/bml/constraint/Min.bml · Max.bml · MinLength.bml · MaxLength.bml · Pattern.bml · MinItems.bml · MaxItems.bml · ValuePresent.bml · …
     org/blockml/bml/core/Validation.bml
     org/blockml/bml/validation/Error.bml · Warning.bml · Information.bml · …
     org/blockml/bml/core/
     org/blockml/bml/core/Language.bml · ProgrammingLanguage.bml · MarkupLanguage.bml
     org/blockml/bml/type/Number.bml · Integer.bml · Decimal.bml · Float.bml · Text.bml · Boolean.bml · Constant.bml · …
     org/blockml/bml/type/Version.bml · URL.bml · URI.bml · FilePath.bml · MimeType.bml
     org/blockml/bml/core/PrimitiveEntity.bml
     org/blockml/bml/type/IntegerEntity.bml · TextEntity.bml · …
     org/blockml/bml/language/NaturalLanguage.bml · TypeScript.bml · OpenSCAD.bml · English.bml · German.bml · PseudoCode.bml
     org/blockml/bml/service/Math.bml · Strings.bml · …
     org/blockml/bml/core/BlockLibrary.bml   ← bootstrap / _dependencies / _subLibraries / _blocks as Block references; _schemas as FilePathEntity
     org/blockml/bml/core/Definition.bml     ← meta-model base (WIP)
     org/blockml/bml/definition/*.bml        ← NestedBlockDefinition, RootBlockDefinition, PropertyDefinition, … (WIP)

2. @machineblocks/mbom BML              ← MBOM framework grammar
     com/machineblocks/bml/core/Step.bml · Block.bml · CompositeBlock.bml · NativeBlock.bml · Set.bml
     …

3. Project srcDir + libraries
```

Each file is parsed and `registerBlockDefinition(doc)` — **identical path** to user-authored content. The only difference is load order.

### What is defined in BML vs code

| In BML (under `<domain>.bml.*`) | In TypeScript (npm packages) |
|---|---|
| `org.blockml.bml.core.Block`, branches, primitives | `@blockml/parser` — parser, validator, BOM interfaces |
| `org.blockml.bml.compiler.parser.Parser` | `@blockml/compiler` — compile pipeline |
| `com.machineblocks.bml.core.Set`, `Step` | render targets — SCAD emission, processors |
| `org.blockml.bml.language.OpenSCAD` | branch-specific validation rules |
| `org.blockml.bml.service.Math` capabilities | render/processor dispatch |
| User Walls, Sets, Bricks | cache, CLI, target runtime |

No framework FQN should exist only in TypeScript — if it is part of the grammar, it has a `.bml` file with `<documentation>`.

---

## Native Properties Migration

Native MB properties (`size`, `offset`, …) are declared on **concrete MachineBlocks block types** (e.g. `com.machineblocks.bml.bricks.Standard`) — not on the abstract `com.machineblocks.bml.core.Block` base.

`09_mbom_properties.yml` retains **SCAD render hints** keyed by property name:

```yaml
- name: size
  scad_name: size
  serializer: Size3D
  scad_customizer: …
```

Validator matches BML property declarations against YAML entries for SCAD target completeness. Missing YAML entry → warning at render time, not parse time.

Full property migration from YAML → BML proceeds incrementally; structure and modifiers land first.

---

## Package Layout

Membership is defined by each `Library.bml` `_blocks` list — not by directory. Nested libraries are independent units:

```text
packages/core/blocks/
  org/blockml/bml/
    Library.bml                             ← org.blockml.bml.Library (concrete library)
  org/blockml/bml/core/
    BlockLibrary.bml · Block.bml · …        ← BlockLibrary = framework base type, not in Library _blocks
  org/blockml/bml/compiler/                     ← example nested library (future)
    Library.bml                             ← org.blockml.bml.compiler.Library
  org/blockml/bml/status/ · type/ · constraint/ · validation/ · service/ · …

domains/machineblocks/mbom/blocks/
  com/machineblocks/bml/core/
    Step.bml · Block.bml · …
  com/machineblocks/bml/bricks/
    Library.bml · presets/StandardPresets.bml
```

---

## Related Documents

| Topic | Document |
|---|---|
| V1/V2/V3 scope · BML vs Markdown | `01_system.md` — BML Self-Description Roadmap |
| Block BML syntax | `02_mbml.md` |
| MBOM hierarchy | `03_mbom.md` |
| BlockDefinition BOM | `12_bom_object_model.md` |
| Bootstrap | `13_bml_to_bom_mapping.md` |
| SCAD property mapping | `09_mbom_properties.yml` |
| Value types · languages (BML) | `17_type_system_bml.md` |
| Constraints · suggestions | `18_constraints_and_suggestions.md` |
| Definition blocks · bml:xml | `19_definition_blocks_and_bml_xml.md` |
