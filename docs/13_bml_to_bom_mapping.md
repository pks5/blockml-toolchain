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

## Fundamental Rule

> **BML → BOM → BML must always be possible.** The mapper preserves authored structure and authored values. It makes no interpretive decisions. See `00_bom_core.md` — Fundamental Architecture Principles.

```text
Mapper responsibility:     structure + classification + preservation
NOT mapper responsibility: canonicalization, expansion, merge, evaluation
```

---

## Pipeline Placement

```text
[4] Namespace Resolver     → FQN prefix bindings
[5] BML → BOM Mapper       → this document (structure + attribute classification) → Canonical BOM
```

Expression parsing, type validation, and semantic validation are **framework utilities** — not parser stages. See `06_compiler.md` — Framework Utilities.

Stage [5] produces the immutable BOM graph with expression **raw** text only. `parseExpression()` is a separate utility.

---

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

Ordinal = index in `members[]` after mapping. Used by renderers when interpreting StructType array literals against field declaration order and by FunctionMapping for positional capability parameters. See `17_type_system_bml.md` — Declaration Order · `18_function_mapping.md` · `12_bom_object_model.md` — Member Declaration Order.

### Canonical definition paths

BML member containers are preserved structurally in the meta-model (`org.blockml.bml.definition.BlockDefinition`). The BOM stores members in a flat `members[]` array tagged by `kind` (`property`, `aggregation`, `association`, `capability`). Reflection and expression evaluation resolve canonical paths via the structural containers:

```text
com.foo.Bar.properties.width   →  members[] entry where kind="property" and name="width"
com.foo.Bar.aggregations.parts →  members[] entry where kind="aggregation" and name="parts"
com.foo.Bar.capabilities.render → members[] entry where kind="capability" and name="render"
```

Block metadata (`name`, `idea`, `documentation`, `version`, `baseType`, …) maps to top-level `BlockDefinition` fields — addressable directly under the Block FQN without a container segment. See `00_bom_core.md` — § Canonical definition paths · `16_framework_base_types.md` — § Definition Addressing.

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
| **JSON BML format** | **Deferred (TBD).** V1 parser accepts XML only (`.bml`) |
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
otherwise                    → LiteralValue (authored value preserved — type-checked in stage [6])
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

Capability and property type attributes are parsed into **`TypeExpression`** objects at map time (V1 alias: `TypeDescriptor`) — not stored as raw strings. Lives in **`@blockml/parser`** BOM interfaces — not in `org.blockml.bml.type.*`. See `00_bom_core.md` — Mandatory BML namespace · `17_type_system_bml.md` — Type Expressions.

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
<aggregation type="bcore:BlockLibrary[]" .../>   on org.blockml.bml.core.BlockLibrary
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
Unsupported language → BML_IMPLEMENTATION_NOT_SUPPORTED (validate — not in baseType languages)
```

V1 known languages: `org.blockml.bml.language.TypeScript`, `org.blockml.bml.language.OpenSCAD`.

### Type modifiers

Optional elements on `<block>` — mapped to `BlockDefinition` fields. See `16_framework_base_types.md`.

```text
```text
<idea>…</idea>                               → block.idea (trimmed text)
<documentation>…</documentation>             → block.documentation (trimmed text)
<since>…</since>                             → block.since (trimmed text)
<changelog>                                  → block.changelog[]
  <change version="…">…</change>             → { version, text: trimmed body }
<examples>                                   → block.examples[]
  <example title="…" language="…">           → { title, content: CDATA body, language? }
<references>                                 → block.references[]
  <see block="…">…</see>         → { block, context: trimmed body }
  <see file="…">…</see>          → { file, context: trimmed body }
  <see url="…">…</see>           → { url, context: trimmed body }
<status>Draft</status>                → member.statusFqn or block.statusFqn (when declared)
                                             → omitted: inherit effective status from parent
<name>…</name>                               → block.name
<type>…</type>                               → block.type (FQN; root block only — derived on Sub-Blocks)
<version>…</version>                         → block.version
<abstract />                                 → block.abstract = true  (equivalent: <abstract>true</abstract>)
<final />                                    → block.final = true     (equivalent: <final>true</final>)
<visibility>…</visibility>                   → block.visibility (Sub-Block only; root → BML_VISIBILITY_ON_ROOT_BLOCK)
<core:Block />                               → block.subTypes[] (direct Block reference in <subTypes>)
<lang:OpenSCAD />                            → block.languages[] (direct Language reference in <languages>)
<ac:Wall />                                  → block.contracts[]   (direct Block reference in <contracts>; root block only)
<baseType="…"/>                            → block.genericTypes[] { name: element local name, baseType, defaultType? } (root block only)
```

```text
```text
Omitted <idea> on root block            → BML_MISSING_IDEA (warning V1)
Omitted <documentation> on root block  → BML_MISSING_DOCUMENTATION (warning V1)
Omitted <since> / <changelog> / <examples> / <references> → undefined (optional)
Invalid <since> version                  → BML_INVALID_SINCE_VERSION (error)
<changelog> entries out of version order → BML_CHANGELOG_VERSION_ORDER (warning V1)
<example> without title attribute        → BML_EXAMPLE_MISSING_TITLE (error)
<example> body not CDATA                 → BML_EXAMPLE_NOT_CDATA (error)
<see> without block, file, or url          → BML_REFERENCE_MISSING_TARGET (error)
<see> with more than one target attr       → BML_REFERENCE_AMBIGUOUS_TARGET (error)
Omitted abstract/final                 → false
Omitted <visibility> on Sub-Block      → derive from <name> (__ → private, _ → protected, else public)
<visibility> on root Block               → BML_VISIBILITY_ON_ROOT_BLOCK (error)
<visibility> mismatches <name>           → BML_VISIBILITY_MISMATCH (error)
Private member access outside scope      → BML_PRIVATE_MEMBER_ACCESS (error)
Protected member access outside scope    → BML_PROTECTED_MEMBER_ACCESS (error)
Private Sub-Block reference outside scope → BML_PRIVATE_SUBBLOCK_ACCESS (error)
Protected Sub-Block reference outside scope → BML_PROTECTED_SUBBLOCK_ACCESS (error)
Duplicate members by visibility prefix   → BML_DUPLICATE_MEMBER_VISIBILITY_VARIANT (error)
Omitted <subTypes>                     → undefined — inherit effective subTypes from baseType chain
Empty <subTypes/>                        → block.subTypes = [] (explicit override — forbid Sub-Blocks)
Omitted languages / contracts          → inherit from baseType at validate
Omitted genericTypes                 → none — generic parameters are not inherited; bind or forward via baseType
<contracts> on Sub-Block                 → BML_CONTRACT_NOT_ON_ROOT (error)
Duplicate contract reference           → BML_DUPLICATE_CONTRACT (error)
<genericTypes> on Sub-Block                  → BML_GENERIC_NOT_ON_ROOT (error)
Duplicate generic parameter name             → BML_DUPLICATE_GENERIC (error)
generic parameter element name equals Block <name>         → BML_GENERIC_BLOCK_NAME_COLLISION (error)
generic parameter element name equals Sub-Block <name>     → BML_GENERIC_SUBBLOCK_NAME_COLLISION (error)
Unqualified block reference without FQN or xmlns prefix → BML_UNQUALIFIED_BLOCK_REFERENCE (error)
Ambiguous Sub-Block short name (same as root) → BML_SUBBLOCK_QUALIFIED_REFERENCE_REQUIRED (error)
org.blockml.bml.core.Block                   → omits <baseType> (sole inheritance root)
```

ValueType BML uses the same `BlockDefinition` shape as all Blocks — StructTypes declare members via `<properties>`; EnumTypes declare values via `<_values><composition>…</composition></_values>`; generic Blocks declare parameters via `<genericTypes>`. Branch-specific validation — see `17_type_system_bml.md`.

### Member attributes

All member kinds map common fields to `MemberDefinitionBase`:

```text
element localName          → name
element prefix (if any)    → namespace (resolved — see below)
visibility="protected"     → visibility (optional; derived from name when omitted)
readOnly="true"            → readOnly (validator-enforced on instances — see 02_mbml.md § readOnly Members)
final="true"               → final
<documentation>…           → documentation
<since>…                   → since
<changelog>…               → changelog[]
<examples>…                → examples[]
<references>…              → references[]
<status>Draft</status>  → statusFqn (when declared; omitted → inherit from parent)
```

Legacy `namespace="…"` attribute on member elements → **`BML_DEPRECATED_MEMBER_NAMESPACE_ATTR` (error)** at map time. Namespace is supplied exclusively by the element QName.

**Non-definition elements** (`<documentation>`, `<since>`, `<changelog>`, `<examples>`, `<references>`, `<idea>`, `<implementation>`, Block instances, …) may carry `bml:status="Draft"` — mapped to `statusFqn` on the same BOM node **only when deviating** from inherited status. No `<status>` child on these elements.

**Effective status resolution (stage [5] / validate [8]):**

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

**Member namespace resolution (stage [5]):**

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

**Override matching:** `resolveEffectiveMembers()` compares members by **resolved `(namespace, name)`**. A child Block may use a different XML prefix for the same namespace URI — the override still matches.

```text
Parent (xmlns:ui5="com.sap.ui5"):   <ui5:width …/>
Child  (xmlns:design="com.sap.ui5"): <design:width value="42"/>
→ same key (com.sap.ui5, width) → override merges
```

Property-specific:

```text
type="…"                 → typeFqn (resolved)
value="…"                → value (LiteralValue or ExpressionValue). Absent → Optional.empty.
valueRequired="true|false" → valueRequired (boolean; default false)
                           → Validator checks at stage [8] only after resolveEffectiveMembers()
                             (baseType + contracts + local) and instance value binding;
                             missing value → BML_VALUE_REQUIRED
<constraints>            → constraints[] (BlockInstance[], document order)
<suggestions>            → suggestions[] (BlockInstance[], document order)
```

**`<constraints>` mapping:**

Each child element inside `<constraints>` is mapped as a `BlockInstance`. The element name resolves to a Block FQN via namespace prefix (same rules as composition children). Stage [8] validates:

```text
instance.typeFqn baseType chain includes org.blockml.bml.core.Constraint
generic T bound to property type (or element/collection type per constraint definition)
constraint instance member values match bound generic T
validation reference (when present) resolves to org.blockml.bml.core.Validation sub-type
property value satisfies constraint semantics only when validation is present and understood
```

Constraints without a `validation` reference are not value-enforced by the BlockML validator.

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

**General namespace rule:** all XML prefixes in BML (Block type tags, member element QNames, `type:` shorthand, `bml:*`) are resolved during parsing. The BOM stores canonical namespace identifiers only. See `02_mbml.md` — Namespaces · § Member Namespace (Element QName).

---

## Expression Parsing (Two-Phase)

Expression handling spans parser and utility:

```text
Stage [5] BML → BOM Mapper
  Detect ${ ... } spans in attribute and directive values
  Store ExpressionValue { raw, source } in Canonical BOM

parseExpression() utility (@blockml/core)
  Input:  ExpressionValue.raw + ParseContext
  Output: ParsedExpression { ast, resultTypeFqn } — NOT written to BOM
  On failure → BML_EXPR_SYNTAX_ERROR
```

### Stage [5] — raw capture

When an attribute or directive value contains `${ }`:

```text
size="${ [size.x, size.y, size.z - 1] }"
  → ExpressionValue {
       raw: "[size.x, size.y, size.z - 1]",   // inside delimiters, trimmed
       source: { line, column of opening ${ }
     }

size="[1, 8, 9]"
  → LiteralValue { value: [1, 8, 9], typeFqn: "…Size3D" }   (authored form; type-checked by validateTypes() utility)
```

Directive values (e.g. `bml:each="i : ${ numberOfSamples }"`) are split structurally in stage [5]: loop variables parsed from the prefix; the `${ }` portion stored as `ExpressionValue { raw }` on the directive node.

Stage [5] does **not** build AST nodes and does **not** resolve property references.

`<implementation language="…">` CDATA is stored verbatim on `ImplementationBlock.source`. During stage [5], the mapper scans for `<$ … $>` pairs and appends each to `ImplementationBlock.embeddedExpressions`:

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

Validation (stage [8]) runs `parseExpression()` on each `embeddedExpressions[].raw` and applies the same semantic checks as member-value expressions, plus `#this` resolution against `resolveEffectiveMembers()`. See `10_expression_language.md` — BML Embedded Expressions.

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
Stage [5] needs no expression grammar  — only ${ } detection and raw extraction
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
     @blockml/core/blocks        →  org.blockml.bml.core.*, org.blockml.bml.service.*
     @machineblocks/mbom/blocks  →  com.machineblocks.bml.core.*

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
  typeFqn:  com.machineblocks.bml.bricks.StandardBrick
  version:  undefined | "3.0.0"   ← optional; omitted = resolve from registry context at stage [8]
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

Inside Library files: `bml:version` on `_dependencies` / `_blocks` children → `BML_VERSION_NOT_ALLOWED_IN_LIBRARY`.

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
<_presets>
  <composition bml:exportIds="true">  →  CompositionTemplate.exportIds = true
```

Qualified `{BlockFQN}::{id}` references (e.g. in `basePresets`) validate against exported compositions with static target ids — see `00_bom_core.md` — Qualified Block Instance References.

**Aggregation + composition mapping:**

```text
<aggregations>
  <_parts type="…">                        → AggregationDefinition (+ typeFqn)
    <composition bml:exportIds="true">     → AggregationDefinition.composition OR CompositionTemplate
      …children…
    </composition>
  </_parts>
</aggregations>

bare <composition> on definition            → BML_STANDALONE_COMPOSITION (error)
<{aggregationName}><composition>…           → CompositionTemplate for that aggregation
<memberName> on instance                    → BlockInstance.aggregationCompositions[]
```

The `composition aggregation="…"` attribute is **removed** — aggregations are opened by member element name.

### Contract merge (stage [8])

```text
<ac:IIdentifiable/>
  → Parser resolves element name via xmlns prefix → FQN stored in block.contracts[] (stage [5])
  → Validator resolves contract BlockDefinition (stage [8])
  → resolveContractMembers(contractFqn) — declared members only;
    subBlocks[] and compositions[] on contract type ignored
  → resolveEffectiveMembers(implementingBlock) merges:
       baseType chain members
     → contract members (in block.contracts[] order; later overrides earlier)
     → Block local declarations (override all)
     Same partial-override rules as baseType inheritance
```

```text
BML_UNKNOWN_CONTRACT              — type FQN not in TypeRegistry
BML_CONTRACT_NOT_ON_ROOT          — <contracts> on Sub-Block
BML_DUPLICATE_CONTRACT            — same type listed twice in block.contracts[]
BML_CONTRACT_MEMBER_KIND_MISMATCH — override uses a different member kind than merged member
BML_FINAL_MEMBER_OVERRIDE         — override attempted on final member (from contract or baseType)
BML_READONLY_MEMBER_WRITE         — Block instance sets a member with readOnly=true
```

### Library blocks

Library descriptors map like any `BlockDefinition` with `baseType: org.blockml.bml.core.BlockLibrary`. Composition children:

```text
<blockml:Library />                        → BlockInstance { typeFqn: "org.blockml.bml.Library" }  — no bml:version
<Schema ref="bricks.xsd"/>                 → org.blockml.bml.core.BlockLibrary.Schema (short name)
<type:Size3d />                             → BlockInstance { typeFqn: "com.machineblocks.bml.type.Size3d" }
<bricks:Wall />                             → BlockInstance { typeFqn: "com.machineblocks.bml.bricks.Wall" }
<bricks:WallPresets />                      → preset block via _blocks
```

`_dependencies` and `_blocks` hold empty Block instances as type references — element name resolves to FQN. **`bml:version` is forbidden** on these children. Type-reference interpretation is context-driven (Library role) — not declared on the aggregation.

Each child requires explicit aggregation members (`_dependencies`, `_schemas`, `_blocks`) — BlockLibrary has no default aggregation.

**Orchestrator (not parser):** after parsing a Library block, resolve each `_dependencies` and `_blocks` entry by FQN, load the referenced definitions using effective block versions, and `registerBlockDefinition`. Validate that outer libraries do not re-export blocks from nested inner libraries (`BML_LIBRARY_NESTING_VIOLATION`).

### Incremental builds

Because the parser is single-file, the hash cache keys per output artifact include **transitive dependency versions** from the TypeRegistry — not inline parsed trees. See `06_compiler.md` — Incremental Build.

The orchestrator re-bootstraps or incrementally updates the TypeRegistry when any registered source file changes.

---

## JSON BML Format (Deferred — TBD)

JSON as a BML **authoring format** is **not implemented in V1**. The V1 parser accepts **XML only** (`.bml`).

JSON may eventually support a very restricted subset (e.g. flat preset blocks, simple leaf blocks). Whether a viable mapping exists is **TBD** — intensive XML namespace usage (`xmlns:bricks`, `bml:*`, prefixed member element names, typed element names) has no natural JSON equivalent. Full BML power requires XML.

When JSON support is specified, it will register a separate root-type mapping rule and JSON Schema — not in V1.

See `02_mbml.md` — Serialization Formats for the design rationale.

---

## Open Decisions

| ID | Topic | Status |
|---|---|---|
| B2 | Unknown instance attributes — warning; unknown `bml:*` — error | **Decided** |
| B3 | `inputType` / `outputType` storage — `TypeDescriptor` union (anonymous struct model) | **Decided** |
| B4 | Expression parsing — raw in BOM; AST via parseExpression() utility | **Decided** |
| B5 | Cross-file / TypeRegistry — single-file parser; orchestrator bootstrap | **Decided** |
| B6 | JSON BML authoring format | **Deferred (TBD)** — not in V1; XML-only parser |

---

## Related Documents

| Topic | Document |
|---|---|
| BOM object model | `12_bom_object_model.md` |
| Expression AST | `10_expression_language.md` |
| Embedded expressions in implementations | `10_expression_language.md` — BML Embedded Expressions |
| Directive placement rules | `12_bom_object_model.md` — Directive Placement Rules |
| Default resolution shortcuts | `02_mbml.md` — BML→BOM Mapping |
