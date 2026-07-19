# BML → BOM Mapping

version: 0.2.0

## Purpose of this Document

This document defines the **algorithmic mapping rules** from parsed BML XML to `BomDocument` — the implementation contract for `@blockml/parser`.

**Phase A:** implement only § V1 Parser / Serializer Scope below; the rest of this document is the full language contract to grow into.

For BOM target types see `12_bom_object_model.md`.
For BML authoring syntax see `02_mbml.md`.
For expression parsing see `10_expression_language.md`.
For compiler pipeline placement see `06_compiler.md`.

Mapping rules are registered per root type (`<block>`, …) — not hardcoded in the parser core. V1 has a single root type: `<block>`.

---

## Fundamental Rule

> **BML → BOM → BML must always be possible.** The mapper preserves authored structure and authored values. It makes no interpretive decisions. See `01_bom_core.md` — Fundamental Architecture Principles.

```text
Mapper responsibility:     structure + classification + preservation
NOT mapper responsibility: canonicalization, expansion, merge, evaluation
```

---

## Pipeline Placement

```text
Parser steps (Stage 1 — see 06_compiler.md Stage numbering glossary):
[4] Namespace Resolver     → FQN prefix bindings
[5] BML → BOM Mapper       → this document (structure + attribute classification) → Canonical BOM
```

Expression parsing, type validation, and semantic validation are **Stage 2** (`@blockml/validator` + `@blockml/core` utilities) — not parser steps. See `06_compiler.md` — Framework Utilities.

Parser step [5] produces the immutable BOM graph with expression **raw** text only. `parseExpression()` is a separate Stage-2 utility (Phase B+).

---

## V1 Parser / Serializer Scope (Phase A)

> **Normative for Phase A.** Full mapping rules in this document describe the language contract; **implement and gate** only the slice below until roundtrip tests pass. See `15_dev_setup.md` — V1 Implementation Strategy.

| In V1 (Phase A) | Not in V1 (Phase A) |
|---|---|
| XML `.bml` only (parser steps `[1]`–`[5]`) | JSON authoring (not planned — see § JSON BML) |
| Structural map → immutable Urmodell | Semantic validation (Stage 2) |
| Authored literals + `ExpressionValue { raw }` | `parseExpression()` / AST / evaluation |
| Directives stored in `directives[]` (unexpanded) | Directive expansion / composition expand |
| **Single-file** parse (no library load) | TypeRegistry bootstrap / cross-file resolve |
| Hardcoded mapper + hardcoded inverse serializer | Meta-driven `bml:xml` parser/serializer (`19_…`) |
| Well-formed XML + mapping diagnostics | **XSD as a hard parse requirement** |
| Preserve `bml:xml` / unknown-safe authored form for roundtrip | Interpret Definition/`bml:xml` grammar at parse time |
| Roundtrip corpus T0–T3 | `bom compile` / render targets |

**XSD:** Not part of Phase-A Stage 1. Hand-written schemas / `catalog.xml` may remain a temporary **IDE aid**, but:

- **XSD generation** is a **Render Target** (Stage 3): compile BML / Definition meta-model → `.xsd` artifacts (see `19_definition_blocks_and_bml_xml.md` — D5 · `15_dev_setup.md` — Phase C ordering).
- **XSD validation** of authoring (CLI / IDE / optional parser hook against generated schemas) comes **only after** that target exists — and must remain **always disableable**.
- **Why disableable:** After intentional BML/meta changes, authoring may no longer match the *previous* `.xsd`. Users must still be able to run the XSD target to emit the *new* schemas (chicken-and-egg). Hard-failing schema validation would block regeneration.
- Default may be “on” once schemas exist; escape hatch is mandatory: CLI **`--no-xsd`** and config **`xsdValidation: false`** (both — see `07_cli.md` — XSD validation escape hatch).

V1 parser must not require schema files to succeed. Schema checks are not a Phase-A gate.

**`bml:xml`:** Authored directives/elements are preserved on the Urmodell when present (lossless). V1 does **not** drive mapping or serialization from Definition blocks — that is post–Phase-A (`19_definition_blocks_and_bml_xml.md`).

**Done when:**

```text
parse(serialize(parse(corpus.bml))) deep-equals parse(corpus.bml)
```

on the agreed corpus tiers — no validator, no target, no TypeRegistry bootstrap required.

## Member Mapping Order

When mapping `<block>` definitions, member elements are appended to `BlockDefinition.members[]` **in BML document order**. The **element name** is the member name — there is no `name="..."` attribute:

```text
<properties>    → each child element in XML order (element name = property name)
<aggregations>  → each child element in XML order (element name = aggregation name)
<associations>  → each child element in XML order (element name = association name)
<capabilities>  → each child element in XML order (element name = capability name)
```

```text
MUST NOT sort by name, kind, or typeFqn
MUST NOT merge sections out of document sequence
MAY omit empty sections (<properties> absent → skip)
```

Ordinal = index in `members[]` after mapping. Used by renderers when interpreting StructType array literals against field declaration order, by default SCAD StructType array serialization, and by FunctionMapping for positional capability parameters. See `17_type_system_bml.md` — Declaration Order · `22_function_mapping.md` · `12_bom_object_model.md` — Member Declaration Order.

### Canonical definition paths

BML member containers are preserved structurally in the meta-model (`org.blockml.bml.definition.BlockDefinition` and its sibling specializations `SubBlockDefinition`, `EmbeddedBlockDefinition`, `RootBlockDefinition`). The BOM stores members in a flat `members[]` array tagged by `kind` (`property`, `aggregation`, `association`, `capability`). Reflection and expression evaluation resolve canonical paths via the structural containers:

```text
com.foo.Bar.properties.width   →  members[] entry where kind="property" and name="width"
com.foo.Bar.aggregations.parts →  members[] entry where kind="aggregation" and name="parts"
com.foo.Bar.capabilities.render → members[] entry where kind="capability" and name="render"
```

Block metadata (`name`, `is`, `summary`, `keywords`, `documentation`, `isnot`, `aliases`, `version`, `baseType`, `definitionFqn`, …) maps to top-level `BlockDefinition` fields — addressable directly under the Block FQN without a container segment. See `01_bom_core.md` — § Canonical definition paths · `16_framework_base_types.md` — § Definition Addressing.

---

## Design Decisions

| Topic | Decision |
|---|---|
| **Lossless round-trip** | BOM preserves authored literal syntax — `[5,5,6]` and `{x:5,y:5,z:6}` stored as authored, not normalized |
| **Directives** | Stored as `directives[]` on the element — not expanded at parse time |
| **Registry** | **Removed.** Sibling value sharing via `bml:with` on `<composition>` or `<bml:container>` |
| **Attribute classification** | Fixed priority chain — see § Attribute Classification below |
| **Unknown member attributes** | Warning `BML_UNKNOWN_PROPERTY` at validate (custom property assumed) |
| **Unknown `bml:*` attributes** | Error `BML_UNKNOWN_DIRECTIVE` at map time |
| **`inputType` / `outputType`** | Parsed into `TypeDescriptor` at map time — anonymous `{ a: Float }` = anonymous struct type |
| **Expression parsing** | Parser stores `raw` in BOM; `parseExpression()` utility builds AST (separate result) |
| **Cross-file resolution** | Single-file parser; TypeRegistry bootstrap by CLI/orchestrator before validate |
| **JSON authoring format** | **Not planned** as equivalent BML. V1/V2 parser accepts XML only (`.bml`). See § JSON BML |
| **Composition render** | Leaf geometry → NativeBlock → `mb_block()`; see `14_compiler_runtime.md` |
| **Member order** | Properties, aggregations, associations, capabilities appended in BML document order — **never sorted**; see `12_bom_object_model.md` — Member Declaration Order |

---

## Attribute Classification

When mapping an XML element to a BOM node, every attribute is classified using this **fixed priority chain**. The first matching rule wins.

```text
1. xmlns*, xsi:*              → ignore (except xmlns bindings → SourceInfo.namespaceBindings)
2. bml:*                      → see § Rule 2 — meta (bml:id, bml:version) or directives[]
3. All other attributes       → memberValues[name]  (camelCase property/capability values)
```

### Rule 1 — XML infrastructure

```text
xmlns:bricks="com.machineblocks.bml.bricks"   → namespaceBindings["bricks"]
xsi:schemaLocation="..."                  → ignored
```

### Rule 2 — `bml:*` attributes

**Composition meta** (Block instances only) — stored on `BlockInstance` fields, not in `directives[]`:

| Attribute | BOM field |
|---|---|
| `bml:id` | `BlockInstance.id` (`MemberValue`) |
| `bml:version` | `BlockInstance.version` (`MemberValue`) |
| `bml:bean` | `BlockInstance.bean` (`MemberValue`) |
| `bml:scope` | `BlockInstance.scope` (`"local"` \| `"context"`) |
| `bml:status` | `statusFqn` on the element when declared (deviation from inherited effective status) |

**Flow-control directives** — stored in `directives[]` on the same element (Thymeleaf model):

| Attribute | AST type |
|---|---|
| `bml:each` | `EachDirective` |
| `bml:if` | `IfDirective` |
| `bml:unless` | `UnlessDirective` |
| `bml:with` | `WithDirective` |

Any other `bml:*` attribute name → **`BML_UNKNOWN_DIRECTIVE` (error)**. Examples: `bml:foo`, typos like `bml:ech`.

Known directive on a disallowed element (see placement rules in `12_bom_object_model.md`) → **`BML_DIRECTIVE_NOT_ALLOWED` (error)**.

Directive and meta values that contain `${ }` are stored as `ExpressionValue { raw }` in Canonical BOM. AST via `parseExpression()` utility.

### Rule 3 — Member values

All remaining attributes become `memberValues[name]`:

```text
size="[1, 8, 9]"           → memberValues.size (LiteralValue or ExpressionValue)
id="wall"                    → memberValues.id   (only when Block type declares id Property)
version="1.0.0"              → memberValues.version (only when Block type declares version Property)
blockId="wall"               → memberValues.blockId
onResized="stud://..."       → memberValues.onResized (AddressValue or ExpressionValue)
```

Use **`bml:id`** / **`bml:version`** for composition instance identity and external reference version — not bare attributes.

Value classification within rule 3:

```text
${ ... }                     → ExpressionValue { raw }  (AST via parseExpression() utility)
address-shaped capability    → AddressValue
otherwise                    → LiteralValue (authored value preserved — type-checked in Stage 2)
```

Unknown member names survive rule 3 and are stored in `memberValues`. The semantic validator emits **`BML_UNKNOWN_PROPERTY` (warning)** — custom property assumed. See § Unknown Attributes below.

### Unknown Attributes

| Case | When | Severity | Code |
|---|---|---|---|
| Unknown member on instance | Validate — name not in effective members | **Warning** | `BML_UNKNOWN_PROPERTY` |
| readOnly member on instance | Validate — effective member has readOnly=true | **Error** | `BML_READONLY_MEMBER_WRITE` |
| Unknown `bml:*` name | Map — not in allowed directive list | **Error** | `BML_UNKNOWN_DIRECTIVE` |
| Known `bml:*` on wrong element | Map or validate — placement rule violated | **Error** | `BML_DIRECTIVE_NOT_ALLOWED` |
| `namespace="…"` on member element | Map | **Error** | `BML_DEPRECATED_MEMBER_NAMESPACE_ATTR` |

Unlike member attributes, **`bml:*` is never silently ignored** — unknown or misplaced directives always fail compilation.

### Worked Example

Input:

```xml
<bricks:StandardBrick
    bml:version="3.0.0"
    bml:id="${ 'val_' + i }"
    bml:each="i : ${ numberOfSamples }"
    size="[1, 1, 1]"
    renderGroup="calibration" />
```

Output (`BlockInstanceNode`):

```text
instance:
  typeFqn:     com.machineblocks.bml.bricks.StandardBrick
  version:     LiteralValue("3.0.0")
  renderGroup: "calibration"
  id:          ExpressionValue
  memberValues:
    size: LiteralValue
directives:
  [EachDirective { variables: ["i"], collection: ExpressionValue }]
```

---

## Type Descriptor Parsing

Capability and property type attributes are parsed into **`TypeExpression`** objects at map time (V1 alias: `TypeDescriptor`) — not stored as raw strings. Lives in **`@blockml/core`** BOM interfaces — not in `org.blockml.bml.type.*`. See `01_bom_core.md` — Mandatory BML namespace · `17_type_system_bml.md` — Type Expressions.

Unqualified names at **specialized reference sites** resolve via context-bound implicit namespace — see `02_mbml.md` — § Context-Bound Implicit Namespace:

```text
Property.type / Capability.inputType / outputType  →  org.blockml.bml.type.*
Implementation.language                           →  org.blockml.bml.language.*
<status> / bml:status                               →  org.blockml.bml.status.*
Capability.type                                     →  org.blockml.bml.capability.*
Constraint.validation                               →  org.blockml.bml.validation.*
```

General block references (aggregation type, association type, composition tags, baseType) have no implicit namespace — require FQN or `xmlns:` prefix.

```text
<aggregation type="core:BlockLibrary[]" .../>   on org.blockml.bml.core.BlockLibrary
  → NamedTypeReference { fqn: "org.blockml.bml.core.BlockLibrary" }

inputType="Float"
  → NamedTypeReference { fqn: "org.blockml.bml.type.Float" }

inputType="{ a: Float, b: Float }"
  → AnonymousStructType {
       fields: [
         { name: "a", type: NamedTypeReference(Float) },
         { name: "b", type: NamedTypeReference(Float) }
       ]
     }
```

Conceptually, `{ a: Float, b: Float }` is shorthand for an anonymous class with private fields `a` and `b` — see `12_bom_object_model.md` — Type Descriptors.

Single-parameter Transformation Capabilities use a primitive `NamedTypeReference` directly — no one-field struct wrapper.

Validation by Capability type:

```text
Inbound         — inputType required, outputType forbidden
Outbound        — outputType required, inputType forbidden
Transformation  — inputType and outputType both required
```

Parse failure → `BML_UNKNOWN_TYPE`.

### `<implementation>` mapping

Child of `<capability>`. Maps to `CapabilityDefinition.implementation`:

```text
<implementation language="org.blockml.bml.language.TypeScript"><![CDATA[ ... ]]></implementation>
  → ImplementationBlock {
       languageFqn: "org.blockml.bml.language.TypeScript",
       source: CDATA body (trimmed)
     }
```

Rules:

```text
language attribute   — required; must be org.blockml.bml.language.* FQN
Missing language     → BML_MISSING_IMPLEMENTATION_LANGUAGE (error)
Unknown language FQN → BML_IMPLEMENTATION_UNKNOWN_LANGUAGE (error)
```

V1 known languages: `org.blockml.bml.language.TypeScript`, `org.blockml.bml.language.OpenSCAD`.

Whether the active Target/renderer can execute or emit that language is a Target concern — not a per-Block authoring whitelist.

### Type modifiers

Optional elements on `<block>` — mapped to `BlockDefinition` fields. See `16_framework_base_types.md`.

```text
<is>…</is>                               → block.is (trimmed text)
<summary>…</summary>                     → summaries[] DocumentationProseEntry
                                           { namespace: "" | resolved QName NS, text, languageFqn }
  <summary language="…">                 → languageFqn from attribute; else effective Block/Library language
  <scad:summary>…</scad:summary>         → namespace from xmlns:scad (facet — not i18n)
<keywords>                                   → keywords[] KeywordEntry; shorthand → FreeTextKeyword only
  <meta:FreeTextKeyword term="…" />          → { typeFqn: FreeTextKeyword, term, languageFqn?, weight? }
  <domain:Inheritance />                     → { typeFqn: domain keyword block }  (example)
<isnot>…</isnot>                                 → block.isnot (trimmed text); block definitions only
<aliases>                                    → aliases[] AliasEntry; shorthand → FreeTextAlias only
  <meta:FreeTextAlias name="…" />            → { typeFqn: FreeTextAlias, name, languageFqn?, legacy? }
<language>…</language>                       → block.languageFqn (NaturalLanguage FQN)
<documentation language="…">…</documentation> → documentations[] DocumentationProseEntry
                                           { namespace: "" | resolved QName NS, text, languageFqn }
  <scad:document>…</scad:document> → facet entry; namespace from xmlns — not for locales
<since>…</since>                             → block.since (trimmed text)
<changelog>                                  → block.changelog[]
  <change version="…" language="…">…</change> → { version, text: trimmed body, languageFqn? }
<examples>                                   → block.examples[] (mixed canonical + Annotation Example siblings)
  <example title="…" language="…" snippet="…"> → { title, content, contentLanguageFqn?, snippet?, namespace: "" }
  <scad:example title="…" language="…" snippet="…"> → { title, content, contentLanguageFqn?, snippet?, namespace: resolved Annotation FQN }
  <scad:examples>…</scad:examples>           → independent container; namespace from xmlns:scad on each child example
    <example …>                              → { …, namespace: resolved Annotation FQN }
<references>                                 → block.references[]
  <see type="…" relation="…" language="…">…</see>         → { type, relationFqn?, context, languageFqn? }
  <see instance="…" relation="…" language="…">…</see>      → { instance, relationFqn?, context, languageFqn? }
  <see file="…" relation="…" language="…">…</see>          → { file, relationFqn?, context, languageFqn? }
  <see url="…" relation="…" language="…">…</see>           → { url, relationFqn?, context, languageFqn? }
  <see property="…" relation="…" language="…">…</see>      → { property: canonicalPath, relationFqn?, context, languageFqn? }
  <see aggregation="…" …>…</see>                           → { aggregation: canonicalPath, … }
  <see association="…" …>…</see>                           → { association: canonicalPath, … }
  <see capability="…" …>…</see>                            → { capability: canonicalPath, … }
  <see type="…" property="…" …>…</see>                     → { property: resolve(type)+".properties."+name, … }  (type not stored)
  <see type="…" capability="…" …>…</see>                   → { capability: resolve(type)+".capabilities."+name, … }
  <see type="…" instance="…" …>…</see>                     → { instance: resolve(type)+"::"+id, … }  (type not stored)
<status>Draft</status>                → member.statusFqn or block.statusFqn (when declared)
                                             → omitted: inherit effective status from parent
<name>…</name>                               → block.name
<type>foo:MyBlock</type>                     → block.type (FQN; TypeReference property text;
                                               root block only — derived on Sub-Blocks)
<baseType>core:Block</baseType>              → block.baseType (FQN / TypeExpression string;
                                               generics allowed, e.g. PrimitiveEntity(Integer))
<version>…</version>                         → block.version
<abstract>true</abstract>                    → block.abstract = true
<final>true</final>                          → block.final = true
<visibility>…</visibility>                   → block.visibility (Sub-Block only; root → BML_VISIBILITY_ON_ROOT_BLOCK)
<ac:Wall />                                  → block.contracts[]   (TypeReference(core:Block)[] child; root block only)
`<definition>RootBlockDefinition</definition>` → `block.definitionFqn`. Default depends on parse context: Sub-Blocks → `SubBlockDefinition`; document root → `RootBlockDefinition`; embedded virtual files → `EmbeddedBlockDefinition`. Explicit `<definition>` must be compatible with block role (`BML_DEFINITION_TYPE_MISMATCH`).
<baseType="…"/>                            → block.genericTypes[] { name: element local name, baseType, defaultType? } (any Block definition — root, Sub-Block, embedded)
```

`<subBlocks>` and `<embeddedBlocks>` (Inline Library) map to `block.subBlocks[]` and `block.embeddedBlocks[]` respectively — each child `<block>` parsed recursively as a nested `BlockDefinition`. Sub-Block FQN is derived from the immediate enclosing block as `resolve(parent.type) + "." + name`; embedded block FQN is `resolve(type)` (the `<type>` element value). `embeddedBlocks` is parsed only on the document root; children are `EmbeddedBlockDefinition` (no nested `embeddedBlocks`). See `12_bom_object_model.md`.

```text
Omitted <is> on Block definition         → BML_MISSING_IS (warning V1)
Omitted default-namespace <documentation> → BML_MISSING_DOCUMENTATION (warning V1)
Missing <isnot> when confusion risk      → BML_MISSING_ISNOT (warning V1)
Missing default-namespace <summary> when canonical documentation long → BML_MISSING_SUMMARY (warning V1)
Duplicate (namespace, languageFqn) on documentation → BML_DUPLICATE_DOCUMENTATION (error)
Duplicate (namespace, languageFqn) on summary → BML_DUPLICATE_SUMMARY (error)
Omitted <since> / <changelog> / <examples> / <references> → undefined (optional)
Invalid <since> version                  → BML_INVALID_SINCE_VERSION (error)
<changelog> entries out of version order → BML_CHANGELOG_VERSION_ORDER (warning V1)
<example> without title attribute        → BML_EXAMPLE_MISSING_TITLE (error)
<*:example> without title attribute      → BML_EXAMPLE_MISSING_TITLE (error)
<example> body not CDATA                 → BML_EXAMPLE_NOT_CDATA (error)
<*:example> body not CDATA               → BML_EXAMPLE_NOT_CDATA (error)
<example language="…"> unknown Language FQN → BML_EXAMPLE_UNKNOWN_LANGUAGE (error)
<language> or documentation/summary language="…" unknown NaturalLanguage FQN → BML_UNKNOWN_NATURAL_LANGUAGE (error)
<see> without type, instance, file, url, property, aggregation, association, or capability → BML_REFERENCE_MISSING_TARGET (error)
<see> with more than one target kind                    → BML_REFERENCE_AMBIGUOUS_TARGET (error)
<see type="…" property="…"> (split member form)         → one member target; type qualifies member name
<see type="…" instance="…"> (split instance form)       → one instance target; type qualifies local id → FQN::id
<see relation="…"> unknown Relation FQN                  → BML_UNKNOWN_RELATION (error)
<see property|aggregation|association|capability="…"> unknown member path at validate time → BML_REFERENCE_UNKNOWN_MEMBER (error)
<see instance="…"> unresolvable / unexported / non-static → BML_UNRESOLVABLE_INSTANCE_REF / BML_UNEXPORTED_INSTANCE_REF / BML_NON_STATIC_INSTANCE_REF
<see> omitted relation                                    → relationFqn = org.blockml.bml.relation.SeeAlso
Member canonical path resolution (split form):
  type="com.foo.Bar" property="width"      → com.foo.Bar.properties.width
  type="com.foo.Bar" aggregation="parts"   → com.foo.Bar.aggregations.parts
  type="com.foo.Bar" association="parent"  → com.foo.Bar.associations.parent
  type="com.foo.Bar" capability="render"   → com.foo.Bar.capabilities.render
  type="com.foo.Bar" instance="myId"       → com.foo.Bar::myId
Full-path form: attribute value stored as-is when it already contains the container segment (.properties., .capabilities., …).
Omitted abstract/final/override          → false
<abstract/> / <final/> / empty boolean   → parse error (explicit true/false required; case variants True/TRUE/False/FALSE accepted)
Attribute shorthand without value        → parse error (e.g. abstract without ="true")
Boolean authored True/TRUE/False/FALSE   → BOM canonical lowercase true/false
Omitted <visibility> on Sub-Block      → derive from <name> (__ → private, _ → protected, else public)
<visibility> on root Block               → BML_VISIBILITY_ON_ROOT_BLOCK (error)
<visibility> mismatches <name>           → BML_VISIBILITY_MISMATCH (error)
Private member access outside scope      → BML_PRIVATE_MEMBER_ACCESS (error)
Protected member access outside scope    → BML_PROTECTED_MEMBER_ACCESS (error)
Private Sub-Block reference outside scope → BML_PRIVATE_SUBBLOCK_ACCESS (error)
Protected Sub-Block reference outside scope → BML_PROTECTED_SUBBLOCK_ACCESS (error)
Duplicate members by visibility prefix   → BML_DUPLICATE_MEMBER_VISIBILITY_VARIANT (error)
Omitted contracts          → inherit from baseType at validate
Omitted genericTypes                 → none — generic parameters are not inherited; bind or forward via baseType / Sub-Block application
<contracts> on Sub-Block                 → BML_CONTRACT_NOT_ON_ROOT (error)
Duplicate contract reference           → BML_DUPLICATE_CONTRACT (error)
Duplicate generic parameter name             → BML_DUPLICATE_GENERIC (error)
generic parameter element name equals declaring Block <name> → BML_GENERIC_BLOCK_NAME_COLLISION (error)
generic parameter element name equals a direct Sub-Block <name> of the declaring Block → BML_GENERIC_SUBBLOCK_NAME_COLLISION (error)
defaultType names later/unknown generic parameter          → BML_GENERIC_DEFAULT_FORWARD_REF (error)
defaultType cycle                                          → BML_GENERIC_DEFAULT_CYCLE (error)
defaultType chain does not ground to concrete type         → BML_GENERIC_DEFAULT_UNRESOLVED (error)
Unqualified block reference without FQN or xmlns prefix → BML_UNQUALIFIED_BLOCK_REFERENCE (error)
Ambiguous Sub-Block short name (same as root) → BML_SUBBLOCK_QUALIFIED_REFERENCE_REQUIRED (error)
Sub-Block explicit type ≠ resolve(parent.type) + "." + name → BML_SUBBLOCK_TYPE_MISMATCH (error)
Sub-Block declares <embeddedBlocks> → BML_EMBEDDED_BLOCKS_ON_SUBBLOCK (error)
Embedded declares <embeddedBlocks> → BML_NESTED_EMBEDDED_BLOCKS (error)
Duplicate FQN among root embeds → BML_DUPLICATE_EMBEDDED_BLOCK (error)
Embedded block without <type> → BML_MISSING_EMBEDDED_BLOCK_TYPE (error)
Embedded block type not fully qualified → BML_UNQUALIFIED_EMBEDDED_BLOCK_TYPE (error)
<definition> incompatible with block role → BML_DEFINITION_TYPE_MISMATCH (error)
org.blockml.bml.core.Block                   → omits <baseType> (sole inheritance root)
```

ValueType BML uses the same `BlockDefinition` shape as all Blocks — StructTypes declare members via `<properties>`; EnumTypes declare members via `<values><composition>…</composition></values>` (optional catalog properties on the EnumType); generic Blocks declare parameters via `<genericTypes>`. Branch-specific validation — see `17_type_system_bml.md`.

### Member attributes

All member kinds map common fields to `MemberDefinitionBase`:

```text
element localName          → name
element prefix (if any)    → namespace (resolved — see below)
visibility="protected"     → visibility (optional; derived from name when omitted)
readOnly="true"            → readOnly (validator-enforced on instances — see 02_mbml.md § readOnly Members)
abstract="true"            → abstract (local declaration property — not inherited)
final="true"               → final (local declaration property — not inherited)
override="true"            → override (local declaration property — not inherited; required on each
                             redeclaration that merges with a baseType or contract member)
<documentation>…           → documentation
<since>…                   → since
<changelog>…               → changelog[]
<examples>…                → examples[]
<references>…              → references[]
<status>Draft</status>  → statusFqn (when declared; omitted → inherit from parent)
```

Legacy `namespace="…"` attribute on member elements → **`BML_DEPRECATED_MEMBER_NAMESPACE_ATTR` (error)** at map time. Namespace is supplied exclusively by the element QName.

**Non-definition elements** (`<documentation>`, `<since>`, `<changelog>`, `<examples>`, `<references>`, `<is>`, `<implementation>`, Block instances, …) may carry `bml:status="Draft"` — mapped to `statusFqn` on the same BOM node **only when deviating** from inherited status. No `<status>` child on these elements.

**Effective status resolution (parser step [5] / Stage 2):**

```text
Implicit default (no declaration anywhere in chain from root):
  effective status = org.blockml.bml.status.Stable

Walk element tree depth-first.
Root (no parent) effective status     →  org.blockml.bml.status.Stable (when omitted)
Element with declared statusFqn         →  declared value becomes effective for subtree
Element without declaration             →  effective status = parent's effective status

Authored:  <status>Draft</status>     → org.blockml.bml.status.Draft (implicit namespace at status site)
           bml:status="Deprecated"    (only when ≠ inherited)

BOM:       statusFqn on node (explicit only) + resolved effectiveStatusFqn at validate

Bare name "Draft" at <status> / bml:status site  →  org.blockml.bml.status.Draft
Bare name outside specialized site               →  BML_UNKNOWN_TYPE (parse error)
Unknown status FQN                               →  BML_UNKNOWN_STATUS (validate)
Redundant status (= inherited)         →  BML_REDUNDANT_STATUS (warning V1)
```

**Member namespace resolution (parser step [5]):**

Member namespace is supplied **exclusively by the XML element QName**. The element local name is the member name; an optional prefix supplies the namespace.

```text
Document:  xmlns:ui5="com.sap.ui5"
Authored:  <properties><ui5:width type="Integer"/></properties>

BOM:       PropertyDefinition {
             namespace: "com.sap.ui5",   // resolved identifier — never "ui5"
             name: "width",
             …
           }
```

```text
Unprefixed element (<width/>)  →  namespace undefined / default namespace (empty string)
Undeclared prefix on element   →  BML_UNKNOWN_NAMESPACE_PREFIX (parse error)
Prefix alias never stored      →  BOM contains canonical identifiers only
namespace="…" attribute       →  BML_DEPRECATED_MEMBER_NAMESPACE_ATTR (parse error)
```

The parser treats absence of a prefix as `namespace = ""` — independent of the document default `xmlns`.

**Override matching:** `resolveEffectiveMembers()` compares members by **resolved `(namespace, normalizedLogicalName)`** — visibility prefixes (`_` / `__`) are stripped from the element localName before match. A child may widen visibility (`_name` → `name`); narrowing → `BML_VISIBILITY_NARROWING`. A child Block may use a different XML xmlns prefix for the same namespace URI — the override still matches.

```text
Parent (xmlns:ui5="com.sap.ui5"):   <ui5:width …/>
Child  (xmlns:design="com.sap.ui5"): <design:width value="42"/>
→ same key (com.sap.ui5, width) → override merges
```

Member containers map common fields to `MemberDefinitionBase` (including `constraints[]` on all member kinds):

```text
element localName          → name
...
<constraints>            → constraints[] (BlockInstance[], document order) — all member kinds
```

Property-specific:

```text
type="…"                 → typeFqn (resolved)
value="…" / <value>…     → values[] entry { namespace: "", value } + convenience value
  <scad:value>…</scad:value> nested under the property element
                         → values[] entry { namespace: resolved Annotation FQN, value }
                         → Annotation.Value facet — same property identity; not member scad:myProp
                         → not top-level <properties><scad:value/> (that is Annotation.Property member)
  duplicate namespace     → BML_DUPLICATE_PROPERTY_VALUE
  absent canonical value → Optional.empty (not null); facets may still exist
<suggestions>            → suggestions[] (BlockInstance[], document order) — Property only
```

Block-level:

```text
<constraints>            → block.constraints[] (BlockInstance[], document order)
```

**`<constraints>` mapping (Block and all member kinds):**

Each child element inside `<constraints>` is mapped as a `BlockInstance`. The element name resolves to a Block FQN via namespace prefix (same rules as composition children). Stage [8] validates:

```text
instance.typeFqn baseType chain includes org.blockml.bml.core.Constraint
constraint branch compatible with embedding context (BML_CONSTRAINT_TARGET_MISMATCH)
generic T bound automatically from context (property ValueType, member definition type, or Block definition type)
constraint instance member values match bound generic T
validation reference (when present) resolves to org.blockml.bml.core.Validation sub-type
rule evaluated only when validation is present and understood
```

Constraints without a `validation` reference are not rule-enforced by the BlockML validator. Target binding and resolved generics are not stored in the Canonical BOM.

**`<suggestions>` mapping (Property only):**

Each child element inside `<suggestions>` is mapped as a `BlockInstance`. Aggregation type on `PropertyDefinition` is `core:Block[]`. Stage [8] validates compatibility with the property `typeFqn`:

```text
PrimitiveType property  → suggestion must be PrimitiveEntity(T) for that T
                          (Text → TextEntity, Integer → IntegerEntity, Color → ColorEntity, …)
StructType property     → suggestion typeFqn compatible with the StructType
EnumType property       → <suggestions> forbidden (BML_SUGGESTIONS_ON_ENUM)
otherwise               → BML_SUGGESTION_TYPE_MISMATCH
```

Suggestions are metadata — no value enforcement. See `18_constraints_and_suggestions.md`.

Visibility derivation when `visibility` is omitted:

```text
name starts with "__"  →  private
name starts with "_"   →  protected (single underscore)
otherwise              →  public
```

Mismatch between derived and explicit `visibility` → `BML_VISIBILITY_MISMATCH` at validate.

Partial overrides: a child Block may declare a member with only the logical name and changed attributes. Unspecified fields inherit from the parent member at `resolveEffectiveMembers()`. **Unchanged `type` should be omitted** — restate `type` only when refining it. Override key is resolved `(namespace, normalizedLogicalName)` — visibility prefixes stripped; not the XML xmlns prefix. Visibility may widen (`_name` → `name`); narrowing → `BML_VISIBILITY_NARROWING`.

**General namespace rule:** all XML prefixes in BML (Block type tags, member element QNames, `type:` shorthand, `bml:*`) are resolved during parsing. The BOM stores canonical namespace identifiers only. See `02_mbml.md` — Namespaces · § Member Namespace (Element QName).

---

## Expression Parsing (Two-Phase)

Expression handling spans parser and utility:

```text
Parser step [5] BML → BOM Mapper
  Detect ${ ... } spans in attribute and directive values
  Store ExpressionValue { raw, source } in Canonical BOM

parseExpression() utility (@blockml/core)
  Input:  ExpressionValue.raw + ParseContext
  Output: ParsedExpression { ast, resultTypeFqn } — NOT written to BOM
  On failure → BML_EXPR_SYNTAX_ERROR
```

### Parser step [5] — raw capture

When an attribute or directive value contains `${ }`:

```text
size="${ [size.x, size.y, size.z - 1] }"
  → ExpressionValue {
       raw: "[size.x, size.y, size.z - 1]",   // inside delimiters, trimmed
       source: { line, column of opening ${ }
     }

size="[1, 8, 9]"
  → LiteralValue { value: [1, 8, 9], typeFqn: "…SizeXYZ" }   (authored form; type-checked by validateTypes() utility)
```

Directive values (e.g. `bml:each="i : ${ numberOfSamples }"`) are split structurally in parser step [5]: loop variables parsed from the prefix; the `${ }` portion stored as `ExpressionValue { raw }` on the directive node.

Parser step [5] does **not** build AST nodes and does **not** resolve property references.

`<implementation language="…">` CDATA is stored verbatim on `ImplementationBlock.source`. During parser step [5], the mapper scans for `<$ … $>` pairs and appends each to `ImplementationBlock.embeddedExpressions`:

```text
<implementation language="org.blockml.bml.language.OpenSCAD"><![CDATA[
function clamp(v) = <$ #math.max(#this.minimum(), v) $>;
]]></implementation>

→ ImplementationBlock {
     languageFqn: "org.blockml.bml.language.OpenSCAD",
     source: "function clamp(v) = <$ #math.max(#this.minimum(), v) $>;\n",
     embeddedExpressions: [
       { raw: "#math.max(#this.minimum(), v)", start: 20, end: 58 }
     ]
   }
```

Validation runs `parseExpression()` on each `embeddedExpressions[].raw` and applies the same semantic checks as member-value expressions, plus `#this` resolution against `resolveEffectiveMembers()`. See `10_expression_language.md` — BML Embedded Expressions.

### parseExpression() — AST construction

The utility receives `ExpressionValue.raw` and `ParseContext` (built from enclosing Block, directive scope, target member):

```text
parseExpression("[size.x, size.y, size.z - 1]", context)
  → { ast: AccessExpression / BinaryExpression / … tree, resultTypeFqn: … }
```

Parse context is built from the enclosing Block, directive scope (`bml:each` / `bml:with` variables on ancestor chain), and the target member being assigned.

Expressions are **parsed, not evaluated**. Evaluation is `evaluateExpression()` — renderer working model only. See `10_expression_language.md` — Expression AST.

### Why parser and utility are separate

```text
Parser step [5] needs no expression grammar  — only ${ } detection and raw extraction
parseExpression() runs when needed    — CLI validation, renderer pipeline, tooling
validateTypes() can check literals before expressions are parsed
Mapping errors vs. expression syntax errors are separated
```

`validateConstraints()` uses `parseExpression()` output for semantic checks — diagnostics only, no BOM mutation.

---

## Cross-File Resolution & TypeRegistry Bootstrap

The parser is **single-file scoped**. Cross-file resolution is a **bootstrap + validation** concern in `@blockml/core` and `@blockml/cli`.

### Responsibilities

```text
@blockml/parser (parser step [5])
  Input:   one BML source file (+ format hint)
  Output:  one BomDocument
  Stores:  external refs as typeFqn + version on BlockInstance — does NOT load other files

@blockml/core (TypeRegistry) + @blockml/validator (Stage 2)
  Populated before validation of any document that needs cross-file lookup
  Resolves: external block types, preset refs, version pins, effective members

@blockml/cli / compile orchestration
  Discovers and parses all project + library BML files
  Registers each BomDocument in TypeRegistry
  Then runs validate/compile on requested file(s)
```

### TypeRegistry bootstrap (Option A)

Before validating or compiling a file that references external types, the orchestrator builds a populated `TypeRegistry`:

```text
1. Pre-register framework BML (fixed paths — see 16_framework_base_types.md)
     @blockml/core/blocks        →  org.blockml.bml.core.*, org.blockml.bml.service.*
     @machineblocks/mbom/blocks  →  com.machineblocks.bml.core.*

2. Discover BML sources
     Project srcDir scan     →  all *.bml
     library.xml manifests   →  explicit <block> / <presets> refs (optional index)
     Declared dependencies   →  transitive library paths from bom.config.json / library.xml

3. Parse each discovered file (single-file parser — parser step [5])
     registerBlockDefinition(doc)  for each BomDocument

4. Validate / compile target file(s) using populated registry (Stage 2)
```

Without `library.xml`, all BML files in a directory are discovered and registered. With `library.xml`, the manifest lists public blocks and presets; see `02_mbml.md` — Library Format.

### What the parser stores for external references

```xml
<bricks:StandardBrick bml:version="3.0.0" bml:id="strip" size="[2, 4, 3]" />
```

Parser step [5] output — no file load:

```text
BlockInstance:
  typeFqn:  com.machineblocks.bml.bricks.StandardBrick
  version:  undefined | "3.0.0"   ← optional; omitted = resolve from registry context at Stage 2
  memberValues: { id, size }
```

Stage [8] lookup:

```typescript
// version omitted — resolve from registry context (library bootstrap)
registry.getBlockDefinition("com.machineblocks.bml.bricks.StandardBrick")
  → BlockDefinition | undefined

// version present — exact assert
registry.getBlockDefinition("com.machineblocks.bml.bricks.StandardBrick", "3.0.0")
  → BlockDefinition | undefined
  → undefined → BML_UNKNOWN_VERSION
```

Inside Library files: optional `bml:version` on `bootstrap` / `dependencies` / `subLibraries` / `blocks` / `readMe` TypeReferenceEntity sugar — exact-version assert against `value`; no match → `BML_UNKNOWN_VERSION`.

Same-document Sub-Block references omit `version` — resolved against the `subBlocks[]` tree in the same `BomDocument`.

### Preset cross-file references (MachineBlocks)

```text
basePresets="com.martianmicro.anyclosure.WallPresets::large"
  → Parser stores string as authored (parser step [5])
  → Validator resolves preset BlockDefinition + preset instance id in _presets (Stage 2)

basePresets="brick-1x1 com.other.Presets::color-red"
  → Stored on Block instance memberValues.basePresets (parser step [5])
  → Validator resolves each token as local id or FQN::id (Stage 2)
```

Preset instances in `_presets` composition map like any other Block instance. The `name` attribute maps to `memberValues.name`; `bml:id` maps to `BlockInstance.id`.

```text
<_presets>
  <composition>  →  CompositionTemplate for _presets (instance ID reachability from aggregation visibility)
```

Qualified `{BlockFQN}::{id}` references (e.g. in `basePresets`) validate against instances in **public** target aggregations with static target ids — see `01_bom_core.md` — Qualified Block Instance References.

**Aggregation + composition mapping:**

```text
<aggregations>
  <_parts type="…">                        → AggregationDefinition (+ typeFqn, cardinality from multiplicity)
    default="true"                           → AggregationDefinition.default (boolean; at most one per Block)
    visibility="public"                      → AggregationDefinition.visibility (controls instance ID reachability)
    <composition>                            → AggregationDefinition.composition (CompositionTemplate)
      …children…
    </composition>
  </_parts>
</aggregations>

bare <composition> on definition            → BML_STANDALONE_COMPOSITION (error)
<{aggregationName}><composition>…           → CompositionTemplate for that aggregation
<memberName> on instance                    → BlockInstance.aggregationCompositions[]
```

The `composition aggregation="…"` attribute is **removed** — aggregations are opened by member element name.

### TypeReferenceEntity aggregation (Stage 2)

**Empty child sugar:** when the aggregation payload type is a `TypeReferenceEntity` application,
`<foo:Bar />` expands to `<type:TypeReferenceEntity value="foo:Bar" />` — a real Entity instance.
See `17_type_system_bml.md` — TypeReference and TypeReferenceEntity.

```text
Aggregation type is TypeReferenceEntity(B)[/…/]  →  TypeReferenceEntity instances
  Parser: empty non-TypeReferenceEntity QName child → expand sugar → Entity { value: resolved FQN }
  Explicit <type:TypeReferenceEntity value="…" /> is equivalent
  Store Entity instances in contracts[] / language / Library lists
  Validator: satisfiesTypeBound(resolve(value), B) for each child
  FQN projections (e.g. languageFqn, contract FQN sets) derive from .value

Aggregation type is plain Block[] (domain)       →  domain BlockInstance trees
  Parser: children → BlockInstance of the child element type
  Empty child = real BlockInstance with no authored member values

Identity properties type / baseType               →  TypeReference(core:Block) text
  Parser: element text → resolve QName/FQN / TypeExpression → block.type / block.baseType
  Child-element form inside <type> / <baseType> → BML_IDENTITY_TYPE_CHILD_ELEMENT (error)

unwrapTypeReferenceEntity(typeExpr):
  fqn === org.blockml.bml.type.TypeReferenceEntity  →  return B (bound payload constraint)
  else  →  null
```

```text
BML_IDENTITY_TYPE_CHILD_ELEMENT — identity <type> or <baseType> uses a child element instead of text
BML_TYPE_REFERENCE_CONSTRAINT       — resolve(value) fails satisfiesTypeBound(value, B)
BML_TYPE_REFERENCE_MULTIPLICITY     — wrong child count (bare = 0..1, [1..1] = required single)
BML_TYPE_REFERENCE_CHILD_VALUE      — domain members authored on QName-sugar child (instance is TypeReferenceEntity)
```

### Contract merge (Stage 2)

```text
<ac:IIdentifiable/>
  → Parser expands sugar → TypeReferenceEntity { value: "…IIdentifiable" } in block.contracts[]
  → Validator resolves contract BlockDefinition from resolve(value) (Stage 2)
  → resolveContractMembers(contractFqn) — declared members only;
    subBlocks[], embeddedBlocks[], and compositions[] on contract type ignored
  → resolveEffectiveMembers(implementingBlock) merges:
       baseType chain members
     → contract members (in block.contracts[] order; later overrides earlier)
     → Block local declarations (override all)
     Same partial-override rules as baseType inheritance; override="true" required on every local
     redeclaration that merges with a baseType or contract member → BML_OVERRIDE_REQUIRED
  → satisfiesTypeBound checks on generic constraints and other type-bound sites (Stage 2)
```

```text
BML_UNKNOWN_CONTRACT              — resolve(value) not in TypeRegistry
BML_CONTRACT_NOT_ON_ROOT          — <contracts> on Sub-Block
BML_DUPLICATE_CONTRACT            — same type listed twice in block.contracts[] (by resolve(value))
BML_CONTRACT_MEMBER_KIND_MISMATCH — override uses a different member kind than merged member
BML_FINAL_MEMBER_OVERRIDE         — override attempted on final member (from contract or baseType)
BML_OVERRIDE_REQUIRED             — local redeclaration merges with baseType or contract member but override omitted
BML_OVERRIDE_WITHOUT_PARENT       — override="true" but no same-named parent member
BML_GENERIC_CONSTRAINT_VIOLATION  — generic type argument fails satisfiesTypeBound
BML_GENERIC_DEFAULT_FORWARD_REF   — defaultType names a later or unknown generic parameter
BML_GENERIC_DEFAULT_CYCLE         — defaultType reference graph contains a cycle
BML_GENERIC_DEFAULT_UNRESOLVED    — defaultType chain does not ground to a concrete type
BML_TYPE_BOUND_NOT_SATISFIED      — type reference fails satisfiesTypeBound
BML_READONLY_MEMBER_WRITE         — Block instance sets a member with readOnly=true
```

### Library blocks

Library descriptors map like any `BlockDefinition` with `baseType: org.blockml.bml.core.BlockLibrary`. On library **instances**, aggregation children are authored inside `<composition>`. Interpretation depends on the aggregation `type` — see `17_type_system_bml.md` — TypeReferenceEntity.

```text
<!-- TypeReferenceEntity aggregations — QName sugar → Entity { value: FQN } -->
<blockml:README />                         →  readMe: TypeReferenceEntity value="org.blockml.bml.README"
<blockml:Library />                        →  dependencies entry (context version)
<blockml:Library bml:version="3.0.0" />     →  dependencies entry — exact-version assert on value
<compiler:Library />                       →  subLibraries entry
<type:SizeXYZ />                             →  blocks entry
<bricks:Wall />                             →  blocks entry
<bricks:WallPresets />                      →  blocks entry

<!-- Instance aggregation (schemas) — child = FilePathEntity -->
<type:FilePathEntity value="bricks.xsd"/> →  BlockInstance { typeFqn: "…FilePathEntity", value: "bricks.xsd" }
```

`readMe`, `bootstrap`, `dependencies`, `subLibraries`, and `blocks` use `TypeReferenceEntity`
aggregations — empty QName sugar expands to Entity instances. Optional **`bml:version`** on sugar
is an exact-version assert against the referenced type (`value`) — stored on the expanded
TypeReferenceEntity instance like other composition `bml:version` asserts. Meta-model types:
`TypeReferenceEntity(core:ReadMe)[1..1]`,
`TypeReferenceEntity(core:Bootstrap)`, `TypeReferenceEntity(core:BlockLibrary)[]`,
`TypeReferenceEntity(core:Block)[]`.

Each child requires explicit aggregation members (`readMe`, `bootstrap`, `dependencies`,
`subLibraries`, `schemas`, `blocks`) — BlockLibrary has no default aggregation.

**Orchestrator (not parser):** after parsing a Library block, resolve each `readMe`, `bootstrap`,
`dependencies`, `subLibraries`, and `blocks` entry by `resolve(value)` (honouring optional
`bml:version`), load the referenced
definitions using effective block versions, and `registerBlockDefinition`. Validate that outer
libraries do not re-export blocks from nested inner libraries (`BML_LIBRARY_NESTING_VIOLATION`).

### Incremental builds

Because the parser is single-file, the hash cache keys per output artifact include **transitive dependency versions** from the TypeRegistry — not inline parsed trees. See `06_compiler.md` — Incremental Build.

The orchestrator re-bootstraps or incrementally updates the TypeRegistry when any registered source file changes.

---

## JSON BML authoring (not planned)

JSON is **not** an equivalent BML authoring format and is **not planned** for V1 or V2 (and may never ship). The parser accepts **XML only** (`.bml`).

Reasons: no natural mapping for namespaces / `bml:*` / typed element names; exploratory comparisons produced **larger** JSON than XML for the same content. See `02_mbml.md` — JSON as authoring form (not planned).

Do not extend the format detector, root-type registry, or CLI for JSON authoring unless this decision is explicitly revisited.

---

## Open Decisions

| ID | Topic | Status |
|---|---|---|
| B2 | Unknown instance attributes — warning; unknown `bml:*` — error | **Decided** |
| B3 | `inputType` / `outputType` storage — `TypeDescriptor` union (anonymous struct model) | **Decided** |
| B4 | Expression parsing — raw in BOM; AST via parseExpression() utility | **Decided** |
| B5 | Cross-file / TypeRegistry — single-file parser; orchestrator bootstrap | **Decided** |
| B6 | JSON BML authoring format | **Not planned** — not equivalent to XML; not V1/V2; may never ship (see § JSON BML) |
| B7 | V1 Phase-A slice — no XSD must; no meta-`bml:xml` drive; raw expressions only | **Decided** — see § V1 Parser / Serializer Scope |
| B8 | XSD generation as Render Target; XSD validation only after that target ships; **always disableable** via `--no-xsd` + `xsdValidation: false` | **Decided** — see § V1 Scope · `07_cli.md` escape hatch · `15_dev_setup.md` Phase C |
| B9 | BlockDoc-first Stage-3 + `targets[]` in V1; then XSD / FatBlock / SCAD | **Decided** — default `targets: ["blockdoc"]`; packages `@blockml/{blockdoc,xsd,fatblock}-target` — see `01` · `07` · `14` C3 · `15` Phase C |

---

## Related Documents

| Topic | Document |
|---|---|
| BOM object model | `12_bom_object_model.md` |
| V1 Phase-A build order | `15_dev_setup.md` — V1 Implementation Strategy |
| Expression AST | `10_expression_language.md` |
| Embedded expressions in implementations | `10_expression_language.md` — BML Embedded Expressions |
| Directive placement rules | `12_bom_object_model.md` — Directive Placement Rules |
| Default resolution shortcuts | `02_mbml.md` — BML→BOM Mapping |
