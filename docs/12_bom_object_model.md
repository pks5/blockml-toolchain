# BOM Object Model

version: 1.0.0

## Purpose of this Document

This document defines the **formal BOM object model** — the canonical data structures produced by `@blockml/parser` and consumed by `@blockml/core`, `@blockml/compiler`, and render targets.

For conceptual foundations see `00_bom_core.md`.
For BML authoring syntax see `02_mbml.md`.
For MachineBlocks domain extensions see `03_mbom.md`.
For optional runtime object patterns see `08_managed_object.md` (implementation blueprint, not required).
For Expression AST node types see `10_expression_language.md` (separate spec).

This document is the **implementation contract** for `@blockml/core`. It specifies TypeScript-oriented interfaces and validation rules. It does not duplicate domain semantics already defined elsewhere.

---

## Abstraction Principle

> **A BOM document is an abstract representation of BML source.** It preserves authored structure — including directives, aggregation declarations, and unresolved type references. BOM makes **no statement** about how directives are expanded, how aggregations are interpreted, or how blocks are rendered.

```text
BML source          →  abstract, authoring-true
BOM (this doc)      →  canonical parse result — still abstract
Validation          →  resolves inheritance, types, external references
Render Target       →  interprets and serializes
```

Examples of what BOM **stores** vs. what downstream **interprets**:

| Authored in BML | Stored in BOM | Interpreted downstream |
|---|---|---|
| `bml:each`, `bml:if`, `bml:with` | `DirectiveNode` | Preprocessor, BlockProcessor, or Validator |
| `<aggregations>` declaration | `AggregationDefinition` | Domain rules (e.g. implicit `_parts` in MBOM) |
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
| **Directives** | Stored as **`DirectiveNode`** in the composition tree. **Not expanded** at parse time. |
| **Instance `version`** | **Required only for external block references** (types defined in another file). Not required for same-document Sub-Block references. |

---

## Package Ownership

```text
@blockml/core
  - All interfaces in this document
  - TypeRegistry
  - resolveEffectiveMembers()
  - Validation API (uses effective members + TypeRegistry)

@blockml/parser
  - BML → BomDocument mapper
  - Does NOT merge inherited members
  - Does NOT expand directives

@blockml/compiler
  - Consumes BomDocument (opaque to most pipeline stages)

@machineblocks/mbom
  - Extends TypeRegistry with MBOM types + 09_mbom_properties.yml native members
```

---

## Root: `BomDocument`

Every parsed BML file produces exactly one `BomDocument`.

```typescript
interface BomDocument {
  /** Discriminator — matches BML root element / JSON type field */
  kind: "block" | "blockPresets"

  /** Parse metadata */
  source: SourceInfo

  /** Root payload — exactly one is set per kind */
  block?: BlockDefinition
  presets?: PresetsDocument
}

interface SourceInfo {
  /** Absolute or project-relative path */
  filePath: string
  /** "xml" | "json" */
  format: "xml" | "json"
  /** xmlns prefix → FQN package prefix (XML only) */
  namespaceBindings?: Record<string, string>
}
```

---

## `BlockDefinition`

A Block definition is the abstract representation of a `<block>` document (or a Sub-Block within one).

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
   * May contain BlockInstance, DirectiveNode, VirtualBlockNode.
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
  payloadTypeFqn: string    // or structured type descriptor
  returnTypeFqn?: string
  visibility?: "public" | "hidden"
  implementation?: ImplementationBlock
}

interface ImplementationBlock {
  language: string          // "scad" | "typescript"
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
  /** Raw source inside ${ } */
  raw: string
  /** Parsed AST — node types defined in 10_expression_language.md */
  ast: ExpressionNode
  /** Expected/inferred result type FQN */
  resultTypeFqn: string
  source: SourceLocation
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

`ExpressionNode` is specified separately. This document defines only the **slot** that holds it.

---

## Composition Tree

A Composition fills an Aggregation with a tree of nodes. The tree preserves BML structure including directives.

```typescript
interface CompositionTemplate {
  /** Target aggregation name — e.g. "_parts", "_blocks" */
  aggregationName: string
  children: CompositionNode[]
  source?: SourceLocation
}

type CompositionNode =
  | BlockInstanceNode
  | DirectiveNode
  | VirtualBlockNode

interface BlockInstanceNode {
  kind: "blockInstance"
  instance: BlockInstance
}

interface VirtualBlockNode {
  kind: "virtualBlock"
  /** bml:block — groups children, produces no block output itself */
  directives: DirectiveAttribute[]
  children: CompositionNode[]
  source?: SourceLocation
}
```

---

## `BlockInstance`

Represents a concrete child block in a composition (XML element or JSON child object).

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

  /** Instance/part ID — explicit or derived via bml:id directive */
  id?: string

  renderGroup?: string
  namespace?: string

  /** Preset reference: {PresetsDocumentFQN}::{preset-id} */
  presetRef?: string

  /** Member values set on this instance (properties + capabilities) */
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

```text
Same-document reference (Sub-Block or type defined in subBlocks[]):
  → version attribute NOT required on instance
  → effective version = Sub-Block definition's version field

External reference (type from another .mbml file / Type Registry):
  → version attribute REQUIRED on instance
  → missing → BML_MISSING_VERSION
```

Examples from `Calibrator.mbml`:

```xml
<!-- Same file, Sub-Block — no version required -->
<Base id="base_stud" offset="[0, 0, 0]" ... />

<!-- External type (Standard.mbml) — version SHOULD be present -->
<bricks:StandardBrick version="3.0.0" id="strip" ... />
```

Existing library files may omit `version` on external references during migration. The validator MAY emit `BML_MISSING_VERSION` as warning first, then error once the library is updated.

Block **definitions** (root and Sub-Block) always carry `<version>` as definition metadata — independent of instance version rules.

---

## Directive Nodes

Directives are **not** Block properties. They are stored as structured nodes wrapping or annotating composition elements.

```typescript
interface DirectiveNode {
  kind: "directive"
  /** Directives applied to the following element or virtual block */
  directives: DirectiveAttribute[]
  /** The element this directive applies to */
  target: BlockInstanceNode | VirtualBlockNode
  source?: SourceLocation
}

type DirectiveAttribute =
  | EachDirective
  | IfDirective
  | UnlessDirective
  | WithDirective
  | IdDirective

interface EachDirective {
  type: "each"
  /** "i : ${ expr }" or "item, stat : ${ expr }" — parsed form */
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
  /** Local bindings: [{ name, value: ExpressionValue }, ...] */
  bindings: WithBinding[]
}

interface WithBinding {
  name: string
  value: ExpressionValue
}

interface IdDirective {
  type: "id"
  expression: ExpressionValue
}
```

Directives are **never expanded** into multiple `BlockInstance` nodes at parse time. Expansion (if any) is a downstream concern.

---

## `PresetsDocument`

Root type for `<blockPresets>` documents.

```typescript
interface PresetsDocument {
  fullQualifiedName: string
  blockTypeFqn: string
  version: string
  presets: Preset[]
  source: SourceLocation
}

interface Preset {
  id: string
  name: string
  basePresetRefs?: PresetRef[]
  properties: Record<string, MemberValue>
  source?: SourceLocation
}

interface PresetRef {
  /** Same-document preset id or full "FQN::id" for cross-file */
  ref: string
}
```

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

The Type Registry is **not** part of `BomDocument`. It is a runtime service in `@blockml/core`, populated from:

```text
- Parsed BlockDefinitions (all loaded .mbml files)
- Domain packages (09_mbom_properties.yml native members on com.machineblocks.core.Block)
- Built-in ServiceBlock definitions (@blockml/core-services)
- Enum / type schemas (domain XSD)
```

```typescript
interface TypeRegistry {
  getBlockDefinition(fqn: string, version?: string): BlockDefinition | undefined
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
      - BlockDefinition Utils (FunctionBlock, capabilities with scad implementation)
      - BlockDefinition Base (composition with bml:each DirectiveNodes)
      - BlockDefinition StudDiameter
      - BlockDefinition BaseWallThickness
      - BlockDefinition TubeDiameter
      - BlockDefinition PinDiameter

    compositions:
      - aggregationName: "_parts" (implicit)
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
✓  External instance references have version
✓  Sub-Block baseType ∈ parent's allowedSubBlockTypes (domain rule)
✓  Expression result types match member types
✓  Preset property names exist on target blockType
✓  Property defaultValue cycles (topological sort)
✓  Preset basePresetRefs cycles
```

The validator does **not** expand directives or interpret aggregations.

---

## What This Document Does Not Specify

| Topic | Document |
|---|---|
| Expression AST node union | `10_expression_language.md` (extend) |
| BML → BOM mapping algorithm | `13_bml_to_bom_mapping.md` (planned) |
| MBOM native property list | `09_mbom_properties.yml` |
| MBOM → SCAD serialization | `04_types.md`, `05_scad_renderer.md` |
| ManagedObject runtime API | `08_managed_object.md` (optional pattern) |
| Built-in `#math` / `#strings` capabilities | `@blockml/core-services` (pending) |

---

## Related Diagnostics

```text
BML_MISSING_BASE_TYPE         — baseType absent on BlockDefinition
BML_MISSING_VERSION           — version absent on external BlockInstance reference
BML_DUPLICATE_MEMBER_NAME     — member name collision in declared members
BML_UNKNOWN_TYPE              — typeFqn cannot be resolved
BML_INVALID_SUBBLOCK_TYPE     — Sub-Block baseType not allowed on parent
BML_PROPERTY_CYCLE            — circular defaultValue dependencies
BML_PRESET_CYCLE              — circular basePresetRefs
BML_EXPR_UNKNOWN_PROPERTY     — property reference not in effective members
```

See `06_compiler.md` for the full diagnostic catalog.
