# BOM Object Model

version: 1.0.0

## Purpose of this Document

This document defines the **formal BOM object model** — the canonical data structures produced by `@blockml/parser` and consumed by `@blockml/core`, `@blockml/compiler`, and render targets.

For conceptual foundations see `00_bom_core.md`.
For BML authoring syntax see `02_mbml.md`.
For MachineBlocks domain extensions see `03_mbom.md`.
For optional runtime object patterns see `08_managed_object.md` (implementation blueprint, not required).
For Expression AST node types see `10_expression_language.md` — Expression AST.

This document is the **implementation contract** for `@blockml/core`. It specifies TypeScript-oriented interfaces and validation rules. It does not duplicate domain semantics already defined elsewhere.

---

## Abstraction Principle

> **A BOM document is an abstract representation of BML source.** It preserves authored structure — including directives, aggregation declarations, and unresolved type references. BOM makes **no statement** about how directives are expanded, how aggregations are interpreted, or how blocks are rendered.

> **„Block“ in BML is the mandatory input concept — not a uniform runtime object model.** The parser must read `<block>` documents; validators must walk `baseType` chains. Internal representation after parse is free. See `17_type_system_bml.md` — Semantic Layer vs Compiler Implementation.

```text
BML source          →  abstract, authoring-true
BOM (this doc)      →  canonical parse result — still abstract
Validation          →  resolves inheritance, types, external references
Render Target       →  interprets and serializes
```

Examples of what BOM **stores** vs. what downstream **interprets**:

| Authored in BML | Stored in BOM | Interpreted downstream |
|---|---|---|
| `bml:each`, `bml:if`, `bml:with` | `directives[]` on element | Preprocessor, BlockProcessor, or Validator |
| `data:*` attributes | `customData[]` on Block | Tooling only — UI5-style customData shorthand (see below) |
| `<aggregations>` declaration | `AggregationDefinition` (declared only) | Inherited members (e.g. `_parts` on `com.machineblocks.core.Block`) resolved at validate |
| `<composition>` children | `CompositionNode` tree | Renderer (wrapper logic, assembly patterns) |
| `baseType` FQN | string reference | Type Registry → effective members |
| Preset reference | string `FQN::id` | Preset merge resolver |

---

## Design Decisions

| Topic | Decision |
|---|---|
| **Mutability** | Parse result is an **immutable plain-data graph** (`BomDocument`). Mutable object APIs (ManagedObject pattern) are optional — see `08_managed_object.md`. |
| **Member inheritance** | **Lookup at validate.** BOM stores only **declared** members per Block. Effective members are resolved via `baseType` chain + Type Registry — never merged into the parse result. |
| **Sub-Blocks** | **Nested** in `BlockDefinition.subBlocks[]`. One BML file → one root `BlockDefinition` with embedded sub-block definitions. |
| **Semantic vs runtime** | BML `<block>` is one authoring element for all definition kinds; internal split into separate interfaces/registries is **implementation freedom** — see `17_type_system_bml.md`. |
| **Directives** | `bml:*` stored as **attributes on the element** they apply to (Thymeleaf model) — not as wrapper nodes. **Not expanded** at parse time. `bml:id` does not exist — `id` is a **system property** on `org.blockml.core.Block`. |
| **Custom data** | `data:*` follows the **UI5 customData model** — arbitrary key/value metadata on Block elements. Parsed into `customData[]`; not a `bml:` directive. |
| **Instance `version`** | **Required on every external block reference** (another file). **Strict from V1** — no registry default, no implicit `latest`, no migration warnings. Missing → `BML_MISSING_VERSION` (error). Unknown version → `BML_UNKNOWN_VERSION` (error). Same-document Sub-Blocks exempt. |
| **Instance `id`** | **Authored in BOM only** — parser stores `memberValues.id` when present; no auto-ID in `BomDocument`. Auto-IDs assigned **after directive expansion** for static unreferenced children. Referenced instances and `bml:each` elements require explicit `id`. No FQN fallback. |

---

## Package Ownership

```text
@blockml/core
  - All interfaces in this document
  - TypeRegistry + bootstrap API (called by CLI/host before validate)
  - resolveEffectiveMembers()
  - Validation API (stages [6–8] — uses populated TypeRegistry)

@blockml/cli
  - TypeRegistry bootstrap: discover + parse + register all project/library sources
  - Then invoke validate/compile on target file(s)

@blockml/parser
  - BML → BomDocument mapper (stage [5]) — **single file per invocation**
  - parseExpression enrichment pass (stage [7]) — raw → AST
  - Does NOT load external BML files or populate TypeRegistry
  - Does NOT merge inherited members
  - Does NOT expand directives

@blockml/compiler
  - Consumes BomDocument (opaque to most pipeline stages)

@machineblocks/mbom
  - Framework base type BML (com.machineblocks.core.Block, NativeBlock, Set, …)
  - 09_mbom_properties.yml — SCAD render mapping only (not type SSOT)
  - Extends TypeRegistry bootstrap with mbom BML paths
```

---

## Root: `BomDocument`

Every parsed BML file produces exactly one `BomDocument`.

```typescript
interface BomDocument {
  /** V1: always `<block>` root. Legacy `<blockPresets>` removed — presets are PresetCollection blocks. */
  kind: "block"

  /** Parse metadata */
  source: SourceInfo

  /** Root block definition */
  block: BlockDefinition
}

interface SourceInfo {
  /** Absolute or project-relative path */
  filePath: string
  /** "xml" in V1. "json" deferred (TBD). */
  format: "xml" | "json"
  /** xmlns prefix → FQN package prefix (XML only) */
  namespaceBindings?: Record<string, string>
}
```

---

## `BlockDefinition`

A Block definition is the abstract representation of a `<block>` document (or a Sub-Block within one). Semantically: a **Class** — type shape without instance state.

```typescript
interface BlockDefinition {
  /** Short class name (PascalCase). Required. */
  name: string

  /**
   * Globally unique FQN.
   * Required on root blocks (authored in BML).
   * Derived on Sub-Blocks: parentFqn + "." + name
   */
  fullQualifiedName: string

  /** Parent type FQN. Required — no default. */
  baseType: string

  /** Semantic version of this definition. Required. */
  version: string

  /** Human-readable description of what this Block is. Required on root definitions. */
  documentation?: string

  /** Abstract type — not usable as composition instance type. Default false. */
  abstract?: boolean

  /** Final type — cannot be used as baseType on definitions. Default false. */
  final?: boolean

  /** Sub-Block baseTypes permitted in subBlocks[]. Default: inherit from baseType chain. */
  allowedSubBlockTypes?: string[]

  /** org.blockml.language.* FQNs allowed on capability implementations. Default: inherit. */
  supportedImplementationTypes?: string[]

  /**
   * Members declared in THIS block only — not inherited.
   * Validator resolves effective members via baseType chain.
   */
  members: MemberDefinition[]

  /**
   * Sub-Block definitions nested in this block.
   * Sub-Blocks are full BlockDefinitions (recursive structure).
   */
  subBlocks: BlockDefinition[]

  /**
   * Composition templates — one per aggregation filled.
   * May contain BlockInstanceNode and VirtualBlockNode children.
   * bml:with may appear on the composition itself.
   */
  compositions: CompositionTemplate[]

  /** Expanded from data:* attributes and explicit customData entries */
  customData: CustomDataEntry[]

  /** BML source span of this definition (root or sub-block) */
  source: SourceLocation
}
```

### Sub-Block FQN Derivation

Sub-Blocks omit `<fullQualifiedName>` in BML. The parser derives:

```text
Parent FQN:  com.machineblocks.calibration.Calibrator
Sub-Block:   <name>Base</name>
→ FQN:       com.machineblocks.calibration.Calibrator.Base

Nested:      Calibrator.Base.Strip
→ FQN:       com.machineblocks.calibration.Calibrator.Base.Strip
```

Sub-Blocks are **part of the same `BomDocument`** as their parent root block.

---

## Type Descriptors

Types in BOM are represented by **`TypeDescriptor`** — a structured, parse-time model. This applies to Capability `payloadType` / `returnType` and (future) Property types.

### Anonymous struct = shorthand for inline class

An anonymous Object payload type is **not** an untyped string. It is shorthand for an anonymous class with private typed fields:

```text
{ a: Float, b: Float }

  ≡  (conceptually)

class /*anonymous*/ {
  private Float a;
  private Float b;
}
```

The BOM stores this as `AnonymousStructType` with **ordered fields** — field order defines positional call parameter order. Named and positional call syntax both map to the same struct instance at runtime.

A single primitive (`Float`, `org.blockml.type.Integer`, …) is **not** wrapped — it is a `NamedTypeReference` directly (equivalent to a single-parameter method, not a one-field class).

### `TypeDescriptor` union

```typescript
type TypeDescriptor =
  | NamedTypeReference
  | ArrayTypeDescriptor
  | AnonymousStructType

interface NamedTypeReference {
  kind: "named"
  /** Resolved FQN, e.g. org.blockml.type.Float or com.myDomain.ResizePayload */
  fqn: string
}

interface ArrayTypeDescriptor {
  kind: "array"
  elementType: TypeDescriptor
}

interface AnonymousStructType {
  kind: "anonymousStruct"
  /** Ordered — declaration order = positional parameter order */
  fields: StructField[]
}

interface StructField {
  name: string
  type: TypeDescriptor
}
```

### BML surface syntax → `TypeDescriptor`

Parsed from `payloadType` / `returnType` / `type` attribute strings at map time:

```text
Float                              → NamedTypeReference { fqn: "org.blockml.type.Float" }
org.blockml.type.Float             → NamedTypeReference { fqn: "org.blockml.type.Float" }
type:Size3D                        → NamedTypeReference { fqn: "com.machineblocks.type.Size3D" }
Array<Integer>                     → ArrayTypeDescriptor { elementType: Named(Integer) }
{ a: Float, b: Float }             → AnonymousStructType { fields: [a, b] }
{ list: Array<Object>, index: Integer }  → nested descriptors
```

Unqualified primitive names resolve to `org.blockml.type.*`. Domain types require the `type:` prefix or full FQN. Parse failure → `BML_UNKNOWN_TYPE`.

FunctionBlock Capabilities use `AnonymousStructType` for multi-parameter signatures; variadic built-ins (e.g. `#strings.concat`) use `ArrayTypeDescriptor` instead.

---

## Member Definitions

Properties, Aggregations, Associations, and Capabilities share one namespace per Block. All are stored as a discriminated union:

```typescript
type MemberDefinition =
  | PropertyDefinition
  | AggregationDefinition
  | AssociationDefinition
  | CapabilityDefinition

interface MemberDefinitionBase {
  name: string
  documentation?: string
  source?: SourceLocation
}

interface PropertyDefinition extends MemberDefinitionBase {
  kind: "property"
  typeFqn: string
  defaultValue: MemberValue
  group?: string
  suggestions?: Suggestion[]
}

interface Suggestion {
  value: string
  label?: string
}

interface AggregationDefinition extends MemberDefinitionBase {
  kind: "aggregation"
  typeFqn: string
  cardinality: "0..1" | "0..n" | "1..1" | "1..n"
  visibility: "public" | "hidden"
  defaultAggregation?: boolean
  /** ServiceBlock binding */
  beanName?: string
  scope?: "local" | "context"
}

interface AssociationDefinition extends MemberDefinitionBase {
  kind: "association"
  typeFqn: string
  cardinality: "0..1" | "0..n"
}

interface CapabilityDefinition extends MemberDefinitionBase {
  kind: "capability"
  classFqn: string          // org.blockml.capability.Sync | AsyncInbound | AsyncOutbound
  payloadType: TypeDescriptor
  returnType?: TypeDescriptor
  visibility?: "public" | "hidden"
  implementation?: ImplementationBlock
}

interface ImplementationBlock {
  typeFqn: string          // org.blockml.language.TypeScript | org.blockml.language.OpenSCAD
  source: string            // CDATA body
  sourceLocation?: SourceLocation
}
```

### Effective Members (not stored in BOM)

Inherited and native members are resolved at validation time:

```typescript
/** @blockml/core — not part of BomDocument */
function resolveEffectiveMembers(
  block: BlockDefinition,
  registry: TypeRegistry
): EffectiveMemberSet

interface EffectiveMemberSet {
  /** Flattened, de-duplicated member list after baseType chain walk */
  members: MemberDefinition[]
  /** Map member name → declaring block FQN (for diagnostics) */
  declaredOn: Record<string, string>
}
```

Native MBOM properties from `09_mbom_properties.yml` are attached to `com.machineblocks.core.Block` in the Type Registry — not repeated in every derived Block's `members[]`.

---

## Member Values

Values on Block instances and property defaults use a common value model:

```typescript
type MemberValue =
  | LiteralValue
  | ExpressionValue
  | AddressValue

interface LiteralValue {
  kind: "literal"
  /** Typed BOM value — see 04_types.md for canonical forms */
  value: unknown
  typeFqn: string
}

interface ExpressionValue {
  kind: "expression"
  /** Raw source inside ${ } — set at stage [5] */
  raw: string
  source: SourceLocation
  /** Parsed AST — filled at stage [7]. Required before semantic validation. */
  ast?: ExpressionNode
  /** Inferred result type — filled at stage [7]. Validated at stage [8]. */
  resultTypeFqn?: string
}

interface AddressValue {
  kind: "address"
  /** Parsed org.blockml.type.Address */
  address: Address
}

interface Address {
  raw: string
  scheme: string | null
  path: string
  isAbsolute: boolean
  isRelative: boolean
  isExpression: boolean
}
```

`ExpressionNode` is specified in `10_expression_language.md` — Expression AST.

---

## Composition Tree

A Composition fills an Aggregation with a tree of nodes. `bml:*` directives follow the **Thymeleaf model** — attributes on the element they modify, not separate wrapper nodes.

```typescript
interface CompositionTemplate {
  /** Target aggregation name — e.g. "_parts", "_blocks" */
  aggregationName: string
  /** bml:with on <composition> */
  directives?: DirectiveAttribute[]
  children: CompositionNode[]
  source?: SourceLocation
}

type CompositionNode =
  | BlockInstanceNode
  | VirtualBlockNode

interface BlockInstanceNode {
  kind: "blockInstance"
  instance: BlockInstance
  /** bml:each, bml:if, bml:unless, bml:with on this block instance element */
  directives?: DirectiveAttribute[]
  source?: SourceLocation
}

interface VirtualBlockNode {
  kind: "virtualBlock"
  /** bml:each, bml:if, bml:unless, bml:with on <bml:block> */
  directives?: DirectiveAttribute[]
  children: CompositionNode[]
  source?: SourceLocation
}
```

### Directive Placement Rules

`bml:*` directives are stored in `directives[]` on the element they appear on — analogous to Thymeleaf `th:*` attributes on HTML elements.

`data:*` is a separate mechanism, modeled after **SAP UI5 customData**: in UI5 views, `data:myVal` on a Control or Element sets a key/value pair in that element's customData. BlockML applies the same pattern to Block definitions and Block instances — shorthand for the implicit `customData` aggregation on `org.blockml.core.Block`.

| Attribute / namespace | Allowed on | Notes |
|---|---|---|
| `data:*` | Block definitions and Block instances only | **Not** a `bml:` directive. UI5-style customData shorthand — parsed into `customData[]`. |
| `bml:with` | `<composition>`, `<bml:block>`, Block instances | Local variable scope |
| `bml:each` | `<bml:block>`, Block instances | Loop |
| `bml:if`, `bml:unless` | `<bml:block>`, Block instances | Conditional inclusion |
| `id` | Block instances | **Normal property** from `org.blockml.core.Block` — not a directive. Use `id="${ expr }"` for dynamic IDs in loops. |

`data:*` is only valid on elements that extend `org.blockml.core.Block`. It must not appear on `<aggregation>`, `<capability>`, or other non-Block elements.

Directives are **never expanded** at parse time. Expansion (if any) is a downstream concern.

```typescript
type DirectiveAttribute =
  | EachDirective
  | IfDirective
  | UnlessDirective
  | WithDirective

interface EachDirective {
  type: "each"
  variables: string[]
  statVariable?: string
  collection: ExpressionValue
}

interface IfDirective {
  type: "if"
  condition: ExpressionValue
}

interface UnlessDirective {
  type: "unless"
  condition: ExpressionValue
}

interface WithDirective {
  type: "with"
  bindings: WithBinding[]
}

interface WithBinding {
  name: string
  value: ExpressionValue
}
```

Dynamic instance IDs in loops use the **`id` system property** with an expression value — not a separate directive:

```xml
<bricks:StandardBrick
    bml:each="i : ${ numberOfSamples }"
    id="${ 'val_' + i }"
    size="[1, 1, 1]" />
```

In BOM: `memberValues.id` is an `ExpressionValue` or literal on the `BlockInstance` — **only when authored**. Omitted `id` is stored as absent; the parser does not assign auto-IDs.

---

## Instance ID Rules

`id` is a **system property** on `org.blockml.core.Block` — inherited by every Block, system-relevant, and treated specially by the compiler (identity, references, auto-ID, render output). It is **not** a `bml:` directive and **not** a custom property like `wallThickness`.

It identifies a child within its parent's composition tree. Nested paths use `::`:

```text
parentPartId::childPartId::grandchildPartId
```

There is **no FQN fallback** — instance identity is never derived from the Block type's FQN.

### Pipeline

```text
Parse       →  id stored only when authored (literal or ExpressionValue)
Validate    →  cross-instance references (blockId, placeId, …) must target
               siblings with explicit authored id; BML_MISSING_ID /
               BML_UNRESOLVABLE_INSTANCE_REF on failure
Expand      →  bml:each / bml:if / bml:with resolved to concrete instances
Resolve ID  →  id expressions evaluated; auto-ID for remaining static children
Render      →  mb_block_id(parentId, partId) using resolved part IDs
```

Auto-generated IDs are **not** stored in `BomDocument`. They exist only on the expanded composition tree used for rendering.

### Explicit vs. auto-generated

| Case | Rule |
|---|---|
| Referenced by another instance (`blockId`, `placeId`, …) | **Explicit `id` required** (literal) — `BML_MISSING_ID` if absent |
| Element with `bml:each` | **Explicit `id` required** (literal or Expression) — no auto-ID |
| Static anonymous `_parts` child, not referenced | Auto-ID after expansion (deterministic hash) |
| FQN as identity fallback | **Forbidden** |

### Auto-ID algorithm

Assigned after directive expansion, only for static instances still lacking `id`:

```text
Hash inputs:
  - typeFqn of the Block instance
  - sibling index in the parent's composition (post-expansion)
  - parent resolved part ID

Result:  6 hex characters (e.g. "a3f7c2"); extend on collision
```

Deterministic across compile runs — same position → same ID → clean SCAD diffs.

### Reference validation (pre-expansion)

Cross-references within the same composition scope are validated against **authored explicit ids**:

```text
_blocks child with id="wall"     ← target
_placement child blockId="wall"  ← reference  ✓

_blocks child without id         ← target
_placement child blockId="wall"  ← reference  ✗  BML_MISSING_ID on target

_blocks child with id="wall"     ← target
_placement child blockId="floor" ← reference  ✗  BML_UNRESOLVABLE_INSTANCE_REF
```

`blockId` / `placeId` values must match an authored `id` in the referenced aggregation — not an auto-generated or FQN-derived value.

---

## `BlockInstance`

Represents a concrete child block in a composition (XML element or JSON child object). Semantically: an **Object** — instance of a Block class (`typeFqn`) with optional `id` and member values.

```typescript
interface BlockInstance {
  /** Resolved FQN of the referenced block type */
  typeFqn: string

  /**
   * Required when typeFqn refers to an external block (another file).
   * Optional for same-document Sub-Block references.
   * See "Instance Version Rules" below.
   */
  version?: string

  /** Preset reference: {PresetsDocumentFQN}::{preset-id} */
  presetRef?: string

  renderGroup?: string
  namespace?: string

  /**
   * Member values set on this instance (properties + capabilities).
   * Includes `id` (system property on org.blockml.core.Block) — literal or Expression.
   * Resolved `id` value serves as the composition instance identity (partId).
   */
  memberValues: Record<string, MemberValue>

  customData: CustomDataEntry[]

  source: SourceLocation
}
```

### Type Reference Resolution

When parsing a composition child element, the parser resolves `typeFqn`:

```text
1. Short name (no prefix, starts with uppercase)
   → search current Block's subBlocks[] by name
   → found: typeFqn = derived Sub-Block FQN (same document)

2. Prefixed name (bricks:StandardBrick)
   → Namespace Resolver: prefix → FQN package + local name

3. Full FQN
   → use directly
```

Resolution scope for Sub-Block short names: **current BlockDefinition only** (innermost containing block definition — root or sub-block).

---

## Instance Version Rules

External block references are **dependencies**. Every dependency must pin an exact semantic version — from V1, with no exceptions and no fallback behavior.

```text
Same-document reference (Sub-Block or type defined in subBlocks[]):
  → version attribute NOT required on instance
  → effective version = Sub-Block definition's version field

External reference (type from another BML file — `.bml`, or `.mbml` in MachineBlocks library):
  → version attribute REQUIRED on instance
  → missing                    → BML_MISSING_VERSION (error — always, no warning mode)
  → version not in registry    → BML_UNKNOWN_VERSION (error)
  → no implicit latest         → TypeRegistry MUST NOT resolve without explicit version
  → no registry default        → library.xml version does NOT substitute for instance version
```

Examples from `Calibrator.mbml`:

```xml
<!-- Same file, Sub-Block — no version required -->
<Base id="base_stud" offset="[0, 0, 0]" ... />

<!-- External type (Standard.mbml) — version REQUIRED -->
<bricks:StandardBrick version="3.0.0" id="strip" ... />
```

Legacy library files that omit `version` on external references are **invalid** and must be updated before they compile. There is no migration period with warnings.

Block **definitions** (root and Sub-Block) always carry `<version>` as definition metadata — independent of instance version rules.

### TypeRegistry lookup

```typescript
getBlockDefinition(fqn: string, version: string): BlockDefinition | undefined
// version is required for external lookups — omitting it is a validator error, not a silent default
```

---

## Preset Collections (`org.blockml.core.PresetCollection`)

Preset files are ordinary `BlockDefinition` documents — not a separate BOM root type.

```text
org.blockml.core.PresetCollection   abstract composable Block
  aggregation  presets   0..n   org.blockml.core.Preset   (defaultAggregation)

org.blockml.core.Preset             final composable Block
  property     name      String   — display label (Customizer UI)
  property     id        String   — inherited from ComposableBlock; stable reference key
  aggregation  block     0..1   org.blockml.core.Block   (defaultAggregation)
  association  basePresets 0..n org.blockml.core.Preset  — space-separated ids on instance
```

Preset instances appear as `<Preset>` children in the PresetCollection's default `<composition>`. Each preset's optional block child fills the `block` aggregation automatically — no `aggregation=` attribute needed when only one aggregation exists on Preset.

**Preset reference syntax** (unchanged):

```text
{PresetCollectionFQN}::{preset-id}

Example:
  com.machineblocks.bricks.StandardPresets::brick-2x4
```

Cross-file `basePresets` entries use the same `FQN::id` form. Local ids resolve within the same PresetCollection document.

**Merge order** when resolving a preset for rendering:

```text
1. Own block instance properties (child of Preset)
2. basePresets — applied left-to-right; later entries override earlier
3. Referenced Block defaultValues
```

Cycles in `basePresets` → `BML_PRESET_CYCLE`.

---

## Libraries (`org.blockml.core.Library`)

Library descriptors are ordinary `BlockDefinition` documents with `baseType="org.blockml.core.Library"`.

**Naming (soft convention):** block `<name>` is `{Segment}Library` (e.g. `BricksLibrary`); FQN = package + name (e.g. `com.machineblocks.bricks.BricksLibrary`); filename = block name.

```text
org.blockml.core.Library
  property     description     String
  aggregation  _dependencies   0..n  org.blockml.core.Dependency
  aggregation  _schemas        0..n  org.blockml.core.Schema
  aggregation  _types          0..n  org.blockml.core.TypeRef
  aggregation  _blocks         0..n  org.blockml.core.BlockRef
  aggregation  _presets        0..n  org.blockml.core.PresetsRef

org.blockml.core.Dependency   properties: ref (Library FQN), version
org.blockml.core.Schema       property:  ref (relative .xsd path)
org.blockml.core.TypeRef      property:  ref (relative TypeBlock file path)
org.blockml.core.BlockRef     property:  ref (relative block file path)
org.blockml.core.PresetsRef   property:  ref (relative PresetCollection path)
```

Composition children use element names `Dependency`, `Schema`, `TypeRef`, `BlockRef`, `PresetsRef` — each `aggregation=` attribute is required (Library has five aggregations, none is default).

The orchestrator resolves `ref` paths relative to the library package root, loads referenced files into the TypeRegistry, and validates Library dependencies (`ref` + `version` must match a registered Library block).

`_schemas` is optional legacy XSD. `_types` lists exported TypeBlock BML — primary SSOT as types migrate from XSD.

---

## Custom Data

```typescript
interface CustomDataEntry {
  key: string
  value: string
}
```

`data:*` XML attributes are expanded to `CustomDataEntry` at parse time. Custom data has no effect on validation or rendering.

---

## Source Locations

All diagnostics reference BML source positions via:

```typescript
interface SourceLocation {
  file: string
  line: number
  column: number
  /** Optional end position for ranges */
  endLine?: number
  endColumn?: number
}
```

Every `BlockDefinition`, `BlockInstance`, `MemberDefinition`, and `ExpressionValue` SHOULD carry a `source` / `sourceLocation` for diagnostic quality.

---

## Type Registry

The Type Registry is **not** part of `BomDocument`. It is a runtime service in `@blockml/core`, populated **before validation** by the compile orchestrator (`@blockml/cli` or host application).

The parser (`@blockml/parser`) is **single-file scoped** — it does not load or resolve external BML files. External block references are stored as `typeFqn` + `version` on `BlockInstance`; resolution happens at validate time against a bootstrapped registry. See `13_bml_to_bom_mapping.md` — Cross-File Resolution.

### Bootstrap sources

```text
1. Built-in ServiceBlocks     — @blockml/core-services (org.blockml.service.*)
2. Framework BML              — @blockml/core, @machineblocks/mbom (see 16_framework_base_types.md)
3. Library blocks             — org.blockml.core.Library → resolve BlockRef / PresetsRef paths
4. Project srcDir scan        — remaining *.bml / configured extensions in bom.config.json
5. Declared dependencies      — Library Dependency entries + bom.config.json paths
```

Each discovered file is parsed independently (stages [5–7]) and registered via `registerBlockDefinition(doc)`.

Without `library.xml`, all BML files in a directory are registered. With `library.xml`, the manifest explicitly lists public blocks and presets.

```typescript
interface TypeRegistry {
  /** version is required for external block lookups — no implicit latest */
  getBlockDefinition(fqn: string, version: string): BlockDefinition | undefined
  getNativeMembers(baseTypeFqn: string): MemberDefinition[]
  resolveType(typeName: string, contextFqn: string): string | undefined
  registerBlockDefinition(doc: BomDocument): void
}
```

---

## Reference Example: `Calibrator.mbml`

File: `domains/machineblocks/.../scad-lib/blocks/com/machineblocks/calibration/Calibrator.mbml`

```text
BomDocument
  kind: "block"
  block: BlockDefinition
    name: Calibrator
    fullQualifiedName: com.machineblocks.calibration.Calibrator
    baseType: com.machineblocks.core.Block
    version: "1.0.0"

    members: (declared only — NOT including inherited size, offset, baseColor, ...)
      - PropertyDefinition numberOfSamples
      - PropertyDefinition font
      - PropertyDefinition size (computed defaultValue → ExpressionValue)
      - AggregationDefinition utils → typeFqn: ...Calibrator.Utils, beanName: "utils"

    subBlocks:
      - BlockDefinition Utils (FunctionBlock, capabilities with OpenSCAD implementation)
      - BlockDefinition Base (composition with bml:each on instances, dynamic id via id property)
      - BlockDefinition StudDiameter
      - BlockDefinition BaseWallThickness
      - BlockDefinition TubeDiameter
      - BlockDefinition PinDiameter

    compositions:
      - aggregationName: "_parts" (inherited from com.machineblocks.core.Block)
        children:
          - BlockInstanceNode Base (no version — same document)
          - BlockInstanceNode StudDiameter
          - BlockInstanceNode Base (id=base_wall)
          - BlockInstanceNode BaseWallThickness
          - ... (4 calibration rows, no bml:each at root — authored explicitly)
```

Key observations for implementers:

- Root composition references Sub-Blocks by short name — parser resolves against `subBlocks[]`.
- `@utils.formatValue(...)` in expressions is stored as `ExpressionValue` — V1 runtime deferred, parse allowed.
- `#math.round_n(...)`, `#math.floor(...)` stored as `ExpressionValue` with builtin call AST nodes.
- Inherited native properties (`size` used in expressions) are **not** in `Calibrator.members[]` — validator resolves via `resolveEffectiveMembers()`.

---

## Validation Responsibilities

The parser produces `BomDocument`. The validator (`@blockml/core`) checks:

```text
✓  Member namespace uniqueness (declared members per block)
✓  baseType exists in TypeRegistry
✓  resolveEffectiveMembers() — property/capability references in expressions
✓  External instance references have exact pinned version (BML_MISSING_VERSION / BML_UNKNOWN_VERSION)
✓  Cross-instance references (blockId, placeId) resolve to explicit authored id
✓  bml:each elements have explicit id (literal or Expression)
✓  Sub-Block baseType ∈ parent's allowedSubBlockTypes (domain rule)
✓  Expression result types match member types
✓  Preset block instance properties exist on referenced block type
✓  Property defaultValue cycles (topological sort)
✓  Preset basePresets resolve (local id or FQN::id) and have no cycles
✓  Library TypeRef / BlockRef / PresetsRef paths resolve to existing files
✓  Library Dependency ref + version matches registered Library block
```

The validator does **not** expand directives, assign auto-IDs, or interpret aggregations.

---

## What This Document Does Not Specify

| Topic | Document |
|---|---|
| Expression AST node union | `10_expression_language.md` — Expression AST |
| BML → BOM mapping algorithm | `13_bml_to_bom_mapping.md` |
| Framework base types (BML) | `16_framework_base_types.md` |
| TypeBlock · LanguageBlock (BML) | `17_type_system_bml.md` |
| Development setup (Phase D) | `15_dev_setup.md` |
| MBOM native property list | `09_mbom_properties.yml` |
| MBOM → SCAD serialization | `04_types.md`, `05_scad_renderer.md` |
| ManagedObject runtime API | `08_managed_object.md` (optional pattern) |
| Built-in `#math` / `#strings` capabilities | `@blockml/core-services` |

---

## Related Diagnostics

```text
BML_MISSING_BASE_TYPE         — baseType absent on BlockDefinition
BML_MISSING_DOCUMENTATION     — root <block> lacks <documentation> (warning V1)
BML_MISSING_VERSION           — version absent on external BlockInstance reference (always error)
BML_UNKNOWN_VERSION           — version present but no matching BlockDefinition in TypeRegistry
BML_MISSING_ID                — referenced instance or bml:each element lacks explicit id
BML_UNRESOLVABLE_INSTANCE_REF — blockId / placeId does not match any explicit id in target aggregation
BML_DUPLICATE_MEMBER_NAME     — member name collision in declared members
BML_UNKNOWN_TYPE              — typeFqn cannot be resolved
BML_INVALID_DEFINITION_BRANCH — member/element not allowed on this baseType branch (see 17_type_system_bml.md)
BML_INVALID_TYPE_REFERENCE    — type FQN resolves but wrong branch (e.g. Block used as property type)
BML_LEGACY_TYPE_SOURCE        — type from XSD only · migrate to BML (warning)
BML_UNKNOWN_PROPERTY          — instance attribute not in effective members (warning)
BML_UNKNOWN_DIRECTIVE         — unrecognized bml:* attribute (error)
BML_DIRECTIVE_NOT_ALLOWED     — bml:* on disallowed element (error)
BML_CUSTOM_DATA_NOT_ALLOWED   — data:* on non-Block element (error)
BML_INVALID_SUBBLOCK_TYPE     — Sub-Block baseType not allowed on parent
BML_PROPERTY_CYCLE            — circular defaultValue dependencies
BML_PRESET_CYCLE              — circular basePresetRefs
BML_EXPR_UNKNOWN_PROPERTY     — property reference not in effective members
```

See `06_compiler.md` for the full diagnostic catalog.
