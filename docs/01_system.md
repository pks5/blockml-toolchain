# BOM Compiler — System

version: 2.4.0

## Purpose

This document describes the BOM Compiler project (`bom`) — the universal toolchain that translates BML (Block Markup Language) source files into domain-specific render target files via a typed BOM (Block Object Model).

The compiler is domain-agnostic. It understands the BML format and the BOM object model. Domain-specific knowledge lives exclusively in Render Targets. MachineBlocks is the reference implementation (Blaupause) — the first domain built on this foundation.

The architecture is designed to accommodate domain BOMs and Render Targets that are not yet known. Adding a new domain requires no changes to the core.

---

## Architecture

The BOM Compiler follows a three-layer architecture. See `00_bom_core.md` — Fundamental Architecture Principles for the authoritative design decision.

```text
BML                              BomBuilder (V3, planned)
 │                               createBlock / addProperty / …
 ▼                               │
Parser                          @blockml/parser
 │                               seal()
 └───────────────┬───────────────┘
                 ▼
Urmodell (Canonical BOM)        lossless BML representation — SSOT, read-only
 │
 ├─ Validator fork ──► default Pragmatic Model   @blockml/validator
 │                    (partial inheritance / merges — resolve only)
 │
 ├──────────── Framework Utilities ────────────┐   @blockml/core
 │  forkBom, resolveInheritance, validateTypes,│   never mutate Urmodell
 │  parseExpression, expandComposition, …      │
 │                                             │
 ▼                                             ▼
Renderer Pipeline                      other Renderers
 │  read Urmodell · reuse pragmatic ·       @blockml/compiler + target packages
 │  fork(Urmodell) N times + partial merges
 ▼
Renderer target Working Model          target-specific, mutable, cacheable
 │
 ▼
Emitter
 │
 ▼
Target Output (SCAD, Java, JSX, JSON, …)

Serializer ← Urmodell (Parser or Builder provenance)
```

**V1 build order:** Parser and serializer prove BML ↔ BOM roundtrip first (`@blockml/parser`, `@blockml/serializer`); validator and compiler follow. See `15_dev_setup.md` — V1 Implementation Strategy.

**BML** (Block Markup Language) is the universal declarative authoring format. File extension **`.bml`**. Content-type `bml`. **XML is the V1 reference format.** JSON as an alternate BML authoring serialization is **deferred (TBD — not V1)** due to namespace and directive constraints.

**BOM** (Block Object Model) has two runtime roles plus a planned authoring path — see `00_bom_core.md` — Urmodell and Pragmatic Model · BomBuilder (V3):

- **Urmodell (Canonical BOM)** — immutable, lossless representation of BML; SSOT; produced by the parser (V1) or by `BomBuilder.seal()` (V3); never receives derived writes.
- **Pragmatic Model** — mutable working copy; the Validator resolves inheritance/merges here by default; renderers may reuse it or fork the Urmodell again (including multiple times) for their own partial merges. **Resolve only** — not structural authoring.
- **BomBuilder (V3, planned)** — writable session to build or edit BOM graphs block-by-block (`addProperty`, …); `seal()` yields a new Urmodell. V1/V2 type and pipeline design must maximize reuse for this path.

BOM specializations (MBOM, EBOM, etc.) extend the abstract BOM Core with domain-specific type definitions declared in BML.

**Framework Utilities** (`@blockml/core`) provide reusable analysis and transformation algorithms. They read the Urmodell and return derived views/diagnostics or apply partial merges only to pragmatic forks — they never write back to the Urmodell. Semantic validation (Stage 2) is orchestrated by `@blockml/validator`.

**Render Target** is the domain-specific output backend. Each target defines its own pipeline: which model to read (Urmodell, default pragmatic, or own forks), which utilities to call, in what order, and how to build its target working model. A Target declares which `baseType` FQNs it supports and contains Block Processors that emit target-specific results.

**The Compiler** (`@blockml/compiler`) is the facade and Target Registry. It does not prescribe a fixed compile path — renderers orchestrate utilities themselves.

**Self-hosting (bootstrap):** Before processing user projects, the CLI bootstraps a TypeRegistry from framework BML in `@blockml/core` and `@machineblocks/mbom`. Each registered BlockDefinition is an immutable `BomDocument` (Urmodell) — typically parse-origin today; Builder-origin documents are valid once V3 ships.

**The CLI** (`bom`) is the Node.js command-line interface for parsing, validating, compiling, watching, and scaffolding BML projects.

### Reference Implementation: MachineBlocks

MachineBlocks is the first and reference domain. Its BOM specialization is **MBOM** (MachineBlocks Object Model). Its Render Target is the **SCAD Renderer**, producing OpenSCAD files compatible with the MachineBlocks V3 SCAD Library.

```text
BML Source (.bml)                    BomBuilder (V3, planned)
  ↓ parse                              ↓ seal()
Urmodell (Canonical BOM, immutable) ←─┘
  ↓ validator fork → default Pragmatic Model (optional for render)
  ↓ renderer: choose Urmodell / pragmatic / fork(s) + partial merges
SCAD Render Target
  ↓ emit
STL / 3MF
```

---

## Key Design Principles

**BML and BOM are inseparable.** The Urmodell is the lossless, immutable representation of BML — not a pre-interpreted object model. BML → BOM → BML must always be possible.

**The parser makes no semantic decisions.** It produces the read-only Urmodell. Validation, inheritance resolution, expression evaluation, and composition expansion run on pragmatic forks or as utility results — never as Urmodell mutations.

**Urmodell is SSOT; Pragmatic Model is not.** The Validator resolves on a copy. Renderers decide what to read and may fork the Urmodell repeatedly for partial merges.

**Authoring is BomBuilder (V3), not pragmatic resolve.** Structural writes (`addProperty`, new blocks from scratch) go through a writable builder session that `seal()`s to a new Urmodell. Build V1 so Parser, Serializer, Validator, and core types are fully reusable by Language Server (V2) and BomBuilder (V3) — see `00_bom_core.md`.

**Language Server (V2) reuses the language loop.** `@blockml/lsp` adapts Parser → Urmodell, Validator → diagnostics, Serializer → format — no parallel IDE AST. See `00_bom_core.md` — Language Server.

**Renderers own their pipeline and working model.** The framework provides utilities; each renderer decides which model and merges to use and how to map BML semantics to the target system.

**BML is not a SCAD wrapper.** BML describes semantic objects. Any render target is one possible output.

**BOM is not a render target AST.** The Urmodell is the authored model. Renderers build pragmatic forks and/or their own target working models.

**The core is browser-compatible.** No Node.js-only APIs in `@blockml/core`, `@blockml/parser`, `@blockml/compiler`, or any Render Target package.

**All mappings are declarative and configurable.** No BOM types, properties, or render mappings are hardcoded in compiler logic.

**Domain BOMs extend, never modify core.** Adding EBOM, UBOM, or any future BOM does not change `@blockml/core`, `@blockml/parser`, or `@blockml/compiler`.

**No mandatory input↔output mapping.** Render targets define output cardinality. See `14_compiler_runtime.md` — Compile I/O Model (C4).

---

## Tool vs. Content

`bom` is a standalone tool — installed or cloned once and used across multiple content projects. Content projects (BML sources, render target output) live in separate directories and are not part of the compiler repository.

```text
~/.../blockml/                  ← BlockML / BOM Compiler tool (installed once)
~/.../my-enclosure-project/     ← content project (BML sources, SCAD output)
~/.../my-electronics-project/   ← another content project
```

This is analogous to `tsc` or `webpack` — the tool is global, content projects each have their own `bom.config.json`.

---

## Monorepo Structure

See `15_dev_setup.md` for **as-of-now vs target** layout, workspace configuration, build scripts, and implementation order.

**Today:** specs under `docs/`, framework BML under `packages/core/`, domain BML under `domains/machineblocks/mbom/`, scad-lib submodule — no npm workspace / TS packages yet.

**Target tree** (after scaffolding):

```text
blockml/
  packages/
    core/              — @blockml/core (BOM TS contracts + framework BML: org.blockml.bml.*)
    parser/            — @blockml/parser (BML → BomDocument; types from core)
    serializer/        — @blockml/serializer (BomDocument → BML; types from core)
    validator/         — @blockml/validator
    compiler/          — @blockml/compiler (Rahmen + Target Registry)
    cli-tools/         — @blockml/cli
    lsp/               — @blockml/lsp (V2, planned — Language Server)

  engines/
    maker-engine/      — @blockml/engine-maker (V1 engine: compile + template + copy + llm)

  domains/
    machineblocks/
      mbom/            — @machineblocks/mbom (framework BML: com.machineblocks.bml.core.*)
        blocks/com/machineblocks/bml/core/
      machineblocks-v3-scad-target/
        src/
          target.ts
          processors/
            ScadBlockProcessor/      — compile strategy
              processor.ts
            ScadSetProcessor/        — compile strategy
              processor.ts
            MathBuiltInProcessor/    — copy strategy (copies scad-lib math helpers)
              processor.ts
            CapabilityImplementationProcessor/  — compile strategy (TS → SCAD transpilation)
              processor.ts
        runtimes/
          scad-lib/    — Git Submodule: MachineBlocks V3 SCAD Library
            lib/
            config/
            docs/
            blocks/
              com/
                machineblocks/
                  bricks/
                  ...

  docs/
  README.md
```

### The First Engine: `@blockml/engine-maker`

**CompilerEngine** is the generic term for the processing infrastructure that BlockProcessors use. BOM Core defines the TypeScript interface `RenderEngine` — this is the CompilerEngine contract. **MakerEngine** (`@blockml/engine-maker`) is the first CompilerEngine implementation, built for the Maker Universe platform — the first product ecosystem to use BlockML.

V1 ships with MakerEngine, which covers all rendering strategies needed for the MakerUniverse use cases. BlockProcessors within any target call whichever engine method fits their needs:

```text
engine.compile(...)         — deterministic code transformation
engine.renderTemplate(...)  — template file + variable substitution
engine.copyTemplate(...)    — pure file copy, no transformation
engine.callLLM(...)         — LLM-based generation (deferred to later)
```

This means a single RenderTarget can mix strategies freely — some Processors compile, others use templates, others copy. The engine is the infrastructure; the Processors make the strategy decisions.

New engines can always be built as independent packages. Each implements the CompilerEngine contract via the `RenderEngine` interface. MakerEngine is the first such implementation — named `maker-engine` because it is designed around the use cases that emerge from the MakerUniverse — physical blocks, electronics, services.

### Built-in service Definitions

Built-in services (`#math`, `#strings`, `#numbers`, `#lists`, `#bools`) are defined as BML service files in `@blockml/core` — **SSOT**. Pre-rendered SCAD in `scad-lib/blocks/org/blockml/bml/service/`. Thymeleaf-aligned `#` utility names; `#math` is BlockML-specific.

The library follows Thymeleaf's `#` utility object naming — plural for utilities (`#strings`, `#lists`, …), extended with `#math` which Thymeleaf does not provide.

```text
packages/core/
  blocks/
    org/blockml/bml/core/
      Entity.bml         ← org.blockml.bml.core.Entity
      Language.bml       ← org.blockml.bml.core.Language
      ProgrammingLanguage.bml ← org.blockml.bml.core.ProgrammingLanguage
    org/blockml/bml/language/
      TypeScript.bml · OpenSCAD.bml · English.bml · German.bml · PseudoCode.bml
    org/blockml/bml/service/
      Math.bml           ← org.blockml.bml.service.Math      — #math.*
      Strings.bml        ← org.blockml.bml.service.Strings   — #strings.*
      Numbers.bml        ← org.blockml.bml.service.Numbers   — #numbers.*
      Lists.bml          ← org.blockml.bml.service.Lists     — #lists.*
      Bools.bml          ← org.blockml.bml.service.Bools     — #bools.*
```

**Naming mapping** (package segment `.service` is singular; utility names follow Thymeleaf):

```text
# prefix (authoring)     Service FQN                  BML file
#math.*                  org.blockml.bml.service.Math           Math.bml
#strings.*               org.blockml.bml.service.Strings        Strings.bml
#numbers.*               org.blockml.bml.service.Numbers        Numbers.bml
#lists.*                 org.blockml.bml.service.Lists          Lists.bml
#bools.*                 org.blockml.bml.service.Bools          Bools.bml
```

BML files are **SSOT**. SCAD files in scad-lib are pre-rendered compile artifacts — not hand-edited.

All Transformation Capabilities use structured Object `inputType` with named keys — enabling both positional and named call syntax. Single-parameter Capabilities use the primitive type directly:

```text
#math.max       → inputType: { a: Float, b: Float }, outputType: Float
#math.floor     → inputType: Float, outputType: Integer
#math.clamp     → inputType: { x: Float, lo: Float, hi: Float }, outputType: Float
#math.round_n   → inputType: { x: Float, n: Integer }, outputType: Float
#lists.concat   → inputType: { a: Object[0..n], b: Object[0..n] }, outputType: Object[0..n]
#numbers.formatDecimal → inputType: { x: Float, minInt: Integer, decPoint: String, minFrac: Integer }, outputType: String
```

Each Capability has a TypeScript implementation in `<implementation language="org.blockml.bml.language.TypeScript">`. SCAD equivalents live in `scad-lib/blocks/org/blockml/bml/service/` — one `.scad` file per service. The ScadBlockProcessor automatically adds `use` imports for each service file referenced by a Block's expressions.

### Delegate-Only Targets

A domain that builds entirely on existing targets needs no engine and no processors — only delegates:

```text
martianmicro-anyclosure-target
  engine: —
  processors: —
  delegates: [machineblocks-v3-scad-target]
```

MartianMicro defines only its Block types as MBML files. All rendering is handled by the MB SCAD target. This is the natural pattern for domain libraries that extend an existing render ecosystem without introducing new rendering logic.

### Engine Packages

Engines are always independent packages implementing the CompilerEngine contract (`RenderEngine` interface). There is no fixed set — any engine can be built and published separately:

```text
@blockml/engine-maker      — V1 engine (bundled): compile, template, copy, llm
@mycorp/engine-xslt    — XSLT transformation (third party example)
@mycorp/engine-rust    — Rust code generator (third party example)
```

---

## XSD Schema Structure

> **Architecture decision:** **XSD files are Render Target output**, not a Stage-1 parser dependency. An **XSD Render Target** (Phase C; package name TBD, e.g. `@blockml/xsd-target`) generates `.xsd` from BML / Definition meta-model. **Validating** authored BML against those schemas is enabled only after that target exists — and must remain **always disableable** (CLI/config escape hatch), so intentional language/meta changes can still regenerate schemas when they no longer match the previous `.xsd`.

### Planned toolchain Render Targets (before or beside MachineBlocks SCAD)

MachineBlocks SCAD is the primary **product** target. These **toolchain** targets exercise Stage 3 with less domain surface and are **candidates to ship before** `machineblocks-v3-scad`:

| Target | Name (TBD) | Minimal output | Role |
|---|---|---|---|
| **XSD** | `@blockml/xsd-target` | `.xsd` artifacts | Schemas for IDE / later validation |
| **BlockDoc** | `@blockml/blockdoc-target` | Static HTML files whose URLs follow the **package / FQN hierarchy** (JavaDoc-like browse). Later: richer site, graphs, cross-links | Human/LLM-readable navigation of the block corpus |
| **FatBlock** | `@blockml/fatblock-target` | One `.bml` document: root block plus **all transitive dependencies** inlined as root `<embeddedBlocks>` (virtual `.bml` files) | Portable single-file artifact; proves registry closure + embed model |

See `15_dev_setup.md` — Phase C ordering · `12_bom_object_model.md` / `02_mbml.md` — Embedded Blocks (Inline Library).

Until generated schemas ship, hand-maintained XSDs / `catalog.xml` may remain a temporary **IDE aid** for autocomplete. They are not required for parse/roundtrip.

Long-term, schemas are distributed as compile artifacts (or published from the XSD target) and referenced via `xsi:schemaLocation` / catalog — not authored as the type SSOT (BML is).

### Namespace URLs

```text
BlockML Core (blockml.org):
  http://blockml.org/schema/block      ← default xmlns for <block> documents
  org.blockml.bml.annotation.BmlAnnotation  ← bml: Annotation (directives)
  http://blockml.org/schema/bml        ← XSD/catalog only (not xmlns target)
  http://blockml.org/schema/service    ← org.blockml.bml.service.*

MachineBlocks (machineblocks.com):
  http://machineblocks.com/schema/core        ← MB Core, NativeBlock, Set
  http://machineblocks.com/schema/bricks      ← com.machineblocks.bml.bricks.*
  http://machineblocks.com/schema/calibration ← com.machineblocks.bml.calibration.*
```

### Schema Files

```text
blockml.org schemas (in @blockml/core package):
  schemas/core/
    block.xsd          ← BML document structure (all <block> roots: composable, types, Library, …)
    types.xsd          ← org.blockml.bml.type.* primitives (filename plural; maps to singular .type package)
    service.xsd        ← org.blockml.bml.service.* hierarchy

machineblocks.com schemas (in @machineblocks/mbom package):
  schemas/machineblocks/
    core.xsd           ← MB Core Block, NativeBlock, Set, native properties
    bricks.xsd         ← com.machineblocks.bml.bricks.* + Enum types
    calibration.xsd    ← com.machineblocks.bml.calibration.*
    anyclosure.xsd     ← com.martianmicro.anyclosure.*
```

### catalog.xml

A `catalog.xml` in the project root maps namespace URLs to local XSD files for offline IDE resolution:

```xml
<catalog xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog">
  <uri name="http://blockml.org/schema/block"
       uri="./node_modules/@blockml/core/schemas/core/block.xsd" />
  <uri name="http://blockml.org/schema/bml"
       uri="./node_modules/@blockml/core/schemas/core/block.xsd" />
  <uri name="http://machineblocks.com/schema/core"
       uri="./node_modules/@machineblocks/mbom/schemas/machineblocks/core.xsd" />
  <uri name="http://machineblocks.com/schema/bricks"
       uri="./node_modules/@machineblocks/mbom/schemas/machineblocks/bricks.xsd" />
</catalog>
```

---

## Package Overview

### `@blockml/core`

The BOM object model and framework utilities. Browser and Node compatible. **Owns** the shared TypeScript BOM contracts (`BomDocument`, `BlockDefinition`, …) used by parser, serializer, validator, compiler, and LSP.

```text
  - BomDocument / BlockDefinition / member model (Property, Aggregation, Association, Capability)
  - Composition, Preset, Library, Catalog shapes
  - Expression AST types (`ExpressionNode`) — parse/eval utilities live here; Canonical BOM stores `raw` only
  - TypeRegistry (FQN-based, dynamic)
  - Framework utilities (`resolve*`, `parseExpression`, `validate*`)
  - Framework + built-in service BML (`org.blockml.bml.*`)
  - No domain-specific types, no render logic, no Node-only APIs
```

### `@blockml/parser`

The universal BML → BOM mapper. Browser and Node compatible. Produces `BomDocument` types from `@blockml/core` — does not own those interfaces.

```text
  - XML parser (V1; browser-compatible)
  - JSON BML parser — deferred (TBD, not V1)
  - Namespace resolver (xmlns → FQN)
  - XSD loader (JSON Schema for BML authoring — deferred with JSON format)
  - BML → BOM mapper (per root type, extensible)
  - Parse diagnostics (using `@blockml/core` `Diagnostic`)
  - No render output
```

**V1:** Implemented and tested **before** compiler. See `15_dev_setup.md` — V1 Implementation Strategy.

### `@blockml/serializer`

BOM → canonical BML XML. Browser and Node compatible. Inverse of the parser mapping — enables the **BML → BOM → BML** roundtrip. Consumes `BomDocument` from `@blockml/core` (no dependency on `@blockml/parser` or `@blockml/validator`).

```text
- BOM → BML XML (V1: hardcoded inverse of 13_bml_to_bom_mapping.md)
- Meta-driven output via Definition blocks + bml:xml — deferred (19_definition_blocks_and_bml_xml.md)
- No semantic validation, no render output
- Operates on Urmodell only
```

**Host policy (CLI / IDE):** Whether to refuse serialize/compile after Stage-2 diagnostics is an **orchestrator** decision. The serializer package does not call the validator.

**V1:** Ships together with `@blockml/parser`; roundtrip tests gate validator and compiler work.

### `@blockml/validator`

Semantic validation (Stage 2). Browser and Node compatible. Independent of parser and serializer.

```text
- TypeRegistry integration
- Inheritance, contracts, constraints, references, expression correctness
- Forks Urmodell → mutable default Pragmatic Model (partial resolution / merges)
- Never mutates Urmodell (Canonical BOM)
- Returns diagnostics — does not abort callers; hosts decide abort policy
```

**V1:** Implemented **after** parser + serializer roundtrip tests pass.

### `@blockml/compiler`

Facade and Target Registry. Browser and Node compatible.

```text
- Target Registry: registerTarget(target), getTarget(name)
- compileBmlToBom(input: CompileInput, options?): CompilerResult<BomDocument>
- compileBomToOutput(model, targetName, options?): CompilerResult<RenderOutput>
- compileBmlToOutput(input: CompileInput, targetName, options?): CompilerResult<RenderOutput>
```

See `14_compiler_runtime.md` — Compiler Facade API (C2).

### `@blockml/cli`

Node.js-only CLI tools.

```text
- bom new block <fqn> [--format bml]   # JSON deferred (TBD)
- bom compile <file> <target>
- bom compile --all <target>
- bom validate <file>
- bom inspect <file>
- bom watch [--src <dir>] [--out <dir>] <target>
- bom activate-config <profileName>
- bootstrapTypeRegistry() + bootstrapTargets() before compile/watch (see 14_compiler_runtime.md)
- incrementalBuild.ts — SHA-256 cache in .bom-cache/ (C5)
- OpenSCAD executable resolver (for SCAD target)
- Thumbnail renderer (Sharp-based, Node-only, for SCAD target)
```

### `@blockml/lsp` (V2, planned)

VS Code Language Server for BML. Thin LSP adapter — **reuses** parser, validator, serializer, and core. No parallel IDE AST.

```text
- Language Server Protocol host (Node)
- Document sync → @blockml/parser → Urmodell
- Diagnostics → @blockml/validator (pragmatic fork)
- Format document → @blockml/serializer
- Hover / outline / go-to-definition → TypeRegistry + Urmodell
- Tolerant parse for mid-edit documents
- Does not implement BomBuilder (V3) — text editing only in V2
```

See `00_bom_core.md` — Language Server — planned IDE integration (V2).

### `@machineblocks/mbom`

The MachineBlocks domain BOM. Browser and Node compatible.

```text
- MBOM Block class (extends BOM Core Block)
- MachineBlocks-specific member types (SizeXYZ, Direction, WallGap, Color, ...)
- Native property definitions from `NativeBlock.bml` + `com.machineblocks.bml.type.*` (SSOT)
- `com.machineblocks.bml.core.Block` type definition — including inherited `_parts` aggregation
- No SCAD logic, no Node-only APIs
```

### `@machineblocks/machineblocks-v3-scad-target`

The MachineBlocks V3 SCAD Render Target. Browser and Node compatible. Registers under the name `"machineblocks-v3-scad"`.

```text
- Atomic Target: registers for com.machineblocks.bml.core.Block and com.machineblocks.bml.core.Set
- Block Renderer: MBOM Block → SCAD module (V1: one generic renderer for all MB Blocks)
- Set Renderer: MBOM Set → STEPS array + view submodules
- Module name resolver (FQN → mb__com__...)
- Settings renderer (MBOM properties → SCAD settings array)
- Expression renderer (Expression AST → SCAD)
- Assembly pattern mapping (mb_assembly_groove, mb_assembly_offset, etc.)
- Import resolver
- Customizer generator
- Source map generation (Source Map Spec V3)
- Reference: machineblocks-lib/docs/scad-reference/
```

---

## Naming Conventions

### FQN Namespaces — Mandatory `bml` package

Every BML definition must reside under `<domain>.bml.*`. See `00_bom_core.md` — Mandatory BML namespace.

```text
org.blockml.bml.*           — BlockML framework and compiler Blocks
com.machineblocks.bml.*     — MachineBlocks domain Blocks
com.example.bml.*           — any domain's BML definitions

Examples:
  org.blockml.bml.core.Block
  org.blockml.bml.compiler.parser.Parser
  com.machineblocks.bml.core.Block
  com.machineblocks.bml.bricks.StandardBrick
```

Block FQN, xmlns binding, or Library export outside `<domain>.bml.*` → `BML_OUTSIDE_BML_NAMESPACE`.

### FQN (Fully Qualified Name)

All BOM types use Java-style reverse-domain FQNs with dot separators:

```text
org.blockml.bml.core.Block
com.machineblocks.bml.core.Block
com.machineblocks.bml.bricks.StandardBrick
com.martianmicro.anyclosure.Wall
com.electronics.core.Component
```

Package segments are lowercase. Class names are PascalCase.

### SCAD Module Names (MachineBlocks domain)

FQN segments are separated by double underscores. Package segments are lowercase, class names are PascalCase:

```scad
mb__com__machineblocks__bricks__StandardBrick
mb__com__martianmicro__anyclosure__Wall
mb__com__martianmicro__anyclosure__Wall__Bottom          ← subclass
mb__com__martianmicro__anyclosure__Wall__help__myHelper  ← private helper
mb__com__martianmicro__anyclosure__Wall__func__myFunc    ← private function
```

The names `help` and `func` are reserved and cannot be used as subclass names.

### SCAD File Paths (MachineBlocks domain)

```text
FQN:   com.martianmicro.anyclosure.Wall
File:  scad/com/martianmicro/anyclosure/Wall.scad
```

Multiple block classes may exist in one SCAD file. The file is named after the primary class.

### Thumbnail File Names (MachineBlocks domain)

Thumbnails are named using the Preset **id** directly — no transformation needed:

```text
{BlockName}__{preset-id}.webp

Examples:
  Wall__brick-2x4.webp
  Wall__brick-1x1.webp
  StandardBrick__standard-2x4-yellow.webp
```

The Preset `id` is kebab-case by convention. The Preset `name` ("Brick 2x4") is used in the SCAD Customizer JSON and editor UI only — never in filenames.

### Instance IDs

```text
Separator:  ::
Format:     <instanceId>::<partId>::<subPartId>

Examples:
  00001::bottom
  00001::bottom::inner
  wall::a3f7c2                 — auto-generated part under explicit parent (no FQN fallback)
```

### camelCase Throughout

All property names, parameter names, and attribute names use camelCase in BML, BOM, and render targets:

```text
BML attribute:   baseCutoutType="groove"
BOM property:    baseCutoutType
SCAD parameter:  baseCutoutType
```

---

## Project File Structure

```text
src/                          — BML source files (configurable via srcDir)
  com/martianmicro/anyclosure/
    Wall.bml                    — block definition (.bml = standard)
    WallPresets.bml             — block presets

  com/machineblocks/bml/bricks/     — MachineBlocks library
    StandardBrick.bml
    StandardBrickSet.bml
    StandardBrickPresets.bml
```

scad/                         — SCAD output files (configurable via outDir)
  com/machineblocks/bml/bricks/
    StandardBrick.scad        — compiled block
    StandardBrick.scad.map    — source map
    StandardBrick.json        — compiled presets (OpenSCAD Customizer format)
    StandardBrick__brick-2x4.webp  — thumbnail per preset
    StandardBrick__brick-1x1.webp
    StandardBrickSet.scad     — compiled set
```

Thumbnail files are placed alongside the SCAD output by default. The output directory for thumbnails is configurable via `thumbsDir` in `bom.config.json`.

The root element of the BML file determines the document type — not the filename or path.

---

## SCAD Output per Document Type (MachineBlocks domain)

```text
<block> (composable)     → scad/com/.../ClassName.scad
                           scad/com/.../ClassName.scad.map
                           Block module + customizer. No thumbnails.

<block> (preset block)    → scad/com/.../ReferencedBlock.scad   (implicit compile per preset block type)
                           scad/com/.../ReferencedBlock.scad.map
                           scad/com/.../ReferencedBlock.json     (OpenSCAD Customizer preset file)
                           scad/com/.../ReferencedBlock__{preset-id}.webp  (one thumbnail per preset)
```

Compiling a preset block (`baseType = com.machineblocks.bml.core.Block` with `_presets` composition) is a standard entry point when generating Customizer output. It triggers implicit compilation of referenced block types and produces all artifacts in one step.

A MachineBlocks Set is a `<block>` document with `baseType = com.machineblocks.bml.core.Set`. The SCAD Renderer detects this and produces STEPS-based output.

---

## Configuration Files

### `bom.config.json`

Project-level configuration:

```json
{
  "srcDir":       "src",
  "outDir":       "scad",
  "thumbsDir":    null,
  "activeConfig": "prusa_pla"
}
```

`mbLibPath` is optional. When absent, the CLI resolves the MachineBlocks V3 SCAD Library relative to its own executable location (see Library Resolution below).

### `bom-cli.config.json`

CLI-level configuration (command names, argument names, shortcuts):

```json
{
  "commands": {
    "compile":        "compile",
    "watch":          "watch",
    "validate":       "validate",
    "inspect":        "inspect",
    "activateConfig": "activate-config"
  }
}
```

---

## Library Resolution (MachineBlocks domain)

The MachineBlocks V3 SCAD Library (`machineblocks-lib/`) is bundled with the BOM Compiler installation as a Git Submodule. Content projects do not need to install or reference the library separately.

Resolution order for the library path:

```text
1. bom.config.json → "mbLibPath"         (explicit override, highest priority)
2. Environment variable MACHINEBLOCKS_LIB_PATH
3. Resolved relative to the bom executable:
     path.join(dirname(bom_executable), "../machineblocks-lib")
```

If none of the above yields a valid library path, the CLI reports a clear error:

```text
ERROR: MachineBlocks V3 SCAD Library not found.
  Set "mbLibPath" in bom.config.json or MACHINEBLOCKS_LIB_PATH to the library root.
```

This resolution is implemented in `@blockml/cli` as `resolveMbLib.ts`.

---

## Config Profiles

Config profiles are project-wide property presets that define hardware-specific or rendering-specific defaults (printer calibration, filament shrinkage, scale, etc.).

They are preset blocks (`baseType="com.machineblocks.bml.core.Block"` with `_presets` composition) and share the same property namespace as block properties.

```text
config/prusa_pla.bml    — printer + filament profile
config/scale_2x.bml     — scale profile
```

Only one config profile is active at a time:

```bash
bom activate-config prusa_pla
```

Merge priority (ascending):

```text
configProfile < appliedPresets chain < inline property
```

---

## BML Self-Description Roadmap

BlockML should eventually be the language in which BlockML is understood. The path there is **evolutionary** — V1 must not be overloaded. V1 exists first to make **MachineBlocks** workable.

### Decision criterion

When choosing whether content belongs in BML or Markdown:

```text
Does this information directly benefit authoring, validation, the customizer,
the type system, or MachineBlocks implementation?

  yes  →  prefer BML (V1 scope)
  no   →  keep Markdown for now; mark as V2 migration candidate
```

### V1 — MachineBlocks-focused BML SSOT

V1 does **not** model the full compiler in BML. V1 pulls into BML only what you actively extend, validate, or author against — without wading through long Markdown handbooks.

| In BML (V1) | Stays Markdown (V1) |
|---|---|
| Parameter definitions | Compiler pipeline architecture |
| Property types | Parser architecture |
| Primitive, Struct, Enum, Generic container types | CLI specification |
| Native MachineBlocks properties | Target implementation details |
| Defaults and computed defaults | Design rationale and principles |
| Suggestions / customizer metadata | Runtime and bootstrap internals |
| Built-in services used in expressions | Full replacement of existing docs |
| Framework base types for validation and authoring | Self-hosting of the entire toolchain |
| Definition meta-model (`org.blockml.bml.definition.*`, `core.Definition`) | Meta-driven `bml:xml` parser and BOM → XML serializer |

Markdown remains **authoritative** in V1 for architecture, pipeline, runtime, CLI, implementation details, and design rationale.

**V1:** Authored Capabilities in BML; no synthetic accessor generation. Renderer interprets Capabilities target-specifically — see `08_managed_object.md`.

### V2 — Documentation migration · Language Server

From V2 onward, stable structural information moves from Markdown into BML Blocks. Roles split as follows:

| Markdown | BML |
|---|---|
| Principles, motivation, architecture decisions | Structure, types, members, rules |
| Reading guide and commentary | Stages, targets, diagnostics |
| Links to BML definitions | Reusable, machine-readable concepts |

Rules:

- Avoid duplicate tables across Markdown and BML.
- Anything machine-readable, validatable, or editor/LLM-relevant migrates to BML step by step.
- Markdown becomes increasingly a **table of contents** and commentary on the BML structure.

**V2 migration candidates** (compiler-adjacent Blocks, when they add real value):

```text
Pipeline · Stage · Validator · Diagnostic · RenderTarget
BlockProcessor · RenderEngine · CliCommand
bml:xml meta-serializer (not implemented)   ← BML meta-model specified in 19_definition_blocks_and_bml_xml.md
```

During migration, content is classified as: stays prose · becomes BML · removed from Markdown (link only) · temporarily duplicated.

**Language Server (V2):** `@blockml/lsp` (name TBD) — VS Code Language Server that **reuses** `@blockml/parser`, `@blockml/validator`, `@blockml/serializer`, and `@blockml/core`. Diagnostics, hover, outline, go-to-definition, format-on-save. Text/XML editing only; structural BomBuilder editing is V3. See `00_bom_core.md` — Language Server — planned IDE integration (V2).

### V3 — Compiler as BlockML system · BomBuilder

Pipeline, stages, targets, processors, diagnostics, CLI, and tests are **predominantly** described as Blocks. Prose remains only for core principles and rationale.

**BomBuilder (V3)** ships as the writable authoring API: build or edit BOM graphs programmatically (block-by-block, including new properties), then `seal()` to Urmodell. Same consumers as parse-origin documents (serializer, validator, renderers, LSP). See `00_bom_core.md` — BomBuilder — planned writable authoring API (V3).

### Phases

```text
Phase 1 / V1   MachineBlocks-focused BML SSOT
               Types, properties, framework base types, service blocks, authoring metadata
               Goal: practical usability — not complete self-description
               Constraint: BOM types + serialize/validate provenance-agnostic;
                           source spans on parse (optional on types) — LSP- and Builder-ready

Phase 2 / V2   Documentation migration + Language Server
               Stable structure from Markdown → BML; Markdown shortens and links to FQNs
               @blockml/lsp: Parser / Validator / Serializer / TypeRegistry behind LSP
               Constraint: keep construction-friendly factories; no parse-only type traps

Phase 3 / V3   Compiler as BlockML system + BomBuilder
               Pipeline, stages, targets, diagnostics, CLI largely in BML
               BomBuilder: writable session → seal() → Urmodell; IDE / bom new / generators
```

Type-level migration within V1 (`04_types.md` → BML, XSD deprecation) is specified in `17_type_system_bml.md` — Migration from XSD and 04_types.md. Framework bootstrap scope is in `16_framework_base_types.md`.

---

## Documentation Architecture

```text
00_bom_core.md         — BOM Core: abstract model (Block, Member, Preset, Library, Catalog, Target System)
01_system.md           — this document (architecture, packages, conventions, project structure)
02_mbml.md             — BML format, document types, namespaces, schema
03_mbom.md             — MBOM: MachineBlocks domain model, properties, aggregations, expressions
04_types.md            — MBOM type system, serialization rules
05_scad_renderer.md    — SCAD Render Target: Block Renderers, assembly patterns, naming, source maps
06_compiler.md         — compiler pipeline, Stage numbering glossary, Target Registry, testing (incl. toolchain RT sketches)
07_cli.md              — CLI commands, configuration, watch mode, scaffolding
12_bom_object_model.md — formal BOM data structures (BomDocument, BlockDefinition, CompositionNode)
13_bml_to_bom_mapping.md — BML → BOM algorithm (parser implementation contract)
14_compiler_runtime.md — compiler runtime (Facade, bootstrap, RenderContext, cache, thumbnails)
15_dev_setup.md        — monorepo tooling, build, test, IDE setup
16_framework_base_types.md — framework base types as BML (abstract, final)
17_type_system_bml.md  — ValueType, Language, Block hierarchy
18_constraints_and_suggestions.md — property constraints and suggestions
19_definition_blocks_and_bml_xml.md — Definition meta-model BML (specified); bml:xml meta-serializer (not implemented)
20_value_type_instance_configuration.md — ValueType `{…}` instance configuration
21_constant_value_type.md — Constant(T){value} singleton domains
22_function_mapping.md — Capability call argument mapping (FunctionMapping)
09_mbom_properties.yml — transitional SCAD render hints only (must follow NativeBlock.bml)

domains/machineblocks/runtimes/scad-lib/
  lib/                 — SCAD Runtime (every generated SCAD file uses this)
  config/              — mb_config.scad
  docs/                — SCAD API reference (used by machineblocks-v3-scad-target)
  blocks/              — pre-rendered reference Blocks
    com/machineblocks/bml/
      bricks/          — StandardBrick.scad, StandardBrick.json, thumbnails, ...
      ...
```

Native MBOM / SCAD parameters (**SSOT**): `domains/machineblocks/mbom/blocks/com/machineblocks/bml/core/NativeBlock.bml` + `…/type/*.bml`. See `04_types.md` (XY / XYZ / AB). `09_mbom_properties.yml` is transitional only and must not contradict NativeBlock.

**BML vs Markdown:** BML is SSOT for structure you author and validate against (V1 scope above). Markdown explains concepts, relationships, architecture decisions, and reading order. Long-term, Markdown links to BML FQNs instead of duplicating tables — see [BML Self-Description Roadmap](#bml-self-description-roadmap).
