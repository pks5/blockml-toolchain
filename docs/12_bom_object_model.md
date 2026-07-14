# BOM Object Model

version: 1.0.0

## Purpose of this Document

This document defines the **formal BOM object model** — the canonical data structures produced by `@blockml/parser` and consumed by `@blockml/core`, `@blockml/compiler`, and render targets.

For conceptual foundations see `00_bom_core.md`.
For BML authoring syntax see `02_mbml.md`.
For MachineBlocks domain extensions see `03_mbom.md`.
For the ManagedObject and synthetic accessor model (Draft · V1 preparation) see `08_managed_object.md`.
For Expression AST node types see `10_expression_language.md` — Expression AST.

This document is the **implementation contract** for `@blockml/core`. It specifies TypeScript-oriented interfaces and validation rules. It does not duplicate domain semantics already defined elsewhere.

**Namespace convention:** Interfaces in this document (`BlockDefinition`, `TypeDescriptor`, `BomDocument`, …) are TypeScript contracts in `@blockml/parser` — not BML Block FQNs. BML meta-model Blocks live under `org.blockml.bml.definition.*` (e.g. `org.blockml.bml.definition.BlockDefinition`). Language Blocks like `org.blockml.bml.core.Block` are BML-defined. See `00_bom_core.md` — Mandatory BML namespace.

---

## Abstraction Principle

> **A BOM document is a lossless representation of BML source.** It preserves authored structure and authored values — including directives, aggregation declarations, literal syntax, and unresolved type references. BOM makes **no statement** about how directives are expanded, how aggregations are interpreted, or how blocks are rendered.

> **BML → BOM → BML must always be possible.** See `00_bom_core.md` — Fundamental Architecture Principles.

> **„Block“ in BML is the mandatory input concept — not a uniform runtime object model.** The parser must read `<block>` documents; validators must walk `baseType` chains. Internal representation after parse is free. See `17_type_system_bml.md` — Semantic Layer vs Compiler Implementation.

```text
BML source          →  authoring format
BOM (this doc)      →  canonical, immutable, lossless parse result
Framework Utilities →  derived views (EffectiveMemberSet, AST, diagnostics) — never mutate BOM
Render Target       →  own pipeline + working model
```

Examples of what BOM **stores** vs. what downstream **interprets**:

| Authored in BML | Stored in BOM | Interpreted downstream |
|---|---|---|
| `bml:each`, `bml:if`, `bml:with` | `directives[]` on element — **unexpanded** | Renderer (directive expansion) |
| `size="[5,5,6]"` vs `size="{x:5,…}"` | `LiteralValue` in **authored form** | Renderer (target serialization via type metadata) |
| `${ size.x }` | `ExpressionValue { raw, ast }` — **not evaluated** | Renderer (expression evaluation) |
| `<aggregations>` declaration | `AggregationDefinition` (declared only) | Type Registry lookup for effective members — **metadata only, no instance data resolution** |
| `<composition>` children | `CompositionNode` tree | Renderer (wrapper logic, assembly patterns) |
| `baseType` FQN | string reference | Type Registry → effective member metadata |
| Preset reference | string `FQN::id` — **unmerged** | Renderer (preset merge) |
| Authored Capabilities | `CapabilityDefinition` in BOM | Renderer (interpretation only — not invoked at parse/validate time) |

---

## Design Decisions

| Topic | Decision |
|---|---|
| **Immutability** | Canonical `BomDocument` is **immutable** after parse. No utility or renderer may write derived data back. See `00_bom_core.md` — Canonical BOM is immutable. |
| **Member inheritance** | **Utility lookup only.** BOM stores **declared** members per Block. `resolveEffectiveMembers()` returns `EffectiveMemberSet` — a separate structure, never flattened into BOM. |
| **Capabilities** | Authored Capabilities stored in BOM. No synthetic getter/setter generation. Renderer interprets all Capabilities. See `08_managed_object.md`. |
| **Member identity** | Uniqueness by resolved **`(namespace, name)`**. Namespace from member element QName prefix — resolved to canonical identifier at parse time; alias never stored in BOM. |
| **Composition** | Nested inside `<aggregation>` on definitions only — never standalone. Block instances open aggregations directly (no `<composition>` wrapper). `composition aggregation="…"` removed. |
| **Sub-Blocks** | **Nested** in `BlockDefinition.subBlocks[]`. One BML file → one root `BlockDefinition` with embedded sub-block definitions. |
| **Semantic vs runtime** | BML `<block>` is one authoring element for all definition kinds; internal split into separate interfaces/registries is **implementation freedom** — see `17_type_system_bml.md`. |
| **Directives** | `bml:*` on composition elements — flow-control in `directives[]`; composition meta (`bml:id`, `bml:version`) on `BlockInstance` fields. **Not expanded** at parse time. |
| **Instance `version`** | From **`bml:version`** — optional on external block references. Omitted → resolve effective version from TypeRegistry context. Present → exact-version assert (`BML_UNKNOWN_VERSION` if no match). Forbidden inside Library files → `BML_VERSION_NOT_ALLOWED_IN_LIBRARY`. Same-document Sub-Blocks exempt. |
| **Definition `version`** | Every Block definition has an **effective version**: own `<version>` if present, else library version if the block is exported via a Library, else error (`BML_MISSING_VERSION`). |
| **Instance `id`** | From **`bml:id`** — authored in BOM only on `BlockInstance.id`; no auto-ID in `BomDocument`. Auto-IDs assigned **after directive expansion** for static unreferenced children. Referenced instances and `bml:each` elements require explicit `bml:id`. No FQN fallback. |
| **Property values** | **Deep copy only — never linked.** A property value must never point to another instance by reference. Enum tokens (`STANDARD`, `FQN::id`) are resolution keys — resolved values are materialized as inline copies. Cross-instance `FQN::id` references are valid only on **associations** (e.g. `basePresets`, `Step.part`), not on property values. See § Member Values — Property Value Semantics. |

---

## Package Ownership

```text
@blockml/core
  - All interfaces in this document
  - TypeRegistry + bootstrap API
  - Framework utilities: resolveEffectiveMembers(), validateTypes(), parseExpression(), …
  - Utilities return derived views — never mutate Canonical BOM

@blockml/cli
  - TypeRegistry bootstrap: discover + parse + register all project/library sources
  - Calls validateTypes() / validateConstraints() after parse (diagnostics)
  - Invokes renderer pipeline for compile

@blockml/parser
  - BML → BomDocument mapper (stage [5]) — **single file per invocation**
  - Produces immutable Canonical BOM
  - Does NOT load external BML files, populate TypeRegistry, merge inheritance, or expand directives

@blockml/compiler
  - Target Registry facade — renderers orchestrate their own pipelines

@machineblocks/mbom
  - Framework base type BML (com.machineblocks.bml.core.Block, NativeBlock, Set, …)
  - 09_mbom_properties.yml — SCAD render mapping (renderer concern)
  - Extends TypeRegistry bootstrap with mbom BML paths
```

---

## Root: `BomDocument`

Every parsed BML file produces exactly one `BomDocument`.

```typescript
interface BomDocument {
  /** V1: always `<block>` root. Legacy `<blockPresets>` removed — presets are MachineBlocks `_presets` blocks. */
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
  /** xmlns prefix → resolved namespace identifier (XML only; authoring aid — members store resolved values) */
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
  type: string

  /** Parent type FQN. Required — no default. */
  baseType: string

  /** Semantic version of this definition. Required. */
  version: string

  /** Short semantic description — what this Block represents in meaning. Required. */
  idea?: string

  /** Natural language FQN for documentation prose and example titles. Omitted = inherit Library, then Block default (English). */
  languageFqn?: string

  /** Human-readable technical description of what this Block is. Required on root definitions. */
  documentation?: string

  /** NaturalLanguage FQN when documentation prose deviates from effective block language. Omitted = inherit. */
  documentationLanguageFqn?: string

  /** Semantic version from which this definition is available. Omitted = since initial release. */
  since?: string

  /** Version history entries — oldest first. */
  changelog?: ChangelogEntry[]

  /** Usage examples with title and CDATA body. */
  examples?: DocumentationExample[]

  /** Cross-references to related Blocks or Definitions. */
  references?: DocumentationReference[]

  /** Abstract type — not usable as composition instance type. Default false. */
  abstract?: boolean

  /** Final type — cannot be used as baseType on definitions. Default false. */
  final?: boolean

  /** BlockML access visibility — Sub-Blocks only. Derived from name when omitted. Forbidden on root Blocks. Does not restrict renderer BOM access. */
  visibility?: "private" | "protected" | "public"

  /** Sub-Block baseTypes permitted in subBlocks[]. undefined = inherit from baseType chain; explicit [] = override to forbid */
  subTypes?: string[]

  /** org.blockml.bml.language.* FQNs allowed on capability implementations. Default: inherit. */
  languages?: string[]

  /** Contract Block FQNs merged into this Block after the baseType chain.
   * Root block only. Order is significant — later contracts override earlier ones;
   * local Block declarations override all contracts.
   * subBlocks and compositions on contract types are ignored.
   */
  contracts?: string[]

  /**
   * Generic type parameters declared on this Block (e.g. T on Box<T>).
   * Each parameter has a name and a baseType constraint (must inherit from that ValueType branch).
   */
  genericTypes?: GenericType[]

  /**
   * Members declared in THIS block only — not inherited.
   * Validator resolves effective members via baseType chain.
   * Array order is significant — see § Member Declaration Order.
   */
  members: MemberDefinition[]

  /**
   * Sub-Block definitions nested in this block.
   * Sub-Blocks are full BlockDefinitions (recursive structure).
   */
  subBlocks: BlockDefinition[]

  /**
   * Composition templates — derived from nested <composition> inside <aggregation> member elements.
   * May contain BlockInstanceNode and VirtualContainerNode children.
   */
  compositions: CompositionTemplate[]

  /** BML source span of this definition (root or sub-block) */
  source: SourceLocation
}
```

```typescript
interface GenericType {
  /** Parameter name (e.g. T) — substituted in type references within this Block */
  name: string
  /** FQN constraint — each concrete type argument must inherit from this baseType */
  baseType: string
}
```

### Sub-Block FQN Derivation

Sub-Blocks omit `<type>` in BML. The parser derives:

```text
Parent FQN:  com.machineblocks.bml.calibration.Calibrator
Sub-Block:   <name>Base</name>
→ FQN:       com.machineblocks.bml.calibration.Calibrator.Base

Nested:      Calibrator.Base.Strip
→ FQN:       com.machineblocks.bml.calibration.Calibrator.Base.Strip
```

Sub-Blocks are **part of the same `BomDocument`** as their parent root block.

---

## Type Expressions

Types in BOM are represented by **`TypeExpression`** (alias: `TypeDescriptor` in V1 docs) — a structured, parse-time model. This applies to Capability `inputType` / `outputType` and Property `type` attributes.

**Language vs. BOM:** BML knows four ValueType kinds (Primitive, Enum, Struct, Constant). Unions, collections, and generic applications are **type expressions** — not ValueTypes. The parser maps them to `@blockml/parser` descriptor types internally.

### Anonymous struct = shorthand for inline class

An anonymous Object input type is **not** an untyped string. It is shorthand for an anonymous class with private typed fields:

```text
{ a: Float, b: Float }

  ≡  (conceptually)

class /*anonymous*/ {
  private Float a;
  private Float b;
}
```

The BOM stores this as `AnonymousStructType` with **ordered fields**. FunctionMapping uses field order for positional call parameters — see `18_function_mapping.md`.

A single primitive (`Float`, `org.blockml.bml.type.Integer`, …) is **not** wrapped — it is a `NamedTypeReference` directly (equivalent to a single-parameter method, not a one-field class).

### `TypeExpression` union

```typescript
/** Parse-time type expression — @blockml/parser (not a language ValueType). */
type TypeExpression =
  | NamedTypeReference
  | AnonymousStructType
  | UnionTypeExpression
  | GenericParameterReference
  | SelfTypeReference

interface Multiplicity {
  min: number
  max: number | "*"
}

interface InstanceConfiguration {
  /** Named configuration — ValueType property name → value */
  named?: Record<string, LiteralValue | ExpressionValue>
  /** Positional configuration — mapped by ValueType property declaration order */
  positional?: (LiteralValue | ExpressionValue)[]
}

interface NamedTypeReference {
  kind: "named"
  fqn: string
  typeArguments?: TypeExpression[]
  /** Configures the Property's owned ValueType instance — see 20_value_type_instance_configuration.md */
  instanceConfiguration?: InstanceConfiguration
  multiplicity?: Multiplicity
}

interface UnionTypeExpression {
  kind: "union"
  alternatives: TypeExpression[]
}

interface GenericParameterReference {
  kind: "genericParam"
  name: string   // e.g. "T"
}

interface SelfTypeReference {
  kind: "self"   // bml:Self — resolved after inheritance
}

interface AnonymousStructType {
  kind: "anonymousStruct"
  fields: StructField[]
}

interface StructField {
  name: string
  type: TypeExpression
}
```

V1 may keep the alias `TypeDescriptor = TypeExpression`. Internal-only shapes the compiler may use when normalizing (not BML Block classes): `CollectionTypeDescriptor`, `GenericApplicationDescriptor`, etc.

### BML surface syntax → `TypeExpression`

Parsed from `inputType` / `outputType` / `type` attribute strings at map time:

```text
Float                              → NamedTypeReference { fqn: "org.blockml.bml.type.Float" }
org.blockml.bml.type.Float             → NamedTypeReference { fqn: "org.blockml.bml.type.Float" }
type:Size3D                        → NamedTypeReference { fqn: "com.machineblocks.bml.type.Size3D" }
Integer[0..n]                      → NamedTypeReference { fqn: Integer, multiplicity: { min: 0, max: "*" } }
Integer[]                          → same as Integer[0..n]
Integer[3]                         → NamedTypeReference { fqn: Integer, multiplicity: { min: 3, max: 3 } }
com.foo.Box<Integer>               → NamedTypeReference { fqn: "com.foo.Box", typeArguments: [Integer] }
Text{maxLength=100}                → NamedTypeReference { fqn: Text, instanceConfiguration: { named: { maxLength: 100 } } }
Decimal{precision=10, scale=2}     → NamedTypeReference { fqn: Decimal, instanceConfiguration: { named: { precision: 10, scale: 2 } } }
Decimal{10, 2}                     → NamedTypeReference { fqn: Decimal, instanceConfiguration: { positional: [10, 2] } }
Text{maxLength=50}[0..n]           → NamedTypeReference { fqn: Text, instanceConfiguration: { … }, multiplicity: { min: 0, max: "*" } }
Constant(Text){value="auto"}       → NamedTypeReference { fqn: Constant, typeArguments: [Text], instanceConfiguration: { named: { value: "auto" } } }
Boolean | Constant(Text){value="auto"} → UnionTypeExpression { alternatives: [Boolean, Constant(…)] }
"auto" | Float                     → UnionTypeExpression { alternatives: [literal "auto", Float] } — legacy; normalize to Constant form
false | Size3D                     → UnionTypeExpression { alternatives: [literal false, Size3D] }
Boolean | Integer                  → UnionTypeExpression { alternatives: [Boolean, Integer] }
T                                  → GenericParameterReference { name: "T" }
bml:Self                           → SelfTypeReference
{ a: Float, b: Float }             → AnonymousStructType { fields: [a, b] }
{ list: String[0..n], index: Integer }  → nested expressions with multiplicity on fields
```

Unqualified primitive names resolve to `org.blockml.bml.type.*`. Domain types require the `type:` prefix or full FQN. Parse failure → `BML_UNKNOWN_TYPE`.

Capability use `AnonymousStructType` for multi-parameter signatures. Variadic built-ins use a named collection field (`{ values: String[0..n] }`). See `17_type_system_bml.md` — Type Expressions.

---

## Member Definitions

Properties, Aggregations, Associations, and Capabilities share one namespace per Block. All are stored as a discriminated union:

```typescript
type MemberDefinition =
  | PropertyDefinition
  | AggregationDefinition
  | AssociationDefinition
  | CapabilityDefinition

interface ChangelogEntry {
  /** Semantic version this change applies to */
  version: string
  /** Change description (trimmed text body of <change>) */
  text: string
  /** NaturalLanguage FQN when change text deviates from effective block language. Omitted = inherit. */
  languageFqn?: string
  source?: SourceLocation
}

interface DocumentationExample {
  /** Required title attribute on <example> — always in enclosing block's natural language */
  title: string
  /** CDATA body — BML/MBML or target-language source text */
  content: string
  /** Implementation Language FQN for CDATA content (org.blockml.bml.language.OpenSCAD, …). Omitted when content is BML/MBML. */
  contentLanguageFqn?: string
  source?: SourceLocation
}

interface DocumentationReference {
  /** Block or Definition reference (xmlns prefix:Name) — XML block attribute on <see> */
  block?: string
  /** Repository markdown file — XML file attribute on <see> */
  file?: string
  /** External URL — XML url attribute on <see> */
  url?: string
  /** Required text body — why or how the referenced element relates */
  context: string
  /** NaturalLanguage FQN when relationship text deviates from effective block language. Omitted = inherit. */
  languageFqn?: string
  source?: SourceLocation
}

interface MemberDefinitionBase {
  name: string
  documentation?: string
  /** NaturalLanguage FQN when member documentation prose deviates from effective block language. */
  documentationLanguageFqn?: string
  since?: string
  changelog?: ChangelogEntry[]
  examples?: DocumentationExample[]
  references?: DocumentationReference[]
  /**
   * Resolved canonical namespace identifier (FQN or URI).
   * Parsed from the member element QName prefix via document xmlns: table.
   * Unprefixed member elements → default namespace (empty string).
   * Never stores the XML alias.
   */
  namespace?: string
  /** BlockML access visibility. Derived from naming convention; explicit attribute must match. Does not restrict renderer BOM access. */
  visibility?: "private" | "protected" | "public"
  /** When true, Block instances must not set this member. Definition and child override allowed. */
  readOnly?: boolean
  /**
   * When true, member is abstract — its effective definition is semantically incomplete and must be
   * explicitly implemented by a descendant before the enclosing Block can be concrete.
   * abstract is inherited effectively; it is lifted only by explicitly setting abstract=false on a
   * local redeclaration (override does not change abstract implicitly).
   */
  abstract?: boolean
  /** When true, child Blocks cannot override this member */
  final?: boolean
  /** When true, this declaration overrides a same-named parent member */
  override?: boolean
  source?: SourceLocation
}

interface PropertyDefinition extends MemberDefinitionBase {
  kind: "property"
  typeFqn: string
  /** Optional — absent means no value (not null) */
  value?: MemberValue
  group?: string
  /** Constraint Block instances — each typeFqn must extend org.blockml.bml.core.Constraint */
  constraints?: BlockInstance[]
  /** Block instances of the same type as typeFqn — metadata only */
  suggestions?: BlockInstance[]
}

interface AggregationDefinition extends MemberDefinitionBase {
  kind: "aggregation"
  typeFqn: string
  cardinality: "0..1" | "0..n" | "1..1" | "1..n"
  defaultAggregation?: boolean
  /** Nested composition filling this aggregation (may be omitted on override declarations) */
  composition?: CompositionTemplate
}

interface AssociationDefinition extends MemberDefinitionBase {
  kind: "association"
  typeFqn: string
  cardinality: "0..1" | "0..n"
}

interface CapabilityDefinition extends MemberDefinitionBase {
  kind: "capability"
  typeFqn: string           // org.blockml.bml.capability.Inbound | Outbound | Transformation
  inputType?: TypeDescriptor
  outputType?: TypeDescriptor
  implementation?: ImplementationBlock
}

interface ImplementationBlock {
  languageFqn: string      // org.blockml.bml.language.TypeScript | org.blockml.bml.language.OpenSCAD
  source: string            // CDATA body — full original text including <$ $> regions
  embeddedExpressions: EmbeddedExpression[]
  sourceLocation?: SourceLocation
}

interface EmbeddedExpression {
  raw: string               // expression text between delimiters (for parsing)
  start: number             // byte/char offset of opening <$ in source
  end: number               // offset immediately after closing $>
  /** AST from parseExpression() — utility output; optional on Canonical BOM */
  ast?: ExpressionNode
}
```

### Member Declaration Order

The parser **must preserve** the declaration order of members from BML. **No sorting** (e.g. alphabetically by name) at parse, map, or validate time.

```text
Mapping sequence (append to members[] in this order):
  1. <properties>     — child member elements in XML document order (element localName = name)
  2. <aggregations>   — child member elements in XML document order
  3. <associations>   — child member elements in XML document order
  4. <capabilities>   — child member elements in XML document order
```

The position of each entry in `BlockDefinition.members[]` is the **declaration ordinal** for that block. Render targets may use this order (e.g. Customizer parameter sequence, UI field layout). The compiler must not reorder declared members when writing BOM or when passing definitions to processors.

**StructType array literals:** for a StructType defined via `<properties>` (e.g. `Size3d` with `x`, `y`, `z`), property **declaration order** defines positional array literal mapping. Member access in expressions uses property names only. See `17_type_system_bml.md` — Declaration Order · `18_function_mapping.md`.

```text
size="[4, 2, 3]"   →  index 0 = x, index 1 = y, index 2 = z  (order in Size3d.bml)
size="${ [size.x, size.y, size.z - 1] }"
```

Named object syntax (`{ x: 4, y: 2, z: 3 }`) and attribute syntax (`x="4" y="2" z="3"` on a StructType instance) are equivalent; array literals use **declaration order**, not alphabetical name order.

**Function argument mapping:** handled by FunctionMapping — see `18_function_mapping.md` · `10_expression_language.md` — Capability Input Types and Function Parameters.

**Effective members:** `resolveEffectiveMembers()` merges by `(namespace, name)` in this order:

```text
1. baseType chain   — walk from root Block to direct baseType
2. contracts[]      — in declaration order (later overrides earlier)
3. Block local      — declared members on this Block (override all)
```

Child and contract override declarations merge with accumulated members — only specified attributes replace inherited or merged values. Private members cannot be overridden; `final="true"` prevents any redeclaration. `readOnly="true"` prevents instance authoring only — child Block definitions may still override the value/composition. An `override="true"` on an abstract parent keeps the effective member abstract unless the child explicitly lifts it to `abstract="false"`. The transition `abstract: true → false` is the explicit implementation event; the implementing redeclaration must be locally complete for the member kind.

An override that keeps the member concrete (`abstract: false → false`) is not an implementation event
and may omit required fields locally — they may be inherited from the effective parent member.

```text
Parser / mapper     MUST NOT reorder declared members
Validator           MUST NOT reorder members[] or struct fields for display
Render target       MAY use declaration order for output sequencing
```

### Effective Members (not stored in BOM)

Inherited and native members are resolved by **`resolveEffectiveMembers()` utility** — output is `EffectiveMemberSet`, **not part of `BomDocument`**:

```typescript
/** @blockml/core — not part of BomDocument */
function resolveEffectiveMembers(
  block: BlockDefinition,
  registry: TypeRegistry
): EffectiveMemberSet

interface EffectiveMemberSet {
  /** Flattened, de-duplicated member list after baseType chain + contract merge + local declarations */
  members: MemberDefinition[]
  /** Map member name → declaring source FQN (baseType Block, contract Block, or this Block — for diagnostics) */
  declaredOn: Record<string, string>
}
```

Native MBOM properties from `09_mbom_properties.yml` are attached to `com.machineblocks.bml.core.Block` in the Type Registry — not repeated in every derived Block's `members[]`.

### Capabilities in the BOM

Authored Capabilities (`Inbound`, `Outbound`, `Transformation`) are stored in Canonical BOM as declared. There are **no special** constructor, getter, or setter types — all behaviour is expressed as ordinary Capabilities. The Renderer decides how to interpret each Capability for the target system. See `08_managed_object.md` · `00_bom_core.md` — Semantics remain in BML.

V1: Canonical BOM (`BlockDefinition.members[]`) contains **only authored** members. Renderers read BOM Property values and Capability definitions directly.

### Contract Merge (not stored in BOM)

Contract contributions are **merged into** the effective member set — not validated as a separate superset check:

```typescript
/** @blockml/core — not part of BomDocument; used internally by resolveEffectiveMembers() */
function resolveContractMembers(
  contractFqn: string,
  registry: TypeRegistry
): EffectiveMemberSet
// Walks contract Block's declared members (properties, aggregations, associations,
// capabilities, constraints, suggestions, documentation, examples, references, optional defaults).
// Ignores subBlocks[] and compositions[].
// Does not walk contracts[] on the contract Block itself (no transitive contract merge).
```

For each FQN in `block.contracts[]`, declared members are merged in order. The Block's own declared members are merged last. Merge semantics match `baseType` partial overrides — same member kind required; only specified attributes replace prior values.

---

## Member Values

Values on Block instances and property defaults use a common value model.

### Property Value Semantics

> **Property values are never linked.** A property on a Block instance or definition must never hold a reference to another instance — neither directly nor indirectly. All property values are **deep copies**.

Cross-instance references via `FQN::id` exist only on **associations** — `basePresets`, `Step.part`, and similar members whose semantics explicitly model instance identity. Properties typed with ValueTypes always store inline values.

**EnumType:** an authored token such as `STANDARD` or `com.machineblocks.bml.type.BaseCutoutType::STANDARD` is **not** a link to the `_values` composition entry. The validator resolves the token against `_values` by `id` and materializes the result as an inline value copy (e.g. `value="standard"`). Changes to the EnumType definition do not affect already-stored property values. See `17_type_system_bml.md` — EnumType.

**StructType and primitives:** authored literals remain inline in Canonical BOM — `[1, 1, 1]`, `{x:1, y:1, z:1}`, or a nested StructType element are self-contained copies, not references to other instances.

**Preset/config merge:** merge copies values into the render-time view — never writes references back to `BomDocument`. See `14_compiler_runtime.md` — Property resolution.

```typescript
type MemberValue =
  | LiteralValue
  | ExpressionValue
  | AddressValue

interface LiteralValue {
  kind: "literal"
  /**
   * Authored value exactly as in BML — preserved for lossless BML ↔ BOM round-trip.
   * MUST NOT be normalized to a canonical internal form at parse/validate time.
   * Examples: [5,5,6] stays an array; {x:5,y:5,z:6} stays an object;
   * <Size3d x="5" …/> stays a nested BlockInstance.
   * Type compatibility is checked against typeFqn — the stored shape is not rewritten.
   */
  value: unknown
  typeFqn: string
}

interface ExpressionValue {
  kind: "expression"
  /** Raw source inside ${ } — the only expression field in Canonical BOM */
  raw: string
  source: SourceLocation
}

interface AddressValue {
  kind: "address"
  /** Parsed org.blockml.bml.type.Address */
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

Union variant discrimination (`resolvedTypeFqn`) is a **`validateTypes()` utility result** — not stored in Canonical BOM.

AST (`ExpressionNode`) and `resultTypeFqn` are produced by **`parseExpression()`** — not stored in Canonical BOM.

`ExpressionNode` is specified in `10_expression_language.md` — Expression AST.

---

## Composition Tree

A Composition fills an Aggregation with a tree of nodes. `bml:*` directives follow the **Thymeleaf model** — attributes on the element they modify, not separate wrapper nodes.

```typescript
interface CompositionTemplate {
  /** Target aggregation name — e.g. "_parts", "_blocks", "_presets" */
  aggregationName: string
  /**
   * bml:exportIds="true" on <composition> or <bml:container> — children with explicit static id
   * are referencable via {EnclosingBlockFQN}::{id} from other documents.
   */
  exportIds?: boolean
  /** bml:with on <composition> */
  directives?: DirectiveAttribute[]
  children: CompositionNode[]
  source?: SourceLocation
}

/** Aggregation opened inline on a Block instance */
interface InstanceAggregationComposition {
  aggregationName: string
  composition: CompositionTemplate
}

type CompositionNode =
  | BlockInstanceNode
  | VirtualContainerNode

interface BlockInstanceNode {
  kind: "blockInstance"
  instance: BlockInstance
  /** bml:each, bml:if, bml:unless, bml:with on this block instance element */
  directives?: DirectiveAttribute[]
  source?: SourceLocation
}

interface VirtualContainerNode {
  kind: "virtualContainer"
  /** bml:each, bml:if, bml:unless, bml:with on <bml:container> */
  directives?: DirectiveAttribute[]
  children: CompositionNode[]
  source?: SourceLocation
}
```

### Directive Placement Rules

`bml:*` directives are stored in `directives[]` on the element they appear on — analogous to Thymeleaf `th:*` attributes on HTML elements.

| Attribute / namespace | Allowed on | Notes |
|---|---|---|
| `bml:id` | Block instances | Composition instance identity — literal or `${ expr }` |
| `bml:version` | Block instances | External block reference version |
| `bml:bean` | Block instances | Service bean name |
| `bml:scope` | Block instances | Bean visibility: `"local"` or `"context"` |
| `bml:with` | `<composition>`, `<aggregation>`, `<bml:container>`, Block instances | Local variable scope |
| `bml:each` | `<bml:container>`, Block instances | Loop |
| `bml:if`, `bml:unless` | `<bml:container>`, Block instances | Conditional inclusion |

Directives are **never expanded** at parse time. Expansion (if any) is a downstream concern.

**Composition meta** (`bml:id`, `bml:version`, `bml:bean`, `bml:scope`) is parsed from the `bml:` namespace but stored on **`BlockInstance` fields** — not in `directives[]` and not in `memberValues`.

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

Dynamic instance IDs in loops use **`bml:id`** with an expression value:

```xml
<bricks:StandardBrick
    bml:each="i : ${ numberOfSamples }"
    bml:id="${ 'val_' + i }"
    size="[1, 1, 1]" />
```

In BOM: `BlockInstance.id` is an `ExpressionValue` or literal — **only when `bml:id` is authored**. Omitted `bml:id` is stored as absent; the parser does not assign auto-IDs.

---

## Instance ID Rules

**`bml:id`** identifies a child within its parent's composition tree. `org.blockml.bml.core.Block` declares no members — composition identity is not a Property. Bare `id=` on an instance is a **member value** only when the referenced Block type declares a Property named `id`.

Nested paths use `::`:

```text
parentPartId::childPartId::grandchildPartId
```

There is **no FQN fallback** — instance identity is never derived from the Block type's FQN.

### Pipeline

```text
Parse       →  bml:id stored on BlockInstance.id only when authored (literal or ExpressionValue)
Validate    →  cross-instance references (blockId, placeId, …) must target
               siblings with explicit authored bml:id; BML_MISSING_ID /
               BML_UNRESOLVABLE_INSTANCE_REF on failure
Expand      →  bml:each / bml:if / bml:with resolved to concrete instances
Resolve ID  →  id expressions evaluated; auto-ID for remaining static children
Render      →  mb_block_id(parentId, partId) using resolved part IDs
```

Auto-generated IDs are **not** stored in `BomDocument`. They exist only on the expanded composition tree used for rendering.

### Explicit vs. auto-generated

| Case | Rule |
|---|---|
| Referenced by another instance (`blockId`, `placeId`, …) | **Explicit `bml:id` required** (literal) — `BML_MISSING_ID` if absent |
| Element with `bml:each` | **Explicit `bml:id` required** (literal or Expression) — no auto-ID |
| Static anonymous `_parts` child, not referenced | Auto-ID after expansion (deterministic hash) |
| FQN as identity fallback | **Forbidden** |

### Auto-ID algorithm

Assigned after directive expansion, only for static instances still lacking `bml:id`:

```text
Hash inputs:
  - typeFqn of the Block instance
  - sibling index in the parent's composition (post-expansion)
  - parent resolved part ID

Result:  6 hex characters (e.g. "a3f7c2"); extend on collision
```

Deterministic across compile runs — same position → same ID → clean SCAD diffs.

### Reference validation (pre-expansion)

Cross-references within the same composition scope are validated against **authored explicit bml:id values**:

```text
_presets child with bml:id="wall"           ← target
_parts child basePresets="wall"       ← reference  ✓  (same document, unqualified)
```

### Qualified references (`{BlockFQN}::{id}`)

References to instances in **another Block definition** use the qualified form:

```text
com.machineblocks.bml.bricks.StandardPresets::brick-2x4
```

Valid only when:

```text
1. Target composition has bml:exportIds="true"
2. Target instance has explicit literal bml:id (no Expression, not bml:each-only)
3. Reference attribute value is a literal token (not ${ … })
```

```text
<!-- Target document: StandardPresets.bml -->
<_presets>
  <composition bml:exportIds="true">
    <bricks:Standard bml:id="brick-2x4" … />     ← referencable
  </composition>
</_presets>

<!-- Referencing document -->
<bricks:Standard basePresets="com.machineblocks.bml.bricks.StandardPresets::brick-2x4" />  ✓

<!-- Aggregation without export -->
<_presets>
  <composition>
    <bricks:Standard bml:id="brick-2x4" … />
  </composition>
</_presets>
→ com.machineblocks.bml.bricks.StandardPresets::brick-2x4  ✗  BML_UNEXPORTED_INSTANCE_REF

<!-- Dynamic target or reference -->
<bricks:Standard bml:id="${ presetId }" … />                              ✗  BML_NON_STATIC_INSTANCE_REF
<bricks:Standard basePresets="${ ref }" … />                      ✗  BML_NON_STATIC_INSTANCE_REF
```

Same-document unqualified ids (`basePresets="brick-2x4"`) do not require `bml:exportIds="true"`.

Local validation examples:

```text
_presets child without bml:id               ← target
_parts child basePresets="wall"     ← reference  ✗  BML_MISSING_ID on target preset

_presets child with bml:id="wall"           ← target
_parts child basePresets="floor"     ← reference  ✗  BML_UNRESOLVABLE_INSTANCE_REF
```

`basePresets` / `Step.part` values must match an authored **`bml:id`** in the referenced aggregation — not an auto-generated or FQN-derived value.

---

## `BlockInstance`

Represents a concrete child block in a composition (XML element or JSON child object). Semantically: an **Object** — instance of a Block class (`typeFqn`) with optional `bml:id` / `bml:version` and member values.

```typescript
interface BlockInstance {
  /** Resolved FQN of the referenced block type */
  typeFqn: string

  /**
   * Composition instance identity — from bml:id (literal or ExpressionValue).
   * Resolved value serves as partId in composition tree.
   */
  id?: MemberValue

  /**
   * From bml:version — optional exact-version assert on external block references.
   * Omitted → resolve effective version from TypeRegistry context at validate time.
   * Forbidden inside Library bootstrap / _dependencies / _subLibraries / _blocks → BML_VERSION_NOT_ALLOWED_IN_LIBRARY.
   * See "Version Rules" below.
   */
  version?: MemberValue

  /**
   * From bml:bean — registers this instance as a named service bean.
   * Accessible in Expressions via @beanName.
   */
  bean?: MemberValue

  /**
   * From bml:scope — bean visibility: "local" (default) or "context".
   * Context-scoped beans are visible to all descendant Blocks in Compositions.
   */
  scope?: "local" | "context"

  /** Preset reference: {PresetsDocumentFQN}::{preset-id} */
  basePresets?: string

  renderGroup?: string
  namespace?: string

  /**
   * Member values set on this instance (properties + capabilities).
   * Property namespace is free — id/version here only when declared on the Block type
   * and authored as bare attributes (not bml:id / bml:version).
   */
  memberValues: Record<string, MemberValue>

  /**
   * Nested aggregation compositions on this instance.
   * Parsed from <{aggregationName}><composition>…</composition></{aggregationName}>.
   * Standalone <composition> → BML_STANDALONE_COMPOSITION.
   */
  aggregationCompositions?: InstanceAggregationComposition[]

  source: SourceLocation
}
```

### Type Reference Resolution

Composition child elements are **general block references** — they have no implicit namespace. The parser resolves the element QName via `xmlns:` declarations or full FQN. Bare PascalCase tags without prefix → `BML_UNQUALIFIED_BLOCK_REFERENCE`.

Sub-Blocks must use qualified names (`RootBlock.SubBlock`) or prefixed form (`cal:Calibrator.Base`), never bare short names.

---

## Version Rules

### Effective block version (definitions)

Every Block definition has an **effective version**:

```text
effectiveBlockVersion =
  own <version>,           if present on the Block definition
  else library.version,    if the Block is exported via a Library (_blocks)
  else error               → BML_MISSING_VERSION
```

**Block in a Library:** may omit `<version>` and inherit the Library's version. If the Block declares its own `<version>`, it must be `>= library.version` (semver). Below library version → error. Patch-only drift is best practice; minor drift may warn.

**Framework convention (`org.blockml.bml.*`, `com.machineblocks.bml.*`):** maintain version only on `Library.bml` — no `<version>` on individual block files.

**Standalone block (not in a Library):** `<version>` is mandatory → `BML_MISSING_VERSION` if missing.

### Instance version rules (references)

External block references resolve version from registry context. `bml:version` is an **optional exact-version assert**, not a mandatory pin.

```text
Same-document reference (Sub-Block or type defined in subBlocks[]):
  → bml:version NOT allowed as resolution hint (same-doc scope)
  → effective version = Sub-Block definition's effectiveBlockVersion

External reference (type from another BML file — `.bml`):
  → bml:version omitted  → use effective version from TypeRegistry context
  → bml:version present  → target must be exactly that version
                           → no match → BML_UNKNOWN_VERSION (error)

Inside Library files (bootstrap / _dependencies / _subLibraries / _blocks):
  → bml:version FORBIDDEN on composition children
  → present → BML_VERSION_NOT_ALLOWED_IN_LIBRARY (error)
```

Examples from `Calibrator.bml`:

```xml
<!-- Same file, Sub-Block — no bml:version -->
<Base bml:id="base_stud" offset="[0, 0, 0]" ... />

<!-- External type — registry context (preferred) -->
<bricks:StandardBrick bml:id="strip" ... />

<!-- External type — exact-version assert (optional) -->
<bricks:StandardBrick bml:version="3.0.0" bml:id="strip" ... />
```

### TypeRegistry lookup

```typescript
getBlockDefinition(fqn: string, version?: string): BlockDefinition | undefined
// version omitted → resolve from registry context (library bootstrap / active dependency set)
// version present → exact match required
```

---

## Presets (MachineBlocks)

Presets are **not** a BlockML core feature. MachineBlocks models them via `_presets` aggregation and `basePresets` association on `com.machineblocks.bml.core.Block`. Preset files are ordinary `BlockDefinition` documents.

```text
com.machineblocks.bml.core.Block
  aggregation  _presets   0..n   com.machineblocks.bml.core.Block
  association  basePresets  0..n  bml:Self  — space-separated ids on instance
```

Preset instances appear as Block children in `_presets` composition. Preset merge is compiler logic; Customizer JSON is render-target logic.

**Preset reference syntax:**

```text
{BlockFQN}::{preset-id}

Example:
  com.machineblocks.bml.bricks.StandardPresets::brick-2x4
```

Cross-file `basePresets` entries use the same `FQN::id` form. Local ids resolve within the enclosing Block's `_presets`.

**Merge order** when resolving base presets:

```text
1. Own instance properties
2. basePresets — applied left-to-right; later entries override earlier
3. Block definition values (property `value`)
```

Cycles in `basePresets` → `BML_PRESET_CYCLE`.

---

## Libraries (`org.blockml.bml.core.BlockLibrary`)

Library descriptors are ordinary `BlockDefinition` documents with `baseType="org.blockml.bml.core.BlockLibrary"`.

`org.blockml.bml.core.BlockLibrary` is a framework base type in `core/` — not exported via Library `_blocks`. All concrete `Library.bml` files inherit from it.

**Naming (required):** every real library block is named `Library` (`<name>Library</name>`), filename is always `Library.bml`. FQN = package + `Library` (e.g. `com.machineblocks.bml.bricks.Library`, `org.blockml.bml.Library`, `org.blockml.bml.compiler.Library`).

**Membership is defined only by `Library.bml` — not by directories.** A Block belongs to the Library whose `_blocks` lists it. Package-prefix overlap does not imply inclusion.

### Nested libraries

Multiple `Library.bml` files may exist at different package levels (e.g. `org.blockml.bml.Library` and `org.blockml.bml.compiler.Library`). Each is an independent publishable unit.

```text
Typical dependency:   inner _dependencies → outer Library
Typical grouping:     outer _subLibraries → inner Library
Forbidden:            outer _blocks → Block exported by inner Library
```

Inner libraries usually declare the outer library in `_dependencies`. The outer library declares inner libraries in `_subLibraries` and must **not** re-export inner-library blocks in `_blocks` — consumers depend on the inner library directly. Violation → `BML_LIBRARY_NESTING_VIOLATION`.

```text
org.blockml.bml.core.BlockLibrary
  property     description     String
  property     language        org.blockml.bml.language.NaturalLanguage
  aggregation  bootstrap       0..1  org.blockml.bml.core.Bootstrap
  aggregation  _dependencies   0..n  org.blockml.bml.core.BlockLibrary
  aggregation  _subLibraries   0..n  org.blockml.bml.core.BlockLibrary
  aggregation  _schemas        0..n  org.blockml.bml.type.FilePathEntity
  aggregation  _blocks         0..n  org.blockml.bml.core.Block

org.blockml.bml.type.FilePathEntity            property:  value (relative .xsd path)
org.blockml.bml.core.Bootstrap                 aggregation:  readFirst (Documentation[])
```

`bootstrap`, `_dependencies`, `_subLibraries`, and `_blocks` use empty Block instances as type references — element name resolves to FQN. **`bml:version` is forbidden** on these children; effective version is resolved from library context. Type-reference interpretation follows from the Library role (orchestrator / render target) — not from an aggregation attribute.

Composition children in `bootstrap`, `_dependencies`, `_subLibraries`, and `_blocks` are Block instances (`<blockml:README />`, `<blockml:Library />`, `<compiler:Library />`, `<bricks:Standard />`). `_schemas` holds `FilePathEntity` composition children (`<btype:FilePathEntity value="bricks.xsd" />`). Each `aggregation=` attribute is required (BlockLibrary has five aggregations, none is default).

The orchestrator resolves `bootstrap`, `_dependencies`, `_subLibraries`, and `_blocks` entries by FQN, loads referenced definitions into the TypeRegistry using effective block versions, and validates library membership.

`bootstrap` points to the library entry point — typically a `README` block with a `readFirst` documentation list. `_schemas` is optional legacy XSD (`FilePathEntity` paths). `_blocks` lists exported Block and ValueType BML — primary SSOT as types migrate from XSD.

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
1. Built-in services     — @blockml/core (org.blockml.bml.service.*)
2. Framework BML              — @blockml/core, @machineblocks/mbom (see 16_framework_base_types.md)
3. Library blocks             — org.blockml.bml.core.BlockLibrary → resolve bootstrap / _dependencies / _subLibraries / _blocks by FQN (no bml:version)
4. Project srcDir scan        — remaining *.bml in bom.config.json srcDir
5. Declared dependencies      — Library _dependencies entries + bom.config.json paths
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

## Reference Example: `Calibrator.bml`

File: `domains/machineblocks/.../scad-lib/blocks/com/machineblocks/bml/calibration/Calibrator.bml`

```text
BomDocument
  kind: "block"
  block: BlockDefinition
    name: Calibrator
    type: com.machineblocks.bml.calibration.Calibrator
    baseType: com.machineblocks.bml.core.CompositeBlock
    version: "1.0.0"

    members: (declared only — NOT including inherited size, offset, baseColor, ...)
      - PropertyDefinition numberOfSamples
      - PropertyDefinition font
      - PropertyDefinition size (computed value → ExpressionValue)
      - AggregationDefinition _utils → typeFqn: ...Calibrator.Utils, composition with Utils instance (bml:bean="utils", bml:scope="context")
      - AggregationDefinition _parts → composition with 4 calibration rows

    subBlocks:
      - BlockDefinition Utils (utility Sub-Blocks, capabilities with OpenSCAD implementation)
      - BlockDefinition Base (composition with bml:each on instances, dynamic id via id property)
      - BlockDefinition StudDiameter
      - BlockDefinition BaseWallThickness
      - BlockDefinition TubeDiameter
      - BlockDefinition PinDiameter

    compositions:
      - aggregationName: "_utils"
        children:
          - BlockInstanceNode Utils (bml:bean="utils", bml:scope="context")
      - aggregationName: "_parts" (inherited from com.machineblocks.bml.core.CompositeBlock)
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
✓  Property values are inline deep copies — never instance references (enum FQN::id tokens are resolution keys only)
✓  resolveEffectiveMembers() — property/capability references in expressions
✓  Block definitions have effective version (BML_MISSING_VERSION if standalone and no <version>)
✓  Library member block.version >= library.version when both declared
✓  External instance references resolve via registry context; optional bml:version is exact assert (BML_UNKNOWN_VERSION)
✓  Library bootstrap / _dependencies / _subLibraries / _blocks children have no bml:version (BML_VERSION_NOT_ALLOWED_IN_LIBRARY)
✓  Cross-instance references (blockId, placeId, FQN::id) resolve to explicit authored id
✓  Qualified FQN::id references target bml:exportIds="true" compositions with static literal ids
✓  bml:each elements have explicit id (literal or Expression)
✓  Sub-Block baseType ∈ parent's subTypes (domain rule)
✓  Sub-Block references use qualified name or FQN — no bare short names
✓  generic parameter name ≠ Block name; generic parameter name ≠ any Sub-Block name in same document
✓  Sub-Block same name as root Block → qualified reference required at use sites
✓  Sub-Block visibility derived from name or explicit <visibility>; root Block must not declare visibility
✓  Member access respects visibility (private / protected / public) — formal access rule
✓  Sub-Block reference respects visibility scope (private / protected / public)
✓  No duplicate members differing only by visibility prefix (normalized logical name)
✓  Expression result types match member types
✓  Preset block instance properties exist on referenced block type
✓  Property value cycles (topological sort)
✓  basePresets resolve (local id or FQN::id) and have no cycles
✓  contract Block references resolve and merge into effective members (declaration order; later wins)
✓  constraints — after resolveEffectiveMembers() and instance value binding: validateConstraints() enforces each effective constraint with an understood validation reference (including ValuePresent → BML_CONSTRAINT_VIOLATION)
✓  readOnly — after resolveEffectiveMembers(): Block instances must not set members with readOnly=true (BML_READONLY_MEMBER_WRITE)
✓  Library _blocks entries resolve to registered Block definitions (FQN + effectiveBlockVersion)
✓  Outer library _blocks does not re-export blocks from a nested inner library (BML_LIBRARY_NESTING_VIOLATION)
✓  Library _dependencies entries resolve to registered BlockLibrary definitions (FQN + effectiveBlockVersion)
```

The validator does **not** expand directives, assign auto-IDs, or interpret aggregations.

---

## What This Document Does Not Specify

| Topic | Document |
|---|---|
| Expression AST node union | `10_expression_language.md` — Expression AST |
| Embedded expressions in implementations | `10_expression_language.md` — BML Embedded Expressions |
| BML → BOM mapping algorithm | `13_bml_to_bom_mapping.md` |
| Framework base types (BML) | `16_framework_base_types.md` |
| ValueType · Language (BML) | `17_type_system_bml.md` |
| Development setup (Phase D) | `15_dev_setup.md` |
| MBOM native property list | `09_mbom_properties.yml` |
| MBOM → SCAD serialization | `04_types.md`, `05_scad_renderer.md` |
| Synthetic accessors · ManagedObject | `08_managed_object.md` (Draft · V1 preparation) |
| Built-in `#math` / `#strings` capabilities | `@blockml/core` |

---

## Related Diagnostics

```text
BML_MISSING_BASE_TYPE         — baseType absent on BlockDefinition
BML_MISSING_IDEA              — root <block> lacks <idea> (warning V1)
BML_MISSING_DOCUMENTATION     — root <block> lacks <documentation> (warning V1)
BML_INVALID_SINCE_VERSION     — <since> is not a valid semantic version
BML_CHANGELOG_VERSION_ORDER   — <changelog> entries not ordered oldest-first (warning V1)
BML_EXAMPLE_MISSING_TITLE     — <example> lacks required title attribute
BML_EXAMPLE_NOT_CDATA         — <example> body is not CDATA
BML_EXAMPLE_UNKNOWN_LANGUAGE  — <example> language attribute is not a known Language FQN
BML_UNKNOWN_NATURAL_LANGUAGE  — <language> or documentation language attribute is not a NaturalLanguage FQN
BML_MISSING_VERSION           — Block definition lacks effective version (no own <version> and not exported via Library)
BML_UNKNOWN_VERSION           — bml:version assert or lookup failed — no matching BlockDefinition in TypeRegistry
BML_VERSION_NOT_ALLOWED_IN_LIBRARY — bml:version present on BlockInstance inside Library bootstrap / _dependencies / _subLibraries / _blocks
BML_VERSION_BELOW_LIBRARY     — block.version < library.version when both declared (error)
BML_VERSION_MINOR_DRIFT       — block.version minor differs from library.version (warning — best practice: patch only)
BML_LIBRARY_NESTING_VIOLATION  — outer library _blocks re-exports a Block exported by a nested inner library
BML_MISSING_ID                — referenced instance or bml:each element lacks explicit bml:id
BML_UNRESOLVABLE_INSTANCE_REF — blockId / placeId / FQN::id does not match any explicit id in target aggregation
BML_UNEXPORTED_INSTANCE_REF   — qualified {BlockFQN}::{id} targets a composition without bml:exportIds="true"
BML_NON_STATIC_INSTANCE_REF   — qualified reference or export target uses Expression instead of literal id/token
BML_DUPLICATE_MEMBER_NAME     — member name collision in declared members (same normalized name and visibility)
BML_DUPLICATE_MEMBER_VISIBILITY_VARIANT — members differ only by visibility prefix
BML_INVALID_PROPERTY_TYPE     — property or Capability type is not a ValueType
BML_UNKNOWN_TYPE              — typeFqn cannot be resolved
BML_INVALID_DEFINITION_BRANCH — member/element not allowed on this baseType branch (see 17_type_system_bml.md)
BML_INVALID_TYPE_REFERENCE    — type FQN resolves but wrong branch (e.g. Block used as property type)
BML_LEGACY_TYPE_SOURCE        — type from XSD only · migrate to BML (warning)
BML_UNKNOWN_PROPERTY          — instance attribute not in effective members (warning)
BML_UNKNOWN_DIRECTIVE         — unrecognized bml:* attribute (error)
BML_DIRECTIVE_NOT_ALLOWED     — bml:* on disallowed element (error)
BML_DEPRECATED_MEMBER_NAMESPACE_ATTR — legacy namespace="…" attribute on member element (error)
BML_INVALID_SUBBLOCK_TYPE     — Sub-Block baseType not allowed on parent
BML_PROPERTY_CYCLE            — circular property value dependencies
BML_VISIBILITY_MISMATCH       — visibility attribute or <visibility> does not match naming convention
BML_VISIBILITY_ON_ROOT_BLOCK  — <visibility> on root Block
BML_PRIVATE_MEMBER_ACCESS     — private member used outside declaring Block
BML_PROTECTED_MEMBER_ACCESS   — protected member outside allowed inheritance/composition context
BML_PRIVATE_SUBBLOCK_ACCESS   — private Sub-Block referenced outside declaring Block
BML_PROTECTED_SUBBLOCK_ACCESS — protected Sub-Block outside allowed inheritance context
BML_FINAL_MEMBER_OVERRIDE     — override attempted on final or private member
BML_OVERRIDE_WITHOUT_PARENT   — override="true" but no same-named parent member
BML_ABSTRACT_MEMBER_NOT_IMPLEMENTED — abstract member on a concrete block (must be explicitly implemented via abstract="false")
BML_READONLY_MEMBER_WRITE     — Block instance sets a member with readOnly=true
BML_STANDALONE_COMPOSITION     — <composition> not nested inside an aggregation member element
BML_UNKNOWN_NAMESPACE_PREFIX  — member element prefix references undeclared xmlns: prefix
BML_PRESET_CYCLE              — circular basePresets chain
BML_UNKNOWN_CONTRACT          — contract Block FQN not in TypeRegistry
BML_CONTRACT_NOT_ON_ROOT      — <contracts> on Sub-Block
BML_DUPLICATE_CONTRACT        — same type listed twice in block.contracts[]
BML_CONTRACT_MEMBER_KIND_MISMATCH — override uses a different member kind than merged member
BML_EXPR_UNKNOWN_PROPERTY     — property reference not in effective members
```

See `06_compiler.md` for the full diagnostic catalog.
