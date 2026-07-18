# BOM Core

version: 2.4.0

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

### Maximum authored surface for renderers

> **General rule:** The Urmodell must expose **as much of the original document** as possible to serializers and Render Targets — including details that look like parser/serializer “internals” at first glance.

```text
If a renderer or FatBlock / XSD / meta-serializer might need it later,
  it belongs on the Urmodell (authored form) — not dropped at parse time.
```

Examples of “internal-looking” data that **must** still be available downstream:

| Authored detail | Why renderers need it |
|---|---|
| `xmlns` / prefix bindings | 1:1 QName emit (`19` D2) |
| `<bml:xml>` / member `bml:xml` | XML shape for serializer, FatBlock, XSD (`19` D1/D3) |
| Element vs attribute **placement** when both were legal | Lossless roundtrip; canonical emit may differ |
| Expression / literal **raw** form | Target-specific emit without re-authoring |
| Directive attributes unexpanded | Composition expansion is Stage 3, not parse |
| Source locations (when parsed) | Diagnostics, LSP — optional on types, populated by parser |

**Do not** strip or only keep a “semantic subset” for a cleaner object model. Derived convenience belongs on pragmatic forks; **authored facts** stay on the Urmodell. When in doubt, **preserve**.

Consequence for BOM shape: prefer **first-class fields** for grammar/serialization metadata (e.g. `xmlRendering`) over burying it where only the serializer knows to look — every XML-emitting target is a first-class consumer.

### Canonical BOM is immutable (Urmodell)

The **Urmodell** (Canonical BOM) is the **Single Source of Truth**. The parser produces it; it is **read-only** and **not modified** after parsing.

The following must **never** be written back into the Urmodell:

- resolved inheritance
- effective properties
- effective versions
- effective status
- expanded composition
- evaluated expressions
- resolved references
- generated getters/setters
- any other derived or renderer-specific data

The Urmodell describes **only** what was modelled in BML.

Parsed literal values remain in **authored form** (`[5,5,6]` stays an array; `{x:5,y:5,z:6}` stays an object). Expression values store **`raw` source text** only — AST and evaluation results are utility output, not BOM mutations.

### Urmodell and Pragmatic Model

BlockML maintains two complementary model roles. They are not two sources of truth:

```text
Urmodell (Canonical BOM)          Pragmatic Model (Working Model)
──────────────────────────        ────────────────────────────────
read-only after parse             mutable copy / derived graph
SSOT — what was authored          convenience snapshot — what tools need
roundtripable to BML              may hold resolved inheritance, merges, …
never receives derived writes     resolution and partial merges live here
```

**Parser** → creates the Urmodell (immutable).

**Validator** → works on a **copy** (the default Pragmatic Model). It may already resolve inheritance chains, contracts, effective members, and related merges there. Diagnostics and the default pragmatic snapshot are Stage-2 outputs. The Urmodell stays untouched.

**Renderer** decides what to read:

1. the Urmodell directly (e.g. documentation, diff, IDE authored view),
2. the Validator’s default Pragmatic Model, or
3. a **new fork** from the Urmodell for its own pipeline.

Forking is first-class and may happen **multiple times**. Each fork may apply **partial merges** only (e.g. effective members now, directive expansion later, expression evaluation in a further step — or parallel forks for different targets). Derived copies must never write back into the Urmodell; they should retain provenance (Urmodell identity / content hash) so tools can detect staleness.

The Pragmatic Model is a **cache / working surface**, not a second SSOT.

### Language Server — planned IDE integration (V2)

> **Status: planned for V2.** Not implemented in V1. Architecture must keep Parser, Serializer, Validator, and core types reusable as the LSP backend.

A **VS Code Language Server** (`@blockml/lsp`, name TBD) is a thin adapter over the existing language loop — **not** a second parser or AST:

```text
VS Code / editor
  ↕  Language Server Protocol
@blockml/lsp (V2)
  ├─ @blockml/parser       → Urmodell (on open / change)
  ├─ @blockml/validator    → Diagnostics (pragmatic fork)
  ├─ @blockml/serializer   → Format / TextEdits from Urmodell
  └─ @blockml/core         → TypeRegistry, utilities, symbol queries
```

| LSP capability | Reuses |
|---|---|
| Parse / document sync | Parser → Urmodell |
| Diagnostics | Validator on pragmatic fork |
| Format document | Serializer ← Urmodell |
| Hover, outline, symbols | Urmodell + TypeRegistry |
| Go-to-definition / references | TypeRegistry + Urmodell graph |

**V2 scope:** text/XML editing with BOM-backed intelligence. Structural DOM editing (`addProperty`, …) remains **BomBuilder (V3)** — the LSP does not require the Builder.

#### V1 reuse mandate (build for the LSP now)

| Do now | Why |
|---|---|
| Populate **source spans** on parse (ranges for diagnostics, hover, go-to) | LSP maps BOM nodes ↔ editor positions |
| Keep spans **optional** on types | Builder-origin Urmodelle (V3) have none |
| **Tolerant parse** where feasible (partial BOM on broken XML) | IntelliSense must survive mid-edit errors |
| TypeRegistry bootstrap usable outside CLI | Workspace-wide navigation |
| Diagnostics with stable codes + ranges | `publishDiagnostics` |
| Serializer accepts any Urmodell provenance | Format-on-save without parser-only assumptions |
| No parallel IDE AST beside BOM | One model for CLI, compile, and LSP |

XSD/`catalog.xml` remain a V1 IDE aid; the Language Server is the long-term semantic editor backend and complements or supersedes schema-only validation over time.

### BomBuilder — planned writable authoring API (V3)

> **Status: planned for V3.** Not implemented in V1/V2. Architecture and type design must anticipate it from day one.

Creating or changing authored members (e.g. **new properties**, aggregations, composition children, `baseType`) is **authoring**, not resolution. It does **not** belong on the Urmodell (read-only) and must **not** be conflated with the Pragmatic Model (resolve / partial merges only).

```text
Producers of Urmodell                          Consumers of Urmodell
─────────────────────                          ─────────────────────
Parser (V1)        BML → Urmodell              Serializer → BML
BomBuilder (V3)    program → seal() → Urmodell Validator / pragmatic forks
                                               Renderer pipelines
                                               TypeRegistry bootstrap
```

**BomBuilder** (name TBD; package likely `@blockml/core` authoring surface or `@blockml/authoring`) is a **writable session** that builds or edits a BOM graph block-by-block from scratch or from `fork(Urmodell)`:

```text
createBlock() · addProperty() · addAggregation() · setBaseType()
setMemberValue() · addCompositionChild() · …
  ↓
seal() / toBomDocument()  →  immutable Urmodell
  ↓
optional validate · serialize → BML
```

Rules:

- Builder uses the **same** graph types as the Urmodell (`BomDocument`, `BlockDefinition`, members, instances) — **no parallel authoring schema**.
- `seal()` produces a normal Urmodell. Serializer, validator, and renderers must not care whether it came from Parser or Builder.
- Authoring never mutates an existing sealed Urmodell in place; edits yield a **new** sealed document (or replace the session’s draft until seal).
- Pragmatic forks remain resolve-only — no `createProperty` / structural authoring on the pragmatic path.

#### V1/V2 reuse mandate (build for the Builder now)

Everything shipped before V3 must maximize reuse when BomBuilder arrives:

| Do now | Why |
|---|---|
| Keep core BOM interfaces **construction-friendly** (plain data / factories, not parse-only objects) | Builder constructs the same types |
| Make parse-only metadata **optional** (e.g. source spans, XML locations) | Builder-origin documents have no BML offsets |
| Route all output through **Urmodell → Serializer** | One serialize path for parse and build |
| Keep Validator / utilities **provenance-agnostic** | Same Stage 2 for both producers |
| Do **not** put structural authoring on pragmatic forks | Clean Builder vs Resolve split later |
| Prefer small **factory helpers** in `@blockml/core` for valid empty/partial nodes | Shared by tests, scaffolding, and future Builder |
| Avoid baking “only exists after XML map” invariants into types | Builder must assemble graphs without the mapper |

IDE editors use the **Language Server (V2)** for parse/validate/format on text. Structured graph editing and `bom new` / generative tools are expected **V3** consumers of BomBuilder (LSP may call Builder later for refactors).

### Framework Utilities

BlockML provides a toolkit of standardised utilities. Examples:

```text
forkBom() / copyBom()           → new mutable pragmatic copy from Urmodell (resolve only)
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

Structural authoring (`addProperty`, …) is **not** a Stage-2 utility — it is BomBuilder (V3).

Utilities **never mutate** the Urmodell. They return derived information or write only into a pragmatic copy / new result structures (views, working models, diagnostics).

A utility may read the Urmodell plus a TypeRegistry and return e.g. an `EffectiveMemberSet`, an `ExpandedComposition`, or `Diagnostic[]` — always as a separate result object — or apply a named partial merge onto a forked pragmatic model.

### Renderer determines the flow

The framework does **not** prescribe pipeline order. Each renderer decides which model to read and which utilities to run, in what sequence.

```text
SCAD Renderer:
  fork(Urmodell) → resolveInheritance() → evaluateExpression() → expandComposition() → renderSCAD()

Java Renderer:
  reuse Validator pragmatic model → resolveContracts() → renderJava()
  — or —
  fork(Urmodell) → partial merges as needed → renderJava()

Documentation Renderer:
  read Urmodell → renderRawBOM()
```

Each renderer defines its own pipeline. The framework provides building blocks — not a fixed compile path.

### Renderer Working Model

Separately from the Pragmatic BOM copy, each renderer may own an **internal target working model** — optimised, cacheable, and freely mutable:

```text
SCAD:   Modules, Parameters, GeometryGraph
Java:   Classes, Fields, Methods, Constructors
React:  Components, Props, JSX Tree
```

That target model belongs exclusively to the renderer. The Urmodell remains unchanged throughout.

### Semantics remain in BML

BlockML describes semantics only. There are **no special concepts** for constructor, getter, or setter — all behaviour is expressed as ordinary **Capabilities** (`init()`, `getValue()`, `setValue()`, `render()`, …). Capability kinds (`Inbound`, `Outbound`, `Transformation`) describe intent; they are not compiler rules or runtime objects.

The renderer decides how to realise each Capability in the target system:

```text
init()     → Java constructor · UI5 onInit() · React useEffect()
getValue() → direct field access · generated getter · reflection
setValue() → direct field assignment · generated setter
render()   → SCAD module · JSX component · may be ignored
```

Interpretation happens **only** in the renderer — by reading Capability definitions and member values from the Urmodell (and/or a pragmatic fork). The Urmodell never contains implementation concepts such as constructors, getters, setters, runtime values, or executable behaviour.

### Validation pipeline

Validation consists of three independent stages. **Numbering glossary** (Validation Stages vs parser steps `[1]`–`[5]` vs SCAD renderer steps `[9]`–`[19]` vs Test Layers): see `06_compiler.md` — Stage numbering glossary.

```text
Stage 1 — Parser       well-formed XML · namespaces → Urmodell (immutable Canonical BOM)
                       (XSD not required; generation = Render Target — see 13 B8 / 15 Phase C)
Stage 2 — Validator    fork → pragmatic model; inheritance · contracts · type compatibility ·
                       visibility · constraints · references · expression correctness
                       (expressions are NOT evaluated)
Stage 3 — Renderer     chooses Urmodell / default pragmatic model / own fork(s);
                       expression evaluation · optional handling · capability interpretation ·
                       code generation · runtime behaviour
```

The **Parser** creates the Urmodell. The **Validator** forks a mutable **default Pragmatic Model** and may resolve inheritance, contracts, effective members, and defaults there. That default is shared infrastructure for diagnostics and convenience — a Renderer may reuse it, ignore it, or `fork` the Urmodell again (once or repeatedly) for its own partial merges.

### Properties are Optional

Every Property behaves as an **Optional** — it has a value or has no value. There is no `null`. The BOM represents `Optional<Value>` instead of `Value | null`. When a value is required in BlockML, declare a `org.blockml.bml.constraint.ValuePresent` constraint on the Property (with `validation="Error"`). When no ValuePresent constraint is enforced, the Property may remain empty; the Renderer decides how to interpret missing values.

`ValuePresent` is checked in Stage 2 **after** full Block resolution (baseType chain, generic substitution, contract merge, local overrides) via `resolveEffectiveMembers()` and instance value binding — as part of `validateConstraints()`. Missing value → `BML_CONSTRAINT_VIOLATION`.

The `readOnly` check runs in the same stage on every `BlockInstance`. After `resolveEffectiveMembers()` for the instance's `typeFqn`, any authored `memberValues` entry or aggregation/association child element that targets a member with `readOnly=true` → `BML_READONLY_MEMBER_WRITE`. Block definitions and child Block overrides are not instances — they may set or override readOnly members via `<value>` or `<composition>`. Expressions may read readOnly members.

### Expression layer vs BOM data layer

Expressions and BOM member values are **separate layers**:

Expressions describe **what should happen**, not the computed result. The Validator checks referenced members, visibility, type compatibility, valid capabilities, and valid access — but **never executes** expressions. Evaluation belongs exclusively to the Renderer.

| Layer | What it is | Where it lives |
|---|---|---|
| **BOM data** | `LiteralValue`, `ExpressionValue.raw` | Urmodell / Canonical BOM (immutable) |
| **Expression syntax** | AST, type inference, access level | `parseExpression()` utility output |
| **Expression evaluation** | resolved values | Pragmatic / renderer working model only |

In `${ size.x }`, member access is **expression semantics** — not BOM mutation. The underlying `size` literal stays in authored form. Numeric index access on StructType (`size[0]`) is not valid.

### Architecture

```text
BML                         BomBuilder (V3, planned)
 │                          createBlock / addProperty / …
 ▼                          │
Parser                      seal()
 │                          │
 └──────────┬───────────────┘
            ▼
Urmodell (Canonical BOM, immutable, SSOT)
 │
 ├─ Validator fork ──► default Pragmatic Model (partial merges, resolve only)
 │
 ├─────────────── Framework Utilities (never mutate Urmodell) ───┐
 │                                                               │
 ▼                                                               ▼
Renderer Pipeline                                        other Renderers
 │  may read Urmodell · reuse pragmatic · fork again (N times)
 ▼
Renderer target Working Model (optional, target-specific)
 │
 ▼
Emitter
 │
 ▼
Target Output

Serializer ← Urmodell (regardless of Parser or Builder provenance)
```

### Summary

```text
The Urmodell describes exclusively the semantics of BML (SSOT, read-only).
The Pragmatic Model holds tool/resolve state; renderers choose what to read.
Language Server (V2) reuses parser, validator, serializer, and core — no parallel AST.
BomBuilder (V3) is the writable authoring path; seal() yields a new Urmodell.
V1 must keep types and pipelines LSP- and Builder-ready (spans optional; shared serialize/validate).
The framework provides reusable analysis and transformation algorithms.
The renderer orchestrates these algorithms and produces its own working model for the target system.
```

Only **BML ↔ BOM** must be lossless. **BOM → Target** is entirely the renderer's interpretive job.

See also: `01_system.md` — Architecture · Language Server (V2) · BomBuilder (V3) · `06_compiler.md` — Parser, Utilities, and Renderer · `12_bom_object_model.md` — Abstraction Principle · `10_expression_language.md` — Expression vs BOM Data Layer · `08_managed_object.md` — Semantics in BML.

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
ValueType (Integer, SizeXYZ)     →  semantic value class for Property values and Capability input/output
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
org.blockml.bml.core.*         ✓
org.blockml.bml.type.*         ✓   (not .types)
org.blockml.bml.language.*     ✓   — implementation language types (TypeScript, OpenSCAD, …)
org.blockml.bml.service.*      ✓   (not .services)
org.blockml.bml.capability.*   ✓   (not .capabilities)
com.machineblocks.bml.type.*   ✓
com.machineblocks.bml.core.*   ✓
com.electronics.type.*     ✓
com.ui.type.*              ✓
```

**Documented exception — domain library packages:** collective/plural segment names are allowed when the package denotes a **family of related Block types**, not an infrastructure concern. These are stable, intentional FQNs — not typos.

```text
com.machineblocks.bml.bricks.*       ✓   — StandardBrick, Plate, Tile, … (MachineBlocks brick library)
com.machineblocks.bml.calibration.*  ✓   — Calibrator, …
```

Do not infer from `bricks` that other packages may freely use plural segments. New infrastructure namespaces (`.type`, `.service`, `.core`, `.capability`) are always singular. New domain libraries may choose a collective name deliberately — document the decision in the domain spec.

**XML xmlns prefixes:** short aliases (`core`, `type`, `unit`, `lang`, …) **always** mean `org.blockml.bml.*`. Domain mirrors use a domain token — MachineBlocks: `mbcore`, `mbt`, `mbunit`. See `02_mbml.md` — § XML prefix convention.

### Mandatory BML namespace (`<domain>.bml.*`)

Every BML definition — Blocks, Libraries, Types, Languages, Services, Capabilities, and all other BlockML definitions — must reside below the owning domain's **`bml`** package:

```text
General form:  <domain>.bml.*

Examples:
  org.blockml.bml.*
  com.machineblocks.bml.*
  com.example.bml.*
```

No BML Block, Library, or other BlockML definition may exist outside the domain's `bml` namespace. Violation → **`BML_OUTSIDE_BML_NAMESPACE`** (validation error).

```text
Correct:
  org.blockml.bml.core.Block
  org.blockml.bml.type.Integer
  org.blockml.bml.compiler.parser.Parser
  com.machineblocks.bml.core.Block
  com.machineblocks.bml.bricks.StandardBrick

Wrong:
  org.blockml.core.Block                         — missing .bml segment
  com.machineblocks.core.Block                   — missing .bml segment
  xmlns:core="org.blockml.core"                  — xmlns binding outside .bml
  Library blocks exports org.blockml.core.*     — export outside .bml
```

Physical source layout mirrors the FQN: `blocks/org/blockml/bml/core/Block.bml` defines `org.blockml.bml.core.Block`.

Typical BlockML language branches (all under `org.blockml.bml.*`):

```text
org.blockml.bml.core.*         — framework base types (Block, ValueType, Status, Library, …)
org.blockml.bml.type.*         — bootstrap ValueTypes (Integer, Decimal, Float, Text, Boolean, Number, …)
org.blockml.bml.status.*       — standard maturity status blocks (Stable, Draft, Stub, Deprecated)
org.blockml.bml.service.*      — built-in services (#math, #strings, …)
org.blockml.bml.capability.*   — Capability type branches (Inbound, Outbound, Transformation)
org.blockml.bml.language.*     — Languages (TypeScript, OpenSCAD, …)
org.blockml.bml.compiler.*     — compiler domain Blocks (Parser, Validator, Serializer, …)
org.blockml.bml.definition.*   — Definition meta-model Blocks (BlockDefinition, SubBlockDefinition, EmbeddedBlockDefinition, RootBlockDefinition, PropertyDefinition, …)
org.blockml.bml.documentation.* — bootstrap documentation blocks
```

These namespaces contain BML-defined Blocks, ValueTypes, Capability types, and Languages. They are part of the public BlockML grammar.

npm workspace packages (`@blockml/core`, `@blockml/parser`, …) are **deployment units** — not identical to FQN namespaces. A single npm package may ship BML files under `blocks/org/blockml/bml/` and TypeScript toolchain code under `src/`. TypeScript interfaces (BOM shapes in `@blockml/core`, render processors, CLI utilities) are **not** BML definitions and do not receive `<domain>.bml.*` FQNs. See `15_dev_setup.md` — Package Conventions.

Built-in services live in `org.blockml.bml.service.*`. **Class names** follow Thymeleaf utility objects where applicable (`Math`, `Strings`, `Numbers`, `Lists`, `Bools`). Expression calls use the **`#` prefix** with the lowercase utility name — Thymeleaf-aligned, plural for utilities: `#math`, `#strings`, `#numbers`, `#lists`, `#bools`. (`#math` is BlockML-specific; Thymeleaf has no `#math`.)

```text
Examples:
  org.blockml.bml.core.Block
  org.blockml.bml.service.Math
  org.blockml.bml.service.Strings
  org.blockml.bml.language.TypeScript
  org.blockml.bml.language.OpenSCAD
  org.blockml.bml.type.Integer
  com.machineblocks.bml.core.Block
  com.machineblocks.bml.type.SizeXYZ
  com.machineblocks.bml.bricks.StandardBrick   ← domain library (documented plural exception)
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
  com.machineblocks.bml.bricks.StandardPresets::brick-2x4
  com.myproject.enclosures.DefaultEnclosure::floor
```

Used in **association** member values that reference other instances — e.g. `basePresets`, `Step.part`. Association declaration `type` must be `InstanceReference(T)` or `InstanceReference(T)[]`. Values are InstanceReference tokens. **Not** valid on property values — properties always store inline deep copies. Also authorable on `<see instance="…">`. See `12_bom_object_model.md` — Property Value Semantics · AssociationDefinition.

A qualified reference is valid **only when both** conditions hold:

**1. Public target aggregation.** The aggregation member that contains the target instance must be **public** (`visibility="public"` or unprefixed name). Only instances in a public aggregation are visible for qualified cross-document references.

```xml
<aggregations>
  <presets type="core:Block[]">
    <composition>
      <bricks:Standard bml:id="brick-2x4" bml:version="3.0.0" size="[2, 4, 3]" />
    </composition>
  </presets>
</aggregations>
```

When the target aggregation is **protected** or **private**, `com.machineblocks.bml.bricks.StandardPresets::brick-2x4` is invalid → `BML_UNEXPORTED_INSTANCE_REF`.

**Aggregation visibility and instance IDs:**

| Visibility | `bml:id` reachability |
|---|---|
| `public` | Cross-document `{EnclosingBlockFQN}::{id}` references; unqualified ids within permitted BlockML access |
| `protected` | Declaring Block and its **child Blocks** (derived types / Sub-Blocks) — not arbitrary external documents |
| `private` | Declaring Block definition only |

There is no separate export flag on `<composition>` — reachability follows the aggregation member's visibility.

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

Same-document references (unqualified id only, e.g. `basePresets="brick-2x4"` within the same Block) resolve within aggregations visible to the referencing context per normal visibility rules. The public-aggregation rule applies to **`{BlockFQN}::{id}`** cross-document references only.

**BOM storage:** the parser stores `bml:id` only when authored. Auto-IDs are not written into `BomDocument` — see `12_bom_object_model.md` — Instance ID Rules.

---

## Block

A Block is the fundamental unit of BOM Core. It is a parametric, typed, reusable definition — analogous to a class in object-oriented programming.

### Metadata

```text
is                 — required: names the Idea (Urbild); reflection bml:Self.is — see 02_mbml.md § Terminology — Urbild
isnot              — required when confusion risk exists; reflection bml:Self.isnot
summary            — required when documentation is too long for a quick scan
documentation      — always required; human-readable technical description
since              — optional; semantic version from which this Block is available
changelog          — optional; version history (oldest first)
examples           — optional; usage examples (title + CDATA body)
references         — optional; cross-references via `<see>` (`block`, `file`, `url`, `property`, `aggregation`, `association`, or `capability`; optional `relation` from `org.blockml.bml.relation.*`)
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

Blocks inherit from other Blocks via `baseType`. Inheritance is single — each Block has exactly one base type. The root of all inheritance is `org.blockml.bml.core.Block`.

`baseType` is mandatory on every Block definition **except** `org.blockml.bml.core.Block` (inheritance root — omits `<baseType>`). An omitted `<baseType>` elsewhere is a parse-time error (`BML_MISSING_BASE_TYPE`). There is no implicit default — the author must always make an explicit choice about which domain the Block belongs to.

Domain-specific specializations extend this root:

```text
org.blockml.bml.core.Block
  com.machineblocks.bml.core.Block   — adds size, color, offset, direction, _parts aggregation, ...
  com.electronics.core.Component — adds footprint, schematic symbol, ...
  com.ui.core.Control            — adds layout, style, events, ...
  com.service.core.Bean          — adds lifecycle, dependencies, ...
```

### Composite Blocks

A Block with a non-empty Composition is a **Composite Block**. It defines internal structure by filling one or more of its Aggregations with child Block instances.

A Block without a Composition is a **Leaf Block** — it has no internal structure defined at the BOM level. Domain-specific Block Renderers handle its output directly.

---

## Member Namespace

Properties, Aggregations, Associations, and Capabilities all share a single member namespace per Block. Logical uniqueness is determined by **`(namespace, name)`** — unprefixed member elements belong to the default namespace (empty string).

Member namespace is supplied **exclusively by the XML element QName**. An optional prefix on the member element name (`<ui5:width/>`) is resolved via the document's `xmlns:` table; the parser stores the **canonical namespace identifier** in the BOM — never the XML alias. Unprefixed elements (`<width/>`) use the default member namespace (empty string), independent of the document default `xmlns`. See `02_mbml.md` — § Member Namespace (Element QName).

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

The prefix is not the logical member identity. For collision checking and override matching, normalize by stripping visibility prefixes (`myVar`, `_myVar`, `__myVar` → `myVar`). Members differing only by prefix in the same Block → `BML_DUPLICATE_MEMBER_VISIBILITY_VARIANT`. On override, visibility may **widen** (`_myVar` → `myVar`); narrowing → `BML_VISIBILITY_NARROWING`. Private members cannot be overridden.

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
```

### Member Inheritance and Overrides

Members are inherited via `baseType`. Derived Blocks inherit all Members of their base type and may add their own. **Partial overrides** are permitted — a child Block may redeclare an inherited member with only the attributes that change; unspecified attributes are inherited from the parent definition. **Unchanged `type` should be omitted** on the override (inherited); restate `type` only when refining it.

```text
Same member kind required
Only specified attributes replaced
Omit unchanged type on override (should omit; identical restatement discouraged)
Override key: resolved (namespace, normalizedLogicalName) — visibility prefixes stripped; not XML xmlns prefix
Private members cannot be overridden
Visibility may widen on override (protected → public); narrowing → BML_VISIBILITY_NARROWING
final="true" on parent prevents override → BML_FINAL_MEMBER_OVERRIDE
readOnly="true" prevents instance authoring only — child Block definitions may override value/composition
```

Effective members are resolved by merging along the `baseType` chain, then contract fragments, then local declarations — see `resolveEffectiveMembers()` in `12_bom_object_model.md` and Contracts below.

### Contracts (Reusable Partial Definitions)

A Block is a **semantic definition**, not a runtime class. Its internal structure (Properties, Aggregations, Associations) is not the public surface — only Capabilities are visible outward; the renderer decides concrete manifestation (Java getter, REST endpoint, SCAD parameter, UI binding, …).

A **contract** is a **reusable partial definition** of a Block — not a pure interface, but a fragment that can be composed into concrete Blocks. Contracts replace the separate concepts of interfaces, traits, and mixins in classical OOP.

BlockML uses **two complementary mechanisms** (Option 2 — see `17_type_system_bml.md` — baseType vs contracts):

```text
baseType chain   — framework taxonomy, structural inheritance, branch detection (inBranch)
contracts[]      — domain cross-cutting definitions, member mixin, type-bound identification (satisfiesTypeBound)
```

Framework core branch types (`org.blockml.bml.core.ValueType`, `Entity`, `Language`, …) are **`baseType` markers only** — not duplicated as interface contracts in `@blockml/core`. Domain libraries introduce contract Blocks (e.g. `com.foo.IIdentifiable`) where cross-cutting behaviour or polymorphic type bounds are needed.

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
Child element:     TypeReferenceEntity instance — empty QName sugar or explicit value
                   (see 17_type_system_bml.md — TypeReference and TypeReferenceEntity)
Contract target:   any Block definition usable as a partial definition (typically abstract)
Member scope:      Properties, Aggregations, Associations, Capabilities, Constraints,
                   Suggestions, documentation, examples, references, optional Capability defaults
Ignored on target: subBlocks[], embeddedBlocks[], compositions[] on the contract Block
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
Local redeclarations merging with a baseType or contract member must declare
  override="true" (including contract completion) → BML_OVERRIDE_REQUIRED
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
  <id override="true">
    <documentation>Unique identifier</documentation>
    <constraints>…</constraints>
  </id>
</properties>
```

Effective member `id`: `type` from the contract; `documentation` and `constraints` from the Block.

### Contracts as type-bound identifiers

A Block **implements** each FQN in its `<contracts>` list for **type-bound** validation — in addition to member merge. The validator resolves bounds via **`satisfiesTypeBound(T, G)`**:

```text
satisfiesTypeBound(T, G)  ⇔  G on T's baseType chain  OR  G ∈ T.contracts[]  (direct only in V1)
```

**`satisfiesTypeBound`** applies to generic parameter constraints, `TypeReference(B)` bounds, and other type-bound reference sites. **`inBranch`** (framework branch rules — Property types, Definition branch, branch table in `17_type_system_bml.md`) walks the **`baseType` chain only** — contracts do not substitute for core branch markers.

```text
org.blockml.bml.type.Integer  →  inBranch(Integer, core:ValueType)           via baseType chain
com.foo.Money                 →  satisfiesTypeBound(Money, com.foo:IValueType)  via contracts[]
```

Mismatch → `BML_GENERIC_CONSTRAINT_VIOLATION` or `BML_TYPE_BOUND_NOT_SATISFIED`. See `17_type_system_bml.md` — Contracts as type-bound identifiers · `12_bom_object_model.md`.

Contract members are **merged into** the effective member set by `resolveEffectiveMembers()` — they are not validated as a separate superset check. Merge resolution runs at Stage 2 (semantic validation), after the contract Block definitions themselves are resolved.

---

## Properties

Properties are typed parameters of a Block. Every Property has a name, a type, and a defined value.

### Composition Meta (`bml:id`, `bml:version`)

`org.blockml.bml.core.Block` declares **no members**. The property namespace on every sub-type is **completely free** — domains may declare Properties named `id`, `version`, or anything else.

Composition **instance identity** and **external reference version** are not member attributes. They use the `bml:` namespace on Block instance elements:

```text
bml:id       — instance identity within a composition tree; may be empty
bml:version  — semantic version pin when typeFqn refers to an external block (another file)
```

```text
Authored as:     bml:id="…" and bml:version="…" on composition instances
Not on Block:    org.blockml.bml.core.Block declares no members — no reserved property names
Bare id=/version= on instances → memberValues if the referenced Block type declares such Properties
Special semantics: identity paths (parent::child), reference validation,
                   auto-ID rules, render identity (mb_block_id)
```

Do not confuse `bml:id` (composition meta) with a domain Property named `id`. The compiler, validator, and renderer give `bml:id` dedicated handling. See Instance Identity and `12_bom_object_model.md` — Instance ID Rules.

### Property metadata

```text
name          — camelCase property name (unique within namespace — see Member Namespace)
type          — FQN of a ValueType (baseType chain includes org.blockml.bml.core.ValueType)
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

**Declaration order:** `<property>` elements within `<properties>` are stored in BML document order. The parser must not reorder them. Order defines array literal authoring, FunctionMapping positional parameters, default SCAD/render-target array serialization, and compatibility — see `17_type_system_bml.md` — Declaration Order · `22_function_mapping.md`.

**EnumType property values:** when the property `type` is an EnumType, enum member references may omit the `{EnumTypeFQN}::` prefix — `Standard` is equivalent to `com.machineblocks.bml.type.BaseCutout::Standard` on a `BaseCutout` property. BOM stores **id + typeFqn** only. See `17_type_system_bml.md` — EnumType.

**Property value semantics:** property values are **never linked** to other instances — always deep copies (StructType / primitives) or identity tokens (EnumType: id + typeFqn). Enum `FQN::id` tokens are resolution keys against the enum `values` catalog, not live references. See `12_bom_object_model.md` — Property Value Semantics.

### Property and Capability Value Types

Property `type` attributes must resolve to a **ValueType** — a Block whose `baseType` chain includes `org.blockml.bml.core.ValueType` (primitives, structs, enums, generics). Non-ValueType Blocks (Wall, Entity, NativeBlock, …) are not valid property types. The same rule applies to Capability `inputType` and `outputType`.

```text
type="Integer"              →  org.blockml.bml.type.Integer        ✓  (Number → PrimitiveType → ValueType)
type="Decimal"              →  org.blockml.bml.type.Decimal        ✓
type="type:SizeXYZ"            →  com.machineblocks.bml.type.SizeXYZ ✓  (StructType → ValueType)
type="com.foo.Wall"           →  ✗  BML_INVALID_PROPERTY_TYPE (not a ValueType)
```

Generic type arguments must satisfy each parameter's `baseType` constraint — see `17_type_system_bml.md` — Generics.

### Aggregations and Associations

Aggregation and association `type` attributes may reference **any Block FQN** — including composable Blocks, ValueTypes, and meta Blocks:

```text
type="com.machineblocks.bml.core.Block[]"     ✓
type="com.machineblocks.bml.type.SizeXYZ[]"    ✓
type="org.blockml.bml.type.Integer[]"         ✓
```

ValueTypes appear as type references on Properties — values are stored on the Property, not on the ValueType. When a primitive must appear as a Block instance in composition, use a concrete `*Entity` type (for example `org.blockml.bml.type.TextEntity`). See `17_type_system_bml.md` — § PrimitiveType · PrimitiveEntity.

### Constraints

Blocks and members may declare constraints via a shared `<constraints>` container. Each constraint is a Block instance whose `baseType` chain includes `org.blockml.bml.core.Constraint`. The **embedding context** (Block, Property, Aggregation, Association, or Capability) determines the constraint target and automatic generic binding. **Rule enforcement** depends on the optional `validation` property — when omitted, the BlockML validator does not enforce the rule; the instance remains metadata.

```xml
<block>
  <constraints>
    <constraint:RequiresMember name="width" validation="Error"/>
  </constraints>
  <properties>
    <width type="Float">
      <value>50</value>
      <constraints>
        <constraint:Min value="0" validation="Error"/>
        <constraint:Max value="100" validation="Error"/>
      </constraints>
    </width>
  </properties>
</block>
```

Wrong constraint branch for context → `BML_CONSTRAINT_TARGET_MISMATCH`. Intrinsic language rules (invalid types, visibility, …) are **not** modeled as constraints. See `18_constraints_and_suggestions.md`.

### Suggestions

A Property may declare a list of suggested values. Each suggestion is a Block instance compatible with the property type — no special base type. The property value remains a literal on the Property; suggestion children are composition-style instances:

- **PrimitiveType** property (e.g. `Text`, `Integer`, `Color`) → matching `*Entity` wrapper (`TextEntity`, `IntegerEntity`, `ColorEntity`) — not `<Text …/>`
- **StructType** property (e.g. `SizeXYZ`) → instance of that StructType
- **EnumType** property → `<suggestions>` forbidden (`BML_SUGGESTIONS_ON_ENUM`)

Suggestions are purely metadata — they do not affect type validation or compilation. Editors display the property as a combobox; the SCAD BlockProcessor generates an OpenSCAD Customizer dropdown comment.

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
<size type="SizeXYZ">
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
default       — boolean; marks the primary aggregation (tooling / render targets)
documentation — human-readable description
since         — optional; semantic version from which this member is available
changelog     — optional; version history (oldest first)
examples      — optional; usage examples (title + CDATA body)
references    — optional; cross-references to related Blocks or Definitions (type + optional context)
composition   — optional nested Composition filling this aggregation
readOnly      — when true, instance authoring forbidden; definition and child override allowed
final         — prevents override in child Blocks
namespace     — resolved canonical namespace identifier (empty = default namespace)
visibility    — optional; must match naming convention; on aggregations controls composition instance ID reachability (public → cross-document {FQN}::{id}; protected → declaring Block and child Blocks; private → declaring Block only)
```

`<aggregation>` and `<association>` child order within their containers is preserved by the parser (same rules as properties). Render targets may use aggregation order for UI or output sequencing.

**Member visibility** follows § Member Visibility. Private aggregations (`__name`) are confined to the declaring Block. Protected aggregations (`_name`) follow the formal access rule — derived Blocks and the direct composition owner may access them. Cross-document `{BlockFQN}::{id}` references require a **public** target aggregation.

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
<association name="next" type="InstanceReference(bml:Self)"/>
```

On `com.foo.Node` → `next : InstanceReference(com.foo.Node)`. On `com.bar.SpecialNode extends com.foo.Node` → `next : InstanceReference(com.bar.SpecialNode)`.

Collection forms: `InstanceReference(bml:Self)[]`, etc. Associations require the `InstanceReference` wrapper — bare `bml:Self` / `bml:Self[]` are invalid on association `type`. `bml:Self` remains valid on Aggregations and elsewhere a type reference is allowed:

```xml
<property type="bml:Self"/>
<aggregation type="bml:Self"/>
<inputType>bml:Self</inputType>
```

`bml:Self` is **not** used for definition navigation. Member definition references use canonical structural paths (see below).

#### Canonical definition paths

A `BlockDefinition` is a regular Block. Every definition element is addressable via its **canonical path** within the Block FQN — matching the BML document structure exactly:

```text
com.foo.Bar.name                    →  <name>Wall</name>
com.foo.Bar.is                    →  <is>…</is>
com.foo.Bar.summary                 →  primary <summary>…</summary> (default NS + effective language)
com.foo.Bar.summaries               →  all <summary> / facet summary entries
com.foo.Bar.keywords                →  <keywords>…</keywords> (Keyword Entity children or shorthand)
com.foo.Bar.documentation           →  primary <documentation>…</documentation>
com.foo.Bar.documentations          →  all <documentation> / facet documentation entries (i18n + QName)
com.foo.Bar.isnot                     →  <isnot>…</isnot>
com.foo.Bar.aliases                 →  <aliases>…</aliases> (Alias Entity children or shorthand)
com.foo.Bar.type                    →  <type>com.foo.Bar</type>
com.foo.Bar.baseType                →  <baseType>…</baseType>
com.foo.Bar.version                 →  <version>1.0.0</version>
com.foo.Bar.definition              →  Definition meta-model type FQN (default RootBlockDefinition)
com.foo.Bar.subBlocks.Inner.definition → Definition meta-model type FQN (default SubBlockDefinition)
com.foo.Bar.properties.width        →  PropertyDefinition for width
com.foo.Bar.aggregations.children   →  AggregationDefinition for children
com.foo.Bar.associations.parent     →  AssociationDefinition for parent
com.foo.Bar.capabilities.render     →  CapabilityDefinition for render
com.foo.Bar.genericTypes.T          →  GenericTypeDefinition for T
com.foo.Bar.subBlocks.Inner         →  nested BlockDefinition (FQN = com.foo.Bar.Inner)
com.foo.Bar.subBlocks.Outer.subBlocks.Inner → nested Sub-Block at arbitrary depth
com.foo.internal.Physics            →  embedded BlockDefinition (FQN = embedded block &lt;type&gt;)
com.foo.internal.Physics.subBlocks.Force → Sub-Block on embedded block
com.foo.Bar.contracts               →  contracts aggregation
```

The path encodes both location and definition kind — no special definition-reference constructs (such as `bml:Def`) are required. Further navigation on member definitions follows the same rule: `com.foo.Bar.properties.width.type`, `com.foo.Bar.properties.width.documentation`.

Within the Block being defined, the Block's own FQN serves as the definition root:

```text
com.foo.Bar.properties.width        ≡  (current definition).properties.width
```

`org.blockml.bml.definition.BlockDefinition` carries generic meta-type parameter `B extends org.blockml.bml.core.Block` — conceptually `BlockDefinition<com.foo.Bar>` when describing `com.foo.Bar`. It declares the shared block definition shape (identity, abstract `definition`, `subBlocks`, member containers, `language`). `SubBlockDefinition`, `RootBlockDefinition`, and `EmbeddedBlockDefinition` are sibling specializations that each override `definition` with a role-specific default. Document roots use `RootBlockDefinition` (adds `embeddedBlocks`). Virtual files in that aggregation use `EmbeddedBlockDefinition` (no nested embeds). Nested types use `SubBlockDefinition`.

#### BOM internal representation

BML member containers (`<properties>`, `<aggregations>`, `<associations>`, `<capabilities>`) map to a flat `members: MemberDefinition[]` in the BOM (tagged by `kind`). The canonical path resolver walks the structural containers at reflection time — `com.foo.Bar.properties.width` resolves to the `PropertyDefinition` with `name: "width"` in that Block's effective definition.

| Expression | Meaning |
|---|---|
| `width` | shorthand for `#this.width` (instance value) |
| `#this.width` | value of the Property on the current Block instance |
| `bml:Self` | current effective Block type (type reference only) |
| `com.foo.Bar` | BlockDefinition for com.foo.Bar |
| `com.foo.Bar.definition` | Definition meta-model type FQN (default RootBlockDefinition) |
| `com.foo.Bar.subBlocks.Inner.definition` | Definition meta-model type FQN (default SubBlockDefinition) |
| `com.other.ForeignBlock` | embedded BlockDefinition (FQN = &lt;type&gt; of embedded block) |
| `com.other.ForeignBlock.properties.width` | PropertyDefinition on embedded block |
| `com.foo.Bar.name` | `<name>` metadata of the Block definition |
| `com.foo.Bar.properties.width` | PropertyDefinition for `width` |
| `com.foo.Bar.properties.width.type` | type FQN of the width property |

### Implicit Default Aggregation

When no Aggregations are declared, a domain-specific default Aggregation is created implicitly. BOM Core does not prescribe the name or child type — that is the domain's responsibility.

### Service Aggregations

A service Block provides named, reusable logic — such as data models, math utilities, or formatters. Services are bound into a Block via Aggregations with a bean name. Once bound, they are accessible in Expressions via their bean name using the `@` prefix.

### Service Class Hierarchy

```text
org.blockml.bml.core.Block
  org.blockml.bml.core.Entity              — base for built-in services and utility Sub-Blocks
    org.blockml.bml.service.*              — built-in expression utilities (#math, #strings, …)
    org.blockml.bml.service.ModelBlock     — holds data (JSONModel, ODataModel, XMLModel)
```

**`org.blockml.bml.core.Entity`** — abstract base for addressable logic units. Built-in services in `org.blockml.bml.service.*` extend Entity directly.

**`org.blockml.bml.service.ModelBlock`** — provides data access via path-based Transformation Capabilities. Specializations: `org.blockml.bml.service.JSONModel`, `org.blockml.bml.service.ODataModel`, `org.blockml.bml.service.XMLModel`.

Every Capability inherits an optional `<implementation>` from `org.blockml.bml.core.CapabilityType`. The element **`language`** attribute must reference a Language FQN — e.g. `<implementation language="org.blockml.bml.language.TypeScript">`. The BlockProcessor transpiles to the target language or executes at compile time when all arguments are literals. This is the pragmatic escape hatch for logic that no built-in covers yet — and a natural transition path: once a built-in is available, the `<implementation>` is removed and the call site is updated to a `#built-in` call while the Capability signature remains unchanged.

Built-in services are defined in `org.blockml.bml.service.*` and accessible via the `#` prefix. They are shared across all Blocks in the same domain and cannot be overridden.

```text
#math    — built-in math service (min, max, ceil, floor, ...)
#strings  — built-in string utilities (format, trim, ...)
```

User-defined services are registered as Block instances in a Composition and given a bean name via `bml:bean`:

```text
@myModel   — user-defined JSONModel instance with bml:bean="myModel"
@myService — user-defined service Block instance with bml:bean="myService"
```

The distinction between `#` (built-in) and `@` (user-defined) is enforced at parse time. `#`-prefixed names are reserved and cannot be used as bean names.

### Bean Scope

Every service instance declares a `bml:scope` that controls visibility to child Blocks:

```text
bml:scope   — "local" | "context"    default: "local"
```

`local` — the bean is only accessible within the Block that declares it. Child Blocks in Compositions cannot see it.

`context` — the bean is passed down to all child Blocks in Compositions. A child Block can declare a bean with the same name to override it for its own children.

**Scope resolution in Expressions:**

When an Expression references `@myBean`, the resolver walks up the Composition hierarchy:

```text
1. Current Block — has a bean named "myBean" with `bml:scope="context"`? → use it
2. Not found → go one level up
3. Repeat until root
4. Not found → parse-time error: bean "myBean" not in scope
```

A bean with `bml:scope="local"` is invisible to children — it is skipped during the upward walk.

**Override example:**

```text
App       @data (bml:scope="context")  ← ODataModel (visible to all descendants)
  View    @data (bml:scope="context")  ← JSONModel  (overrides App @data for this View and its children)
    Table                        ← sees JSONModel via @data
  Sidebar                        ← sees ODataModel via @data (no override here)
```

This is analogous to Spring Bean scoping (`@ApplicationScope`, `@RequestScope`) — but scope is declared on the instance (`bml:scope`), not on the service type itself. The same service type can have different scopes in different contexts.

---

## Associations

Associations connect **instances to instances** — loose, non-owning model links between concrete Block instances. They are not documentation links: documentation **References** (`<see>` on `<references>`) connect **types to types** or **types to instances** (and optionally definition members, files, or URLs). See `02_mbml.md` — Associations vs References.

Associations carry no composition ownership. They are defined for use across all BOM specializations.

```text
name          — member name (unique within the Block's member namespace)
type          — InstanceReference(T) or InstanceReference(T)[] (T extends core:Block)
documentation — human-readable description
since         — optional; semantic version from which this member is available
changelog     — optional; version history (oldest first)
examples      — optional; usage examples (title + CDATA body)
references    — optional; documentation cross-references (type↔type / type↔instance via `<see>`)
```

Associations carry no ownership and do not affect rendering. Association `type` must be
`InstanceReference(T)` or `InstanceReference(T)[]` — bare Block FQNs are invalid.

---

## Capabilities

Capabilities describe how a Block communicates — with the outside world or internally within a Composition. A Capability is a named member of a Block, sharing the member namespace with Properties, Aggregations, and Associations.

Like Properties, Capabilities are declared with a name and a type (FQN). Like Properties, their value in a Composition is set directly on the child Block instance as an attribute. For Capabilities, this value is the address or binding — not a data value.

### Capability Types

Capabilities use FQN type values. The type determines the communication pattern.

**Package (decided):** `org.blockml.bml.capability.*`, base type `org.blockml.bml.core.Capability`. Sources: `packages/core/blocks/org/blockml/bml/capability/{Inbound,Outbound,Transformation}.bml` and `…/core/Capability.bml`.

```text
org.blockml.bml.capability.Inbound         — receives data/messages asynchronously
org.blockml.bml.capability.Outbound        — sends/emits data/messages asynchronously
org.blockml.bml.capability.Transformation  — synchronously callable; transforms inputType to outputType
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
org.blockml.bml.type.Integer          — primitive (NamedTypeReference)
org.blockml.bml.type.Text           — primitive
{ a: Float, b: Float }            — anonymous struct (AnonymousStructType)
com.myDomain.MyClass              — named type (NamedTypeReference)
{ items: org.blockml.bml.type.Integer[0..n] }  — collection field (multiplicity on reference)
```

See `12_bom_object_model.md` — Type Descriptors for the formal BOM representation.

Unqualified type names are resolved against the domain's default type namespace (determined by the Block's `baseType`).

### Object Input as Function Signature

When a Capability uses a structured Object as `inputType`, the Object defines an **anonymous struct type**. FunctionMapping translates call syntax to this struct — see `22_function_mapping.md`.

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

A mismatch between declared `inputType` and call syntax is a **validation** error (Stage 2 FunctionMapping) — not a Stage-1 parse failure. See `22_function_mapping.md`.

### Capability Value in Compositions

Capabilities do not have an `address` attribute in their definition. The address or binding is set as the Capability's value on a child Block instance in a Composition — exactly like a Property value.

Four value patterns are recognized:

```text
Absolute URI      — outbound routing to a fixed address (stud:// over sockets/HTTP)
  stud://domain/path

Relative path     — context-resolved address; **deferred** until the stud:// protocol design is complete
  /path/to/resource
  Candidate rule: resolve against nearest App/Area Block, then expand to stud://…
  Phase A/B: store authored path losslessly; do not resolve. See Address Schemes.

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

**Capability linking in Presets:** **Not in V1.** MachineBlocks presets are property-only (renderer-oriented). Linking remains a Composition concern — see § Preset (MachineBlocks).

### Transformation Capability Implementations

A `Transformation` Capability may carry an `<implementation>` element that provides a target-language function body. The `language` attribute must reference a registered Language FQN (`org.blockml.bml.language.*`). Whether that language can be executed or rendered is decided by the active Target/renderer — not by a per-Block whitelist.

```text
Implementation language types (org.blockml.bml.language.*):
  org.blockml.bml.language.TypeScript   — TypeScript arrow function (compile-time / transpile)
  org.blockml.bml.language.OpenSCAD     — OpenSCAD function(s) in CDATA

Unknown Language FQN → BML_IMPLEMENTATION_UNKNOWN_LANGUAGE
Target/renderer cannot use the implementation → Target-specific diagnostic
  (e.g. BML_FUNCTION_NO_RUNTIME_IMPL, BML_NO_TARGET)
```

A Transformation Capability implementation can live directly on any Block — not only on `utility Sub-Block` Sub-Blocks. The Sub-Block approach is a convention for grouping related utilities, not a requirement:

```xml
<!-- Direct on Block -->
<capabilities>
  <formatValue type="org.blockml.bml.capability.Transformation" ...>
    <implementation language="org.blockml.bml.language.OpenSCAD"><![CDATA[
function formatValue(x) =
    <$ #strings.concat(
        #this.prefix(),
        #math.round_n(x, 1)
    ) $>;
    ]]></implementation>
  </formatValue>
</capabilities>
```

**Embedded Expressions:** Capability references inside `<implementation>` use **BML Embedded Expression** syntax (`<$ … $>`) — not raw target-language calls to generated names. The implementation body remains target-language source; embedded regions are BlockML Expression Language. The renderer substitutes each region with target-language syntax. See `10_expression_language.md` — BML Embedded Expressions.

### Address Schemes

BOM Core uses `protocol://` as a generic placeholder. Domain specializations define concrete schemes:

```text
stud://    — Capability addressing (WOT / MachineBlocks); reachable over sockets and HTTP
             (protocol design in progress — relative path expansion deferred)
http://    — REST / WebHook
mqtt://    — MQTT broker topic
wot://     — Web of Things device hub
```

**`stud://`** is the primary scheme for Capability endpoints in the WOT stack: it makes Inbound / Outbound / Transformation Capabilities addressable as networked resources (socket and HTTP transports).

> **Design phase:** The `stud://` protocol (routing, authority, path semantics, App/Area context) is **not finalized**. Absolute `stud://…` bindings may be authored and stored; **relative Capability paths** (`/path/…` → expand to `stud://…`) are specified only as a **candidate pattern** and must not be resolved by parser, validator, or renderers until the protocol design lands. See Capability Value in Compositions.

### Message Model

BOM Core defines a minimal abstract message model for Inbound and Outbound Capabilities:

```text
Message
  address   — URI identifying the target capability (typically stud://…)
  headers   — key-value metadata
    replyTo — optional; address to send an asynchronous response to
  payload   — structure declared by the Capability's inputType (Inbound) or outputType (Outbound)
```

All async messaging is asynchronous. A Capability may reply using the `replyTo` header. BOM Core does not prescribe when or whether a response is sent.

**BML as message format:** In the WOT context, BlockML is **not authoring-only**. The same typed BML grammar carries **data and semantics** on the wire — Capability payloads and structured interchange use BML so humans, LLMs, compilers, and Things share one format. Authoring files (`.bml`) and runtime messages are two roles of that universal format, not separate languages. See `01_system.md` · `02_mbml.md` · `17_type_system_bml.md` — WOT alignment.

---

## Compositions

A Composition fills an Aggregation with concrete child Block instances. **Composition is part of Aggregation** — the preferred authoring form nests `<composition>` directly inside `<aggregation>`. The `composition aggregation="…"` attribute is removed.

Compositions may appear on Block definitions (filling declared or inherited aggregations) and on Block instances (opening aggregations inline). Every Block instance may optionally contain its own nested composition — the language is fully recursive.

```text
aggregation   — opened by aggregation member element name on definitions and instances
visibility    — on the aggregation member; controls composition instance ID reachability (see Member Visibility)
children      — ordered list of child Block instances (each may contain nested compositions)
```

**Placement rules:**

```text
<composition> must always be nested inside an aggregation member element — never standalone.
New aggregation declaration     → type required on the aggregation element
Inherited aggregation override  → override="true" required; type may be omitted; aggregation element + <composition> only
Standalone <composition>        → BML_STANDALONE_COMPOSITION (validation error)
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
true / True / TRUE    — Boolean literal (case-insensitive; preferred lowercase; BOM stores canonical)
false / False / FALSE — Boolean literal (case-insensitive; preferred lowercase; BOM stores canonical)
[1, 8, 9]             — Array literal (pure literals only outside ${ })
{x: 1, y: 0}         — Object literal (pure literals only outside ${ })
${ size[0] + 1 }      — Expression
```

**Capability values** are addresses or bindings (see Capabilities → Capability Value in Compositions):

```text
stud://domain/path            — Absolute URI
/path/to/resource             — Relative path (deferred — stud:// protocol still in design)
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
org.blockml.bml.core.Status          — abstract base (in @blockml/core)
org.blockml.bml.status.Stable        — complete, tested, reliable
org.blockml.bml.status.Draft         — defined; implementation or mapping incomplete
org.blockml.bml.status.Stub          — placeholder; behaviour not yet specified
org.blockml.bml.status.Deprecated    — retained for compatibility; do not use in new work
```

Domain libraries may define additional status blocks (e.g. domain-specific WIP markers).

### Inheritance and defaults

Status is **inherited downward**. The document root defaults to `status:Stable`. Child elements inherit the effective status of their parent unless they declare a deviation.

```text
Omitted status on block/property/member   →  inherit from parent (root → Stable)
<status>Draft</status> on property →  Draft for property and its subtree
bml:status on non-definition element      →  only when deviating from inherited status
```

### Authoring syntax

**Definition elements** — `<status>` child **only when deviating** from inherited status:

```text
<block>  <property>  <aggregation>  <association>  <capability>  <constraint>  <suggestion>
```

```xml
<property name="width" type="Float">
    <status>Draft</status>
    …
</property>
```

**Non-definition elements** — `bml:status` attribute **only when deviating**:

```xml
<is bml:status="Stub">…</is>
<bricks:StandardBrick bml:status="Deprecated" … />
```

### Context-bound implicit namespace

At specialized reference sites, unqualified names resolve to a fixed implicit namespace — see `02_mbml.md` — § Context-Bound Implicit Namespace:

```text
Property.type / Capability.inputType / outputType  →  org.blockml.bml.type.*
Implementation.language                           →  org.blockml.bml.language.*
<language> element child                          →  org.blockml.bml.language.* (NaturalLanguage)
documentation language attribute                  →  org.blockml.bml.language.* (NaturalLanguage)
change language attribute                         →  org.blockml.bml.language.* (NaturalLanguage)
see language attribute                            →  org.blockml.bml.language.* (NaturalLanguage)
example language attribute                        →  org.blockml.bml.language.* (Language)
<status> / bml:status                               →  org.blockml.bml.status.*
Capability.type                                     →  org.blockml.bml.capability.*
Constraint.validation                               →  org.blockml.bml.validation.*
```

```text
Draft        →  org.blockml.bml.status.Draft   (at <status> / bml:status site)
Integer      →  org.blockml.bml.type.Integer     (at Property.type site)
TypeScript   →  org.blockml.bml.language.TypeScript (at language= site)
English      →  org.blockml.bml.language.English   (at <language> / documentation / change / see language= site)
OpenSCAD     →  org.blockml.bml.language.OpenSCAD  (at example language= site)
Error        →  org.blockml.bml.validation.Error (at validation= site)
```

General block references (`baseType`, aggregation type, association type, composition tags) have **no implicit namespace** — use FQN or `xmlns:` prefix.

See `02_mbml.md` — § Status for full authoring rules and examples.

---

## BML Directives

BML Directives are special attributes and elements in the `bml:` namespace. They are not Block properties — they are instructions to the BML processor. Whether a directive is pre-processed at compile time or translated 1:1 into target-specific constructs is the BlockProcessor's decision.

The `bml:` prefix is the canonical namespace for language directives. Flow-control `bml:*` attributes follow the **Thymeleaf model** — they sit on the element they apply to, not in wrapper elements.

**Serialization directives:** `bml:xml` declares how Definition blocks and `org.blockml.bml.core.Block` map to canonical BML XML (root element name, member as attribute/element/text/cdata). This is separate from composition flow control — see `19_definition_blocks_and_bml_xml.md`.

### Directive Placement

| Attribute / namespace | Allowed on | Notes |
|---|---|---|
| `bml:with` | `<composition>`, `<bml:container>`, Block instances | Local variable scope |
| `bml:each` | `<bml:container>`, Block instances | Loop |
| `bml:id` | Block instances | Composition instance identity — literal or `${ expr }` |
| `bml:version` | Block instances | External block reference version (required when type is from another file) |
| `bml:status` | Non-definition elements | Maturity marker — only when deviating from inherited status |
| `bml:if`, `bml:unless` | `<bml:container>`, Block instances | Conditional |
| `<bml:xml>…</bml:xml>` | `org.blockml.bml.core.Block`, Definition blocks only | XML root element name for this type — see `19_definition_blocks_and_bml_xml.md` |
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

Sub-Blocks are Block definitions nested inside a parent Block definition. They are analogous to **Java static nested classes** — they belong to the parent conceptually, share its FQN prefix, may declare their own `<genericTypes>`, and do **not** see the enclosing Block's type parameters (forward explicitly). Sub-Blocks form a **semantic type hierarchy** within a single `BomDocument` and may nest to arbitrary depth via `<subBlocks>`. They do not open their own document or library scope. Unqualified nested type resolution walks the enclosing chain like Java — see `02_mbml.md` — § Unqualified nested type resolution.

Sub-Blocks are declared in a `<subBlocks>` section within the parent Block definition (root block, parent Sub-Block, or embedded block). Each Sub-Block is a full Block definition with its own properties, aggregations, capabilities, composition, and optional generics. Sub-Blocks must not declare `<embeddedBlocks>`. Their `baseType` follows the same rules as any other Block definition (must resolve, must not be `final`, branch rules).

Sub-Blocks follow the same visibility naming convention as members (`__` private, `_` protected, plain public). Optional root-level `<visibility>` on Sub-Blocks only — forbidden on root Blocks (`BML_VISIBILITY_ON_ROOT_BLOCK`). Visibility controls BlockML reference scope only — not target-system visibility. Mismatch → `BML_VISIBILITY_MISMATCH`; out-of-scope reference → `BML_PRIVATE_SUBBLOCK_ACCESS` or `BML_PROTECTED_SUBBLOCK_ACCESS`. See `02_mbml.md` — § Member Visibility · § Sub-Block Visibility.

### FQN Convention

```text
Parent:    com.machineblocks.bml.calibration.Calibrator
Sub-Block: com.machineblocks.bml.calibration.Calibrator.Base
           com.machineblocks.bml.calibration.Calibrator.StudDiameter
```

The Sub-Block `<type>` is normally omitted — it is derived recursively as `resolve(parent.type) + "." + name` from the immediate enclosing block (root block, parent Sub-Block, or embedded block). An explicit `<type>` must match that expected value (`BML_SUBBLOCK_TYPE_MISMATCH`). Sub-Blocks may declare nested `<subBlocks>` to arbitrary depth but must not declare `<embeddedBlocks>` (`BML_EMBEDDED_BLOCKS_ON_SUBBLOCK`).

```text
Parent:    com.machineblocks.bml.calibration.Calibrator
Sub-Block: com.machineblocks.bml.calibration.Calibrator.Base
           com.machineblocks.bml.calibration.Calibrator.StudDiameter
```

Root blocks require `<type>` (`BML_MISSING_BLOCK_TYPE`). `<name>` is optional on root blocks — when omitted, `effectiveName = lastSegment(resolve(type))`; when present, it must match that segment (`BML_BLOCK_NAME_TYPE_MISMATCH`). On Sub-Blocks, `<name>` is required (`BML_MISSING_SUBBLOCK_NAME`).

### Short-Name Reference

Within the parent Block's own Composition, Sub-Blocks may be referenced by unqualified local name — **same BML file, parent Block context only**:

```xml
<Base bml:id="base_stud" ... />
<StudDiameter bml:id="samples_stud" ... />
```

Outside that context, Sub-Blocks require the parent Block's namespace and a qualified name (`RootBlock.SubBlock`), full FQN, or prefixed qualified form (`cal:Calibrator.Base`). Bare Sub-Block short names outside parent context → `BML_UNQUALIFIED_BLOCK_REFERENCE`.

If a Sub-Block shares the root Block's `<name>`, bare short tags are ambiguous → `BML_SUBBLOCK_QUALIFIED_REFERENCE_REQUIRED`; use `Calibrator.Calibrator`, `cal:Calibrator.Calibrator`, or the full FQN.

### Embedded Blocks (Inline Library)

**Gedankenstütze:** `embeddedBlocks` is an **Inline Library** of **virtual `.bml` files** on the **document root only** — primary use: fat single-file artifacts. Meta-model entry type: `org.blockml.bml.definition.EmbeddedBlockDefinition`. Multiple BML documents in one source file, including packages outside the root block's namespace.

**FatBlock Render Target (planned):** produces such an artifact automatically — root block plus transitive dependencies inlined as root `<embeddedBlocks>`. See `01_system.md` — Planned toolchain Render Targets · `15_dev_setup.md` Phase C.

Each embedded block is a **full Block document** — own FQN, members, `subBlocks`. Its **FQN is the value of its `<type>` element** (e.g. `com.foo.internal.Physics`) — not nested under the enclosing block. Sub-Blocks on an embedded block derive their FQNs from the embedded block's type. Nested `embeddedBlocks` are **forbidden** (`BML_NESTED_EMBEDDED_BLOCKS`); compose by listing virtual files flat under the root.

```text
type required     — BML_MISSING_EMBEDDED_BLOCK_TYPE
type must be FQN  — BML_UNQUALIFIED_EMBEDDED_BLOCK_TYPE (no derivation, no unqualified names)
FQN               — resolve(type), e.g. com.foo.internal.Physics
definition        — default EmbeddedBlockDefinition
subBlocks         — allowed (Sub-Block FQNs derive from embedded block type)
embeddedBlocks    — forbidden (BML_NESTED_EMBEDDED_BLOCKS)
```

Within the enclosing document, each embedded FQN **shadows** the corresponding library or file-based `BlockDefinition`. Duplicate embed FQNs → `BML_DUPLICATE_EMBEDDED_BLOCK`. Externally, embedded blocks and their Sub-Blocks are **invisible**. Composition references from within the same document must use the **fully qualified** Block type — never an unqualified or Sub-Block-relative name.

```xml
<embeddedBlocks>
  <block>
    <is>Virtual file — would normally live in its own .bml</is>
    <type>com.foo.internal.Physics</type>
    <baseType>org.blockml.bml.core.Block</baseType>
    <version>1.0.0</version>
    <subBlocks>
      <block>
        <name>Force</name>
        <baseType>org.blockml.bml.core.Block</baseType>
        <version>1.0.0</version>
      </block>
    </subBlocks>
  </block>
  <block>
    <type>com.foo.internal.Math</type>
    <baseType>org.blockml.bml.core.Block</baseType>
    <version>1.0.0</version>
  </block>
</embeddedBlocks>
```

### SCAD Mapping

```text
com.machineblocks.bml.calibration.Calibrator.Base
→  mb__com__machineblocks__calibration__Calibrator__Base
```

### Visibility

Sub-Blocks are full BOM objects referenceable via full FQN from outside the parent Block. External use is possible but uncommon.

---

## Preset (MachineBlocks)

Presets are **not** a BlockML core feature. In MachineBlocks, a preset is a named property configuration represented as a Block instance in the `_presets` aggregation. Any MachineBlocks Block instance can reference presets via the `basePresets` association.

Presets apply only to Properties — not to Aggregations, Associations, or Capabilities. Preset merge is compiler logic; Customizer JSON is render-target logic.

**V1 / MachineBlocks:** The current MB preset system (`_presets` / `basePresets`) is a **renderer-oriented** property-configuration mechanism. It uses **Properties only** — no Capability bindings or Capability linking. Capability linking in presets is **out of scope for V1**; revisit only if a future preset model becomes capability-aware (WOT / messaging). Until then, Capability linking is valid in **Compositions** only (see Capability Linking).

### Preset Block

A preset block (e.g. `com.machineblocks.bml.bricks.StandardPresets`) is a Block definition with `baseType="com.machineblocks.bml.core.Block"`:

```text
type — FQN of this preset block (e.g. com.machineblocks.bml.bricks.StandardPresets)
version           — semantic version
composition       — Block instances in a public aggregation (e.g. presets); cross-file {FQN}::{id} requires public visibility
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
  com.machineblocks.bml.bricks.StandardPresets::brick-2x4
```

Qualified cross-document references require a **public** target aggregation and a **literal static `bml:id`** on the target instance — see Instance Identity → Qualified Block Instance References.

### Preset in Compositions

```xml
<bricks:Standard
    basePresets="com.machineblocks.bml.bricks.StandardPresets::brick-2x4" />

<bricks:Standard
    basePresets="com.machineblocks.bml.bricks.StandardPresets::brick-2x4"
    baseColor="#303D4E" />
```

### Merge Order

```text
configProfile < basePresets chain < inline property
```

---

## Library

A Library is a **Block** with `baseType="org.blockml.bml.core.BlockLibrary"`. It groups exported Block and ValueType definitions, optional XSD schemas, and dependencies on other libraries into one publishable unit. Replaces the legacy `library.xml` descriptor.

`org.blockml.bml.core.BlockLibrary` is a **framework base type** in core — like `Block` or `ValueType`. It is **not** exported via any Library `blocks` catalog. Concrete `Library.bml` files inherit from it.

```text
org.blockml.bml.core.BlockLibrary           abstract composable Block
  property     description   String          (public, readOnly)
  aggregation  language      NaturalLanguage (public, readOnly)
  aggregation  readMe     ReadMe[1..1]     (public, readOnly — human/LLM reading entry)
  aggregation  bootstrap     Bootstrap        (public, readOnly — optional automation SPOE, 0..1)
  aggregation  dependencies  BlockLibrary[]   (public, readOnly)
  aggregation  subLibraries  BlockLibrary[]   (public, readOnly)
  aggregation  schemas       FilePathEntity[] (public, readOnly — optional legacy XSD)
  aggregation  blocks        Block[]          (public, readOnly)

org.blockml.bml.type.FilePathEntity            value (relative .xsd path)
org.blockml.bml.core.ReadMe                    abstract role marker — human/LLM reading entry
org.blockml.bml.README                         extends ReadMe — ReadFirst + TaskIndex on references
org.blockml.bml.core.Bootstrap                 abstract role marker — automation SPOE (empty)
org.blockml.bml.core.TaskGuide                 abstract — org.blockml.bml.task.* procedural blocks
org.blockml.bml.core.Diagnostic                abstract — org.blockml.bml.diagnostic.* error codes
```

`description`, `language`, `readMe`, `bootstrap`, `dependencies`, `subLibraries`, `schemas`, and `blocks` are **public** and **`readOnly`**: foreign Blocks and tools may inspect a library catalog in expressions; only the Library definition (and child overrides) may author these members — instances must not rewrite them (`BML_READONLY_MEMBER_WRITE`).

`readMe`, `bootstrap`, `dependencies`, `subLibraries`, and `blocks` are **TypeReferenceEntity** aggregations — each empty QName child expands to a TypeReferenceEntity instance. Optional **`bml:version`** on sugar (or explicit Entity) children is an exact-version assert against the referenced type (`value`) — omitted → TypeRegistry / library context; no match → `BML_UNKNOWN_VERSION`. See `17_type_system_bml.md` — TypeReference and TypeReferenceEntity.

`readMe` references a `ReadMe` block (typically `README`) — required human/LLM reading entry. Curated reading order uses `<references>` with `relation=ReadFirst`; available tasks use `relation=TaskIndex`. `bootstrap` is the optional automation SPOE — see `doc:BootstrapModel` and `doc:TaskGuideModel`.

**Concrete Library `<references>`:** at most two `<see>` entries — required `ReadFirst` → the `readMe` target; optional `ThenContinueWith` → the `bootstrap` target when present (after reading, execute the automation SPOE). No other relations on the catalog descriptor.
`schemas` holds `FilePathEntity` composition children; **`value`** is the relative `.xsd` path from the library package root (directory containing `Library.bml`).

The Library block is always named `Library.bml`. Its FQN is `{package}.Library` where `{package}` is derived from the file's package path (e.g. `com.machineblocks.bml.bricks.Library`, `org.blockml.bml.Library`, `org.blockml.bml.compiler.Library`).

**Name (required):** `<name>Library</name>`. Filename is always `Library.bml`.

**Membership is defined only by `Library.bml` — not by directories.** A Block belongs to exactly the Library whose `blocks` lists it. Physical file location and package-prefix overlap do not imply inclusion. Two libraries may share a package prefix (e.g. `org.blockml` and `org.blockml.bml.compiler`) without one automatically exporting the other's blocks.

### Nested libraries

Libraries may be **nested by package**. Example: `org.blockml/Library.bml` and `org.blockml.bml.compiler/Library.bml` are **separate** publishable units — the inner library does not merge into the outer one.

```text
org/blockml/bml/
  Library.bml                 → org.blockml.bml.Library
  core/Block.bml              → member iff listed in org.blockml.bml.Library blocks
  compiler/
    Library.bml               → org.blockml.bml.compiler.Library  (own library)
    Parser.bml                → member iff listed in org.blockml.bml.compiler.Library blocks only
```

**Typical pattern:** inner library depends on outer via `dependencies`; outer declares the inner library in `subLibraries` (not in `blocks`).

```xml
<!-- org/blockml/bml/Library.bml (outer) -->
<subLibraries>
  <composition>
    <compiler:Library />       <!-- nested child library -->
  </composition>
</subLibraries>

<!-- org/blockml/bml/compiler/Library.bml (inner) -->
<dependencies>
  <composition>
    <blockml:Library />        <!-- outer library as dependency -->
  </composition>
</dependencies>
<blocks>
  <composition>
    <compiler:Parser />        <!-- only compiler-owned blocks -->
  </composition>
</blocks>
```

**Nesting rule (required):** an outer library's `blocks` must **not** reference Blocks exported by an inner library (any `blocks` entry of a library whose package is a strict sub-package of the outer library's package). Inner-library blocks are consumed via the inner library dependency — not re-exported by the outer catalog.

Violation → `BML_LIBRARY_NESTING_VIOLATION`.

**Bootstrap:** the CLI/orchestrator discovers all `Library.bml` files, resolves `readMe`, `bootstrap`, `dependencies`, `subLibraries`, and `blocks` by FQN (effective version from library context), and registers referenced definitions in dependency order. Without a Library block, all BML files in a directory are treated as public (fallback).

**Types:** ValueType definitions (StructType, EnumType, …) are exported via `blocks` alongside composable Blocks. **`schemas`** holds optional legacy XSD paths as `FilePathEntity` instances — omit when types are BML-only.

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

The referenced bean must be registered on a Block instance via `bml:bean` in the current Block or an ancestor Composition. Only `Transformation` Capabilities are callable in Expressions. The output value is used as the expression result.

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

This form is only valid when the target member is a Capability — using it on a Property is a parse-time error. **Not permitted in MachineBlocks presets (V1):** presets configure Properties only; Capability linking is Composition-only — see § Preset (MachineBlocks).

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

`${ }` spans are stored in Canonical BOM as **`ExpressionValue { raw }` only** — never as AST. The **`parseExpression()` utility** (`@blockml/core`) builds a typed **`ExpressionNode`** tree as a separate result (`ParsedExpression`); it must **not** write `ast` / `resultTypeFqn` back into the Urmodell. Evaluation is renderer / pragmatic-model only. See `10_expression_language.md` — Expression AST.

**Implementation order:** Parser and serializer (Phase A) preserve `raw` for roundtrip. `parseExpression()` ships with the validator / framework utilities (Phase B), before renderers consume ASTs (Phase C). See `15_dev_setup.md` — V1 Implementation Strategy.

---

## Type System

BOM Core defines a minimal set of primitive types. Domain specializations extend this with domain-specific types. The type registry is dynamic — new types can be registered at runtime without modifying BOM Core.

### BOM Core Primitive Types

```text
org.blockml.bml.type.Boolean
org.blockml.bml.type.Text
org.blockml.bml.type.Number          — abstract numeric branch
  org.blockml.bml.type.Integer
  org.blockml.bml.type.Float
  org.blockml.bml.type.Decimal
```

Context-bound implicit namespace at specialized reference sites — see `02_mbml.md` — § Context-Bound Implicit Namespace. No global unqualified resolution.

### Type Expressions (not ValueTypes)

BlockML has four ValueType kinds: **Primitive**, **Enum**, **Struct**, **Constant**. Unions, collections, and generic applications are **type expressions** — see `17_type_system_bml.md` — Type Expressions.

```text
Union:        "auto" | Float · false | T · Boolean | StudType
Collection:   Integer[] · SizeXYZ[1..3]
Generic use:  Box<Integer>   (Box is a StructType with <genericTypes>)
              In BML type="..." attributes write Box(Integer) — see 17_type_system_bml.md
```

Legacy wrapper types (`AutoOr<T>`, `NoneOr<T>`, `Array<T>`, …) are **obsolete** — use union and multiplicity syntax directly.

### Domain Type Namespaces

Each domain BOM defines its own type namespace:

```text
com.machineblocks.bml.type.*   — SizeXYZ, Direction, WallGap, Color, ...
com.electronics.type.*     — Voltage, Resistance, Footprint, ...
com.ui.type.*              — Color, Length, FontSize, ...
```

Types are never shared across domain namespaces unless explicitly defined in `org.blockml.bml.type`. This is intentional — domain-specific types carry domain-specific semantics even when they share a name.

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
bml:version on TypeReferenceEntity sugar — optional exact-version assert against referenced type (value); no match → BML_UNKNOWN_VERSION
```

**Framework convention (`org.blockml.bml.*`, `com.machineblocks.bml.*`):** version only on `Library.bml`, not on individual block files.

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
  baseType = "com.machineblocks.bml.core.Block"
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
  baseType = "org.blockml.bml.service.Math"
  process(block: Block, engine: RenderEngine): RenderOutput {
    return engine.copyTemplate("lib/math_service.scad", "lib/math_service.scad")
  }
}
```

**Mixed within one target:**

```text
machineblocks-v3-scad-target
  ScadBlockProcessor      → compile strategy    (com.machineblocks.bml.core.Block)
  ScadSetProcessor        → compile strategy    (com.machineblocks.bml.core.Set)
  MathBuiltInProcessor    → copy strategy       (org.blockml.bml.service.Math)
  CapabilityImplementationProcessor  → compile strategy    (org.blockml.bml.core.Entity)
```

### Built-in services as BML

Built-in services (`#math`, `#strings`, etc.) are defined as BML BML service files in `@blockml/core` — **SSOT**. SCAD equivalents in `scad-lib/blocks/org/blockml/bml/service/` are pre-rendered build artifacts. Thymeleaf-aligned `#` utility names; `#math` is BlockML-specific.

```text
@blockml/core/
  src/
    org/blockml/bml/service/
      Math.bml            — org.blockml.bml.service.Math      — #math.*
      Strings.bml         — org.blockml.bml.service.Strings   — #strings.*
      Numbers.bml         — org.blockml.bml.service.Numbers   — #numbers.*
      Lists.bml           — org.blockml.bml.service.Lists     — #lists.*
      Bools.bml           — org.blockml.bml.service.Bools     — #bools.*
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
