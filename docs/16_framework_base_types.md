# Framework Base Types — BML Definitions

version: 0.1.0

## Purpose of this Document

This document specifies how **framework base types** (`org.blockml.bml.core.Block`, `com.machineblocks.bml.core.Block`, `org.blockml.bml.core.Entity`, …) are defined — as **BML files**, not code or YAML.

For BML block syntax see `02_mbml.md`.
For MBOM hierarchy see `03_mbom.md`.
For TypeRegistry bootstrap see `13_bml_to_bom_mapping.md`.
For SCAD property mapping see `NativeBlock.bml` (parameter SSOT) and transitional `09_mbom_properties.yml` (must follow NativeBlock).
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
| **MB native params SSOT** | `com.machineblocks.bml.core.NativeBlock` + `com.machineblocks.bml.type.*` |
| **Interpretation** | Renderers / validators only — no type semantics hardcoded outside BML + registry; **renderers free in output** — see `17_type_system_bml.md` — Renderer freedom |
| **Compiler internals** | Parser **must** know `<block>` as input concept; internal representation **free** — see `17_type_system_bml.md` |
| **09_mbom_properties.yml** | Transitional render hints only — **must follow** NativeBlock; not parameter SSOT |
| **User blocks** | Same mechanism — `<baseType>` → chain to framework BML |
| **Block identity** | Every `<block>` starts with definition identity — `<name>`, `<type>`, `<baseType>` (before `<is>`) |
| **Block is** | Every `<block>` carries required `<is>` after identity — names the Idea (Urbild); see `02_mbml.md` § Terminology — Urbild |
| **Block documentation** | Every Block definition carries required `<documentation>`; `<summary>` when documentation is long; `<isnot>` when confusion risk exists |
| **Everything is a Block** | Framework types, primitives, languages, services, Set meta blocks — one `<block>` element, one registry; see `17_type_system_bml.md` |
| **ValueType branch** | `org.blockml.bml.core.ValueType` — abstract base for all value blocks used in Property `type` and Capability `inputType` / `outputType`; four kinds: PrimitiveType · StructType · EnumType · ConstantType |
| **Unit branch** | `org.blockml.bml.core.Unit` — measurement-unit taxonomy (like Language/Status), not a ValueType; used as generic type arguments on Number (e.g. `Decimal(unit:Millimeter)`); concrete units in `org.blockml.bml.unit.*` |
| **Mandatory BML namespace** | All BML definitions under `<domain>.bml.*` — see `00_bom_core.md` |
| **Self-hosting bootstrap** | Compiler loads `@blockml/core` + domain framework BML **before** user content — TypeRegistry bootstrap in V1; full toolchain self-description is V3 — see `01_system.md` |

```text
BML NativeBlock + type/*.bml (what params/types ARE)  →  TypeRegistry / authoring SSOT
09_mbom_properties.yml (optional transitional hints) →  must match NativeBlock; never override
BlockProcessor (when/how to render)                  →  Render pipeline
```

---

## Type Modifiers (BML)

Optional elements on any `<block>` definition and on member declarations (properties, aggregations,
associations, capabilities). Declared in the meta-model on
`org.blockml.bml.definition.StructuralDefinition` (blocks) and
`org.blockml.bml.definition.MemberDefinition` (members, including `override`). Local declaration
properties — not inherited; only semantic effects propagate.

On **block definitions**, render as child elements (`<abstract>`, `<final>`). On **member
declarations**, render as element or attribute (`bml:xml="element|attribute"`) — element form
preferred when serializing definitions; attribute form preferred on Block instances. See
`org.blockml.bml.definition.MemberDefinition` and `19_definition_blocks_and_bml_xml.md` — Member
value placement.

### `<abstract>`

```xml
<abstract>true</abstract>
```

Local declaration property — not inherited. When true, the type exists for inheritance and validation but must not be used as a composition instance typeFqn (except as baseType on definitions). A child block of an abstract type is concrete by default unless it explicitly declares `abstract="true"`.

```text
true   — abstract type; creates implementation obligations for concrete descendants
false  — default when omitted; concrete derivable type
```

Empty elements (`<abstract/>`) are not permitted — use `<abstract>true</abstract>` explicitly.

Framework types `org.blockml.bml.core.Block`, `org.blockml.bml.service.*` (abstract bases), `com.machineblocks.bml.core.Block` are `abstract=true`.

Concrete blocks (`Wall`, `StandardBrick`, `Math`) omit `<abstract>` or set `false`.

### `<final>`

```xml
<final>true</final>
```

Local declaration property — not inherited. When true, no Block definition may use this type as baseType (BML_FINAL_BASE_TYPE).

```text
true   — no Block definition may use this type as baseType
         (BML_FINAL_BASE_TYPE)
false  — default when omitted
```

Empty elements (`<final/>`) are not permitted — use `<final>true</final>` explicitly.

`com.machineblocks.bml.core.NativeBlock` is `final=true`.

### `<contracts>`

```xml
<contracts>
  <ac:Wall />
  <core:Identifiable />
</contracts>
```

```text
Lists contract Block references merged into this Block (root block only).
Meta-model type: type:TypeReferenceEntity(core:Block)[]. Each child is a TypeReferenceEntity instance — empty QName sugar or explicit value.
Same container pattern as other TypeReferenceEntity aggregations — no wrapper <contract> element.
See 17_type_system_bml.md — TypeReference and TypeReferenceEntity.
Role            — member merge + type-bound identification (satisfiesTypeBound); see 17_type_system_bml.md
Omitted = inherit from baseType at validate
Duplicate reference → BML_DUPLICATE_CONTRACT
<contracts> on Sub-Block → BML_CONTRACT_NOT_ON_ROOT
Core branch types (ValueType, Entity, Language, …) are baseType markers — not duplicated as interface contracts
```

See `02_mbml.md` — Contracts · `00_bom_core.md` — Contracts.

### `<genericTypes>`

```xml
<genericTypes>
  <T baseType="org.blockml.bml.core.ValueType"/>
</genericTypes>
```

```text
Declares type parameters on this Block (root, Sub-Block, or embedded — Java static nested model)
Element name  — parameter identifier used in type references (e.g. type="T")
baseType      — FQN constraint; concrete type arguments must satisfy this bound via satisfiesTypeBound
defaultType   — optional default when the type argument is omitted:
                  concrete TypeExpression (e.g. type:Decimal), or the name of an
                  earlier sibling parameter (e.g. defaultType="N") — declaration-order
                  only; cycles / forward refs forbidden. See 17_type_system_bml.md — defaultType.
Usage         — com.foo.Box<org.blockml.bml.type.Integer> at reference sites
Validator     — substitutes parameters at validate time; BML_GENERIC_CONSTRAINT_VIOLATION on mismatch

Generic parameters belong exclusively to the declaring Block — they are never inherited
implicitly and never visible on nested Sub-Blocks (no enclosing-instance / outer-T scope).
Forward explicitly: Outer(T) member type="Selector(T)" where Selector declares its own T.
When a generic Block is used as baseType, the derived Block must bind or forward
each parameter explicitly (for example baseType = PrimitiveEntity(Integer) binds T = Integer).
Resolution substitutes bound parameters in the inherited definition during validate time.
See 17_type_system_bml.md — § Generic resolution through inheritance · Generic parameter naming.

Naming (parse time, per declaring Block):
  element name must differ from the Block's <name>           → BML_GENERIC_BLOCK_NAME_COLLISION
  element name must differ from every direct Sub-Block <name> → BML_GENERIC_SUBBLOCK_NAME_COLLISION
  duplicate element name among genericTypes entries          → BML_DUPLICATE_GENERIC
  defaultType names later/unknown parameter                  → BML_GENERIC_DEFAULT_FORWARD_REF
  defaultType cycle                                          → BML_GENERIC_DEFAULT_CYCLE
  default chain does not ground                              → BML_GENERIC_DEFAULT_UNRESOLVED
```

See `17_type_system_bml.md` — Generics · `12_bom_object_model.md` — GenericType.

---

## Definition Branch (Meta-Model)

**FQN:** `org.blockml.bml.core.Definition` — abstract **identification marker** for all Definition meta-model blocks.

### `org.blockml.bml.core.Definition` — identification, not shape

`org.blockml.bml.core.Definition` is intentionally **empty** — no properties, aggregations, or Sub-Blocks. It declares only `name`, `type`, `baseType: org.blockml.bml.core.Block`, and `abstract`.

**Role:** branch identification. Any block whose `baseType` chain includes `org.blockml.bml.core.Definition` is a **Definition meta-model block** (`org.blockml.bml.definition.*`) — distinct from composable domain blocks, ValueTypes, Languages, Constraints, and services. The **concrete shape** lives on subtypes (`StructuralDefinition`, `BlockDefinition`, `PropertyDefinition`, `GenericTypeDefinition`, …); `core.Definition` itself does not model members.

**Uses in the meta-model:**

```text
Inheritance marker     — org.blockml.bml.definition.* blocks extend core.Definition (directly or via StructuralDefinition)
MemberReference.D      — generic parameter D on org.blockml.bml.type.MemberReference:
                           baseType def:MemberDefinition; bound by PropertyReference / …
genericTypes           — e.g. <D baseType="org.blockml.bml.core.Definition" defaultType="def:RootBlockDefinition"/>
Validator              — definitionBranch = "definitionBlock" when baseType chain includes core.Definition
bml:xml                — permitted on all blocks whose baseType chain includes core.Definition
```

**Design note:** Framework core branch types remain **`baseType` markers** (`ValueType`, `Entity`, `Language`, `Annotation`, …). Domain interface-style polymorphism uses **`<contracts>`** and **`satisfiesTypeBound`** — see `17_type_system_bml.md` — baseType vs contracts. Core branch types are not duplicated as interface contracts in `@blockml/core`.

### Annotation branch

**FQN:** `org.blockml.bml.core.Annotation` — abstract branch for annotation namespaces.

Annotations are **orthogonal to Definition**. They formalize BML-semantic `xmlns` targets that are not Packages: language directives (`BmlAnnotation`) and domain facets (`ScadAnnotation`). See `02_mbml.md` — § Annotations.

```text
org.blockml.bml.core.Block
  org.blockml.bml.core.Annotation
    preferredAlias · directives[]
    SubBlocks: Directive → Member(*) | Element | Attribute
               Member → Property | Aggregation | Association | Capability
               Element → Document(document) | Summary(summary) | Examples(examples) | Example(example) | Value(value)

org.blockml.bml.annotation.BmlAnnotation          preferredAlias=bml
com.machineblocks.bml.annotation.ScadAnnotation   preferredAlias=scad
```

Source: `packages/core/blocks/org/blockml/bml/core/Annotation.bml`

### Keyword and Alias branches

```text
org.blockml.bml.core.Entity
  org.blockml.bml.core.Keyword          abstract branch — domain vocabulary + free text
    org.blockml.bml.meta.FixedKeyword      catalogue base (protected members on definition)
      org.blockml.bml.meta.FreeTextKeyword   ad-hoc term — widens members to public (shorthand target)
  org.blockml.bml.core.Alias            abstract branch — domain catalogue + free text
    org.blockml.bml.meta.FixedAlias        catalogue base (protected members on definition)
      org.blockml.bml.meta.FreeTextAlias     ad-hoc name — widens members to public (shorthand target)
```

Domain libraries define concrete blocks extending `FixedKeyword` / `FixedAlias` for controlled vocabulary. `FreeTextKeyword` / `FreeTextAlias` extend the Fixed bases and override protected members as public attributes (`_term` → `term`, `_name` → `name`) via visibility widening. Comma-separated shorthand on `<keywords>` / `<aliases>` expands to **FreeTextKeyword** / **FreeTextAlias** instances only. See `02_mbml.md` — keywords · aliases · Member Visibility — Visibility on override.

### Task guides and diagnostics

```text
org.blockml.bml.core.Documentation     abstract — concept docs (org.blockml.bml.documentation.*)
org.blockml.bml.core.TaskGuide         abstract — procedural tasks (org.blockml.bml.task.*)
org.blockml.bml.core.Diagnostic        abstract — validator codes (org.blockml.bml.diagnostic.*)
```

Task navigation uses `<references>` with task relations — same mechanism as ReadFirst:

```text
relation=TaskIndex      on README — catalog available tasks
relation=TaskStep       on TaskGuide — ordered procedure steps
relation=Prerequisite   on TaskGuide — before starting
relation=Resolves       on Diagnostic — link to fix TaskGuide
```

See `02_mbml.md` — Task guides · `doc:TaskGuideModel`.

Source: `packages/core/blocks/org/blockml/bml/core/Definition.bml`

```text
org.blockml.bml.core.Block
  org.blockml.bml.core.Definition                    ← empty identification marker (complete)
    org.blockml.bml.definition.StructuralDefinition
      org.blockml.bml.definition.ConstrainableDefinition  ← abstract; <constraints> container
        org.blockml.bml.definition.BlockDefinition
          org.blockml.bml.definition.SubBlockDefinition
          org.blockml.bml.definition.EmbeddedBlockDefinition
          org.blockml.bml.definition.RootBlockDefinition
        org.blockml.bml.definition.MemberDefinition
          org.blockml.bml.definition.PropertyDefinition
          org.blockml.bml.definition.AggregationDefinition
          org.blockml.bml.definition.AssociationDefinition
          org.blockml.bml.definition.CapabilityDefinition
      inline Sub-Blocks (declared in StructuralDefinition.bml — not separate library exports):
        StructuralDefinition.Documentation             ← <documentation> element (StructType branch)
        StructuralDefinition.Change                    ← one <change> in <changelog>
        StructuralDefinition.Example                   ← one <example> in <examples>
        StructuralDefinition.Reference                 ← one <see> in <references>
    org.blockml.bml.definition.GenericTypeDefinition
    …
```

`org.blockml.bml.definition.StructuralDefinition` declares the shared documentation model and type modifiers:

```text
Properties:    since · status · summary · documentation (Documentation) · abstract · final
Aggregations:  keywords (core:Keyword[]) · changelog (Change[]) · examples (Example[]) · references (Reference[])
Sub-blocks:    Documentation · Change · Example · Reference   ← inline in StructuralDefinition.bml
Source:        packages/core/blocks/org/blockml/bml/definition/StructuralDefinition.bml
```

`abstract`, `final`, and `override` are local declaration properties — not inherited. On block
definitions, `abstract` and `final` control type instantiability and extensibility. On member
declarations, `abstract="true"` marks an incomplete local declaration that creates an implementation
obligation for concrete descendants. `override="true"` must be set on every local redeclaration
that merges with a baseType or contract member — including contract completion. Omission →
`BML_OVERRIDE_REQUIRED`.
A locally concrete override (abstract defaults to false) satisfies an abstract implementation obligation
when complete for the member kind. To keep a member abstract in a child block, explicitly declare
`abstract="true"` on that redeclaration. `final="true"` on any declaring layer prevents redeclaration
in child blocks.

`org.blockml.bml.core.Block` declares `language` (NaturalLanguage) — root default English. Library descriptors inherit via BlockLibrary.

`org.blockml.bml.definition.BlockDefinition` declares the shared shape of all Block definition documents: identity (`name`, `type`, `baseType`, `version`), designation (`is`, `isnot`), abstract `definition` (meta-model role selector), `summary` and `keywords` aggregation (`core:Keyword[]`, inherited from StructuralDefinition), `aliases` aggregation (`core:Alias[]`, block-level), `language` (NaturalLanguage element — per-block override), member containers (`properties`, `aggregations`, `associations`, `capabilities`), `subBlocks` (recursive Sub-Block hierarchy), and block-level collections (`genericTypes`, `contracts`). Generic meta-type parameter `B extends org.blockml.bml.core.Block` binds the definition to the Block type it describes.

`org.blockml.bml.definition.SubBlockDefinition`, `RootBlockDefinition`, and `EmbeddedBlockDefinition` are **sibling** specializations of `BlockDefinition` that each override `definition` with a tighter TypeReference and default (`SubBlockDefinition` / `RootBlockDefinition` / `EmbeddedBlockDefinition`). `RootBlockDefinition` additionally declares `embeddedBlocks` (`EmbeddedBlockDefinition[]` — virtual files, root-only). `EmbeddedBlockDefinition` has no nested embeds. `subBlocks` is inherited from `BlockDefinition` and may nest to arbitrary depth on roots, embeds, and Sub-Blocks.

`org.blockml.bml.definition.StructuralDefinition.Reference` — inline Sub-Block; **documentation** cross-reference connecting **types to types** or **types to instances** (also definition members, files, URLs). Not an instance-to-instance model link — those are Associations. See `02_mbml.md` — Associations vs References.

```text
FQN             org.blockml.bml.definition.StructuralDefinition.Reference (Sub-Block — not a top-level library export)
baseType        org.blockml.bml.core.Entity
bml:xml         see                — renders as <see> inside <references>
type            QName (prefix:Name) — Block or Definition type via xmlns prefix; XML type attribute; or Block FQN qualifier with member/instance attribute
instance        String             — InstanceReference token (myId or FQN::id); XML instance attribute
file            String             — repository markdown file; XML file attribute
url             String             — external URL; XML url attribute
property        String             — PropertyDefinition canonical path; XML property attribute
aggregation     String             — AggregationDefinition canonical path; XML aggregation attribute
association     String             — AssociationDefinition canonical path; XML association attribute
capability      String             — CapabilityDefinition canonical path; XML capability attribute
relation        Relation           — optional; relationship category; XML relation attribute; default SeeAlso
language        NaturalLanguage    — optional; prose language override for context text
context         String (required)  — relationship note; XML text content
```

Exactly one target kind among `type` (standalone), `instance`, `file`, `url`, `property`, `aggregation`, `association`, and `capability` must be set. Split form: `type=` + one member attribute resolves to a canonical member path — `type` is not stored as a type target. Split form: `type=` + `instance=` resolves to `{FQN}::{id}`. `relation` is optional — omitted → `org.blockml.bml.relation.SeeAlso`. Unqualified names on `relation=` resolve via `org.blockml.bml.relation.*`.

Standard relation blocks (`org.blockml.bml.relation.*`): `SeeAlso` (default when omitted), `ReadFirst`, `ReadNext`, `ThenContinueWith`, `Extends`, `Requires`, `ContrastsWith`, `AuthoringGuide`, `Defines`, `DeepDive`, `TaskIndex`, `TaskStep`, `Prerequisite`, `Resolves`. Abstract bases: `org.blockml.bml.core.Relation` (any target kind); `org.blockml.bml.core.TypeRelation(T)` (only `see type=`, target must satisfy `satisfiesTypeBound(…, T)`, default `T = core:Block`). `ThenContinueWith` is `TypeRelation(core:Bootstrap)`.

**Design note:** Eight mutually exclusive target attributes instead of one generic `target`. The attribute name encodes the target kind at the read site — `<see type="…">` (`TypeReference`), `<see instance="…">` (`InstanceReference`), `<see property="…">` (`PropertyReference`), `<see aggregation="…">` / `<see association="…">` / `<see capability="…">` (matching MemberReference children), `<see file="…">` (doc), `<see url="…">` (web). Member values are canonical definition paths in the BOM. See `02_mbml.md` — `<references>` — Why separate target attributes.

Authoring: list only targets **relevant to the current definition**; text body describes the relationship. All cross-links belong in `<references>` — never in `<documentation>`. See `02_mbml.md` — `<documentation>` · `<references>`.

`org.blockml.bml.definition.StructuralDefinition.Change` — inline Sub-Block; one changelog entry in a `<changelog>` container:

```text
FQN             org.blockml.bml.definition.StructuralDefinition.Change (Sub-Block)
baseType        org.blockml.bml.core.Entity
bml:xml         change             — renders as <change> inside <changelog>
version         Version (required) — XML version attribute
language        NaturalLanguage    — optional; prose language override for description text
description     String (required)  — trimmed text body
```

`org.blockml.bml.definition.StructuralDefinition.Example` — inline Sub-Block; one usage example in an `<examples>` container:

```text
FQN             org.blockml.bml.definition.StructuralDefinition.Example (Sub-Block)
baseType        org.blockml.bml.core.Entity
bml:xml         example            — renders as <example> inside <examples>
title           String (required)  — XML title attribute; always in block natural language
language        Language FQN       — optional; implementation dialect or NaturalLanguage for content
snippet         Boolean            — optional; default false — illustrative fragment, skip syntax checks
content         String (required)  — CDATA body
```

`org.blockml.bml.definition.StructuralDefinition.Documentation` — inline Sub-Block; one technical prose entry on any StructuralDefinition element. Authors may repeat the element for **i18n** (`language=`) and for **QName facets** (`scad:document`, …). Facet namespaces are **not** NaturalLanguage / i18n. Examples containers follow the same Annotation-facet pattern via `Annotation.Examples` (`scad:examples`, …). Paired target-language samples use `Annotation.Example` (`scad:example` sibling of `<example>` under the same `<examples>`).

```text
FQN             org.blockml.bml.definition.StructuralDefinition.Documentation (Sub-Block)
baseType        org.blockml.bml.type.StructType
bml:xml         documentation      — renders as <documentation> or prefixed localName documentation
namespace       from element QName — "" = canonical facet; never a locale
language        NaturalLanguage    — optional attribute; omitted → effective Block/Library language
content         String (required)  — trimmed text body
BOM             documentations[] DocumentationProseEntry { namespace, text, languageFqn }
identity        (namespace, "documentation", languageFqn) — duplicate → BML_DUPLICATE_DOCUMENTATION
```

`org.blockml.bml.definition.StructuralDefinition.summary` follows the same multiplicity: BOM `summaries[]` as `DocumentationProseEntry`, identity `(namespace, "summary", languageFqn)`, duplicate → `BML_DUPLICATE_SUMMARY`. See `02_mbml.md` — Documentation facets and i18n.

Each Definition block may declare **`bml:xml`** — how instances serialize to canonical BML XML (root element name, member as attribute/element/text/cdata). The meta-model is **work in progress**; full specification in `19_definition_blocks_and_bml_xml.md`.

`org.blockml.bml.core.Block` itself carries `<bml:xml>${ bml:Self }</bml:xml>` — composable instances render under their declared type tag. Definition blocks describe the grammar; ordinary domain blocks consume it.

### Definition Addressing

Definition elements are addressed via **canonical structural paths** within the Block FQN. The path mirrors the BML document structure:

```text
com.foo.Bar.name                    →  Block metadata
com.foo.Bar.documentation           →  primary documentation (default NS + effective language)
com.foo.Bar.documentations          →  StructuralDefinition.documentations[] (DocumentationProseEntry)
com.foo.Bar.summary                 →  primary summary (default NS + effective language)
com.foo.Bar.summaries               →  StructuralDefinition.summaries[] (DocumentationProseEntry)
com.foo.Bar.keywords                 →  StructuralDefinition.keywords (KeywordEntry[])
com.foo.Bar.isnot                      →  BlockDefinition.not (block-level only)
com.foo.Bar.aliases                  →  BlockDefinition.aliases (AliasEntry[]; block-level only)
com.foo.Bar.properties.width.summary → primary PropertyDefinition summary
com.foo.Bar.properties.width.summaries → PropertyDefinition.summaries[]
com.foo.Bar.properties.width.keywords → PropertyDefinition.keywords
com.foo.Bar.properties.width.documentations → PropertyDefinition.documentations[]
com.foo.Bar.version                 →  Block version
com.foo.Bar.properties.width        →  PropertyDefinition
com.foo.Bar.aggregations.children   →  AggregationDefinition
com.foo.Bar.associations.parent     →  AssociationDefinition
com.foo.Bar.capabilities.render     →  CapabilityDefinition
com.foo.Bar.genericTypes.T          →  GenericTypeDefinition (described Block's type parameter)
com.foo.Bar.definition              →  Definition meta-model type FQN (default RootBlockDefinition)
com.foo.Bar.subBlocks.Inner.definition → Definition meta-model type FQN (default SubBlockDefinition)
com.foo.Bar.subBlocks.Inner         →  nested BlockDefinition (FQN = com.foo.Bar.Inner)
com.foo.Bar.subBlocks.Outer.subBlocks.Inner → nested Sub-Block at arbitrary depth
com.foo.internal.Physics            →  embedded BlockDefinition (FQN = embedded block &lt;type&gt;)
com.foo.internal.Physics.definition →  Definition meta-model type FQN (default EmbeddedBlockDefinition)
com.foo.internal.Physics.subBlocks.Force → Sub-Block on embedded block (FQN = com.foo.internal.Physics.Force)
com.foo.internal.Physics.properties.width →  PropertyDefinition on embedded block
com.foo.Bar.contracts               →  contract references
```

`org.blockml.bml.definition.BlockDefinition` is itself a Block with generic type parameter `B extends org.blockml.bml.core.Block` — conceptually `BlockDefinition<com.foo.Bar>` when describing `com.foo.Bar`. The described Block's own `<genericTypes>` aggregation (e.g. `T` on `Box<T>`) is separate from this meta-type parameter. `BlockDefinition` declares abstract `definition` and `subBlocks`. `SubBlockDefinition`, `RootBlockDefinition`, and `EmbeddedBlockDefinition` are sibling specializations that each override `definition`. Document roots use `RootBlockDefinition` (adds `embeddedBlocks`). Virtual files use `EmbeddedBlockDefinition`.

No special definition-reference constructs (`bml:Def`, flat `com.foo.Bar.memberName`) are used. `bml:Self` remains available for **type references** only (`type="bml:Self"`), not for definition navigation.

BML member containers map to a flat `members: MemberDefinition[]` in the BOM (tagged by `kind`). Reflection resolves canonical paths via the structural containers at query time.

Definition blocks may declare their own Capabilities — enabling domain-specific definition types with additional behaviour (for example `validateDefinition()`, `generateDocumentation()`) without core changes.

---

## Root Type Exception

`org.blockml.bml.core.Block` is the **sole inheritance root**. It **omits** `<baseType>` — the only definition allowed to do so. All other definitions must declare a non-empty parent FQN in `<baseType>`.

All other definitions must declare `<baseType>`. Framework branches inherit via `org.blockml.bml.core.ValueType`, `org.blockml.bml.core.Language`, `org.blockml.bml.core.Unit`, or domain bases — all ultimately extend `org.blockml.bml.core.Block`. See `17_type_system_bml.md`.

---

## Bootstrap Order

The compiler **bootstraps from its own BML** — self-hosting at the TypeRegistry level. Framework packages are not special-cased in code; they are loaded first because later definitions depend on them.

```text
1. @blockml/core BML                    ← BlockML describes BlockML
     org/blockml/bml/core/Block.bml
     org/blockml/bml/core/Status.bml
     org/blockml/bml/core/Relation.bml
     org/blockml/bml/core/TypeRelation.bml   ← TypeRelation(T); default T = core:Block; type-target only
     org/blockml/bml/status/Stable.bml · Draft.bml · Stub.bml · Deprecated.bml
     org/blockml/bml/relation/SeeAlso.bml · ReadFirst.bml · ReadNext.bml · ThenContinueWith.bml · Extends.bml · Requires.bml · ContrastsWith.bml · AuthoringGuide.bml · Defines.bml · DeepDive.bml · TaskIndex.bml · TaskStep.bml · Prerequisite.bml · Resolves.bml
     # ThenContinueWith = TypeRelation(core:Bootstrap)
     org/blockml/bml/core/Documentation.bml · TaskGuide.bml · Diagnostic.bml
     org/blockml/bml/core/Keyword.bml · Alias.bml
     org/blockml/bml/meta/FixedKeyword.bml · FixedAlias.bml
     org/blockml/bml/meta/FreeTextKeyword.bml · FreeTextAlias.bml   ← extend Fixed*; widen to public
     org/blockml/bml/core/ValueType.bml · PrimitiveType.bml · StructType.bml · EnumType.bml · ConstantType.bml · …
     org/blockml/bml/core/Constraint.bml
     org/blockml/bml/constraint/*.bml        ← ValueConstraint, StructuralConstraint, BlockConstraint, Min, …
     org/blockml/bml/core/Validation.bml
     org/blockml/bml/validation/Error.bml · Warning.bml · Information.bml · …
     org/blockml/bml/core/
     org/blockml/bml/core/Language.bml · ProgrammingLanguage.bml · MarkupLanguage.bml
     org/blockml/bml/core/Unit.bml
     org/blockml/bml/unit/None.bml · Millimeter.bml · Centimeter.bml · Meter.bml · Inch.bml
     org/blockml/bml/type/Number.bml · Integer.bml · Decimal.bml · Float.bml · Text.bml · Boolean.bml · Constant.bml · …
     org/blockml/bml/type/Version.bml · URL.bml · URI.bml · FilePath.bml · MimeType.bml
     org/blockml/bml/core/PrimitiveEntity.bml
     org/blockml/bml/type/TypeReference.bml · TypeReferenceEntity.bml
     org/blockml/bml/type/MemberReference.bml · PropertyReference.bml · AggregationReference.bml · AssociationReference.bml · CapabilityReference.bml · InstanceReference.bml
     org/blockml/bml/type/IntegerEntity.bml · TextEntity.bml · …
     org/blockml/bml/language/NaturalLanguage.bml · TypeScript.bml · OpenSCAD.bml · English.bml · German.bml · PseudoCode.bml
     org/blockml/bml/service/Math.bml · Strings.bml · …
     org/blockml/bml/core/BlockLibrary.bml   ← readMe / bootstrap / dependencies / subLibraries / blocks as TypeReferenceEntity; schemas as FilePathEntity
     org/blockml/bml/core/ReadMe.bml · Bootstrap.bml
     org/blockml/bml/README.bml              ← extends ReadMe
     org/blockml/bml/core/Definition.bml     ← empty Definition-branch identification marker
     org/blockml/bml/definition/*.bml        ← StructuralDefinition (inline Documentation/Change/Example/Reference), BlockDefinition, MemberDefinition, …

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

`09_mbom_properties.yml` may retain transitional **SCAD render hints** keyed by property name (must follow NativeBlock):

```yaml
- name: size
  scad_name: size
  serializer: SizeXYZ
  scad_customizer: …
```

Validator matches BML property declarations against YAML entries for SCAD target completeness. Missing YAML entry → warning at render time, not parse time.

Full property migration from YAML → BML proceeds incrementally; structure and modifiers land first.

---

## Package Layout

Membership is defined by each `Library.bml` `blocks` list — not by directory. Nested libraries are independent units:

```text
packages/core/blocks/
  org/blockml/bml/
    Library.bml                             ← org.blockml.bml.Library (concrete library)
  org/blockml/bml/core/
    BlockLibrary.bml · Block.bml · …        ← BlockLibrary = framework base type, not in Library blocks
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
| MB native params / types | `NativeBlock.bml` + `type/*.bml` |
| SCAD property hints (transitional) | `09_mbom_properties.yml` (must follow NativeBlock) |
| Value types · languages (BML) | `17_type_system_bml.md` |
| Constraints · suggestions | `18_constraints_and_suggestions.md` |
| Definition blocks · bml:xml | `19_definition_blocks_and_bml_xml.md` |
