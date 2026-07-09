# BML → BOM Mapping

version: 0.2.0

## Purpose of this Document

This document defines the **algorithmic mapping rules** from parsed BML (XML/JSON) to `BomDocument` — the implementation contract for `@blockml/parser`.

For BOM target types see `12_bom_object_model.md`.
For BML authoring syntax see `02_mbml.md`.
For expression parsing see `10_expression_language.md`.
For compiler pipeline placement see `06_compiler.md`.

Mapping rules are registered per root type (`<block>`, …) — not hardcoded in the parser core. V1 has a single root type: `<block>`.

---

## Pipeline Placement

```text
[4] Namespace Resolver     → FQN prefix bindings
[5] BML → BOM Mapper       → this document (structure + attribute classification)
[7] Expression Parser      → fill ExpressionValue.ast on mapped nodes
[6] Type Validator         → literal deserialization + type checks
[8] Semantic Validator     → effective members, cross-refs, expression types
```

Stage [5] produces the abstract BOM graph with expression **raw** text only. Stage [7] fills `ExpressionValue.ast` and `resultTypeFqn` on all mapped nodes (two-phase — see § Expression Parsing).

---

## Member Mapping Order

When mapping `<block>` definitions, member elements are appended to `BlockDefinition.members[]` **in BML document order**:

```text
<properties>    → each <property> in XML order
<aggregations>  → each <aggregation> in XML order
<associations>  → each <association> in XML order
<capabilities>  → each <capability> in XML order
```

```text
MUST NOT sort by name, kind, or typeFqn
MUST NOT merge sections out of document sequence
MAY omit empty sections (<properties> absent → skip)
```

Ordinal = index in `members[]` after mapping. Used by render targets and by StructType array-literal deserialization (`[v0, v1, …]` → fields in property declaration order). See `17_type_system_bml.md` — Ordered Struct Fields · `12_bom_object_model.md` — Member Declaration Order.

---

## Design Decisions

| Topic | Decision |
|---|---|
| **Directives** | Stored as `directives[]` on the element — not expanded at parse time |
| **Data attributes** | `data:*` → `dataAttributes[]` with uninterpreted values (not a `bml:` directive) |
| **Registry** | **Removed.** Sibling value sharing via `bml:with` on `<composition>` or `<bml:container>` |
| **Attribute classification** | Fixed priority chain — see § Attribute Classification below |
| **Unknown member attributes** | Warning `BML_UNKNOWN_PROPERTY` at validate (custom property assumed) |
| **Unknown `bml:*` attributes** | Error `BML_UNKNOWN_DIRECTIVE` at map time |
| **`inputType` / `outputType`** | Parsed into `TypeDescriptor` at map time — anonymous `{ a: Float }` = anonymous struct type |
| **Expression parsing** | Two-phase: stage [5] stores `raw`; stage [7] builds AST |
| **Cross-file resolution** | Single-file parser; TypeRegistry bootstrap by CLI/orchestrator before validate |
| **JSON BML format** | **Deferred (TBD).** V1 parser accepts XML only (`.bml`) |
| **Composition render** | Leaf geometry → NativeBlock → `mb_block()`; see `14_compiler_runtime.md` |
| **Member order** | Properties, aggregations, associations, capabilities appended in BML document order — **never sorted**; see `12_bom_object_model.md` — Member Declaration Order |

---

## Attribute Classification

When mapping an XML element to a BOM node, every attribute is classified using this **fixed priority chain**. The first matching rule wins.

```text
1. xmlns*, xsi:*              → ignore (except xmlns bindings → SourceInfo.namespaceBindings)
2. bml:*                      → see § Rule 2 — meta (bml:id, bml:version) or directives[]
3. data:*                     → DataAttribute → dataAttributes[]  (Block definitions + Block instances only)
4. All other attributes       → memberValues[name]  (camelCase property/capability values)
```

### Rule 1 — XML infrastructure

```text
xmlns:bricks="com.machineblocks.bricks"   → namespaceBindings["bricks"]
xsi:schemaLocation="..."                  → ignored
```

### Rule 2 — `bml:*` attributes

**Composition meta** (Block instances only) — stored on `BlockInstance` fields, not in `directives[]`:

| Attribute | BOM field |
|---|---|
| `bml:id` | `BlockInstance.id` (`MemberValue`) |
| `bml:version` | `BlockInstance.version` (`MemberValue`) |

**Flow-control directives** — stored in `directives[]` on the same element (Thymeleaf model):

| Attribute | AST type |
|---|---|
| `bml:each` | `EachDirective` |
| `bml:if` | `IfDirective` |
| `bml:unless` | `UnlessDirective` |
| `bml:with` | `WithDirective` |

Any other `bml:*` attribute name → **`BML_UNKNOWN_DIRECTIVE` (error)**. Examples: `bml:foo`, typos like `bml:ech`.

Known directive on a disallowed element (see placement rules in `12_bom_object_model.md`) → **`BML_DIRECTIVE_NOT_ALLOWED` (error)**.

Directive and meta values that contain `${ }` are stored as `ExpressionValue` (raw in stage [5], AST in stage [7]).

### Rule 3 — `data:*` data attributes

Only valid on Block definitions and Block instances (elements whose type extends `org.blockml.core.Block`).

```text
data:role="structural"         →  dataAttributes[] { key: "role", value: LiteralValue("structural") }
data:count="${ sampleCount }"  →  dataAttributes[] { key: "count", value: ExpressionValue(...) }
```

Values are **not evaluated** at parse or validate time. Invalid placement (e.g. on `<capability>`) → diagnostic error at map time.

### Rule 4 — Member values

All remaining attributes become `memberValues[name]`:

```text
size="[1, 8, 9]"           → memberValues.size (LiteralValue or ExpressionValue)
id="wall"                    → memberValues.id   (only when Block type declares id Property)
version="1.0.0"              → memberValues.version (only when Block type declares version Property)
blockId="wall"               → memberValues.blockId
onResized="stud://..."       → memberValues.onResized (AddressValue or ExpressionValue)
```

Use **`bml:id`** / **`bml:version`** for composition instance identity and external reference version — not bare attributes.

Value classification within rule 4:

```text
${ ... }                     → ExpressionValue { raw }  (AST added in stage [7])
address-shaped capability    → AddressValue
otherwise                    → LiteralValue (typed deserializer — see § Literal Deserialization, pending)
```

Unknown member names survive rule 4 and are stored in `memberValues`. The semantic validator emits **`BML_UNKNOWN_PROPERTY` (warning)** — custom property assumed. See § Unknown Attributes below.

### Unknown Attributes

| Case | When | Severity | Code |
|---|---|---|---|
| Unknown member on instance | Validate — name not in effective members | **Warning** | `BML_UNKNOWN_PROPERTY` |
| Unknown `bml:*` name | Map — not in allowed directive list | **Error** | `BML_UNKNOWN_DIRECTIVE` |
| Known `bml:*` on wrong element | Map or validate — placement rule violated | **Error** | `BML_DIRECTIVE_NOT_ALLOWED` |
| `data:*` on non-Block element | Map | **Error** | `BML_CUSTOM_DATA_NOT_ALLOWED` |

Unlike member attributes, **`bml:*` is never silently ignored** — unknown or misplaced directives always fail compilation.

### Worked Example

Input:

```xml
<bricks:StandardBrick
    bml:version="3.0.0"
    bml:id="${ 'val_' + i }"
    bml:each="i : ${ numberOfSamples }"
    size="[1, 1, 1]"
    data:role="sample"
    renderGroup="calibration" />
```

Output (`BlockInstanceNode`):

```text
instance:
  typeFqn:     com.machineblocks.bricks.StandardBrick
  version:     LiteralValue("3.0.0")
  renderGroup: "calibration"
  id:          ExpressionValue
  memberValues:
    size: LiteralValue
  dataAttributes:
    [{ key: "role", value: LiteralValue("sample") }]
directives:
  [EachDirective { variables: ["i"], collection: ExpressionValue }]
```

---

## Type Descriptor Parsing

Capability and property type attributes are parsed into **`TypeExpression`** objects at map time (V1 alias: `TypeDescriptor`) — not stored as raw strings. Lives in **`org.blockml.bom.*`** — not in `org.blockml.type.*`. See `00_bom_core.md` — Implementation Namespaces · `17_type_system_bml.md` — Type Expressions.

Unqualified PascalCase names on `type="..."` (properties, aggregations, capabilities) use the **same Sub-Block resolution order** as composition children (see `02_mbml.md` — Short-Name Reference) before falling back to `NamedTypeReference` registry lookup.

```text
<aggregation type="Dependency" .../>   on org.blockml.core.Library
  → NamedTypeReference { fqn: "org.blockml.core.Library.Dependency" }

inputType="Float"
  → NamedTypeReference { fqn: "org.blockml.type.Float" }

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
<implementation type="org.blockml.language.TypeScript"><![CDATA[ ... ]]></implementation>
  → ImplementationBlock {
       typeFqn: "org.blockml.language.TypeScript",
       source: CDATA body (trimmed)
     }
```

Rules:

```text
type attribute   — required; must be org.blockml.language.* FQN (not a language= shorthand)
Missing type     → BML_MISSING_IMPLEMENTATION_TYPE (error)
Unknown type FQN → BML_IMPLEMENTATION_UNKNOWN_TYPE (error)
Unsupported type → BML_IMPLEMENTATION_NOT_SUPPORTED (validate — not in baseType implTypes)
```

V1 known types: `org.blockml.language.TypeScript`, `org.blockml.language.OpenSCAD`.

### Type modifiers

Optional elements on `<block>` — mapped to `BlockDefinition` fields. See `16_framework_base_types.md`.

```text
```text
<idea>…</idea>                               → block.idea (trimmed text)
<documentation>…</documentation>             → block.documentation (trimmed text)
<name>…</name>                               → block.name
<type>…</type>                               → block.type (FQN; root block only — derived on Sub-Blocks)
<abstract>true</abstract>                    → block.abstract = true
<final>true</final>                          → block.final = true
<subType type="…"/>                          → block.subTypes[] (explicit override)
<implType type="…"/>                         → block.implTypes[]
<contract type="…"/>                        → block.contracts[]   (root block only)
<genericType name="…" baseType="…"/>            → block.genericTypes[]    (root block only)
```

```text
```text
Omitted <idea> on root block            → BML_MISSING_IDEA (warning V1)
Omitted <documentation> on root block  → BML_MISSING_DOCUMENTATION (warning V1)
Omitted abstract/final                 → false
Omitted <subTypes>                     → undefined — inherit effective subTypes from baseType chain
Empty <subTypes/>                        → block.subTypes = [] (explicit override — forbid Sub-Blocks)
Omitted implTypes / contracts / genericTypes → inherit from baseType at validate
<contracts> on Sub-Block                 → BML_CONTRACT_NOT_ON_ROOT (error)
Duplicate contract type                → BML_DUPLICATE_CONTRACT (error)
<genericTypes> on Sub-Block                  → BML_GENERIC_NOT_ON_ROOT (error)
Duplicate genericType name                   → BML_DUPLICATE_GENERIC (error)
org.blockml.core.Block                   → omits <baseType> (sole inheritance root)
```

TypeBlock BML uses the same `BlockDefinition` shape as all Blocks — StructTypes declare members via `<properties>`; EnumTypes declare values via `<aggregation name="_values"><composition>…</composition></aggregation>`; generic Blocks declare parameters via `<genericTypes>`. Branch-specific validation — see `17_type_system_bml.md`.

### Member attributes

All member kinds (`<property>`, `<aggregation>`, `<association>`, `<capability>`) map common attributes to `MemberDefinitionBase`:

```text
name="size"              → name
namespace="ui"           → namespace (resolved — see below)
visibility="protected"   → visibility (optional; derived from name when omitted)
readOnly="true"          → readOnly
final="true"             → final
<documentation>…         → documentation
```

**Member `namespace` resolution (stage [5]):**

The `namespace` attribute value is an **XML namespace prefix** — not a raw URI or dotted name. The parser looks up the prefix in the current document's `xmlns:` bindings (same mechanism as element prefixes and `type:` shorthand).

```text
Document:  xmlns:ui="com.foo.ui"
Authored:  <property namespace="ui" name="width" …/>

BOM:       PropertyDefinition {
             namespace: "com.foo.ui",   // resolved identifier — never "ui"
             name: "width",
             …
           }
```

```text
Omitted namespace attribute  →  namespace undefined / default namespace (empty string)
Undeclared prefix            →  BML_UNKNOWN_NAMESPACE_PREFIX (parse error)
Prefix alias never stored    →  BOM contains canonical identifiers only
```

**Override matching:** `resolveEffectiveMembers()` compares members by **resolved `(namespace, name)`**. A child Block may use a different XML prefix for the same namespace URI — the override still matches.

```text
Parent (xmlns:ui="com.foo.ui"):     namespace="ui"   name="width"
Child  (xmlns:design="com.foo.ui"): namespace="design" name="width" value="42"
→ same key (com.foo.ui, width) → override merges
```

Property-specific:

```text
type="…"                 → typeFqn (resolved)
value="…"                → value (LiteralValue or ExpressionValue). Formerly defaultValue.
<constraints>            → constraints[] (BlockInstance[], document order)
<suggestions>            → suggestions[] (BlockInstance[], document order)
```

**`<constraints>` mapping:**

Each child element inside `<constraints>` is mapped as a `BlockInstance`. The element name resolves to a Block FQN via namespace prefix (same rules as composition children). Stage [8] validates:

```text
instance.typeFqn baseType chain includes org.blockml.core.Constraint
generic T bound to property type (or element/collection type per constraint definition)
constraint instance member values match bound generic T
property value satisfies constraint semantics
```

**`<suggestions>` mapping:**

Each child element inside `<suggestions>` is mapped as a `BlockInstance`. Stage [8] validates:

```text
instance.typeFqn compatible with property typeFqn
```

Suggestions are metadata — no value enforcement. See `18_constraints_and_suggestions.md`.

Visibility derivation when `visibility` is omitted:

```text
name starts with "__"  →  private
name starts with "_"   →  protected (single underscore)
otherwise              →  public
```

Mismatch between derived and explicit `visibility` → `BML_VISIBILITY_MISMATCH` at validate.

Partial overrides: a child Block may declare a member with only `name` and changed attributes. Unspecified fields inherit from the parent member at `resolveEffectiveMembers()`. Override key is resolved `(namespace, name)` — not the XML prefix.

**General namespace rule:** all XML prefixes in BML (Block type tags, `type:` shorthand, member `namespace`, `bml:*`, `data:*`) are resolved during parsing. The BOM stores canonical namespace identifiers only. See `02_mbml.md` — Namespaces · § Member Namespace Attribute.

---

## Expression Parsing (Two-Phase)

Expression handling is split across two pipeline stages:

```text
Stage [5] BML → BOM Mapper
  Detect ${ ... } spans in attribute and directive values
  Store ExpressionValue { raw, source }  — no AST yet

Stage [7] Expression Parser
  Walk BomDocument; find all ExpressionValue nodes
  Parse raw → ExpressionNode AST
  Set resultTypeFqn (initial inference)
  On parse failure → BML_EXPR_SYNTAX_ERROR
```

### Stage [5] — raw capture

When an attribute or directive value contains `${ }`:

```text
size="${ [size[0], size[1], size[2] - 1] }"
  → ExpressionValue {
       raw: "[size[0], size[1], size[2] - 1]",   // inside delimiters, trimmed
       source: { line, column of opening ${ }
     }

size="[1, 8, 9]"
  → LiteralValue   (no ${ } — deserialized in stage [6])
```

Directive values (e.g. `bml:each="i : ${ numberOfSamples }"`) are split structurally in stage [5]: loop variables parsed from the prefix; the `${ }` portion stored as `ExpressionValue { raw }` on the directive node.

Stage [5] does **not** build AST nodes and does **not** resolve property references.

### Stage [7] — AST construction

The Expression Parser receives the stage-[5] `BomDocument` and enriches every `ExpressionValue`:

```text
ExpressionValue { raw: "[size[0], size[1], size[2] - 1]" }
  → ast: AccessExpression / BinaryExpression / … tree
  → resultTypeFqn: inferred from context (member type hint) or from literal roots
```

Parse context (`ParseContext`) is built from the enclosing Block, directive scope (`bml:each` / `bml:with` variables on ancestor chain), and the target member being assigned.

Expressions are **parsed, not evaluated** at this stage. See `10_expression_language.md` — Expression AST.

### Why two phases

```text
Stage [5] needs no expression grammar  — only ${ } detection and raw extraction
Stage [7] runs once the BOM graph exists — full scope context available
Stage [6] can validate literals before expressions are parsed
Errors in structure (mapping) vs. expression syntax are separated
```

After stage [7] completes successfully, every `ExpressionValue` must have `ast` set. Stage [8] validates AST semantics (types, references, scope).

---

## Cross-File Resolution & TypeRegistry Bootstrap

The parser is **single-file scoped**. Cross-file resolution is a **bootstrap + validation** concern in `@blockml/core` and `@blockml/cli`.

### Responsibilities

```text
@blockml/parser (stage [5])
  Input:   one BML source file (+ format hint)
  Output:  one BomDocument
  Stores:  external refs as typeFqn + version on BlockInstance — does NOT load other files

@blockml/core (TypeRegistry + stages [6–8])
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
     @blockml/core/blocks        →  org.blockml.core.*, org.blockml.service.*
     @machineblocks/mbom/blocks  →  com.machineblocks.core.*

2. Discover BML sources
     Project srcDir scan     →  all *.bml
     library.xml manifests   →  explicit <block> / <presets> refs (optional index)
     Declared dependencies   →  transitive library paths from bom.config.json / library.xml

3. Parse each discovered file (single-file parser — stage [5–7])
     registerBlockDefinition(doc)  for each BomDocument

4. Validate / compile target file(s) using populated registry (stages [6–8])
```

Without `library.xml`, all BML files in a directory are discovered and registered. With `library.xml`, the manifest lists public blocks and presets; see `02_mbml.md` — Library Format.

### What the parser stores for external references

```xml
<bricks:StandardBrick bml:version="3.0.0" bml:id="strip" size="[2, 4, 3]" />
```

Stage [5] output — no file load:

```text
BlockInstance:
  typeFqn:  com.machineblocks.bricks.StandardBrick
  version:  "3.0.0"          ← required pin, stored as authored
  memberValues: { id, size }
```

Stage [8] lookup:

```typescript
registry.getBlockDefinition("com.machineblocks.bricks.StandardBrick", "3.0.0")
  → BlockDefinition | undefined
  → undefined → BML_UNKNOWN_VERSION
  → version missing on instance → BML_MISSING_VERSION
```

Same-document Sub-Block references omit `version` — resolved against `subBlocks[]` in the same `BomDocument`.

### Preset cross-file references (MachineBlocks)

```text
basePresets="com.martianmicro.anyclosure.WallPresets::large"
  → Parser stores string as authored (stage [5])
  → Validator resolves preset BlockDefinition + preset instance id in _presets (stage [8])

basePresets="brick-1x1 com.other.Presets::color-red"
  → Stored on Block instance memberValues.basePresets (stage [5])
  → Validator resolves each token as local id or FQN::id (stage [8])
```

Preset instances in `_presets` composition map like any other Block instance. The `name` attribute maps to `memberValues.name`; `bml:id` maps to `BlockInstance.id`.

```text
<aggregation name="_presets">
  <composition export="true">  →  CompositionTemplate.export = true
```

Qualified `{BlockFQN}::{id}` references (e.g. in `basePresets`) validate against exported compositions with static target ids — see `00_bom_core.md` — Qualified Block Instance References.

**Aggregation + composition mapping:**

```text
<aggregations>
  <aggregation name="_parts" type="…">     → AggregationDefinition (+ typeFqn)
    <composition export="true">            → AggregationDefinition.composition OR CompositionTemplate
      …children…
    </composition>
  </aggregation>
</aggregations>

bare <composition> on definition/instance   → CompositionTemplate for default aggregation
<aggregation name="…"> on instance          → BlockInstance.aggregationCompositions[]
```

The `composition aggregation="…"` attribute is **removed** — aggregation is opened by `<aggregation name="…">`.

### Contract validation (stage [8])

```text
<contract type="com.foo.IPlaceable"/>
  → Parser stores FQN in block.contracts[] (stage [5])
  → Validator resolves contract BlockDefinition (stage [8])
  → Contract target must have abstract=true
  → resolveContractMembers(contractFqn) — effective members only;
    subBlocks[] and compositions[] on contract type ignored
  → resolveEffectiveMembers(implementingBlock) must superset contract members
     (name, kind, typeFqn, cardinality compatible)
```

```text
BML_UNKNOWN_CONTRACT              — type FQN not in TypeRegistry
BML_CONTRACT_NOT_ABSTRACT         — contract Block is not abstract
BML_CONTRACT_NOT_ON_ROOT          — <contracts> on Sub-Block
BML_DUPLICATE_CONTRACT            — same type listed twice in block.contracts[]
BML_CONTRACT_MEMBER_MISSING         — required contract member absent
BML_CONTRACT_MEMBER_INCOMPATIBLE    — member kind or type/cardinality mismatch
```

### Library blocks

Library descriptors map like any `BlockDefinition` with `baseType: org.blockml.core.Library`. Composition children:

```text
<Dependency ref="…" version="…"/>  → org.blockml.core.Library.Dependency (short name)
<Schema ref="bricks.xsd"/>         → org.blockml.core.Library.Schema
<TypeRef ref="types/Size3D.bml"/>  → org.blockml.core.Library.TypeRef
<BlockRef ref="blocks/Wall.bml"/>  → org.blockml.core.Library.BlockRef
<BlockRef ref="presets/WallPresets.bml"/>  → preset block via _blocks
```

Short names resolve via inherited Sub-Blocks of `org.blockml.core.Library` on any Library-typed root block.

Each child requires explicit `<aggregation name="…">` (`_dependencies`, `_schemas`, `_types`, `_blocks`) — Library has no default aggregation.

**Orchestrator (not parser):** after parsing a Library block, resolve each `ref` path relative to the library package root, parse referenced files, and `registerBlockDefinition`. Validate `Dependency.ref` + `version` against a registered Library block FQN.

### Incremental builds

Because the parser is single-file, the hash cache keys per output artifact include **transitive dependency versions** from the TypeRegistry — not inline parsed trees. See `06_compiler.md` — Incremental Build.

The orchestrator re-bootstraps or incrementally updates the TypeRegistry when any registered source file changes.

---

## JSON BML Format (Deferred — TBD)

JSON as a BML **authoring format** is **not implemented in V1**. The V1 parser accepts **XML only** (`.bml`).

JSON may eventually support a very restricted subset (e.g. flat preset blocks, simple leaf blocks). Whether a viable mapping exists is **TBD** — intensive XML namespace usage (`xmlns:bricks`, `bml:*`, `data:*`, typed element names) has no natural JSON equivalent. Full BML power requires XML.

When JSON support is specified, it will register a separate root-type mapping rule and JSON Schema — not in V1.

See `02_mbml.md` — Serialization Formats for the design rationale.

---

## Open Decisions

| ID | Topic | Status |
|---|---|---|
| B2 | Unknown instance attributes — warning; unknown `bml:*` — error | **Decided** |
| B3 | `inputType` / `outputType` storage — `TypeDescriptor` union (anonymous struct model) | **Decided** |
| B4 | Expression parsing — two-phase (raw in [5], AST in [7]) | **Decided** |
| B5 | Cross-file / TypeRegistry — single-file parser; orchestrator bootstrap | **Decided** |
| B6 | JSON BML authoring format | **Deferred (TBD)** — not in V1; XML-only parser |

---

## Related Documents

| Topic | Document |
|---|---|
| BOM object model | `12_bom_object_model.md` |
| Expression AST | `10_expression_language.md` |
| Directive placement rules | `12_bom_object_model.md` — Directive Placement Rules |
| Default resolution shortcuts | `02_mbml.md` — BML→BOM Mapping |
