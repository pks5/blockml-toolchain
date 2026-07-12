# BOM Core

version: 2.1.0

## Purpose of this Document

This document defines BOM Core — a domain-agnostic abstract object model for parametric, composable units. BOM Core is the foundation from which domain-specific object models are derived.

BOM Core is not tied to any render target, serialization format, or domain. It defines only structural concepts: what a Block is, how Blocks relate to each other, how Members are organized, how Presets, Libraries, and Catalogs work, and how Targets are registered and dispatched.

Known specializations:

```text
MBOM  — MachineBlocks Object Model (physical, parametric geometry blocks → SCAD)
EBOM  — Electronics Object Model (electronic components → KiCad / Schematic)
UBOM  — Unity Object Model (game objects → Unity Prefabs)
SBOM  — Service / Logic Object Model (service beans → runtime)
UIBOM — UI Object Model (UI controls → UI framework)
KBOM  — Knowledge Object Model (knowledge graph → graph DB)
```

New domain BOMs can be added without modifying BOM Core. The architecture is designed to accommodate domain BOMs that are not yet known.

---

## Fundamental Architecture Principles

> **This is the highest-priority design constraint for the entire BlockML stack.**

### BML and BOM are inseparable

The BOM is **not** a pre-interpreted object model. It is the **canonical, lossless representation of BML**.

**BML → BOM → BML must always be possible.**

The parser makes **no semantic decisions**. It exclusively:

- parses XML
- resolves namespaces
- resolves type references syntactically
- transfers the BML tree into a canonical object structure

All BML information must be fully preserved in the BOM. The parser must **never** pre-empt information that a renderer might interpret differently later.

### Canonical BOM is immutable

The Canonical BOM is the **Single Source of Truth**. It is **not modified** after parsing.

The following must **never** be written back into the Canonical BOM:

- resolved inheritance
- effective properties
- effective versions
- effective status
- expanded composition
- evaluated expressions
- resolved references
- generated getters/setters
- any other renderer-specific derivations

The BOM describes **only** what was modelled in BML.

Parsed literal values remain in **authored form** (`[5,5,6]` stays an array; `{x:5,y:5,z:6}` stays an object). Expression values store **`raw` source text** only — AST and evaluation results are utility output, not BOM mutations.

### Framework Utilities

BlockML provides a toolkit of standardised utilities. Examples:

```text
resolveInheritance()
resolveEffectiveMembers()
resolveType()
resolveReference()
resolveContracts()
resolveGenerics()
parseExpression()
evaluateExpression()
expandComposition()
expandDirectives()
validateTypes()
validateConstraints()
```

Utilities **never mutate** the Canonical BOM. They return derived information or produce **new structures** (views, working models, diagnostics).

A utility may read the immutable BOM plus a TypeRegistry and return e.g. an `EffectiveMemberSet`, an `ExpandedComposition`, or `Diagnostic[]` — always as a separate result object.

### Renderer determines the flow

The framework does **not** prescribe pipeline order. Each renderer decides which utilities it uses and in what sequence.

```text
SCAD Renderer:
  resolveInheritance() → evaluateExpression() → expandComposition() → renderSCAD()

Java Renderer:
  resolveInheritance() → resolveContracts() → renderJava()

Documentation Renderer:
  renderRawBOM()
```

Each renderer defines its own pipeline. The framework provides building blocks — not a fixed compile path.

### Renderer Working Model

Each renderer owns an **internal working model** — optimised, cacheable, and freely mutable:

```text
SCAD:   Modules, Parameters, GeometryGraph
Java:   Classes, Fields, Methods, Constructors
React:  Components, Props, JSX Tree
```

The working model belongs exclusively to the renderer. The Canonical BOM remains unchanged throughout.

### Semantics remain in BML

BlockML describes semantics only. There are **no special concepts** for constructor, getter, or setter — all behaviour is expressed as ordinary **Capabilities** (`init()`, `getValue()`, `setValue()`, `render()`, …). Capability kinds (`Inbound`, `Outbound`, `Transformation`) describe intent; they are not compiler rules or runtime objects.

The renderer decides how to realise each Capability in the target system:

```text
init()     → Java constructor · UI5 onInit() · React useEffect()
getValue() → direct field access · generated getter · reflection
setValue() → direct field assignment · generated setter
render()   → SCAD module · JSX component · may be ignored
```

Interpretation happens **only** in the renderer — by reading Capability definitions and member values from the immutable BOM. The BOM never contains implementation concepts such as constructors, getters, setters, runtime values, or executable behaviour.

### Validation pipeline

Validation consists of three independent stages:

```text
Stage 1 — XML          syntax · namespaces · XSD (no semantics)
Stage 2 — Validator    inheritance · contracts · type compatibility · visibility ·
                       constraints · references · valueRequired · expression correctness
                       (expressions are NOT evaluated)
Stage 3 — Renderer     expression evaluation · optional handling · capability interpretation ·
                       code generation · runtime behaviour
```

The Validator creates the immutable Canonical BOM and a mutable **default Working Model** (partial resolution: inheritance, contracts, effective members, default values). This Working Model is shared infrastructure — a Renderer may reuse it or create an entirely new Working Model.

### Properties are Optional

Every Property behaves as an **Optional** — it has a value or has no value. There is no `null`. The BOM represents `Optional<Value>` instead of `Value | null`. PropertyDefinitions may declare `valueRequired` — when `true`, the Validator requires a value in BlockML; when `false`, the Renderer decides how to interpret missing values.

The `valueRequired` check runs in Stage 2 **after** full Block resolution (baseType chain, generic substitution, contract merge, local overrides) via `resolveEffectiveMembers()`. Only then does the Validator verify that each effective Property with `valueRequired=true` has an authored value on the definition or instance. Missing value → `BML_VALUE_REQUIRED`.

The `readOnly` check runs in the same stage on every `BlockInstance`. After `resolveEffectiveMembers()` for the instance's `typeFqn`, any authored `memberValues` entry or aggregation/association child element that targets a member with `readOnly=true` → `BML_READONLY_MEMBER_WRITE`. Block definitions and child Block overrides are not instances — they may set or override readOnly members via `<value>` or `<composition>`. Expressions may read readOnly members.

### Expression layer vs BOM data layer

Expressions and BOM member values are **separate layers**:

Expressions describe **what should happen**, not the computed result. The Validator checks referenced members, visibility, type compatibility, valid capabilities, and valid access — but **never executes** expressions. Evaluation belongs exclusively to the Renderer.

| Layer | What it is | Where it lives |
|---|---|---|
| **BOM data** | `LiteralValue`, `ExpressionValue.raw` | Canonical BOM (immutable) |
| **Expression syntax** | AST, type inference, access level | `parseExpression()` utility output |
| **Expression evaluation** | resolved values | Renderer working model only |

In `${ size.x }`, member access is **expression semantics** — not BOM mutation. The underlying `size` literal stays in authored form. Numeric index access on StructType (`size[0]`) is not valid.

### Architecture

```text
BML
 │
 ▼
Parser
 │
 ▼
Canonical BOM (immutable)
 │
 ├─────────────── Framework Utilities ───────────────┐
 │                                                   │
 ▼                                                   ▼
Renderer Pipeline                            other Renderers
 │
 ▼
Renderer Working Model
 │
 ▼
Emitter
 │
 ▼
Target Output
```

### Summary

```text
The BOM describes exclusively the semantics of BML.
The framework provides reusable analysis and transformation algorithms.
The renderer orchestrates these algorithms and produces its own working model for the target system.
```

Only **BML ↔ BOM** must be lossless. **BOM → Target** is entirely the renderer's interpretive job.

See also: `01_system.md` — Architecture · `06_compiler.md` — Parser, Utilities, and Renderer · `12_bom_object_model.md` — Abstraction Principle · `10_expression_language.md` — Expression vs BOM Data Layer · `08_managed_object.md` — Semantics in BML.

---

## Core Concepts

BOM Core defines four first-class concepts:

```text
Block        — a parametric, reusable unit (definition / type)
Preset       — a named, concrete property set for a Block
Library      — a collection of Block definitions
Catalog      — a collection of top-level composite Block definitions
```

### Block and Block Instance — Class and Object

The closest familiar model: a **Block** is a declarative, semantic **Class**; a **Block Instance** is an **Object**.

```text
Block (definition)              Block Instance (in composition)
  .bml file · BlockDefinition     <ac:Wall bml:id="wall" size="[1,8,9]" />
  FQN · members · composition     typeFqn + bml:id + member values
  describes shape & behaviour     one concrete occurrence
  no Runtime · no address         may become a Thing in Runtime (WOT)
```

This is a **semantic** analogy — not a mandate for runtime OOP. The compiler may represent definitions and instances as plain data; the parser nonetheless distinguishes `<block>` documents (classes) from composition children (objects). See `17_type_system_bml.md`.

```text
ValueType (Integer, Size3D)     →  semantic value class for Property values and Capability input/output
Language (OpenSCAD)        →  semantic meta-class for implementation contract
Sub-Block in same .bml file     →  nested class (derived type, inner scope)
Preset                          →  named default binding on a class (partial object factory)
```

WOT vocabulary: Block = grammar / template; Block Instance configured via Preset may become a **Thing** when a Runtime activates it — see `WOT_Reference_v26.md` — Block · Block Instance · Set.

Everything else — assemblies, placements, steps, scenes, views — is defined by domain-specific BOMs as specialized Block types.

### Relationships

```text
Library   contains   Block(s)
Block     has        Member(s)   — Properties, Aggregations, Associations, Capabilities
Block     composes Contract(s) — reusable partial Block definitions merged into the effective member set
Block     has        Preset(s)
Block     has        Composition(s)
Catalog   contains   Block(s)   — top-level composite Blocks (finished products / assemblies)
```

---

## Object Identity

Every BOM object is identified by a globally unique **Fully Qualified Name (FQN)**.

### FQN Convention

```text
Format:   <reverse-domain-package>.<ClassName>
Package:  lowercase, dot-separated, reverse-domain
Class:    PascalCase
```

**Package segments are singular** for infrastructure namespaces:

```text
org.blockml.core.*         ✓
org.blockml.type.*         ✓   (not .types)
org.blockml.language.*     ✓   — implementation language types (TypeScript, OpenSCAD, …)
org.blockml.service.*      ✓   (not .services)
org.blockml.capability.*   ✓   (not .capabilities)
com.machineblocks.type.*   ✓
com.machineblocks.core.*   ✓
com.electronics.type.*     ✓
com.ui.type.*              ✓
```

**Documented exception — domain library packages:** collective/plural segment names are allowed when the package denotes a **family of related Block types**, not an infrastructure concern. These are stable, intentional FQNs — not typos.

```text
com.machineblocks.bricks.*       ✓   — StandardBrick, Plate, Tile, … (MachineBlocks brick library)
com.machineblocks.calibration.*  ✓   — Calibrator, …
```

Do not infer from `bricks` that other packages may freely use plural segments. New infrastructure namespaces (`.type`, `.service`, `.core`, `.capability`) are always singular. New domain libraries may choose a collective name deliberately — document the decision in the domain spec.

### Reserved Language Namespaces

Direct package segments under `org.blockml` that belong to the **language** are reserved for **public BML-defined grammar** only. They must not be reused for internal compiler, parser, runtime, or BOM implementation classes.

```text
org.blockml.core.*         — framework base types (Block, ValueType, Status, Library, …)
org.blockml.type.*         — bootstrap ValueTypes (Integer, Decimal, Float, Text, Boolean, Number, …)
org.blockml.status.*       — standard maturity status blocks (Stable, Draft, Stub, Deprecated)
org.blockml.service.*      — built-in services (#math, #strings, …)
org.blockml.capability.*   — Capability type branches (Inbound, Outbound, Transformation)
org.blockml.language.*     — Languages (TypeScript, OpenSCAD, …)
```

These namespaces contain BML-defined Blocks, ValueTypes, Blocks, Capability types, and Languages. They are part of the public BlockML grammar.

### Implementation Namespaces

Internal object models and toolchain infrastructure use **separate** namespaces:

```text
org.blockml.bom.*          — canonical BOM data model (parse result)
org.blockml.parser.*       — parser implementation
org.blockml.compiler.*     — compiler facade, validation, TypeRegistry
org.blockml.runtime.*      — compile orchestration, RenderContext, cache
org.blockml.engine.*       — RenderEngine / CompilerEngine implementations
org.blockml.cli.*          — CLI commands and bootstrap
```

**Rule:** If a package segment is reserved for the public language, it must not additionally host internal implementation types.

```text
Correct:
  org.blockml.core.Block              — public language Block (BML-defined)
  org.blockml.bom.BlockDefinition     — internal BOM parse shape
  org.blockml.compiler.TypeRegistry   — compiler infrastructure

Wrong:
  org.blockml.core.BlockDefinition
  org.blockml.core.TypeReference
  org.blockml.type.TypeDescriptor
```

**Separation goal:**

```text
org.blockml.core.* · type.* · status.* · service.* · capability.* · language.*  →  the language
org.blockml.bom.*                                                    →  canonical BOM data model
org.blockml.parser.* · compiler.* · runtime.* · engine.* · cli.*     →  implementation
```

> Public BlockML namespaces are reserved for the language. Internal implementation classes must never reuse language namespaces.

npm workspace packages (`@blockml/core`, `@blockml/parser`, …) are **deployment units** — not identical to FQN namespaces. A single npm package may ship both BML files under `org/blockml/core/` and TypeScript under `org/blockml/bom/`. See `15_dev_setup.md` — Package Conventions.

Built-in services live in `org.blockml.service.*`. **Class names** follow Thymeleaf utility objects where applicable (`Math`, `Strings`, `Numbers`, `Lists`, `Bools`). Expression calls use the **`#` prefix** with the lowercase utility name — Thymeleaf-aligned, plural for utilities: `#math`, `#strings`, `#numbers`, `#lists`, `#bools`. (`#math` is BlockML-specific; Thymeleaf has no `#math`.)

```text
Examples:
  org.blockml.core.Block
  org.blockml.service.Math
  org.blockml.service.Strings
  org.blockml.language.TypeScript
  org.blockml.language.OpenSCAD
  org.blockml.type.Integer
  com.machineblocks.core.Block
  com.machineblocks.type.Size3D
  com.machineblocks.bricks.StandardBrick   ← domain library (documented plural exception)
  com.electronics.core.Component
  com.ui.core.Control
```

### Instance Identity

Instances within a Composition are identified by a **part ID** — the value of **`bml:id`** on the Block instance. Nested paths are composed with `::`:

```text
Format:    <parentPartId>::<childPartId>::<grandchildPartId>

Examples:
  wall                         — explicit, top-level
  wall::bottom                 — explicit, nested
  wall::bottom::inner          — explicit, deeply nested
  a3f7c2                       — auto-generated, top-level (after expansion)
  wall::a3f7c2                 — auto-generated, nested under explicit parent
```

There is **no FQN fallback** — a Block's type FQN is never used as instance identity.

**Explicit IDs** are authored in BML via **`bml:id`**. Required when:
- another instance references this one (`basePresets`, `Step.part`, …)
- the element carries `bml:each` (literal or Expression — auto-ID is not available in loops)

**Auto-generated IDs** are assigned **after directive expansion** for static, unreferenced children that omit **`bml:id`**. They are deterministic 6-hex hashes:

```text
Hash inputs:
  - FQN of the Block type
  - Sibling index in the composition (post-expansion)
  - Parent resolved part ID

Result:  6 hex characters  (e.g. "a3f7c2")
         extend length automatically on collision
```

Auto-generated IDs are deterministic across compile runs. They may appear in generated output (SCAD instance IDs) but are not intended for cross-references.

### Qualified Block Instance References

A Block instance in another document is referenced by **`{BlockFQN}::{id}`** — the FQN of the **enclosing Block definition** (the document that owns the composition) plus the target instance's **`bml:id` value**:

```text
Format:     {EnclosingBlockFQN}::{instanceId}

Examples:
  com.machineblocks.bricks.StandardPresets::brick-2x4
  com.myproject.enclosures.DefaultEnclosure::floor
```

Used in **association** member values that reference other instances — e.g. `basePresets`, `Step.part`. **Not** valid on property values — properties always store inline deep copies. See `12_bom_object_model.md` — Property Value Semantics.

A qualified reference is valid **only when both** conditions hold:

**1. Export on the target composition.** The composition that contains the target instance must declare `bml:exportIds="true"`. Only instances in an exported composition are visible for qualified references.

```xml
<_presets>
  <composition bml:exportIds="true">
    <bricks:Standard bml:id="brick-2x4" bml:version="3.0.0" size="[2, 4, 3]" />
  </composition>
</_presets>
```

Without `bml:exportIds="true"` on that composition, `com.machineblocks.bricks.StandardPresets::brick-2x4` is invalid → `BML_UNEXPORTED_INSTANCE_REF`.

**2. Static target.** The target instance must be statically resolvable at validate time:

```text
Target bml:id  — explicit literal (not ${ … }); not produced only by bml:each expansion
Reference     — literal token in the attribute value (not wrapped in ${ … })
```

```xml
<!-- ✓ valid reference target -->
<bricks:Standard bml:id="brick-2x4" … />

<!-- ✗ not referencable via FQN::id -->
<bricks:Standard bml:each="i : ${ n }" bml:id="${ 'p_' + i }" … />
<bricks:Standard bml:id="${ presetId }" … />
```

Dynamic references → `BML_NON_STATIC_INSTANCE_REF`.

Same-document references (unqualified id only, e.g. `basePresets="brick-2x4"` within the same Block) resolve within the enclosing Block's aggregations and do not require `bml:exportIds="true"`. The export rule applies to **`{BlockFQN}::{id}`** references only.

**BOM storage:** the parser stores `bml:id` only when authored. Auto-IDs are not written into `BomDocument` — see `12_bom_object_model.md` — Instance ID Rules.

---

## Block

A Block is the fundamental unit of BOM Core. It is a parametric, typed, reusable definition — analogous to a class in object-oriented programming.

### Metadata

```text
idea               — short semantic description: what this Block represents in meaning
documentation      — human-readable technical description
since              — optional; semantic version from which this Block is available
changelog          — optional; version history (oldest first)
examples           — optional; usage examples (title + CDATA body)
references         — optional; cross-references to related Blocks or Definitions (type + optional context)
name               — short class name (PascalCase). Required. See naming convention below.
type               — globally unique FQN
baseType           — FQN of the parent Block. Required — no default.
version            — semantic version of this definition
members            — named members: Properties, Aggregations, Associations, Capabilities
compositions       — list of Composition definitions
```

### Block Name Convention

The `name` field is a class name — not a label or a description:

```text
Format:  PascalCase — starts with uppercase letter, letters and digits only
Regex:   [A-Z][a-zA-Z0-9]*
Valid:   Wall, StandardBrick, Calibrator, DefaultEnclosure, NfcPlayer
Invalid: my-wall, wall_v2, 2Wall, My Wall

Error:   BML_INVALID_BLOCK_NAME
```

PascalCase is required because:
- Sub-Block short-name references (`<Base />`) are unambiguous — no Property name starts with an uppercase letter
- Block names map directly to SCAD module names without transformation
- Consistent with class naming conventions in Java and TypeScript

### Inheritance

Blocks inherit from other Blocks via `baseType`. Inheritance is single — each Block has exactly one base type. The root of all inheritance is `org.blockml.core.Block`.

`baseType` is mandatory on every Block definition **except** `org.blockml.core.Block` (inheritance root — omits `<baseType>`). Omitting it elsewhere is a parse-time error (`BML_MISSING_BASE_TYPE`). There is no implicit default — the author must always make an explicit choice about which domain the Block belongs to.

Domain-specific specializations extend this root:

```text
org.blockml.core.Block
  com.machineblocks.core.Block   — adds size, color, offset, direction, _parts aggregation, ...
  com.electronics.core.Component — adds footprint, schematic symbol, ...
  com.ui.core.Control            — adds layout, style, events, ...
  com.service.core.Bean          — adds lifecycle, dependencies, ...
```

### Composite Blocks

A Block with a non-empty Composition is a **Composite Block**. It defines internal structure by filling one or more of its Aggregations with child Block instances.

A Block without a Composition is a **Leaf Block** — it has no internal structure defined at the BOM level. Domain-specific Block Renderers handle its output directly.

---

## Member Namespace

Properties, Aggregations, Associations, and Capabilities all share a single member namespace per Block. Logical uniqueness is determined by **`(namespace, name)`** — members without an explicit `namespace` belong to the default namespace (empty string).

The `namespace` attribute uses the **same XML namespace mechanism** as element prefixes. The author writes an XML prefix (`xmlns:ui="com.foo.ui"` → `namespace="ui"`). The parser resolves the prefix immediately and stores the **canonical namespace identifier** in the BOM — never the XML alias. See `02_mbml.md` — § Member Namespace Attribute.

This is a deliberate design decision: authors think in names, not in member categories. Bindings, expressions, and presets reference members by resolved `(namespace, name)` without needing to know the category.

```text
Block: MyBlock
  size        — Property      ((namespace, name) must be unique)
  parts       — Aggregation   (cannot collide with size in same namespace)
  target      — Association
  assemble    — Capability
```

**General XML namespace rule:** XML prefixes have no semantic meaning. The BOM contains exclusively canonical namespace identifiers (FQN/URI). Prefixes are authoring syntax only — resolved during parsing for Block types, member namespaces, `type:` shorthand, and all other namespaced BML syntax.

### Member Visibility

Member and Sub-Block visibility is a **BlockML access rule only** — it does not prescribe target-system visibility. Renderers have full access to the entire Canonical BOM regardless of visibility; they decide independently whether and how to manifest BlockML visibility.

All member kinds share the same visibility rules. Visibility is determined primarily by naming convention:

| Name       | Visibility |
| ---------- | ---------- |
| `myVar`    | public     |
| `_myVar`   | protected  |
| `__myVar`  | private    |

The prefix is not the logical member identity. For collision checking, normalize by stripping visibility prefixes (`myVar`, `_myVar`, `__myVar` → `myVar`). Members differing only by prefix → `BML_DUPLICATE_MEMBER_VISIBILITY_VARIANT`.

**private** — usable only within the declaring Block's definition (`C = D`). Composition ownership does not grant private access to child instances.

**protected** — usable when `C = D`, `C` inherits from `D`, `C` is the immediate composition owner of the instance, or `C` inherits from the instance type `I`.

**public** — usable from any BlockML definition.

An optional `visibility="private|protected|public"` attribute may be declared; it must match the naming convention or validation emits `BML_VISIBILITY_MISMATCH`.

Full rules, examples, and formal access notation: `02_mbml.md` — § Member Visibility.

### Common Member Attributes

All member kinds support:

```text
readOnly   — when true, the member cannot be written on Block instances. Validator-enforced.
             Block definitions and child Block overrides may still set the value/composition.
             Expressions may read the member. See 02_mbml.md — § readOnly Members.
final      — when true, child Blocks cannot override this member. Validator-enforced.
namespace  — XML namespace prefix; resolved to canonical identifier at parse time (see 02_mbml.md)
```

### Member Inheritance and Overrides

Members are inherited via `baseType`. Derived Blocks inherit all Members of their base type and may add their own. **Partial overrides** are permitted — a child Block may redeclare an inherited member with only the attributes that change; unspecified attributes are inherited from the parent definition.

```text
Same member kind required
Only specified attributes replaced
Override key: resolved (namespace, name) — not XML prefix
Private members cannot be overridden
final="true" on parent prevents override → BML_FINAL_MEMBER_OVERRIDE
readOnly="true" prevents instance authoring only — child Block definitions may override value/composition
```

Effective members are resolved by merging along the `baseType` chain, then contract fragments, then local declarations — see `resolveEffectiveMembers()` in `12_bom_object_model.md` and Contracts below.

### Contracts (Reusable Partial Definitions)

A Block is a **semantic definition**, not a runtime class. Its internal structure (Properties, Aggregations, Associations) is not the public surface — only Capabilities are visible outward; the renderer decides concrete manifestation (Java getter, REST endpoint, SCAD parameter, UI binding, …).

A **contract** is a **reusable partial definition** of a Block — not a pure interface, but a fragment that can be composed into concrete Blocks. Contracts replace the separate concepts of interfaces, traits, and mixins in classical OOP.

A contract Block may define any subset of:

```text
Properties, Aggregations, Associations, Capabilities
Constraints, Suggestions
Documentation, Examples
Optional default implementations for Capabilities
```

A Block references contracts via `<contracts>`:

```xml
<contracts>
  <com.foo:IIdentifiable />
  <com.foo:IPlaceable />
</contracts>
```

```text
Declared on:       root <block> only (not on Sub-Blocks)
Child element:     direct Block reference (element name = FQN via xmlns prefix)
Contract target:   any Block definition usable as a partial definition (typically abstract)
Member scope:      Properties, Aggregations, Associations, Capabilities, Constraints,
                   Suggestions, documentation, examples, references, optional Capability defaults
Ignored on target: subBlocks[], compositions[] on the contract Block
Partial members:   a contract may declare incomplete members — e.g. only <id type="Text"/>
                   without default, constraints, or documentation; the Block completes them
```

**Effective definition merge order:**

```text
baseType chain  →  Contract 1  →  Contract 2  →  …  →  Block (local declarations)
```

Merge rules (identical to `baseType` partial overrides):

```text
Later contracts override earlier ones          — last contract wins on conflicts
The Block overrides all contracts              — local declarations win always
Only explicitly specified attributes override  — omitted attributes are preserved
final="true" members cannot be overridden      → BML_FINAL_MEMBER_OVERRIDE
Same member kind required for overrides        → BML_CONTRACT_MEMBER_KIND_MISMATCH
```

**Example — contract supplies type, Block supplies the rest:**

```xml
<!-- com.foo.IIdentifiable.bml — contract -->
<properties>
  <id type="Text"/>
</properties>

<!-- com.foo.MyEntity.bml — concrete Block -->
<contracts>
  <com.foo:IIdentifiable/>
</contracts>
<properties>
  <id>
    <documentation>Unique identifier</documentation>
    <constraints>…</constraints>
  </id>
</properties>
```

Effective member `id`: `type` from the contract; `documentation` and `constraints` from the Block.

Contract members are **merged into** the effective member set by `resolveEffectiveMembers()` — they are not validated as a separate superset check. Merge resolution runs at stage [8] (semantic validation), after the contract Block definitions themselves are resolved.

---

## Properties

Properties are typed parameters of a Block. Every Property has a name, a type, and a defined value.

### Composition Meta (`bml:id`, `bml:version`)

`org.blockml.core.Block` declares **no members**. The property namespace on every sub-type is **completely free** — domains may declare Properties named `id`, `version`, or anything else.

Composition **instance identity** and **external reference version** are not member attributes. They use the `bml:` namespace on Block instance elements:

```text
bml:id       — instance identity within a composition tree; may be empty
bml:version  — semantic version pin when typeFqn refers to an external block (another file)
```

```text
Authored as:     bml:id="…" and bml:version="…" on composition instances
Not on Block:    org.blockml.core.Block declares no members — no reserved property names
Bare id=/version= on instances → memberValues if the referenced Block type declares such Properties
Special semantics: identity paths (parent::child), reference validation,
                   auto-ID rules, render identity (mb_block_id)
```

Do not confuse `bml:id` (composition meta) with a domain Property named `id`. The compiler, validator, and renderer give `bml:id` dedicated handling. See Instance Identity and `12_bom_object_model.md` — Instance ID Rules.

### Property metadata

```text
name          — camelCase property name (unique within namespace — see Member Namespace)
type          — FQN of a ValueType (baseType chain includes org.blockml.core.ValueType)
value         — typed defined value (literal or Expression). Formerly defaultValue.
group         — optional grouping hint (for editors)
documentation — human-readable description
since         — optional; semantic version from which this member is available
changelog     — optional; version history (oldest first)
examples      — optional; usage examples (title + CDATA body)
references    — optional; cross-references to related Blocks or Definitions (type + optional context)
constraints   — optional list of Constraint Block instances (see below)
suggestions   — optional list of Block instances of the property type (see below)
readOnly      — when true, instance authoring forbidden; definition and child override allowed
final         — prevents override in child Blocks
namespace     — resolved canonical namespace identifier (empty = default namespace)
visibility    — optional; must match naming convention
```

**Declaration order:** `<property>` elements within `<properties>` are stored in BML document order. The parser must not reorder them. Order defines array literal authoring, FunctionMapping positional parameters, and compatibility — see `17_type_system_bml.md` — Declaration Order · `18_function_mapping.md`.

**EnumType property values:** when the property `type` is an EnumType, enum instance references may omit the `{EnumTypeFQN}::` prefix — `STANDARD` is equivalent to `com.machineblocks.type.BaseCutoutType::STANDARD` on a `BaseCutoutType` property. See `17_type_system_bml.md` — EnumType.

**Property value semantics:** property values are **never linked** to other instances — always deep copies. Enum `FQN::id` tokens are resolution keys, not live references to `_values` composition entries. See `12_bom_object_model.md` — Property Value Semantics.

### Property and Capability Value Types

Property `type` attributes must resolve to a **ValueType** — a Block whose `baseType` chain includes `org.blockml.core.ValueType` (primitives, structs, enums, generics). Non-ValueType Blocks (Wall, Entity, NativeBlock, …) are not valid property types. The same rule applies to Capability `inputType` and `outputType`.

```text
type="Integer"              →  org.blockml.type.Integer        ✓  (Number → PrimitiveType → ValueType)
type="Decimal"              →  org.blockml.type.Decimal        ✓
type="type:Size3d"            →  com.machineblocks.type.Size3d ✓  (StructType → ValueType)
type="com.foo.Wall"           →  ✗  BML_INVALID_PROPERTY_TYPE (not a ValueType)
```

Generic type arguments must satisfy each parameter's `baseType` constraint — see `17_type_system_bml.md` — Generics.

### Aggregations and Associations

Aggregation and association `type` attributes may reference **any Block FQN** — including composable Blocks, ValueTypes, and meta Blocks:

```text
type="com.machineblocks.core.Block[]"     ✓
type="com.machineblocks.type.Size3d[]"    ✓
type="org.blockml.type.Integer[]"         ✓
```

ValueTypes appear as type references on Properties — values are stored on the Property, not on the ValueType. When a primitive must appear as a Block instance in composition, use a concrete `*Entity` type (for example `org.blockml.type.TextEntity`). See `17_type_system_bml.md` — § PrimitiveType · PrimitiveEntity.

### Constraints

A Property may declare a list of validation constraints. Each constraint is a Block instance whose `baseType` chain includes `org.blockml.core.Constraint`. The compiler binds each constraint's generic parameter `T` to the property type (or element type for collection constraints) and validates both the constraint instance and the property value.

```xml
<width type="Float">
  <value>50</value>
  <constraints>
    <constraint:Min value="0"/>
    <constraint:Max value="100"/>
  </constraints>
</width>
```

Constraints are enforceable — value violations emit `BML_CONSTRAINT_VIOLATION`. See `18_constraints_and_suggestions.md`.

### Suggestions

A Property may declare a list of suggested values. Each suggestion is a Block instance of the **same type as the property** — no special base type. Suggestions are purely metadata — they do not affect type validation or compilation. Editors display the property as a combobox; the SCAD BlockProcessor generates an OpenSCAD Customizer dropdown comment.

```xml
<textColor type="Text">
  <value>#303D4E</value>
  <suggestions>
    <TextEntity value="#303D4E"/>
    <TextEntity value="#EAC645"/>
    <TextEntity value="#58B99D"/>
  </suggestions>
</textColor>
```

The author can always enter any value regardless of suggestions. See `18_constraints_and_suggestions.md`.

### Computed Property Values

A `value` may be a static literal or an Expression. Expressions in `value` allow a Property's defined value to be derived from other Properties of the same Block:

```xml
<numberOfSamples type="Integer">
  <value>5</value>
</numberOfSamples>
<labelSize type="Integer">
  <value>5</value>
</labelSize>
<size type="Size3D">
  <value>${ [#math.max(2 * numberOfSamples + 1, labelSize), 12, 2] }</value>
</size>
```
          value="${ [#math.max(2 * numberOfSamples + 1, labelSize), 12, 2] }" />
```

**Allowed expression roots in `value`:**

```text
✓  Other Properties of the same Block
✓  #built-in functions (#math.*, #strings.*, etc.)
✗  @bean references
✗  @model bindings
✗  bml: directives
✗  bml:with variables
```

**Cycle detection:** The compiler performs a topological sort of all Property dependencies before resolving values. If Property A's `value` references Property B and B's `value` references A — directly or transitively — a `BML_PROPERTY_CYCLE` error is emitted and compilation stops.

### Resolution Order

Property values are resolved in this order (highest priority first):

```text
1. Inline value    — set directly on a Block instance in a Composition
2. Preset value    — from the active Preset
3. Config value    — from the active Config profile (domain-specific)
4. Definition value   — from the Block definition (literal or computed expression)
```

---

## Aggregations

An Aggregation describes an ownership relationship: a Block can contain zero or more child objects of a given type.

### Aggregation Metadata

```text
name          — member name (unique within namespace)
type          — FQN of the child type, optionally with occurrence brackets (see Type Notation below)
default       — boolean; marks the default aggregation for bare <composition>
beanName      — optional; marks this Aggregation as a service binding
scope         — optional; "local" | "context" (service bindings only)
documentation — human-readable description
since         — optional; semantic version from which this member is available
changelog     — optional; version history (oldest first)
examples      — optional; usage examples (title + CDATA body)
references    — optional; cross-references to related Blocks or Definitions (type + optional context)
composition   — optional nested Composition filling this aggregation
readOnly      — when true, instance authoring forbidden; definition and child override allowed
final         — prevents override in child Blocks
namespace     — resolved canonical namespace identifier (empty = default namespace)
visibility    — optional; must match naming convention
```

`<aggregation>` and `<association>` child order within their containers is preserved by the parser (same rules as properties). Render targets may use aggregation order for UI or output sequencing.

**Member visibility** follows § Member Visibility. Private aggregations (`__name`) are confined to the declaring Block. Protected aggregations (`_name`) follow the formal access rule — derived Blocks and the direct composition owner may access them.

### Type Notation

**Multiplicity** is expressed in the `type` attribute — there is no separate `cardinality` attribute. BlockML has no `Array` type; brackets describe how many instances of the referenced type are permitted. See `17_type_system_bml.md` — Collections and Multiplicity.

```text
Integer         →  exactly 1
Integer[]       →  0..n   (shorthand for Integer[0..n])
Integer[0..n]   →  0..n
Integer[3]      →  exactly 3
Integer[1..5]   →  1..5
Integer[1..]    →  1..n
Integer[1..1]   →  exactly 1 (explicit)

Block           →  0..1   (association/aggregation — optional single reference)
Block[]         →  0..n
Block[1..1]     →  exactly 1 required reference
```

The internal BOM representation uses `minOccurs` / `maxOccurs` (or equivalent) on the type reference. BML surface syntax uses bracket notation only; the element type FQN is unchanged.

### Expression Context — `#this`, `bml:Self`, and Definition Paths

Three concepts separate instance access, type references, and definition navigation.

#### `#this` — current Block instance

`#this` is a magic bean available in expressions. It always refers to the current outer Block instance whose definition is being evaluated. Its binding does not change inside nested compositions, containers, or directives.

Unqualified member references are shorthand for `#this`:

```text
width          ≡  #this.width
height         ≡  #this.height
calculate()    ≡  #this.calculate()
```

#### `bml:Self` — current effective Block type

`bml:Self` is a context-dependent **type reference**. It resolves to the effective current Block type after inheritance has been resolved — not at parse time.

```xml
<association name="next" type="bml:Self"/>
```

On `com.foo.Node` → `next : com.foo.Node`. On `com.bar.SpecialNode extends com.foo.Node` → `next : com.bar.SpecialNode`.

Collection forms: `bml:Self[]`, `bml:Self[1..3]`, etc. `bml:Self` is especially useful for Associations (parent, children, connectedTo) but is also valid on Aggregations.

`bml:Self` can be used anywhere a normal type reference is allowed:

```xml
<property type="bml:Self"/>
<aggregation type="bml:Self"/>
<inputType>bml:Self</inputType>
<reference type="bml:Self"/>
```

`bml:Self` is **not** used for definition navigation. Member definition references use canonical structural paths (see below).

#### Canonical definition paths

A `BlockDefinition` is a regular Block. Every definition element is addressable via its **canonical path** within the Block FQN — matching the BML document structure exactly:

```text
com.foo.Bar.name                    →  <name>Wall</name>
com.foo.Bar.idea                    →  <idea>…</idea>
com.foo.Bar.documentation           →  <documentation>…</documentation>
com.foo.Bar.type                    →  <type>com.foo.Bar</type>
com.foo.Bar.baseType                →  <baseType>…</baseType>
com.foo.Bar.version                 →  <version>1.0.0</version>
com.foo.Bar.properties.width        →  PropertyDefinition for width
com.foo.Bar.aggregations.children   →  AggregationDefinition for children
com.foo.Bar.associations.parent     →  AssociationDefinition for parent
com.foo.Bar.capabilities.render     →  CapabilityDefinition for render
com.foo.Bar.genericTypes.T          →  GenericTypeDefinition for T
com.foo.Bar.subBlocks.Inner         →  nested BlockDefinition
com.foo.Bar.contracts               →  contracts aggregation
```

The path encodes both location and definition kind — no special definition-reference constructs (such as `bml:Def`) are required. Further navigation on member definitions follows the same rule: `com.foo.Bar.properties.width.type`, `com.foo.Bar.properties.width.documentation`.

Within the Block being defined, the Block's own FQN serves as the definition root:

```text
com.foo.Bar.properties.width        ≡  (current definition).properties.width
```

`org.blockml.definition.BlockDefinition` carries generic type parameter `B extends org.blockml.core.Block` — conceptually `BlockDefinition<com.foo.Bar>` when describing `com.foo.Bar`.

#### BOM internal representation

BML member containers (`<properties>`, `<aggregations>`, `<associations>`, `<capabilities>`) map to a flat `members: MemberDefinition[]` in the BOM (tagged by `kind`). The canonical path resolver walks the structural containers at reflection time — `com.foo.Bar.properties.width` resolves to the `PropertyDefinition` with `name: "width"` in that Block's effective definition.

| Expression | Meaning |
|---|---|
| `width` | shorthand for `#this.width` (instance value) |
| `#this.width` | value of the Property on the current Block instance |
| `bml:Self` | current effective Block type (type reference only) |
| `com.foo.Bar` | BlockDefinition for com.foo.Bar |
| `com.foo.Bar.name` | `<name>` metadata of the Block definition |
| `com.foo.Bar.properties.width` | PropertyDefinition for `width` |
| `com.foo.Bar.properties.width.type` | type FQN of the width property |

### Implicit Default Aggregation

When no Aggregations are declared, a domain-specific default Aggregation is created implicitly. BOM Core does not prescribe the name or child type — that is the domain's responsibility.

### Service Aggregations

A service Block provides named, reusable logic — such as data models, math utilities, or formatters. Services are bound into a Block via Aggregations with a bean name. Once bound, they are accessible in Expressions via their bean name using the `@` prefix.

### Service Class Hierarchy

```text
org.blockml.core.Block
  org.blockml.core.Entity              — base for built-in services and utility Sub-Blocks
    org.blockml.service.*              — built-in expression utilities (#math, #strings, …)
    org.blockml.service.ModelBlock     — holds data (JSONModel, ODataModel, XMLModel)
```

**`org.blockml.core.Entity`** — abstract base for addressable logic units. Built-in services in `org.blockml.service.*` extend Entity directly.

**`org.blockml.service.ModelBlock`** — provides data access via path-based Transformation Capabilities. Specializations: `org.blockml.service.JSONModel`, `org.blockml.service.ODataModel`, `org.blockml.service.XMLModel`.

Every Capability inherits an optional `<implementation>` from `org.blockml.core.CapabilityType`. The element **`type`** attribute must reference a Language FQN — e.g. `<implementation type="org.blockml.language.TypeScript">`. The BlockProcessor transpiles to the target language or executes at compile time when all arguments are literals. This is the pragmatic escape hatch for logic that no built-in covers yet — and a natural transition path: once a built-in is available, the `<implementation>` is removed and the call site is updated to a `#built-in` call while the Capability signature remains unchanged.

Built-in services are defined in `org.blockml.service.*` and accessible via the `#` prefix. They are shared across all Blocks in the same domain and cannot be overridden.

```text
#math    — built-in math service (min, max, ceil, floor, ...)
#strings  — built-in string utilities (format, trim, ...)
```

User-defined services are declared as Aggregations and given a bean name:

```text
@myModel   — user-defined JSONModel, bound as bean "myModel"
@myService — user-defined service Block, bound as bean "myService"
```

The distinction between `#` (built-in) and `@` (user-defined) is enforced at parse time. `#`-prefixed names are reserved and cannot be used as bean names.

### Bean Scope

Every service Aggregation declares a `scope` that controls visibility to child Blocks:

```text
scope   — "local" | "context"    default: "local"
```

`local` — the bean is only accessible within the Block that declares it. Child Blocks in Compositions cannot see it.

`context` — the bean is passed down to all child Blocks in Compositions. A child Block can declare a bean with the same name to override it for its own children.

**Scope resolution in Expressions:**

When an Expression references `@myBean`, the resolver walks up the Composition hierarchy:

```text
1. Current Block — has a bean named "myBean" with scope="context"? → use it
2. Not found → go one level up
3. Repeat until root
4. Not found → parse-time error: bean "myBean" not in scope
```

A bean with `scope="local"` is invisible to children — it is skipped during the upward walk.

**Override example:**

```text
App       @data scope="context"  ← ODataModel (visible to all descendants)
  View    @data scope="context"  ← JSONModel  (overrides App @data for this View and its children)
    Table                        ← sees JSONModel via @data
  Sidebar                        ← sees ODataModel via @data (no override here)
```

This is analogous to Spring Bean scoping (`@ApplicationScope`, `@RequestScope`) — but scope is declared on the Aggregation, not on the service type itself. The same service type can have different scopes in different contexts.

### Data Attributes (`data:`)

BlockML has **no `_customData` aggregation** on `org.blockml.core.Block`. The `data:` namespace attaches arbitrary metadata to Block definitions and Composition instances. Authoring syntax follows the **SAP UI5** pattern (`data:myVal` on Controls) — but in BlockML the values are **uninterpreted expressions** in the BOM, not typed aggregation members.

```text
org.blockml.core.Block   — no implicit aggregations for data:*
```

In BML, `data:*` attributes and `data:*` child elements are stored as `dataAttributes[]` on the Block definition or instance. Values are **not evaluated** at parse or validate time:

```xml
<!-- BML authoring: -->
<bricks:StandardBrick
    bml:id="strip"
    data:role="structural"
    data:count="${ sampleCount }" />

<!-- BOM representation: -->
StandardBrick.dataAttributes: [
    DataAttribute { key: "role",  value: LiteralValue("structural") }
    DataAttribute { key: "count", value: ExpressionValue("${ sampleCount }") }
]
```

A target renderer may interpret `dataAttributes` — e.g. a **UI5 renderer** could map them into `customData` aggregations on runtime Controls. That mapping is **render concern**, not part of the Block type system or BOM validation.

---

## Associations

Associations describe loose references between objects without ownership. They are defined for future use across all BOM specializations.

```text
name          — member name (unique within the Block's member namespace)
type          — FQN of the referenced type, optionally with occurrence brackets (see Type Notation)
documentation — human-readable description
since         — optional; semantic version from which this member is available
changelog     — optional; version history (oldest first)
examples      — optional; usage examples (title + CDATA body)
references    — optional; cross-references to related Blocks or Definitions (type + optional context)
```

Associations carry no ownership and do not affect rendering.

---

## Capabilities

Capabilities describe how a Block communicates — with the outside world or internally within a Composition. A Capability is a named member of a Block, sharing the member namespace with Properties, Aggregations, and Associations.

Like Properties, Capabilities are declared with a name and a type (FQN). Like Properties, their value in a Composition is set directly on the child Block instance as an attribute. For Capabilities, this value is the address or binding — not a data value.

### Capability Types

Capabilities use FQN type values. The type determines the communication pattern.

> **Package TBD** — placeholder `org.blockml.capability.*`. Candidate: `bom.foundation` (domain to be confirmed).

```text
org.blockml.capability.Inbound         — receives data/messages asynchronously
org.blockml.capability.Outbound        — sends/emits data/messages asynchronously
org.blockml.capability.Transformation  — synchronously callable; transforms inputType to outputType
```

### Capability Metadata

All Capabilities share these base fields:

```text
name           — camelCase member name (unique within the Block's member namespace)
type           — FQN of the Capability type (Inbound | Outbound | Transformation)
documentation  — human-readable description
since          — optional; semantic version from which this member is available
changelog      — optional; version history (oldest first)
examples       — optional; usage examples (title + CDATA body)
references     — optional; cross-references to related Blocks or Definitions (type + optional context)
```

Member visibility follows § Member Visibility. Private Capabilities (`__name`) cannot be bound from outside the declaring Block. Protected Capabilities (`_name`) follow the formal access rule — including derived Blocks and the direct composition owner.

**`Inbound`** — `inputType` required, `outputType` forbidden.

**`Outbound`** — `outputType` required, `inputType` forbidden.

**`Transformation`** — `inputType` and `outputType` both required.

Async reply via `replyTo` is a runtime/message pattern — not modeled via Capability attributes.

### Input and Output Types

Capabilities declare typed data via `inputType` and/or `outputType` (see validation rules above). Values are `TypeDescriptor` expressions that resolve to ValueTypes — same parsing rules as Property `type`.

```text
org.blockml.type.Integer          — primitive (NamedTypeReference)
org.blockml.type.Text           — primitive
{ a: Float, b: Float }            — anonymous struct (AnonymousStructType)
com.myDomain.MyClass              — named type (NamedTypeReference)
{ items: org.blockml.type.Integer[0..n] }  — collection field (multiplicity on reference)
```

See `12_bom_object_model.md` — Type Descriptors for the formal BOM representation.

Unqualified type names are resolved against the domain's default type namespace (determined by the Block's `baseType`).

### Object Input as Function Signature

When a Capability uses a structured Object as `inputType`, the Object defines an **anonymous struct type**. FunctionMapping translates call syntax to this struct — see `18_function_mapping.md`.

```text
inputType: { a: Float, b: Float }
  → Arity:       2  (number of keys)
  → Parameter names: a, b  (key names in declaration order)
  → Positional call: #math.max(size.x, labelSize)
  → Named call:      #math.max(a=size.x, b=labelSize)
  → Canonical:       #math.max({a: size.x, b: labelSize})
```

Positional and named call syntax are valid for Object input types when FunctionMapping supports them. This is the standard pattern for all `#math.*`, `#strings.*`, `#lists.*` built-ins.

`Object[0..n]` input types with a single named field are **not** suitable as Capability signatures when arity must be fixed — use a structured Object with named keys for each parameter. Variadic built-ins (e.g. `#strings.concat`) declare an explicit collection field: `{ values: String[0..n] }`.

### Input Call Syntax

The `inputType` determines how a Transformation Capability is called in Expressions:

```text
Primitive:
  myCapa(5)                        →  single value

Object input { a: T, b: T }:
  myCapa(a = 4, b = 5)            →  named parameters
  myCapa({a: 4, b: 5})            →  object literal (equivalent)
  myCapa(4, 5)                    →  positional (key order)

Collection field { values: T[0..n] }:
  myCapa([4, 5])                  →  sequence literal (positional values)
```

Named parameters `(a=4, b=5)`, object literal `({a:4, b:5})`, and positional `(4, 5)` all produce identical input values for Object `inputType`s. A mismatch between declared `inputType` and call syntax is a parse-time error.

### Capability Value in Compositions

Capabilities do not have an `address` attribute in their definition. The address or binding is set as the Capability's value on a child Block instance in a Composition — exactly like a Property value.

Four value patterns are recognized:

```text
Absolute URI      — outbound routing to a fixed address
  stud://domain/path

Relative path     — context-resolved address (TBD: resolved against nearest App/Area Block)
  /path/to/resource

Capability linking — forward to another Capability (via Expression)
  ${ @myService.otherCapa }
  Valid for: Outbound → Inbound (outputType forwarded as inputType), Transformation → Transformation (inputType + outputType must match)

Dynamic address   — Transformation Capability call produces the address string
  ${ @myService.getAddress() }
  outputType of the Transformation Capability must be String
```

### Inheritance

Capabilities are inherited via `baseType`, identical to Properties and Aggregations. A derived Block inherits all Capabilities of its base type and may add its own.

### Transformation Capabilities in Expressions

`Transformation` Capabilities are the only Capability type callable within Expressions. `Inbound` and `Outbound` Capabilities appear in Compositions as address/binding values only — they are not callable in Expressions directly.

### Direct Capability Access in Own Block

A Block can reference its own Capabilities in Expressions without a prefix — identical to how Properties are accessed:

```text
${ myTransform() }             — call own Transformation Capability, output value is used
${ myTransform(a = 1, b = 2) } — with input
${ myInbound }                 — link own Inbound Capability (no parentheses)
```

The rule mirrors external access: with `()` = Transformation call, without `()` = Inbound linking.

`Outbound` Capabilities of the same Block cannot be referenced in Expressions — they are triggered by the Block's internal logic, not bound.

Whether Capability linking in Presets is permitted is to be defined.

### Transformation Capability Implementations

A `Transformation` Capability may carry an `<implementation>` element that provides a target-language function body. This is only permitted when the Block's `baseType` declares support for that implementation type.

```text
Implementation language types (org.blockml.language.*):
  org.blockml.language.TypeScript   — TypeScript arrow function (compile-time / transpile)
  org.blockml.language.OpenSCAD     — OpenSCAD function(s) in CDATA

baseType declares:
  languages: [org.blockml.language.OpenSCAD]
    — e.g. com.machineblocks.core.Block
  languages: [org.blockml.language.OpenSCAD, org.blockml.language.TypeScript]
    — e.g. org.blockml.core.Entity
```

If a Block carries `<implementation type="org.blockml.language.OpenSCAD">` but its `baseType` does not list that type in `languages`, the compiler emits `BML_IMPLEMENTATION_NOT_SUPPORTED`.

A Transformation Capability implementation can live directly on any Block whose `baseType` supports it — not only on `utility Sub-Block` Sub-Blocks. The Sub-Block approach is a convention for grouping related utilities, not a requirement:

```xml
<!-- Direct on Block — valid if baseType supports OpenSCAD -->
<capabilities>
  <formatValue type="org.blockml.capability.Transformation" ...>
    <implementation type="org.blockml.language.OpenSCAD"><![CDATA[
function formatValue(x) = ...;
    ]]></implementation>
  </formatValue>
</capabilities>
```

### Address Schemes

BOM Core uses `protocol://` as a generic placeholder. Domain specializations define concrete schemes:

```text
stud://    — MachineBlocks physical block network
http://    — REST / WebHook
mqtt://    — MQTT broker topic
wot://     — Web of Things device hub
```

### Message Model

BOM Core defines a minimal abstract message model for Inbound and Outbound Capabilities:

```text
Message
  address   — URI identifying the target capability
  headers   — key-value metadata
    replyTo — optional; address to send an asynchronous response to
  payload   — structure declared by the Capability's inputType (Inbound) or outputType (Outbound)
```

All async messaging is asynchronous. A Capability may reply using the `replyTo` header. BOM Core does not prescribe when or whether a response is sent.

---

## Compositions

A Composition fills an Aggregation with concrete child Block instances. **Composition is part of Aggregation** — the preferred authoring form nests `<composition>` directly inside `<aggregation>`. The `composition aggregation="…"` attribute is removed.

Compositions may appear on Block definitions (filling declared or inherited aggregations) and on Block instances (opening aggregations inline). Every Block instance may optionally contain its own nested composition — the language is fully recursive.

```text
aggregation   — opened by aggregation member element name on definitions and instances
export        — optional on <composition>; bml:exportIds="true" marks instances as referencable via {EnclosingBlockFQN}::{id}
children      — ordered list of child Block instances (each may contain nested compositions)
```

**Placement rules:**

```text
Single effective default aggregation  → bare <composition> permitted (sugar)
Multiple aggregations                 → each opened explicitly by member element name
Ambiguous bare <composition>          → BML_AMBIGUOUS_COMPOSITION
```

Each child instance carries:

```text
type          — FQN of the child Block class
bml:id        — composition instance identity. Required when referenced or on bml:each.
                Omitted on anonymous static children → auto-ID after expansion. See Instance Identity.
bml:version   — version pin when type refers to an external block (another file)
members       — member values for Properties and Capabilities (see below)
```

**Property values** are literals or Expressions:

```text
"groove"              — String literal
2                     — Number literal
true                  — Boolean literal
[1, 8, 9]             — Array literal (pure literals only outside ${ })
{x: 1, y: 0}         — Object literal (pure literals only outside ${ })
${ size[0] + 1 }      — Expression
```

**Capability values** are addresses or bindings (see Capabilities → Capability Value in Compositions):

```text
stud://domain/path            — Absolute URI
/path/to/resource             — Relative path (context-resolved, TBD)
${ @myService.otherCapa }     — Capability linking
${ @myService.getAddress() }  — Dynamic address
```

### Model Binding Context

When a child instance's Aggregation is bound to a service Model, all children within that Aggregation inherit the Model binding context. Relative Model paths are resolved against this context:

```xml
<List items="{@myModel:/path/to/array}">
    <ListItem label="{@myModel:relAttr}" />
</List>
```

`:` separates the bean name from the path. An absolute path starts with `/`. A relative path is resolved against the binding context established by the parent Aggregation.

---

## Status

Status expresses the **maturity or lifecycle** of a BML element. Status is not a string or boolean flag — it is a **Block reference** following the Everything-is-a-Block principle.

**Implicit default:** When no status is declared, the effective status is **`status:Stable`**. At the document root this is the fallback; on nested elements the effective status is inherited from the parent (Stable unless an ancestor deviated).

### Core status blocks

```text
org.blockml.core.Status          — abstract base (in @blockml/core)
org.blockml.status.Stable        — complete, tested, reliable
org.blockml.status.Draft         — defined; implementation or mapping incomplete
org.blockml.status.Stub          — placeholder; behaviour not yet specified
org.blockml.status.Deprecated    — retained for compatibility; do not use in new work
```

Domain libraries may define additional status blocks (e.g. domain-specific WIP markers).

### Inheritance and defaults

Status is **inherited downward**. The document root defaults to `status:Stable`. Child elements inherit the effective status of their parent unless they declare a deviation.

```text
Omitted status on block/property/member   →  inherit from parent (root → Stable)
<status>status:Draft</status> on property →  Draft for property and its subtree
bml:status on non-definition element      →  only when deviating from inherited status
```

### Authoring syntax

**Definition elements** — `<status>` child **only when deviating** from inherited status:

```text
<block>  <property>  <aggregation>  <association>  <capability>  <constraint>  <suggestion>
```

```xml
<property name="width" type="Float">
    <status>status:Draft</status>
    …
</property>
```

**Non-definition elements** — `bml:status` attribute **only when deviating**:

```xml
<idea bml:status="status:Stub">…</idea>
<bricks:StandardBrick bml:status="status:Deprecated" … />
```

### Status namespace shorthand

Status values use the `status:` prefix (declared via `xmlns:status="org.blockml.status"`):

```text
status:Stable       →  org.blockml.status.Stable
status:Draft        →  org.blockml.status.Draft
status:Stub         →  org.blockml.status.Stub
status:Deprecated   →  org.blockml.status.Deprecated
```

There is **no implicit resolution** of bare names (`Draft` → `org.blockml.status.Draft` is invalid). The only existing shorthand exception remains Core primitives (`Integer` → `org.blockml.type.Integer`).

See `02_mbml.md` — § Status for full authoring rules and examples.

---

## BML Directives

BML Directives are special attributes and elements in the `bml:` namespace. They are not Block properties — they are instructions to the BML processor. Whether a directive is pre-processed at compile time or translated 1:1 into target-specific constructs is the BlockProcessor's decision.

The `bml:` prefix is the canonical namespace for language directives. Flow-control `bml:*` attributes follow the **Thymeleaf model** — they sit on the element they apply to, not in wrapper elements.

**Serialization directives:** `bml:xml` declares how Definition blocks and `org.blockml.core.Block` map to canonical BML XML (root element name, member as attribute/element/text/cdata). This is separate from composition flow control — see `19_definition_blocks_and_bml_xml.md`.

`data:*` is unrelated to directives. Authoring syntax is inspired by **SAP UI5** (`data:myVal` on Controls) — values land as **uninterpreted** `dataAttributes[]` in the BOM. No `_customData` aggregation on `org.blockml.core.Block`; renderers may interpret.

### Directive Placement

| Attribute / namespace | Allowed on | Notes |
|---|---|---|
| `data:*` | Block definitions and Block instances only | Not a `bml:` directive. Uninterpreted `dataAttributes[]` — renderer may consume. |
| `bml:with` | `<composition>`, `<bml:container>`, Block instances | Local variable scope |
| `bml:each` | `<bml:container>`, Block instances | Loop |
| `bml:id` | Block instances | Composition instance identity — literal or `${ expr }` |
| `bml:version` | Block instances | External block reference version (required when type is from another file) |
| `bml:status` | Non-definition elements | Maturity marker — only when deviating from inherited status |
| `bml:if`, `bml:unless` | `<bml:container>`, Block instances | Conditional |
| `<bml:xml>…</bml:xml>` | `org.blockml.core.Block`, Definition blocks only | XML root element name for this type — see `19_definition_blocks_and_bml_xml.md` |
| `bml:xml="attribute\|element\|text\|cdata"` | Members on Definition blocks | How member values serialize to XML — see `19_definition_blocks_and_bml_xml.md` |

Bare `id=` / `version=` on instances are member values when the Block type declares such Properties.

### `bml:each` — Loop

Repeats a Block instance for each element in a collection or for a numeric count. An optional second variable provides iteration status:

```xml
<!-- Numeric loop: i runs from 0 to n-1 -->
<bricks:StandardBrick
    bml:each="i : ${ numberOfSamples }"
    offset="${ [2 * i, 0, 0] }" />

<!-- Numeric loop with stat -->
<bricks:StandardBrick
    bml:each="i, stat : ${ numberOfSamples }"
    offset="${ [2 * stat.index, 0, 0] }"
    baseCutoutType="${ stat.last ? 'groove' : 'none' }" />

<!-- Collection loop -->
<bricks:StandardBrick
    bml:each="item, stat : ${ @myModel:/items }"
    size="${ item.size }"
    offset="${ [stat.index * 2, 0, 0] }" />
```

**Stat variables:**

```text
stat.index   — 0-based position
stat.count   — 1-based position
stat.size    — total count
stat.first   — boolean
stat.last    — boolean
stat.even    — boolean (based on 0-based index)
stat.odd     — boolean (based on 0-based index)
```

For numeric loops, the loop variable `i` equals `stat.index`. `stat.size` equals the numeric value. The stat variable is optional — omit it when not needed.

### `bml:if` and `bml:unless` — Conditional

Includes a Block instance only when the condition is true (`bml:if`) or false (`bml:unless`):

```xml
<bricks:StandardBrick
    bml:if="${ numberOfSamples > 3 }"
    size="[2, 2, 1]" />

<bricks:StandardBrick
    bml:unless="${ compact }"
    size="[4, 4, 1]" />
```

### `bml:container` — Virtual Container

A container that produces no Block output itself but allows directives to apply to a group of child Blocks:

```xml
<bml:container bml:each="i, stat : ${ numberOfSamples }">
    <Calibrator.Base
        offset="${ [0, i * -3, 0] }"
        label="${ rows[i].label }" />
    <Calibrator.StudDiameter
        offset="${ [0, i * -3, 0] }" />
</bml:container>

<bml:container bml:if="${ showOptional }">
    <ac:Corner offset="[0, 0, 0]" />
    <ac:Corner offset="[12, 0, 0]" />
</bml:container>
```

### Dynamic Instance ID

Use `bml:id` for dynamic IDs inside loops:

```xml
<bricks:StandardBrick
    bml:each="i : ${ numberOfSamples }"
    bml:id="${ 'sample_' + i }"
    offset="${ [2 * i, 0, 0] }" />
```

---

## Sub-Blocks

Sub-Blocks are Block definitions nested inside a parent Block definition. They are analogous to static inner classes in Java — they belong to the parent Block conceptually and share its FQN prefix.

Sub-Blocks are declared in a `<subBlocks>` section within the parent Block definition. Each Sub-Block is a full Block definition with its own properties, aggregations, capabilities, and composition.

### Allowed Sub-Block Types

The `baseType` chain defines which Sub-Block base types are permitted via **effective `subTypes`**. By default every Block has **no** permitted Sub-Block base types (`[]`). A type must **explicitly** declare `<subTypes>` to enable Sub-Blocks — or omit `<subTypes>` to inherit from its parent type.

```text
org.blockml.core.Block
  → subTypes omitted → effective [] (default)

com.machineblocks.core.Block
  → subTypes omitted → inherits [] from org.blockml.core.Block

com.machineblocks.core.CompositeBlock
  → subTypes declared explicitly:
    [com.machineblocks.core.Block]

com.machineblocks.core.Set
  → subTypes omitted → inherits CompositeBlock chain

org.blockml.service.Math
  → baseType: org.blockml.core.Entity

com.machineblocks.core.NativeBlock
  → subTypes omitted → inherits [] (final leaf — no Sub-Blocks)
```

To **forbid** Sub-Blocks on a type whose parent enabled them, declare an explicit empty override: `<subTypes/>`.

If a Sub-Block's `baseType` is not in the parent's effective `subTypes`, the compiler emits `BML_INVALID_SUBBLOCK_TYPE`.

Sub-Blocks follow the same visibility naming convention as members (`__` private, `_` protected, plain public). Optional root-level `<visibility>` on Sub-Blocks only — forbidden on root Blocks (`BML_VISIBILITY_ON_ROOT_BLOCK`). Visibility controls BlockML reference scope only — not target-system visibility. Mismatch → `BML_VISIBILITY_MISMATCH`; out-of-scope reference → `BML_PRIVATE_SUBBLOCK_ACCESS` or `BML_PROTECTED_SUBBLOCK_ACCESS`. See `02_mbml.md` — § Member Visibility · § Sub-Block Visibility.

### FQN Convention

```text
Parent:    com.machineblocks.calibration.Calibrator
Sub-Block: com.machineblocks.calibration.Calibrator.Base
           com.machineblocks.calibration.Calibrator.StudDiameter
```

The Sub-Block `<type>` is never declared — it is always derived from the parent FQN + `<name>`. Sub-Blocks can be nested recursively:

```text
com.machineblocks.calibration.Calibrator.Base.Strip
```

### Short-Name Reference

Within the parent Block's own Composition, Sub-Blocks are referenced by short name without namespace prefix — **same BML file only**:

```xml
<Base bml:id="base_stud" ... />
<StudDiameter bml:id="samples_stud" ... />
```

From other files or child instances, use the parent Block's namespace and a qualified name (`RootBlock.SubBlock`), full FQN, or prefixed qualified form (`cal:Calibrator.Base`). Bare Sub-Block short names are not resolved across files → `BML_SUBBLOCK_UNQUALIFIED_REFERENCE`.

If a Sub-Block shares the root Block's `<name>`, bare short tags are ambiguous → `BML_SUBBLOCK_QUALIFIED_REFERENCE_REQUIRED`; use `Calibrator.Calibrator`, `cal:Calibrator.Calibrator`, or the full FQN.

### SCAD Mapping

```text
com.machineblocks.calibration.Calibrator.Base
→  mb__com__machineblocks__calibration__Calibrator__Base
```

### Visibility

Sub-Blocks are full BOM objects referenceable via full FQN from outside the parent Block. External use is possible but uncommon.

---

## Preset (MachineBlocks)

Presets are **not** a BlockML core feature. In MachineBlocks, a preset is a named property configuration represented as a Block instance in the `_presets` aggregation. Any MachineBlocks Block instance can reference presets via the `basePresets` association.

Presets apply only to Properties — not to Aggregations, Associations, or Capabilities. Preset merge is compiler logic; Customizer JSON is render-target logic.

### Preset Block

A preset block (e.g. `com.machineblocks.bricks.StandardPresets`) is a Block definition with `baseType="com.machineblocks.core.Block"`:

```text
type — FQN of this preset block (e.g. com.machineblocks.bricks.StandardPresets)
version           — semantic version
composition       — Block instances in aggregation _presets; use bml:exportIds="true" for cross-file {FQN}::{id} references
```

Each preset instance in `_presets`:

```text
bml:id           — stable kebab-case identifier (composition meta; reference key)
name             — human-readable display name (Customizer UI, editor)
basePresets   — association bml:Self[]: space-separated preset ids (local or FQN::id)
                   own instance properties override merged preset chain
```

The `id` is the canonical reference key. The `name` is display-only. The `id` must be unique within the enclosing Block's `_presets`.

Multiple preset blocks can target the same Block type — from different authors or packages.

### Preset Reference Syntax

```text
{BlockFQN}::{preset-id}

Example:
  com.machineblocks.bricks.StandardPresets::brick-2x4
```

Qualified references require `bml:exportIds="true"` on the target composition and a **literal static `id`** on the target instance — see Instance Identity → Qualified Block Instance References.

### Preset in Compositions

```xml
<bricks:Standard
    basePresets="com.machineblocks.bricks.StandardPresets::brick-2x4" />

<bricks:Standard
    basePresets="com.machineblocks.bricks.StandardPresets::brick-2x4"
    baseColor="#303D4E" />
```

### Merge Order

```text
configProfile < basePresets chain < inline property
```

---

## Library

A Library is a **Block** with `baseType="org.blockml.core.BlockLibrary"`. It groups exported Block and ValueType definitions, optional XSD schemas, and dependencies on other libraries into one publishable unit. Replaces the legacy `library.xml` descriptor.

`org.blockml.core.BlockLibrary` is a **framework base type** in core — like `Block` or `ValueType`. It is **not** exported via any Library `_blocks` catalog. Concrete `Library.bml` files inherit from it.

```text
org.blockml.core.BlockLibrary           abstract composable Block
  property     description   String
  subBlocks    Schema
  aggregation  _dependencies  BlockLibrary[]
  aggregation  _schemas       Schema[]         (optional — legacy XSD)
  aggregation  _blocks        Block[]

org.blockml.core.BlockLibrary.Schema       ref (relative .xsd path)
```

`_dependencies` and `_blocks` hold empty Block instances as type references — element name resolves to FQN. **`bml:version` is forbidden** on these children. Type-reference interpretation follows from the Library role — no aggregation attribute is required.

The Library block is always named `Library.bml`. Its FQN is `{package}.Library` where `{package}` is derived from the file's package path (e.g. `com.machineblocks.bricks.Library`, `org.blockml.Library`, `org.blockml.compiler.Library`).

**Name (required):** `<name>Library</name>`. Filename is always `Library.bml`.

**Membership is defined only by `Library.bml` — not by directories.** A Block belongs to exactly the Library whose `_blocks` lists it. Physical file location and package-prefix overlap do not imply inclusion. Two libraries may share a package prefix (e.g. `org.blockml` and `org.blockml.compiler`) without one automatically exporting the other's blocks.

### Nested libraries

Libraries may be **nested by package**. Example: `org.blockml/Library.bml` and `org.blockml.compiler/Library.bml` are **separate** publishable units — the inner library does not merge into the outer one.

```text
org/blockml/
  Library.bml                 → org.blockml.Library
  core/Block.bml              → member iff listed in org.blockml.Library _blocks
  compiler/
    Library.bml               → org.blockml.compiler.Library  (own library)
    Parser.bml                → member iff listed in org.blockml.compiler.Library _blocks only
```

**Typical pattern:** inner library depends on outer via `_dependencies`; outer does **not** depend on inner.

```xml
<!-- org/blockml/compiler/Library.bml -->
<_dependencies>
  <composition>
    <blockml:Library />        <!-- outer library as dependency -->
  </composition>
</_dependencies>
<_blocks>
  <composition>
    <compiler:Parser />        <!-- only compiler-owned blocks -->
  </composition>
</_blocks>
```

**Nesting rule (required):** an outer library's `_blocks` must **not** reference Blocks exported by an inner library (any `_blocks` entry of a library whose package is a strict sub-package of the outer library's package). Inner-library blocks are consumed via the inner library dependency — not re-exported by the outer catalog.

Violation → `BML_LIBRARY_NESTING_VIOLATION`.

**Bootstrap:** the CLI/orchestrator discovers all `Library.bml` files, resolves `_dependencies` and `_blocks` by FQN (effective version from library context), and registers referenced definitions in dependency order. Without a Library block, all BML files in a directory are treated as public (fallback).

**Types:** ValueType definitions (StructType, EnumType, …) are exported via `_blocks` alongside composable Blocks. **`_schemas`** is optional legacy XSD — omit when types are BML-only.

A Library answers: *"What Block types, presets, and types does this package export?"*

---

## Catalog

A Catalog is a named collection of top-level composite Block definitions — finished products or assemblies intended for direct use.

```text
name              — short catalog name
type — FQN of the catalog
version           — semantic version
blocks            — list of Block FQNs contained in this catalog
```

A Catalog answers: *"What finished assemblies are available?"*

Where a Library contains reusable types, a Catalog contains concrete finished compositions. The relationship mirrors the distinction between a component library and a product catalog in manufacturing.

---

## Expression System

BOM Core defines an expression system for dynamic member values. Expressions are used in Compositions to derive child Block property values from the parent Block's members, or to bind to service Models and Capabilities.

### Syntax

Expressions are wrapped in `${ }`. The content inside `${ }` is **extended JSON** — standard JSON syntax extended with three additions: property references, model bindings, and bean calls.

```text
${ myProperty }                                    — Property reference
${ myProperty.x }                                  — Attribute access
${ myProperty[0] }                                 — Index access
${ [size[0], size[1], 1] }                         — Array with expressions
${ {x: size[0], y: 1} }                            — Object with expressions
${ size[0] + 1 }                                   — Arithmetic
${ size[0] > 2 ? "groove" : "standard" }           — Ternary
${ myTransform() }                                 — Own Block: Transformation Capability call
${ myTransform(a = 1, b = size[0]) }               — Own Block: Transformation call with input
${ myInbound }                                     — Own Block: Inbound linking (no parentheses)
${ #math.min(size[0], size[1]) }                   — Built-in service call
${ @myBean.format(value = size[0], unit = "mm") }  — Bean call, named params (Object payload)
${ @myBean.format({value: size[0], unit: "mm"}) }  — Bean call, object literal (equivalent)
${ @myBean.compute(size[0], size[1]) }             — Bean call, positional (Array payload)
${ @myBean.compute([size[0], size[1]]) }           — Bean call, array literal (equivalent)
${ @myBean.otherCapa }                             — External Capability linking (no parentheses)
${ @myModel:/some/path }                           — Absolute Model binding
${ @myModel:relAttr }                              — Relative Model binding
${ @myBean.format(@myModel:attr, size[0]) }        — Bean call with mixed arguments
```

### Extended JSON Rules

Inside `${ }`, the following extensions to JSON are permitted:

```text
Property reference:    size   size[0]   size.x        — unquoted, resolves to current Block member
Model binding:         @myModel:/path   @myModel:rel  — @ prefix, : separator
Bean call:             @myBean.capa(...)               — @ prefix, dot notation
Built-in call:         #math.min(...)                  — # prefix, reserved namespace
```

Everything else follows JSON subset rules: strings in quotes, numbers as-is, booleans `true`/`false`, arrays `[...]`, objects `{...}`. **`null` is not valid in BML** — use absent/empty authoring; targets may map to `null` at render time. See `17_type_system_bml.md` — EMPTY.

Object and array literals may contain expressions as values:

```text
${ [size[0], size[1], 1] }              ✓  array with property references
${ {x: size[0], y: @model:/y} }        ✓  object with property reference and model binding
${ {label: @myBean.format(size[0])} }  ✓  object with bean call as value
```

Outside `${ }` (as raw attribute values), only pure JSON literals are allowed:

```text
size="[1, 8, 9]"          ✓  pure array literal
config="{x: 1, y: 0}"    ✓  pure object literal
size="${ [size[0], 1] }"  ✓  expression (dynamic)
config="${ {x: size[0]} }" ✓  expression (dynamic)
```

### Object vs. Array — Mandatory Rule

**If a value has named attributes, it must be written as an Object `{ }` — never as an Array `[ ]`.**

This rule is enforced regardless of how the target language (e.g. SCAD) represents the value internally. The translation from Object to target format is always the BlockProcessor's responsibility.

```text
CORRECT — structured value with named keys → Object:
  { face: 'x-', axis: 'z', type: 'female' }
  { 'z+': -0.5 }
  { x: size[0], y: size[1] }

WRONG — array used as object substitute:
  ['x-', 'z', 'female']    ✗  has implicit positional semantics — not allowed
  [['z+', -0.5]]           ✗  SCAD-style array — not allowed in BML
```

The distinction:
```text
Array  → homogeneous sequence, no named structure: [1, 2, 3], [size[0], 0, 0]
Object → named attributes, structured: { face: 'x-', axis: 'z', type: 'female' }
```

If the SCAD representation uses arrays internally (e.g. `[["z+", -0.5]]`), the BML must still use Object syntax. The Processor translates.

### Expression Prefixes

```text
(no prefix)   — Property or member of the current Block instance
#name         — Built-in service (defined in baseType hierarchy, reserved)
@name         — User-defined Bean (bound via Aggregation) or Model binding
```

### Built-in Service Calls (`#`)

Built-in services are defined in the `baseType` hierarchy. Their Capabilities must be `Transformation`. The `#` namespace is reserved — user-defined beans cannot use `#`.

```text
${ #math.min(size[0], size[1]) }   — Transformation Capability, array input → primitive output
${ #math.max(a, b) }
${ #strings.format(tpl, v) }
```

### User Bean Calls (`@`)

The referenced bean must be declared as an Aggregation with a `beanName` on the current Block. Only `Transformation` Capabilities are callable in Expressions. The output value is used as the expression result.

```text
Object input — two equivalent forms:
  ${ @myBean.capa(a = 4, b = size[0]) }    — named parameters
  ${ @myBean.capa({a: 4, b: size[0]}) }    — object literal

Array input — two equivalent forms:
  ${ @myBean.capa(4, size[0]) }            — positional arguments
  ${ @myBean.capa([4, size[0]]) }          — array literal

Primitive input:
  ${ @myBean.capa(size[0]) }               — single value

Mixed arguments (passing model binding as argument):
  ${ @myBean.format(@myModel:attr, size[0]) }
  ${ @myBean.format(@myModel:/abs/path, "mm") }
```

### Capability Linking

```text
${ @myBean.myOutbound }   — no parentheses; links without calling
```

Links an `Outbound` Capability of a Bean to an `Inbound` Capability of the current Block. The message is forwarded without transformation. The Outbound's `outputType` must match the Inbound's `inputType`.

For `Transformation → Transformation` linking: `inputType` and `outputType` must both match.

This form is only valid when the target member is a Capability — using it on a Property is a parse-time error. Whether Capability linking is permitted in Presets is to be defined.

### Model Binding

```text
${ @myModel:/absolute/path }   — absolute path from Model root
${ @myModel:relativeAttr }     — relative path, resolved against binding context
```

The binding context is established by the parent Aggregation (see Compositions → Model Binding Context). Relative paths are only valid when a binding context exists — otherwise a parse-time error.

### Arithmetic and Ternary

```text
${ myProperty.x + myProperty.y - 1 }
${ myProperty.z * 2 }
${ myProperty > 2 ? "groove" : "standard" }
```

Operators: arithmetic `+  -  *  /  %`, comparison `>  <  ==  !=  >=  <=`.

### Scope Rules

```text
- Property references: current Block instance only (no prefix)
- No access to parent, grandparent, or sibling Block properties
- Direction is always parent → child (top-down only)
- bml:with variables: visible on the element and all descendants (use on <composition> or <bml:container> to share values between siblings)
- @bean references: only beans declared as Aggregations on the current Block
- #built-in references: always available (inherited via baseType)
- Model binding context: inherited from parent Aggregation
- Array/Object literals outside ${ }: pure JSON only (no expressions)
- Array/Object literals inside ${ }: expressions allowed as values
```

### Expression AST

Expressions are parsed into typed **`ExpressionNode`** trees at compile stage [7] — not evaluated as raw strings. Each `${ }` span becomes an `ExpressionValue { raw, ast, resultTypeFqn }` on the BOM. The AST is renderer-independent. See `10_expression_language.md` — Expression AST.

---

## Type System

BOM Core defines a minimal set of primitive types. Domain specializations extend this with domain-specific types. The type registry is dynamic — new types can be registered at runtime without modifying BOM Core.

### BOM Core Primitive Types

```text
org.blockml.type.Boolean
org.blockml.type.Text
org.blockml.type.Number          — abstract numeric branch
  org.blockml.type.Integer
  org.blockml.type.Float
  org.blockml.type.Decimal
```

Unqualified resolution whitelist (step 4): `String`, `Boolean`, `Integer`, `Float`, `Decimal` only — see `02_mbml.md` — § Unqualified Block Resolution.

### Type Expressions (not ValueTypes)

BlockML has three ValueType kinds only: **Primitive**, **Enum**, **Struct**. Unions, collections, and generic applications are **type expressions** — see `17_type_system_bml.md` — Type Expressions.

```text
Union:        "auto" | Float · false | T · Boolean | StudType
Collection:   Integer[] · Size3D[1..3]
Generic use:  Box<Integer>   (Box is a StructType with <genericTypes>)
              In BML type="..." attributes write Box(Integer) — see 17_type_system_bml.md
```

Legacy wrapper types (`AutoOr<T>`, `NoneOr<T>`, `Array<T>`, …) are **obsolete** — use union and multiplicity syntax directly.

### Domain Type Namespaces

Each domain BOM defines its own type namespace:

```text
com.machineblocks.type.*   — Size3D, Direction, WallGap, Color, ...
com.electronics.type.*     — Voltage, Resistance, Footprint, ...
com.ui.type.*              — Color, Length, FontSize, ...
```

Types are never shared across domain namespaces unless explicitly defined in `org.blockml.type`. This is intentional — domain-specific types carry domain-specific semantics even when they share a name.

### Type Resolution Shorthand

Unqualified type names in serialization formats are resolved against the domain's default type namespace. BOM Core does not prescribe the namespace — that is the domain's responsibility.

---

## Versioning

Every Block, Library, and Catalog definition carries a semantic version — directly or via library inheritance. External instance references use **effective version resolution** from the TypeRegistry context; `bml:version` is an optional exact-version assert.

```text
effectiveBlockVersion:
  own <version> on Block definition, else library.version if exported via Library, else error

Library.bml:     <version>3.0.0</version>   — release version of the package
Block in library: <version> optional — inherits library.version; if set, must be >= library.version
Standalone block: <version> mandatory

bml:version="1.0.0" on instance — optional exact-version assert (not a mandatory pin)
bml:version inside Library files — forbidden (BML_VERSION_NOT_ALLOWED_IN_LIBRARY)
```

**Framework convention (`org.blockml.*`, `com.machineblocks.*`):** version only on `Library.bml`, not on individual block files.

See `12_bom_object_model.md` — Version Rules.

---

## Target System

The Target System is the bridge between BOM Core and domain-specific output formats. It defines how Blocks are processed, and how the compiler dispatches processing to the correct RenderTarget.

### Concepts

**RenderTarget** — defines the output system. Its name is the full stack identifier used on the CLI. It has a RenderEngine, zero or more BlockProcessors, and zero or more delegates to other RenderTargets.

**RenderEngine (CompilerEngine)** — provides the processing infrastructure for BlockProcessors. **CompilerEngine** is the generic term; BOM Core defines the contract as the TypeScript `RenderEngine` interface. A BlockProcessor chooses which engine methods to use — compile, renderTemplate, copyTemplate, or callLLM. Each BlockProcessor within the same target may use a different strategy. New CompilerEngine implementations can always be built and published as independent packages. **MakerEngine** (`@blockml/engine-maker`) is the first implementation.

**BlockProcessor** — a sub-unit of the RenderTarget registered for a specific `baseType`. Uses the RenderEngine as infrastructure and chooses its own rendering strategy. A single BlockProcessor can handle many Block types internally, or a target may have one specialized BlockProcessor per Block type, or any combination.

### RenderEngine Interface (CompilerEngine)

A CompilerEngine provides methods for all rendering strategies. BlockProcessors call whichever method fits their needs. The TypeScript interface name is `RenderEngine`:

```typescript
interface RenderEngine {
  // Deterministic code transformation (compile strategy)
  compile(block: Block, processor: BlockProcessor, context: RenderContext): RenderOutput

  // Template loading + variable substitution (template strategy)
  renderTemplate(block: Block, templatePath: string): RenderOutput
  renderTemplates(block: Block, templatePaths: string[]): RenderOutput

  // Pure file copy — no transformation (copy strategy)
  copyTemplate(sourcePath: string, targetPath: string): RenderOutput

  // LLM-based generation (llm strategy — future)
  callLLM(block: Block, prompt: string, context: RenderContext): RenderOutput
}
```

BOM Core defines only this interface. Each engine package implements it in its own way. For `RenderContext` fields see `14_compiler_runtime.md` — RenderContext (C1).

### RenderTarget Interface

```typescript
interface RenderTarget {
  name:       string             // e.g. "machineblocks-v3-scad"
  engine?:    RenderEngine       // optional if target only delegates
  processors: BlockProcessor[]   // 0..n own processors
  delegates:  RenderTarget[]     // 0..n other targets for delegation
}

interface BlockProcessor {
  baseType: string
  process(block: Block, engine: RenderEngine): RenderOutput
}
```

### Dispatch Logic

For each Block in the BOM document:

```text
1. Own processors: exact FQN match
2. Own processors: baseType-chain fallback (most specific wins)
3. Delegates: same logic applied recursively
4. No match → BML_NO_TARGET diagnostic error
```

More specific processors always win over generic ones — analogous to CSS selector specificity.

### Target Types

A RenderTarget is not categorized as "atomic" or "composite" — the combination of processors and delegates determines its behavior:

```text
Only own processors              — handles everything itself
Only delegates                   — pure delegation (e.g. MartianMicro targets)
Own processors + delegates       — mixed: handles some blocks, delegates others
```

### BlockProcessor Strategies

A BlockProcessor chooses its rendering strategy by calling the appropriate engine method. Multiple strategies can coexist within a single RenderTarget:

**Compile strategy** — deterministic code transformation:

```typescript
class ScadBlockProcessor implements BlockProcessor {
  baseType = "com.machineblocks.core.Block"
  process(block: Block, engine: RenderEngine): RenderOutput {
    return engine.compile(block, this, context)
  }
}
```

**Template strategy** — template file + variable substitution:

```typescript
class NfcPlayerProcessor implements BlockProcessor {
  baseType = "com.pimachine.nfc.NfcPlayer"
  process(block: Block, engine: RenderEngine): RenderOutput {
    return engine.renderTemplates(block, ["nfc_player.py.tpl", "config.json.tpl"])
  }
}
```

**Copy strategy** — pure file copy, no transformation:

```typescript
class MathBuiltInProcessor implements BlockProcessor {
  baseType = "org.blockml.service.Math"
  process(block: Block, engine: RenderEngine): RenderOutput {
    return engine.copyTemplate("lib/math_service.scad", "lib/math_service.scad")
  }
}
```

**Mixed within one target:**

```text
machineblocks-v3-scad-target
  ScadBlockProcessor      → compile strategy    (com.machineblocks.core.Block)
  ScadSetProcessor        → compile strategy    (com.machineblocks.core.Set)
  MathBuiltInProcessor    → copy strategy       (org.blockml.service.Math)
  CapabilityImplementationProcessor  → compile strategy    (org.blockml.core.Entity)
```

### Built-in services as BML

Built-in services (`#math`, `#strings`, etc.) are defined as BML BML service files in `@blockml/core` — **SSOT**. SCAD equivalents in `scad-lib/blocks/org/blockml/service/` are pre-rendered build artifacts. Thymeleaf-aligned `#` utility names; `#math` is BlockML-specific.

```text
@blockml/core/
  src/
    org/blockml/service/
      Math.bml            — org.blockml.service.Math      — #math.*
      Strings.bml         — org.blockml.service.Strings   — #strings.*
      Numbers.bml         — org.blockml.service.Numbers   — #numbers.*
      Lists.bml           — org.blockml.service.Lists     — #lists.*
      Bools.bml           — org.blockml.service.Bools     — #bools.*
```

Each domain target registers a corresponding BlockProcessor that renders these services into the target-appropriate form (e.g. `MathBuiltInProcessor` for SCAD copies or generates the required SCAD helper functions).

### Delegate-Only Targets

A target with no processors and no engine — only delegates. Used for domain libraries that build entirely on existing targets:

```text
martianmicro-anyclosure-target
  engine: —
  processors: —
  delegates: [machineblocks-v3-scad-target]
```

MartianMicro defines only its Block types as MBML files. All rendering is handled by the MB SCAD target. The target itself is a thin declaration — no rendering logic needed.

### RenderOutput

`RenderOutput` is defined by each RenderTarget — the compiler treats it as **opaque**. BlockML imposes **no mandatory file output** and **no 1:1 input→output mapping**. A successful compile may produce zero files, one file, many files, or side effects only. See `14_compiler_runtime.md` — Compile I/O Model (C4).

File-based targets typically use a `files[]` structure:

```typescript
interface ScadRenderOutput {
  files: { path: string; content: string; sourceMap?: string }[]
  sideEffects?: RenderSideEffect[]   // optional — service calls, deploy actions, …
}
```

`files` may be an **empty array** when the target performs side effects only. Side-effect shape is target-defined — BOM Core does not prescribe it.

---

## Package

BOM Core is published as a standalone package with no domain dependencies:

```text
@blockml/core
```

Domain BOMs declare it as a dependency:

```text
@machineblocks/mbom   depends on   @blockml/core
@electronics/ebom     depends on   @blockml/core
@ui/uibom             depends on   @blockml/core
```

BOM Core is browser and Node compatible. It contains no render logic, no file system access, and no domain-specific types.
