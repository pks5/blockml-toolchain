# Definition Blocks and `bml:xml` — Self-Describing BML

version: 0.1.0 · **BML meta-model specified; parser/serializer WIP**

## Purpose of this Document

This document specifies the **meta-model** for BlockML self-description: how BlockML describes its own block structure in BML, and how the **`bml:xml`** directive declares the canonical XML rendering of any block type.

The BML sources under `packages/core/blocks/org/blockml/bml/core/Definition.bml` and `packages/core/blocks/org/blockml/bml/definition/*` describe the **Definition meta-model**. `core.Definition` is complete as an empty identification marker; concrete shapes live on `org.blockml.bml.definition.*` subtypes. This document captures the **design intent** so parser, validator, and serializer work can proceed against a stable concept.

For framework base types see `16_framework_base_types.md`.
For BML authoring syntax see `02_mbml.md`.
For the self-description roadmap see `01_system.md` — BML Self-Description Roadmap.
For BOM parse shapes see `12_bom_object_model.md`.

---

## Core Idea — The Format Describes Itself

BlockML blocks are authored as XML (`.bml`). The **structure of a block document** — root element name, member element names, attribute vs element vs text placement — is not hardcoded in the parser forever. Instead, it is declared in **Definition blocks**: BML blocks that describe how other blocks are built and serialized.

```text
org.blockml.bml.definition.BlockDefinition     — shared shape of all <block> definition documents
org.blockml.bml.definition.SubBlockDefinition  — nested Sub-Blocks (definition, subBlocks)
org.blockml.bml.definition.RootBlockDefinition   — root/embedded <block> document (embeddedBlocks)
org.blockml.bml.definition.PropertyDefinition — describes how a <property> member renders
…

Each Definition block carries bml:xml directives
  → a generic XML serializer can render any Block instance back to canonical BML XML
  → the grammar is data, not only prose in Markdown
```

This is a step toward **BML self-hosting** (Phase 2/3 in `01_system.md`): BlockML understands BlockML because BlockML is written in BlockML.

**Scope note:** V1 does **not** require a fully meta-driven parser. Definition blocks and `bml:xml` are specified here as the **target architecture**. Implementation may lag; Markdown remains authoritative for pipeline details until the meta-serializer is wired.

---

## `org.blockml.bml.core.Definition`

**FQN:** `org.blockml.bml.core.Definition`  
**Base type:** `org.blockml.bml.core.Block`  
**Role:** Abstract **identification marker** for the Definition branch — not a shape-bearing type.

`org.blockml.bml.core.Definition` is intentionally **empty** (no members). It exists so tooling can recognize Definition meta-model blocks by `baseType` chain membership. All concrete grammar — documentation model, block shape, member kinds, `bml:xml` — is declared on `org.blockml.bml.definition.*` subtypes.

**Identification uses:**

| Site | How `core.Definition` appears |
|---|---|
| `baseType` chain | `org.blockml.bml.definition.*` blocks inherit from `core.Definition` (directly or via `StructuralDefinition`) |
| `FullyQualifiedName<B, D>` | Generic `D` on `org.blockml.bml.type.FullyQualifiedName` has `baseType="core:Definition"`, `defaultType="def:BlockDefinition"` — constrains definition-element FQN references |
| `<genericTypes>` | Meta-model generic parameters may use `baseType="org.blockml.bml.core.Definition"` (e.g. parameter `D` on a Block that describes definition elements) |
| Validator | `definitionBranch === "definitionBlock"` when `baseType` chain includes `core.Definition` |

**Design note:** Framework core branch types (`core.Definition`, `core.ValueType`, …) remain **`baseType` markers**. Domain interface-style bounds use `<contracts>` and `satisfiesTypeBound` — see `17_type_system_bml.md` — baseType vs contracts.

Definition blocks live in the `org.blockml.bml.definition.*` package branch.

```text
org.blockml.bml.core.Block              — universal root (composable, ValueType, Language, …)
  org.blockml.bml.core.Definition       — empty identification marker; subtypes carry shape
    org.blockml.bml.definition.StructuralDefinition
      inline Sub-Blocks (StructuralDefinition.bml): Documentation · Change · Example · Reference
      org.blockml.bml.definition.ConstrainableDefinition
        org.blockml.bml.definition.BlockDefinition
          org.blockml.bml.definition.SubBlockDefinition
            org.blockml.bml.definition.RootBlockDefinition
        org.blockml.bml.definition.MemberDefinition
          org.blockml.bml.definition.PropertyDefinition
          org.blockml.bml.definition.AggregationDefinition
          org.blockml.bml.definition.AssociationDefinition
          org.blockml.bml.definition.CapabilityDefinition
    org.blockml.bml.definition.GenericTypeDefinition
    …
```

A **Definition block** answers: *What members does this kind of block have, and how does it appear in XML?*

An ordinary **composable block** (e.g. `com.machineblocks.bml.bricks.StandardBrick`) answers: *What is this thing in the domain?*

---

## Definition Block Branch (`org.blockml.bml.definition.*`)

Each member kind in the block grammar has a corresponding Definition block. Sources in `@blockml/core`:

| Definition block | Describes |
|---|---|
| `org.blockml.bml.definition.StructuralDefinition` | Shared documentation model — `since`, `status`, `documentation`, `abstract`, `final`, `changelog`, `examples`, `references`; inline Sub-Blocks Documentation · Change · Example · Reference |
| `org.blockml.bml.definition.BlockDefinition` | Shared `<block>` document shape (identity, members, metadata, member containers) |
| `org.blockml.bml.definition.SubBlockDefinition` | Nested Sub-Block documents — adds `definition` (default SubBlockDefinition), `subBlocks` |
| `org.blockml.bml.definition.RootBlockDefinition` | Root/embedded `<block>` document — overrides `definition` (default RootBlockDefinition), adds `embeddedBlocks` |
| `org.blockml.bml.definition.PropertyDefinition` | `<properties>` child members |
| `org.blockml.bml.definition.AggregationDefinition` | `<aggregations>` child members |
| `org.blockml.bml.definition.AssociationDefinition` | `<associations>` child members |
| `org.blockml.bml.definition.CapabilityDefinition` | `<capabilities>` child members |
| `org.blockml.bml.definition.GenericTypeDefinition` | `<genericTypes>` entries |

`BlockDefinition`, `SubBlockDefinition`, and `RootBlockDefinition` together describe block definition documents. `BlockDefinition` declares the shared members (`name`, `type`, `baseType`, aggregations for `properties`, `aggregations`, …). `SubBlockDefinition` adds `definition` (default `SubBlockDefinition` on Sub-Blocks) and `subBlocks` (recursive Sub-Block hierarchy). `RootBlockDefinition` overrides `definition` (default `RootBlockDefinition` on root and embedded blocks) and adds `embeddedBlocks` (Inline Library — full root-block-shaped embedded documents). Type modifiers `abstract` and `final` are declared on `org.blockml.bml.definition.StructuralDefinition` as local boolean properties (default false, not inherited) and apply to block definitions and member declarations via `MemberDefinition`. See `packages/core/blocks/org/blockml/bml/definition/BlockDefinition.bml`, `SubBlockDefinition.bml`, and `RootBlockDefinition.bml`.

**Distinction from BOM `BlockDefinition`:** The TypeScript interface `org.blockml.bml.bom.BlockDefinition` is the **parse result** for any `<block>` document. The BML blocks `org.blockml.bml.definition.BlockDefinition`, `SubBlockDefinition`, and `RootBlockDefinition` are the **meta-model** that describes what a block document means. Same word, different layers — see `12_bom_object_model.md`.

---

## The `bml:xml` Directive

`bml:xml` declares **how a block type or member maps to XML** when rendering BML from the canonical BOM. It complements flow-control directives (`bml:each`, `bml:if`, …) documented in `00_bom_core.md` — those control composition expansion; `bml:xml` controls **serialization shape**.

Two authoring forms exist.

### Placement Rules

| Form | Allowed on | Purpose |
|---|---|---|
| `<bml:xml>…</bml:xml>` element | `org.blockml.bml.core.Block` and **all Definition blocks** (`baseType` chain includes `org.blockml.bml.core.Definition`) | Root XML element name for instances of this block type |
| `bml:xml="…"` attribute | Properties (and, by extension, members) on Definition blocks | How this member's value is rendered in XML |

The element form is **not** permitted on ordinary composable or ValueType blocks — only on the root Block type and on Definition blocks that declare serialization for their described shape.

Unknown or misplaced `bml:xml` → `BML_XML_DIRECTIVE_NOT_ALLOWED` (validate; TBD in parser).

---

### Element Form — `<bml:xml>…</bml:xml>`

Child of the block definition. Defines the **local name** (and optionally namespace binding) of the XML element used when serializing instances of this type.

**Literal local name**

```xml
<bml:xml>block</bml:xml>
```

→ instances render as `<block>…</block>`.

Example: `org.blockml.bml.definition.BlockDefinition` — every block document uses `<block>` as root.

**Expression — effective Block type as element name**

```xml
<bml:xml>${ bml:Self }</bml:xml>
```

→ element name derived from the instance's **effective Block type** (`bml:Self`). Namespace prefix syntax is supported where authored:

```text
bml:Self = org.blockml.bml.core.Block     →  <core:Block>   (xmlns:core bound)
bml:Self = com.foo.MyBlock            →  <myns:MyBlock> or unprefixed per namespace rules
```

Example: `org.blockml.bml.core.Block` — composable instances render under their declared type tag.

**Expression — member name as element name**

```xml
<bml:xml>${ #this.name }</bml:xml>
```

→ element name taken from the **`name`** member on the current Definition instance (`#this`):

```text
#this.name = size        →  <size>…</size>
#this.name = properties  →  <properties>…</properties>
#this.name = T           →  <T baseType="…"/>   (GenericTypeDefinition — name derived from element)
```

Examples: `PropertyDefinition`, `AggregationDefinition`, `AssociationDefinition`, `CapabilityDefinition`, `GenericTypeDefinition`.

**Direct Block reference — effective Block type as element name**

Same pattern as `org.blockml.bml.core.Block` (`${ bml:Self }`) and Language references in `<languages>`:

```text
<contracts>
  <ac:Wall/>          → contract reference (element name = FQN via xmlns prefix)
</contracts>
<languages>
  <lang:OpenSCAD/>    → language reference
</languages>
<subTypes>
  <core:Block/>       → allowed Sub-Block baseType reference
</subTypes>
```

The container defines context; the child element is the Block reference — no wrapper elements (`contract`, `genericType`) when context is already unambiguous.

The element body may contain only:

- a **literal** XML local name, or
- a **`${ … }` expression** referencing allowed roots (`bml:Self`, `#this`, … — exact set TBD per Definition block)

---

### Attribute Form — `bml:xml="…"` on Members

On property (and member) definitions inside Definition blocks, `bml:xml` selects **XML node kind** for that member's serialized value:

| Value | XML rendering |
|---|---|
| `attribute` | XML attribute on the parent element |
| `element` | Child XML element |
| `element\|attribute` | Element or attribute — both valid; preference depends on context (see below) |
| `text` | Text node child |
| `cdata` | CDATA section child |

**Member value placement** — for scalar fields on member declarations (`PropertyDefinition`,
`CapabilityDefinition`, shared `MemberDefinition` fields):

```text
Block definition documents   element | attribute allowed — prefer element when serializing
Block instances (composition)  element | attribute allowed — prefer attribute when serializing
Structured children            always elements (constraints, suggestions, composition, implementation, …)
```

Example (from `org.blockml.bml.definition.StructuralDefinition` — `Documentation` Sub-Block shape):

```xml
<documentation bml:xml="element">
  <documentation>Technical description prose for this definition element.</documentation>
</documentation>
```

→ the `documentation` value renders as `<documentation>…</documentation>`, not as `documentation="…"`.

When `bml:xml="element|attribute"` is declared, the parser accepts both forms; the meta-driven
serializer chooses element vs attribute using the preference rules above unless the authored
BML form is preserved losslessly in BOM.

Member-level `bml:xml` is declared on **Definition block properties** — it describes serialization for all instances of the described member kind, not on every user-authored Wall or Brick.

---

## Worked Example — Block Document Round-Trip

Meta-model (simplified):

```text
org.blockml.bml.definition.BlockDefinition
  bml:xml element:  block
  properties:       idea, name, type, baseType, version, …
  aggregations:     properties → PropertyDefinition[]
                    aggregations → AggregationDefinition[]
                    …

org.blockml.bml.definition.SubBlockDefinition
  baseType:         BlockDefinition
  properties:       definition (default SubBlockDefinition)
  aggregations:     subBlocks → SubBlockDefinition[]   (recursive)

org.blockml.bml.definition.RootBlockDefinition
  baseType:         SubBlockDefinition
  properties:       definition (default RootBlockDefinition — overrides SubBlockDefinition)
  aggregations:     embeddedBlocks → RootBlockDefinition[]   (Inline Library; full root-block shape)

org.blockml.bml.definition.PropertyDefinition
  bml:xml element:  ${ #this.name }
  (member bml:xml rules for type, value, documentation, … — TBD)

org.blockml.bml.core.Block
  bml:xml element:  ${ bml:Self }
```

Authoring instance:

```xml
<block xmlns:core="org.blockml.bml.core" …>
  <name>Wall</name>
  <type>com.example.Wall</type>
  <baseType>core:Block</baseType>
  <properties>
    <width type="Float">
      <value>50</value>
    </width>
  </properties>
</block>
```

Serialization path (conceptual):

```text
1. Lookup block role → org.blockml.bml.definition.SubBlockDefinition (Sub-Block) or
   org.blockml.bml.definition.RootBlockDefinition (document root / embedded block); honor
   block.definitionFqn when explicitly set
2. Root element name from BlockDefinition.bml:xml → "block"
3. Each aggregation child resolved via its Definition block's bml:xml
4. Property "width" → PropertyDefinition.bml:xml → element name from #this.name → <width>
5. Member values placed per bml:xml="attribute|element|text|cdata" on PropertyDefinition fields
```

The result is **lossless canonical BML XML** derived from BOM + Definition registry — not ad hoc string templates.

---

## Relationship to Parser and BOM

| Layer | Responsibility |
|---|---|
| **Parser (stage [5])** | Parses authored XML into Canonical BOM — today uses fixed mapping rules in `13_bml_to_bom_mapping.md` |
| **Definition blocks** | Declarative SSOT for what those mapping rules *should* be |
| **`bml:xml`** | Declarative SSOT for BOM → XML rendering |
| **Future serializer** | Reads Definition blocks + `bml:xml` from TypeRegistry; emits XML without per-type hardcoding |

Until the meta-serializer exists:

- Parser behavior remains as documented in `13_bml_to_bom_mapping.md`.
- Definition `.bml` files are loaded like any framework block (bootstrap in `16_framework_base_types.md`).
- `bml:xml` elements and attributes are stored in BOM (directives / member metadata — exact BOM fields TBD).

**Non-goals for initial implementation:** Evaluating `${ bml:Self }` / `${ #this.name }` at parse time for non-meta blocks; expanding `bml:xml` into XSD automatically (may follow later).

---

## Implementation Status

| Item | Status |
|---|---|
| `org.blockml.bml.core.Definition` BML | Done — empty identification marker (by design) |
| `org.blockml.bml.definition.StructuralDefinition` BML | Done — documentation Sub-Blocks inline |
| `org.blockml.bml.definition.*` member surfaces | Done — Property, Aggregation, Association, Capability, MemberDefinition |
| `bml:xml` in parser / BOM model | Not implemented |
| Meta-driven BOM → XML serializer | Not implemented |
| Validator rules for placement | Specified here; codes TBD |

Source files live under:

```text
packages/core/blocks/org/blockml/bml/core/Definition.bml
packages/core/blocks/org/blockml/bml/definition/StructuralDefinition.bml
packages/core/blocks/org/blockml/bml/definition/ConstrainableDefinition.bml
packages/core/blocks/org/blockml/bml/definition/BlockDefinition.bml
packages/core/blocks/org/blockml/bml/definition/SubBlockDefinition.bml
packages/core/blocks/org/blockml/bml/definition/RootBlockDefinition.bml
packages/core/blocks/org/blockml/bml/definition/MemberDefinition.bml
packages/core/blocks/org/blockml/bml/definition/PropertyDefinition.bml
packages/core/blocks/org/blockml/bml/definition/AggregationDefinition.bml
packages/core/blocks/org/blockml/bml/definition/AssociationDefinition.bml
packages/core/blocks/org/blockml/bml/definition/CapabilityDefinition.bml
packages/core/blocks/org/blockml/bml/definition/GenericTypeDefinition.bml
```

Documentation Sub-Blocks (`Documentation`, `Change`, `Example`, `Reference`) are declared **inline** in `StructuralDefinition.bml` — not as separate top-level `*Definition.bml` library exports.

---

## Open Decisions

| ID | Topic | Notes |
|---|---|---|
| D1 | Default `bml:xml` when omitted on members | Member scalars: `element\|attribute`; prefer element on definitions, attribute on instances — see § Attribute Form |
| D2 | `${ bml:Self }` prefix resolution at serialize time | Reuse xmlns bindings from BOM `SourceInfo.namespaceBindings` |
| D3 | BOM storage shape for `<bml:xml>` element | `xmlRendering` on BlockDefinition vs `directives[]` |
| D4 | Whether composable blocks may override inherited `bml:xml` | Probably forbidden except via Definition branch |
| D5 | XSD generation from Definition blocks | Future; replaces hand-maintained schemas long-term |

---

## Related Documents

| Topic | Document |
|---|---|
| Framework base types bootstrap | `16_framework_base_types.md` |
| BML directives (flow control) | `00_bom_core.md` — BML Directives · `02_mbml.md` |
| Self-description roadmap | `01_system.md` — BML Self-Description Roadmap |
| BML → BOM mapping (current) | `13_bml_to_bom_mapping.md` |
| BOM BlockDefinition interface | `12_bom_object_model.md` |
| Type system in BML | `17_type_system_bml.md` |
