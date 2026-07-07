# BML → BOM Mapping

version: 0.2.0

## Purpose of this Document

This document defines the **algorithmic mapping rules** from parsed BML (XML/JSON) to `BomDocument` — the implementation contract for `@blockml/parser`.

For BOM target types see `12_bom_object_model.md`.
For BML authoring syntax see `02_mbml.md`.
For expression parsing see `10_expression_language.md`.
For compiler pipeline placement see `06_compiler.md`.

Mapping rules are registered per root type (`<block>`, …) — not hardcoded in the parser core. V1 has a single root type: `<block>` (including PresetCollection blocks).

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

## Design Decisions

| Topic | Decision |
|---|---|
| **Directives** | Stored as `directives[]` on the element — not expanded at parse time |
| **Custom data** | `data:*` → `customData[]` (UI5 model — not a `bml:` directive) |
| **Registry** | **Removed.** Sibling value sharing via `bml:with` on `<composition>` or `<bml:block>` |
| **Attribute classification** | Fixed priority chain — see § Attribute Classification below |
| **Unknown member attributes** | Warning `BML_UNKNOWN_PROPERTY` at validate (custom property assumed) |
| **Unknown `bml:*` attributes** | Error `BML_UNKNOWN_DIRECTIVE` at map time |
| **`payloadType` / `returnType`** | Parsed into `TypeDescriptor` at map time — anonymous `{ a: Float }` = anonymous struct type |
| **Expression parsing** | Two-phase: stage [5] stores `raw`; stage [7] builds AST |
| **Cross-file resolution** | Single-file parser; TypeRegistry bootstrap by CLI/orchestrator before validate |
| **JSON BML format** | **Deferred (TBD).** V1 parser accepts XML only (`.bml` / `.mbml`) |
| **Composition render** | Leaf geometry → NativeBlock → `mb_block()`; see `14_compiler_runtime.md` |

---

## Attribute Classification

When mapping an XML element to a BOM node, every attribute is classified using this **fixed priority chain**. The first matching rule wins.

```text
1. xmlns*, xsi:*              → ignore (except xmlns bindings → SourceInfo.namespaceBindings)
2. bml:*                      → DirectiveAttribute → directives[]
3. data:*                     → CustomDataEntry → customData[]  (Block definitions + Block instances only)
4. Instance meta attributes   → BlockInstance fields (not memberValues)
5. All other attributes       → memberValues[name]  (camelCase property/capability values)
```

### Rule 1 — XML infrastructure

```text
xmlns:bricks="com.machineblocks.bricks"   → namespaceBindings["bricks"]
xsi:schemaLocation="..."                  → ignored
```

### Rule 2 — `bml:*` directives

Parsed into `DirectiveAttribute` on the **same element** (Thymeleaf model):

| Attribute | AST type |
|---|---|
| `bml:each` | `EachDirective` |
| `bml:if` | `IfDirective` |
| `bml:unless` | `UnlessDirective` |
| `bml:with` | `WithDirective` |

Any other `bml:*` attribute name → **`BML_UNKNOWN_DIRECTIVE` (error)**. Examples: `bml:id`, `bml:foo`, typos like `bml:ech`.

Known directive on a disallowed element (see placement rules in `12_bom_object_model.md`) → **`BML_DIRECTIVE_NOT_ALLOWED` (error)**.

Directive values that contain `${ }` are stored as `ExpressionValue` (raw in stage [5], AST in stage [7]).

There is no `bml:id` — `id` is a system property (rule 5).

### Rule 3 — `data:*` custom data

Only valid on Block definitions and Block instances (elements whose type extends `org.blockml.core.Block`).

```text
data:role="structural"  →  customData[] { key: "role", value: "structural" }
```

All values are strings. Invalid placement (e.g. on `<capability>`) → diagnostic error at map time.

### Rule 4 — Instance meta attributes

Applies to **Block instance elements** in a composition. These map to `BlockInstance` fields directly — not `memberValues`:

| Attribute | BOM field |
|---|---|
| `version` | `BlockInstance.version` |
| `presetRef` | `BlockInstance.presetRef` |
| `renderGroup` | `BlockInstance.renderGroup` |
| `namespace` | `BlockInstance.namespace` |

On Block **definitions**, these attributes do not appear — definition metadata uses child elements (`<version>`, etc.).

### Rule 5 — Member values

All remaining attributes become `memberValues[name]`:

```text
size="[1, 8, 9]"           → memberValues.size (LiteralValue or ExpressionValue)
id="wall"                    → memberValues.id   (system property — still stored here)
id="${ 'val_' + i }"         → memberValues.id   (ExpressionValue)
blockId="wall"               → memberValues.blockId
onResized="stud://..."       → memberValues.onResized (AddressValue or ExpressionValue)
```

Value classification within rule 5:

```text
${ ... }                     → ExpressionValue { raw }  (AST added in stage [7])
address-shaped capability    → AddressValue
otherwise                    → LiteralValue (typed deserializer — see § Literal Deserialization, pending)
```

Unknown member names survive rule 5 and are stored in `memberValues`. The semantic validator emits **`BML_UNKNOWN_PROPERTY` (warning)** — custom property assumed. See § Unknown Attributes below.

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
    version="3.0.0"
    id="${ 'val_' + i }"
    bml:each="i : ${ numberOfSamples }"
    size="[1, 1, 1]"
    data:role="sample"
    renderGroup="calibration" />
```

Output (`BlockInstanceNode`):

```text
instance:
  typeFqn:     com.machineblocks.bricks.StandardBrick
  version:     "3.0.0"
  renderGroup: "calibration"
  memberValues:
    id:   ExpressionValue
    size: LiteralValue
  customData:
    [{ key: "role", value: "sample" }]
directives:
  [EachDirective { variables: ["i"], collection: ExpressionValue }]
```

---

## Type Descriptor Parsing

Capability and property type attributes are parsed into **`TypeDescriptor`** objects at map time — not stored as raw strings.

```text
payloadType="Float"
  → NamedTypeReference { fqn: "org.blockml.type.Float" }

payloadType="{ a: Float, b: Float }"
  → AnonymousStructType {
       fields: [
         { name: "a", type: NamedTypeReference(Float) },
         { name: "b", type: NamedTypeReference(Float) }
       ]
     }
```

Conceptually, `{ a: Float, b: Float }` is shorthand for an anonymous class with private fields `a` and `b` — see `12_bom_object_model.md` — Type Descriptors.

Single-parameter Capabilities use a primitive `NamedTypeReference` directly — no one-field struct wrapper.

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
Unsupported type → BML_IMPLEMENTATION_NOT_SUPPORTED (validate — not in baseType supportedImplementationTypes)
```

V1 known types: `org.blockml.language.TypeScript`, `org.blockml.language.OpenSCAD`.

### Type modifiers

Optional elements on `<block>` — mapped to `BlockDefinition` fields. See `16_framework_base_types.md`.

```text
<documentation>…</documentation>             → block.documentation (trimmed text)
<abstract>true</abstract>                    → block.abstract = true
<final>true</final>                          → block.final = true
<allowedSubBlockType type="…"/>              → block.allowedSubBlockTypes[]
<supportedImplementationType type="…"/>     → block.supportedImplementationTypes[]
```

```text
Omitted <documentation> on root block  → BML_MISSING_DOCUMENTATION (warning V1)
Omitted abstract/final                 → false
Empty <allowedSubBlockTypes/>    → [] (no Sub-Blocks allowed)
Omitted lists                    → undefined (inherit from baseType at validate)
org.blockml.core.Block           → omits <baseType> (sole inheritance root)
```

TypeBlock BML (`<fields>`, `<enumValues>`) maps to the same `BlockDefinition` structure with branch-specific validation — see `17_type_system_bml.md`.

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
     @blockml/core/src           →  org.blockml.core.Block, org.blockml.service.*
     @machineblocks/mbom/src     →  com.machineblocks.core.*
     @blockml/core-services/src  →  org.blockml.service.Math, Strings, …

2. Discover BML sources
     Project srcDir scan     →  all *.bml (and configured extensions, e.g. .mbml)
     library.xml manifests   →  explicit <block> / <presets> refs (optional index)
     Declared dependencies   →  transitive library paths from bom.config.json / library.xml

3. Parse each discovered file (single-file parser — stage [5–7])
     registerBlockDefinition(doc)  for each BomDocument

4. Validate / compile target file(s) using populated registry (stages [6–8])
```

Without `library.xml`, all BML files in a directory are discovered and registered. With `library.xml`, the manifest lists public blocks and presets; see `02_mbml.md` — Library Format.

### What the parser stores for external references

```xml
<bricks:StandardBrick version="3.0.0" id="strip" size="[2, 4, 3]" />
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

### Preset cross-file references

```text
presetRef="com.martianmicro.anyclosure.WallPresets::large"
  → Parser stores string as authored (stage [5])
  → Validator resolves PresetCollection BlockDefinition + Preset instance id in composition (stage [8])

basePresets="brick-1x1 com.other.Presets::color-red"
  → Stored on Preset instance memberValues.basePresets (stage [5])
  → Validator resolves each token as local id or FQN::id (stage [8])
```

Preset instances in a PresetCollection composition map like any other Block instance: element `Preset` → `typeFqn: org.blockml.core.Preset`. Child block elements fill the `block` aggregation (defaultAggregation). The Preset `name` attribute maps to `memberValues.name`; `id` maps to `memberValues.id`.

### Library blocks

Library descriptors map like any `BlockDefinition` with `baseType: org.blockml.core.Library`. Composition children:

```text
<Dependency ref="…" version="…"/>  → typeFqn org.blockml.core.Dependency; ref, version → memberValues
<Schema ref="bricks.xsd"/>         → typeFqn org.blockml.core.Schema; ref → memberValues.ref
<TypeRef ref="types/Size3D.bml"/>  → typeFqn org.blockml.core.TypeRef
<BlockRef ref="blocks/Wall.bml"/>  → typeFqn org.blockml.core.BlockRef
<PresetsRef ref="presets/…"/>      → typeFqn org.blockml.core.PresetsRef
```

Each child requires `aggregation=` (`_dependencies`, `_schemas`, `_types`, `_blocks`, `_presets`) — Library has no default aggregation.

**Orchestrator (not parser):** after parsing a Library block, resolve each `ref` path relative to the library package root, parse referenced files, and `registerBlockDefinition`. Validate `Dependency.ref` + `version` against a registered Library block FQN.

### Incremental builds

Because the parser is single-file, the hash cache keys per output artifact include **transitive dependency versions** from the TypeRegistry — not inline parsed trees. See `06_compiler.md` — Incremental Build.

The orchestrator re-bootstraps or incrementally updates the TypeRegistry when any registered source file changes.

---

## JSON BML Format (Deferred — TBD)

JSON as a BML **authoring format** is **not implemented in V1**. The V1 parser accepts **XML only** (`.bml`, domain extensions such as `.mbml`).

JSON may eventually support a very restricted subset (e.g. flat Preset Collections, simple leaf blocks). Whether a viable mapping exists is **TBD** — intensive XML namespace usage (`xmlns:bricks`, `bml:*`, `data:*`, typed element names) has no natural JSON equivalent. Full BML power requires XML.

When JSON support is specified, it will register a separate root-type mapping rule and JSON Schema — not in V1.

See `02_mbml.md` — Serialization Formats for the design rationale.

---

## Open Decisions

| ID | Topic | Status |
|---|---|---|
| B2 | Unknown instance attributes — warning; unknown `bml:*` — error | **Decided** |
| B3 | `payloadType` storage — `TypeDescriptor` union (anonymous struct model) | **Decided** |
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
