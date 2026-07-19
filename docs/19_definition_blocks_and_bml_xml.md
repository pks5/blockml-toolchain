# Definition Blocks and `bml:xml` — Self-Describing BML

version: 0.1.0 · **BML meta-model specified; parser/serializer WIP**

## Purpose of this Document

This document specifies the **meta-model** for BlockML self-description: how BlockML describes its own block structure in BML, and how the **`bml:xml`** directive declares the canonical XML rendering of any block type.

The BML sources under `packages/core/blocks/org/blockml/bml/core/Definition.bml` and `packages/core/blocks/org/blockml/bml/definition/*` describe the **Definition meta-model**. `core.Definition` is complete as an empty identification marker; concrete shapes live on `org.blockml.bml.definition.*` subtypes. This document captures the **design intent** so parser, validator, and serializer work can proceed against a stable concept.

For framework base types see `16_framework_base_types.md`.
For BML authoring syntax see `02_mbml.md`.
For the self-description roadmap see `00_system.md` — BML Self-Description Roadmap.
For BOM parse shapes see `12_bom_object_model.md`.

---

## Core Idea — The Format Describes Itself

BlockML blocks are authored as XML (`.bml`). The **structure of a block document** — root element name, member element names, attribute vs element vs text placement — is not hardcoded in the parser forever. Instead, it is declared in **Definition blocks**: BML blocks that describe how other blocks are built and serialized.

```text
org.blockml.bml.definition.BlockDefinition     — shared shape (definition, subBlocks, members, …)
org.blockml.bml.definition.SubBlockDefinition  — nested Sub-Blocks (overrides definition)
org.blockml.bml.definition.EmbeddedBlockDefinition — virtual .bml in root embeddedBlocks
org.blockml.bml.definition.RootBlockDefinition   — document root (overrides definition; embeddedBlocks)
org.blockml.bml.definition.PropertyDefinition — describes how a <property> member renders
…

Each Definition block carries bml:xml directives
  → a generic XML serializer can render any Block instance back to canonical BML XML
  → the grammar is data, not only prose in Markdown
```

This is a step toward **BML self-hosting** (Phase 2/3 in `00_system.md`): BlockML understands BlockML because BlockML is written in BlockML.

**Scope note:** V1 does **not** require a fully meta-driven parser or serializer. Definition blocks and `bml:xml` are the **target architecture**. Phase A uses a **hardcoded** mapper/serializer (`13_bml_to_bom_mapping.md` — V1 Parser / Serializer Scope): preserve authored `bml:xml` as `xmlRendering` **and** run the D6 Stage-1 recipe check (**B23**); do not drive grammar from Definition blocks yet. **Emit order (B12):** V1 hardcodes Definition member order; **V2** reads that order dynamically from Definition `.bml` files — see `13` § Serializer Emit Order. Markdown remains authoritative for pipeline details until the meta-serializer is wired.

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
| `MemberReference<B, D>` | Generic `D` on `org.blockml.bml.type.MemberReference` has `baseType="def:MemberDefinition"` — bound by PropertyReference / AggregationReference / AssociationReference / CapabilityReference |
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
          org.blockml.bml.definition.EmbeddedBlockDefinition
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
| `org.blockml.bml.definition.BlockDefinition` | Shared `<block>` document shape (identity, `definition`, `subBlocks`, members, metadata, member containers) |
| `org.blockml.bml.definition.SubBlockDefinition` | Nested Sub-Block documents — overrides `definition` (default SubBlockDefinition) |
| `org.blockml.bml.definition.EmbeddedBlockDefinition` | Virtual `.bml` under root `embeddedBlocks` — overrides `definition`; no nested embeds |
| `org.blockml.bml.definition.RootBlockDefinition` | Document root — overrides `definition` (default RootBlockDefinition), adds `embeddedBlocks` (`EmbeddedBlockDefinition[]`) |
| `org.blockml.bml.definition.PropertyDefinition` | `<properties>` child members |
| `org.blockml.bml.definition.AggregationDefinition` | `<aggregations>` child members |
| `org.blockml.bml.definition.AssociationDefinition` | `<associations>` child members |
| `org.blockml.bml.definition.CapabilityDefinition` | `<capabilities>` child members |
| `org.blockml.bml.definition.GenericTypeDefinition` | `<genericTypes>` entries |

`BlockDefinition`, `SubBlockDefinition`, `EmbeddedBlockDefinition`, and `RootBlockDefinition` together describe block definition documents. `BlockDefinition` declares the shared members (`name`, `type`, `baseType`, abstract `definition`, `subBlocks`, aggregations for `properties`, `aggregations`, …). `SubBlockDefinition`, `EmbeddedBlockDefinition`, and `RootBlockDefinition` are **sibling** specializations of `BlockDefinition` that each override `definition` with a tighter TypeReference and default. `RootBlockDefinition` additionally owns `embeddedBlocks` (`EmbeddedBlockDefinition[]`). Type modifiers `abstract` and `final` are declared on `org.blockml.bml.definition.StructuralDefinition` as local boolean properties (default false, not inherited) and apply to block definitions and member declarations via `MemberDefinition`. See `packages/core/blocks/org/blockml/bml/definition/*.bml`.

**Distinction from BOM `BlockDefinition`:** The TypeScript interface `org.blockml.bml.bom.BlockDefinition` is the **parse result** for any `<block>` document. The BML blocks `org.blockml.bml.definition.BlockDefinition`, `SubBlockDefinition`, `EmbeddedBlockDefinition`, and `RootBlockDefinition` are the **meta-model** that describes what a block document means. Same word, different layers — see `12_bom_object_model.md`.

---

## The `bml:xml` Directive

`bml:xml` declares **how a block type or member maps to XML** when emitting BML-shaped XML from the canonical BOM. It complements flow-control directives (`bml:each`, `bml:if`, …) documented in `01_bom_core.md` — those control composition expansion; `bml:xml` controls **XML serialization shape**.

**Consumers are not limited to `@blockml/serializer`.** Any Stage-3 target that emits BML XML (or BML-shaped XML) should read the same metadata — notably:

| Consumer | Why `bml:xml` matters |
|---|---|
| **`@blockml/serializer`** | Canonical roundtrip: BOM → authored BML XML |
| **FatBlock Render Target** | Emits one `.bml` with inlined `<embeddedBlocks>`; must place root/member nodes correctly for every dependency type |
| **XSD Render Target** | Schema particle shape (element vs attribute, local names) follows the same declarations |
| **BlockDoc** (optional) | May surface authored XML form in examples / API pages |

Flow-control directives stay renderer-expansion concerns; `bml:xml` is **shared XML grammar metadata** on the Urmodell / TypeRegistry — not a serializer private detail.

Two authoring forms exist.

### Placement Rules

| Form | Allowed on | Purpose |
|---|---|---|
| `<bml:xml>…</bml:xml>` element | `org.blockml.bml.core.Block` and **all Definition blocks** (`baseType` chain includes `org.blockml.bml.core.Definition`) | Root XML element name for instances of this block type |
| `bml:xml="…"` attribute | Properties (and, by extension, members) on Definition blocks | How this member's value is rendered in XML |

The element form is **not** permitted on ordinary composable or ValueType blocks — only on **`org.blockml.bml.core.Block`** and on **Definition blocks** (`baseType` chain includes `org.blockml.bml.core.Definition`) that declare serialization for their described shape (**D4**).

Ordinary domain blocks **inherit** root-tag behavior (typically `${ bml:Self }` from `core.Block`) and must **not** redeclare `<bml:xml>`. If authored anyway → store on Urmodell (**maximum authored surface**); **Stage 2** → `BML_XML_DIRECTIVE_NOT_ALLOWED` (type/branch knowledge — not Stage 1).

**Member-level** `bml:xml` may change on `override="true"` redeclarations (e.g. FixedAlias `_name` element → FreeTextAlias `name` attribute).

##### When Stage 1 vs Stage 2 (**hybrid — decided**)

| Check | Stage | Code |
|---|---|---|
| `bml:xml` attribute on an element that the **hardcoded** grammar never allows | **Stage 1** (parser) | `BML_XML_DIRECTIVE_NOT_ALLOWED` |
| `<bml:xml>` body not literal / `${ bml:Self }` / `${ #this.name }` (D6) | **Stage 1** (syntactic recipe check) | `BML_XML_RENDERING_INVALID` |
| Malformed `${ … }` / empty illegal body | **Stage 1** | `BML_XML_RENDERING_INVALID` |
| Block-level `<bml:xml>` on ordinary composable / ValueType (D4) | **Stage 2** (needs `baseType` / Definition-branch) | `BML_XML_DIRECTIVE_NOT_ALLOWED` |
| Member `bml:xml` only legal on Definition-branch member declarations | **Stage 2** | `BML_XML_DIRECTIVE_NOT_ALLOWED` |

Stage 1 may still **attach** illegal `xmlRendering` for tooling when the host continues after diagnostics (maximum authored surface); hard-abort vs. continue is host policy. Semantic placement (D4) is never decided by the parser alone.

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

→ element name derived from the instance's **effective Block type** (`bml:Self`). The **XML prefix** is not invented at emit time:

```text
bml:Self = org.blockml.bml.core.Block     →  <core:Block>   only if xmlns:core was authored and stored
bml:Self = com.foo.MyBlock                →  <myns:MyBlock> only with the authored prefix for that namespace
```

Example: `org.blockml.bml.core.Block` — composable instances render under their declared type tag.

##### Namespace prefixes (**D2 — Decided**)

**1:1 roundtrip of authored prefixes is mandatory.**

| Rule | Detail |
|---|---|
| **Store** | Parser records every authored `xmlns` / `xmlns:prefix` on `BomDocument.source.namespaceBindings` (`prefix → namespace id`). Default (unprefixed) xmlns uses a reserved key (e.g. `""`). Do not normalize or rewrite prefixes. Insertion / iteration order **MUST** match authored declaration order. |
| **Emit bindings** | Serializer and XML-emitting targets reuse **exactly** those bindings. No synthetic `ns1` / guessed short names. |
| **Type-ref form (B21)** | Prefer **prefixed QName** vs **FQN** at document level — see below. |
| **Missing binding** | In QName-emit mode, if emit would need a prefix for a namespace that is **not** in `namespaceBindings` → **`BML_NAMESPACE_UNBOUND`** (error). Do not invent a binding and do **not** silently fall back to FQN. |
| **FatBlock** | Host **must** run Stage 2 validation **before** FatBlock emit. Validator ensures the closure of types/namespaces for the bundle is bound (root + every inlined dependency’s authored bindings, merged without prefix collisions). Unbound → `BML_NAMESPACE_UNBOUND`; conflicting prefix→namespace mappings → `BML_NAMESPACE_PREFIX_COLLISION`. No silent rewrite. |

###### Type-reference emit preference (**B21 — decided**)

BOM stores resolved FQNs only. On serialize, choose spelling:

```text
FQN-emit mode  —  document contains no BML-semantic prefixed QNames
                  (non-default xmlns:prefix whose URI is not XMLSchema-instance;
                   xmlns:xsi alone → still FQN mode — B25)
                  → emit type references as FQN

QName-emit mode — otherwise (any BML-semantic xmlns:prefix present)
                  → always emit type references as prefixed QNames when a binding exists for that namespace
                  → never prefer FQN merely because both spellings are possible
```

**Multiple prefixes → same namespace:** use the **first** authored binding for that namespace id (declaration order in `namespaceBindings`). Do not pick arbitrarily or by shortest name.

**XSI (B25):** `xmlns:xsi` → `namespaceBindings`; `xsi:schemaLocation` → `SourceInfo.schemaLocation`; both **MUST** roundtrip on the root element. See `13` § Rule 1 · `12` SourceInfo.
Applies to: `type` / `baseType` / aggregation & association type attributes, TypeReferenceEntity sugar tags (`${ bml:Self }` / empty QName children), composition instance tags, and any other site that emits a Block type identity as QName or FQN.

Compatible with B10: QName and FQN parse to the same FQN on the Urmodell; mixed authored spelling may normalize to all-QName (or all-FQN) on emit.

Phase A roundtrip of a single file already requires preserving `namespaceBindings` losslessly. Prefix resolution for `${ bml:Self }` evaluation is post–Phase A; the storage, “no invent”, and B21 preference rules apply from Phase A onward.

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

Same pattern as `org.blockml.bml.core.Block` (`${ bml:Self }`) and other TypeReferenceEntity definition containers. On these **definition containers**, every empty child element is **TypeReferenceEntity sugar** (QName → value) — not an instance of the named Block. See `17_type_system_bml.md` — TypeReference and TypeReferenceEntity.

```text
<contracts>
  <ac:Wall/>          → contract reference (element name = FQN via xmlns prefix) — type ref, not instance
</contracts>
```

The container defines context; the child element is the Block reference — no wrapper elements (`contract`, `genericType`) when context is already unambiguous.

The element body may contain only:

- a **literal** XML local name, or
- one of the **fixed tag recipes** below (authored with Expression-looking `${ … }` syntax for simplicity — they are not general Expression Language evaluation)

##### Allowed `<bml:xml>` recipes (**decided**)

In this context the `${ … }` forms are **named constants / recipes**, not open Expressions. Same surface syntax as the Expression Language; **no** arithmetic, calls, or other roots.

| Recipe | Meaning | Allowed on |
|---|---|---|
| literal local name | fixed tag, e.g. `block` | `core.Block` + Definition branch (D4) |
| `${ bml:Self }` | effective Block type → QName element | types that emit instance tags from type identity (e.g. `core.Block`) |
| `${ #this.name }` | current Definition instance’s `name` member → local element name | Member Definition blocks (`PropertyDefinition`, `AggregationDefinition`, `AssociationDefinition`, `CapabilityDefinition`, `GenericTypeDefinition`, …) |

Anything else in the `<bml:xml>` body (other roots, `#this.other`, `@bean`, operators, …) → **`BML_XML_RENDERING_INVALID`** (**Stage 1** syntactic check; also enforced at emit if skipped). Phase A stores `xmlRendering.raw` when present; whitelist is hybrid Stage 1 / emit — see § When Stage 1 vs Stage 2.

---

### Attribute Form — `bml:xml="…"` on Members

On property (and member) definitions inside Definition blocks, `bml:xml` selects **XML node kind** for that member's serialized value:

| Value | XML rendering |
|---|---|
| `attribute` | XML attribute on the parent element |
| `element` | Child XML element (named after the member / recipe) |
| `element\|attribute` | Element or attribute — both valid at parse; **canonical emit** uses § Default XML rendering by kind |
| `text` | Character data written **directly into the host element** — no nested child element for this value |

**Not a `bml:xml` value:** `cdata` / `text|cdata`. CDATA is not a placement kind — it is the escaping form of `text` placement (D8). Parse accepts Text nodes and CDATA sections equally when placement is `text`, and **records which form was authored** on the Urmodell.

Explicit `bml:xml` on a Definition member **always wins** over the defaults below.

Member-level `bml:xml` is declared on **Definition block properties** — it describes serialization for all instances of the described member kind, not on every user-authored Wall or Brick.

#### What `text` means (structural)

```text
bml:xml="element"   →  <documentation><content>Hello</content></documentation>   # extra child
bml:xml="attribute" →  <documentation content="Hello"/>                          # attribute
bml:xml="text"      →  <documentation>Hello</documentation>                      # body of host
```

`text` is therefore still required in the grammar: it is a **placement**, parallel to `element` / `attribute`, not a synonym for “non-CDATA”.

#### CDATA = escape policy + authored form for `text` (**D8 — Decided**)

`bml:xml` placement remains **`text`** only. CDATA is how that body may be written in XML.

**Parse (Stage 1):** Text node and CDATA both map to the same string value. Additionally store **authored character-data form** on the Urmodell (`authoredCharacterDataForm: "text" | "cdata"`) — maximum authored surface / B10.

**Emit:**

```text
needsEscape =
  content contains ']]>'     → must use CDATA split / special handling
  OR content contains '<' or '&'

emitAsCdata =
  needsEscape
  OR authoredCharacterDataForm == "cdata"   // author chose CDATA even when not required

if emitAsCdata → <![CDATA[…]]>  (split if ']]>' present)
else           → ordinary text node
```

So: the escape rule **always** applies when content requires it; if the rule does **not** require CDATA but the author used CDATA, roundtrip **writes CDATA again**.

Canonical / fresh emit (no authored form, e.g. BomBuilder): use `needsEscape` only (ordinary text when safe).

Legacy authored `bml:xml="cdata"` / `bml:xml="text|cdata"` → treat as placement `text` (warn in tooling if desired).

#### Default XML rendering by kind (**D1 — Decided**)

When `bml:xml` is **omitted**, or when `element|attribute` leaves a choice at **canonical emit**, use the **kind** of what is being rendered. Serializer, FatBlock, XSD, and other XML-emitting targets share this table.

| Kind of thing being rendered | Canonical XML form | Notes |
|---|---|---|
| **Aggregation / structured container** (`properties`, `aggregations`, `associations`, `capabilities`, `subBlocks`, `embeddedBlocks`, `constraints`, `suggestions`, `composition`, `implementation`, `changelog`, `examples`, `references`, `groups`, `contracts`, `aliases`, `genericTypes`, `language` lists, …) | **element** | Never attributes |
| **Member declaration** inside a member container (Property / Aggregation / Association / Capability / GenericType instance) | **element** named by member identity (`${ #this.name }` on the Definition block) | Optional xmlns prefix on the element name supplies the member namespace |
| **Scalar / TypeReference on a Block definition document** (`name`, `type`, `baseType`, `is`, `isnot`, `version`, member `type` / `value` on definitions, …) | **element** | Definition documents read as nested markup |
| **Scalar member value on a Block instance** (composition / preset instance attributes) | **attribute** | Compact instance authoring |
| **Short meta on documentation Sub-Blocks** (`language`, `version`, `title`, `snippet`, Reference `type` / `file` / `url` / member refs, Change `version`, …) | **attribute** | Facets on the Sub-Block element |
| **Prose / body** (`content`, `description`, `context`, long `documentation` text) | **text** | Host-element character data; CDATA form = D8 (escape **or** authored CDATA) |
| **TypeReferenceEntity sugar** children (e.g. empty `<ac:Wall/>` under `contracts`) | **element** (QName → type ref) | Not a Block instance — see `17_type_system_bml.md` |
| **Block / Definition root tag** | from **element-form** `<bml:xml>…</bml:xml>` on the type | Literal, `${ bml:Self }`, or `${ #this.name }` — not covered by member defaults |

**Accept vs emit:**

```text
Parse (Stage 1)     — if declared form allows both (element|attribute), accept either;
                      MUST store authoredPlacement (D9).
                      For bml:xml="text": accept Text node or CDATA — same string in BOM;
                      store authoredCharacterDataForm (D8).
Canonical emit      — no authoredPlacement → apply D1 table (or explicit single bml:xml);
                      text bodies: emitAsCdata = needsEscape OR authoredCharacterDataForm=="cdata".
Roundtrip serialize — MUST emit authoredPlacement when present (D9);
                      text bodies: D8 (preserve authored CDATA even when escape not required).
Formatting WS       — MAY normalize (B13); not on Urmodell.
```

Example (from `org.blockml.bml.definition.StructuralDefinition` — `Documentation` Sub-Block shape):

```xml
<documentation bml:xml="element">
  <documentation>Technical description prose for this definition element.</documentation>
</documentation>
```

→ the `documentation` value renders as `<documentation>…</documentation>`, not as `documentation="…"` (kind: prose/body on a definition-shaped field, and explicit `bml:xml="element"`).

When `bml:xml="element|attribute"` is declared (e.g. `abstract`, `type`, `value` on member Definitions), the parser accepts both forms and **MUST** record `authoredPlacement`. Roundtrip serialize **MUST** write the same form. Only when `authoredPlacement` is absent (BomBuilder / fresh emit) does canonical emit use the **definition → element** / **instance → attribute** rows above (**D9**).

#### Dual `element|attribute` authored form (**D9 — Decided**)

```text
bml:xml="element|attribute"  →  author may write either form
Parse:   store authoredPlacement = "element" | "attribute" on the value
         (MemberValue.authoredPlacement) or on the declaration (xmlRendering.authoredPlacement)
Emit:    if authoredPlacement present → MUST use that form
         else → D1 kind defaults (definition vs instance context)
```

This is structural choice (unlike CDATA escaping). It participates in BOM deep equality (B10).

---

## Worked Example — Block Document Round-Trip

Meta-model (simplified):

```text
org.blockml.bml.definition.BlockDefinition
  bml:xml element:  block
  properties:       name, type → TypeReference(core:Block),
                    baseType → TypeReference(core:Block), is, isnot, version,
                    definition (abstract — TypeReference(BlockDefinition))
  aggregations:     language → TypeReferenceEntity(NaturalLanguage)
                    aliases → Alias[]
                    genericTypes → GenericTypeDefinition[]
                    contracts → TypeReferenceEntity(Block)[]
                    properties → PropertyDefinition[]
                    aggregations → AggregationDefinition[]
                    subBlocks → SubBlockDefinition[]
                    …

org.blockml.bml.definition.SubBlockDefinition
  baseType:         BlockDefinition
  properties:       definition (default SubBlockDefinition — overrides BlockDefinition)

org.blockml.bml.definition.RootBlockDefinition
  baseType:         BlockDefinition
  properties:       definition (default RootBlockDefinition — overrides BlockDefinition)
  aggregations:     embeddedBlocks → EmbeddedBlockDefinition[]   (virtual files; root-only)

org.blockml.bml.definition.EmbeddedBlockDefinition
  baseType:         BlockDefinition
  properties:       definition (default EmbeddedBlockDefinition — overrides BlockDefinition)
  (no embeddedBlocks — BML_NESTED_EMBEDDED_BLOCKS)

org.blockml.bml.definition.PropertyDefinition
  bml:xml element:  ${ #this.name }
  member fields follow § Default XML rendering by kind (D1); explicit bml:xml overrides

org.blockml.bml.core.Block
  bml:xml element:  ${ bml:Self }
```

Authoring instance:

```xml
<block xmlns:core="org.blockml.bml.core" …>
  <name>Wall</name>
  <type>com.example:Wall</type>
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
1. Lookup block role → SubBlockDefinition (Sub-Block), EmbeddedBlockDefinition (virtual file), or
   RootBlockDefinition (document root); honor block.definitionFqn when explicitly set
2. Root element name from BlockDefinition.bml:xml → "block"
3. Each aggregation child resolved via its Definition block's bml:xml
4. Property "width" → PropertyDefinition.bml:xml → element name from #this.name → <width>
5. Member values placed per bml:xml="attribute|element|text" on PropertyDefinition fields
   (CDATA is D8 escape for text — not a separate placement)
```

The result is **lossless canonical BML XML** derived from BOM + Definition registry — not ad hoc string templates.

---

## Relationship to Parser and BOM

| Layer | Responsibility |
|---|---|
| **Parser step [5]** | Parses authored XML into Canonical BOM — today uses fixed mapping rules in `13_bml_to_bom_mapping.md` |
| **Definition blocks** | Declarative SSOT for what those mapping rules *should* be |
| **`bml:xml`** | Declarative SSOT for BOM → XML shape — shared by serializer **and** XML-emitting Render Targets (FatBlock, XSD, …) |
| **Future serializer / FatBlock / XSD** | Read Definition blocks + `bml:xml` from TypeRegistry; emit XML without per-type hardcoding |

Until the meta-serializer exists:

- Parser behavior remains as documented in `13_bml_to_bom_mapping.md`.
- Definition `.bml` files are loaded like any framework block (bootstrap in `16_framework_base_types.md`).
- `bml:xml` elements and attributes are stored on the Urmodell as first-class **`xmlRendering`** (`12` — D3). Omitted / dual forms resolve via **D1** kind defaults at canonical emit. Prefer this over flow-control `directives[]` so every XML-emitting target can query the same fields (**maximum authored surface** — `01_bom_core.md`).

**Non-goals for initial implementation:** Evaluating `${ bml:Self }` / `${ #this.name }` at parse time for non-meta blocks. **XSD emission** is not a parser side-effect — it is the XSD Render Target (D5).

---

## Implementation Status

| Item | Status |
|---|---|
| `org.blockml.bml.core.Definition` BML | Done — empty identification marker (by design) |
| `org.blockml.bml.definition.StructuralDefinition` BML | Done — documentation Sub-Blocks inline |
| `org.blockml.bml.definition.*` member surfaces | Done — Property, Aggregation, Association, Capability, MemberDefinition |
| `org.blockml.bml.type.TypeReference` / `TypeReferenceEntity` / `MemberReference` (+ children) BML | Specified — ValueType hierarchy for type + member path refs |
| Meta-driven BOM → XML serializer | Not implemented |
| Validator rules for placement / `bml:xml` / xmlns emit | **Hybrid:** D6 + structural → Stage 1; D4 / Definition-branch placement → Stage 2. Codes: `BML_XML_DIRECTIVE_NOT_ALLOWED`, `BML_XML_RENDERING_INVALID`, `BML_NAMESPACE_UNBOUND`, `BML_NAMESPACE_PREFIX_COLLISION` |

Source files live under:

```text
packages/core/blocks/org/blockml/bml/core/Definition.bml
packages/core/blocks/org/blockml/bml/core/PrimitiveEntity.bml
packages/core/blocks/org/blockml/bml/type/TypeReference.bml
packages/core/blocks/org/blockml/bml/type/TypeReferenceEntity.bml
packages/core/blocks/org/blockml/bml/type/MemberReference.bml
packages/core/blocks/org/blockml/bml/type/PropertyReference.bml
packages/core/blocks/org/blockml/bml/type/AggregationReference.bml
packages/core/blocks/org/blockml/bml/type/AssociationReference.bml
packages/core/blocks/org/blockml/bml/type/CapabilityReference.bml
packages/core/blocks/org/blockml/bml/definition/StructuralDefinition.bml
packages/core/blocks/org/blockml/bml/definition/ConstrainableDefinition.bml
packages/core/blocks/org/blockml/bml/definition/BlockDefinition.bml
packages/core/blocks/org/blockml/bml/definition/SubBlockDefinition.bml
packages/core/blocks/org/blockml/bml/definition/EmbeddedBlockDefinition.bml
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
| D1 | Default `bml:xml` when omitted on members | **Decided:** kind-based defaults — § Default XML rendering by kind. Explicit `bml:xml` wins. Dual `element\|attribute`: parse both, store `authoredPlacement` (D9); D1 only when authored form absent |
| D2 | `${ bml:Self }` / type-ref prefix resolution at serialize time | **Decided:** store authored prefixes in `SourceInfo.namespaceBindings` — **1:1 roundtrip**, no invented prefixes. **B21:** QName-emit when any prefixed binding exists; FQN-emit only when the document has no QNames. Multiple prefixes for one NS → first authored. Missing NS → error. FatBlock only after Stage 2; unbound/conflicting NS fail — see § Namespace prefixes |
| D3 | BOM storage shape for `<bml:xml>` / member `bml:xml` | **Decided:** first-class `xmlRendering` on `BlockDefinition` + `MemberDefinitionBase` — **not** flow-control `directives[]`. Follows **maximum authored surface** (`01_bom_core.md`). See `12_bom_object_model.md` · `XmlRenderingBlock` / `XmlRenderingMember` |
| D4 | Whether composable blocks may override inherited `bml:xml` | **Decided (A):** **Member-level** — allowed on `override="true"`. **Block-level** — only `core.Block` + Definition branch. Illegal → `BML_XML_DIRECTIVE_NOT_ALLOWED` at **Stage 2** (hybrid). See § Placement Rules · § When Stage 1 vs Stage 2 |
| D5 | XSD generation from Definition blocks | **Decided:** implement as **Render Target** (Stage 3). Replaces hand-maintained schemas long-term. **XSD validation** of authoring only after this target exists and must remain **always disableable** so schema regen is never blocked. Recommended among toolchain targets **before** MachineBlocks SCAD — see `15_dev_setup.md` Phase C · `13` B8 |
| D6 | Allowed `<bml:xml>` body recipes | **Decided:** literal, `${ bml:Self }`, `${ #this.name }` only. Invalid → `BML_XML_RENDERING_INVALID` at **Stage 1**. Phase A (**B23**): check D6 **and** still store `xmlRendering` — preserve ≠ skip validation. See § Allowed `<bml:xml>` recipes · § When Stage 1 vs Stage 2 · `13` B23 |
| D7 | Illegal `bml:xml` — parser vs validator | **Decided (hybrid):** structural + D6 → Stage 1; D4 / branch placement → Stage 2. See § When Stage 1 vs Stage 2 |
| D8 | `text` vs `cdata` | **Decided:** `text` = placement (host body). CDATA = escape form of `text`, **plus** store `authoredCharacterDataForm` on BOM. Emit CDATA if escape requires it **or** author used CDATA. Legacy `cdata` / `text\|cdata` → placement `text`. See § CDATA = escape policy + authored form |
| D9 | Dual `element\|attribute` authored form | **Decided:** Parser **MUST** store `authoredPlacement`; roundtrip serializer **MUST** emit that form. D1 defaults only when authored form absent. See § Dual element\|attribute authored form |

---

## Related Documents

| Topic | Document |
|---|---|
| Framework base types bootstrap | `16_framework_base_types.md` |
| BML directives (flow control) | `01_bom_core.md` — BML Directives · `02_mbml.md` |
| Self-description roadmap | `00_system.md` — BML Self-Description Roadmap |
| BML → BOM mapping (current) | `13_bml_to_bom_mapping.md` |
| BOM BlockDefinition interface | `12_bom_object_model.md` |
| Type system in BML | `17_type_system_bml.md` |
