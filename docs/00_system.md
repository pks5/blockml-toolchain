# BOM Compiler — System

version: 2.6.0

## Purpose

This document describes the BOM Compiler project (`bom`) — the universal toolchain that translates BML (Block Markup Language) source files into domain-specific render target files via a typed BOM (Block Object Model).

The compiler is domain-agnostic. It understands the BML format and the BOM object model. Domain-specific knowledge lives exclusively in Render Targets. MachineBlocks is the reference implementation (Blaupause) — the first domain built on this foundation.

The architecture is designed to accommodate domain BOMs and Render Targets that are not yet known. Adding a new domain requires no changes to the core.

---

## Architecture

The BOM Compiler follows a three-layer architecture. See `01_bom_core.md` — Fundamental Architecture Principles for the authoritative design decision.

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

**BML** (Block Markup Language) is the universal declarative format for **typed structure, data, and semantics** — not an authoring-only language. File extension **`.bml`**. Content-type `bml`. **XML is the sole BML serialization** for V1 and V2. A JSON authoring form is **not planned** as an equivalent format (see `02_mbml.md` — JSON as authoring form); it remains at most an open possibility, not a roadmap item.

**WOT / runtime role:** In the Web of Things, BML is also a **message format**. Capabilities are addressable via the **`stud://`** protocol over **sockets and HTTP**. The same typed Blocks, values, and semantics used when authoring travel as interchange payloads between Things — BML is the shared grammar for humans, LLMs, compilers, and networked Capabilities. See `01_bom_core.md` — Capabilities · Address Schemes · Message Model · `17_type_system_bml.md` — WOT alignment.

**BOM** (Block Object Model) is the typed graph behind BML. Normative roles — **Urmodell** (immutable Canonical BOM / SSOT), **Pragmatic Model** (resolve-only forks), **BomBuilder** (V3 authoring → `seal()`), Framework Utilities, and renderer freedom — live in `01_bom_core.md` — Fundamental Architecture Principles. This document only sketches the system layout above.

BOM specializations (MBOM, EBOM, etc.) extend the abstract BOM Core with domain-specific type definitions declared in BML.

**The Compiler** (`@blockml/compiler`) is the facade and Target Registry. It does not prescribe a fixed compile path — renderers orchestrate utilities themselves. Pipeline detail: `06_compiler.md`.

**Self-hosting (bootstrap):** Before processing user projects, the CLI bootstraps a TypeRegistry from framework BML in `node_modules/@blockml/core` (`org.blockml.bml.*`) and MachineBlocks BML in `node_modules/@machineblocks/core` (`com.machineblocks.bml.*`). Each registered BlockDefinition is an immutable `BomDocument` (Urmodell) — typically parse-origin today; Builder-origin documents are valid once V3 ships.

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

**Urmodell / roundtrip / authoring.** Canonical BOM is immutable SSOT; BML → BOM → BML must always be possible; pragmatic forks are resolve-only; structural authoring is BomBuilder (V3); LSP (V2) reuses the language loop. **Normative detail:** `01_bom_core.md` — Fundamental Architecture Principles (do not restate here).

**Renderers own their pipeline and working model.** The framework provides utilities; each renderer decides which model and merges to use and how to map BML semantics to the target system. BML describes semantic objects — not a SCAD wrapper or a render-target AST.

**The core is browser-compatible.** No Node.js-only APIs in `@blockml/core`, `@blockml/parser`, `@blockml/compiler`, or any Render Target package.

**All mappings are declarative and configurable.** No BOM types, properties, or render mappings are hardcoded in compiler logic.

**Domain BOMs extend, never modify core.** Adding EBOM, UBOM, or any future BOM does not change `@blockml/core`, `@blockml/parser`, or `@blockml/compiler`.

**Every toolchain package is a BlockML node module.** A normal npm package (`package.json`) plus a `blocks/` folder. That folder is the **SSOT** for the package. Markdown in this repo is transitional and is **not** an implementation source — see [BlockML node packages](#blockml-node-packages), [Package Implementation Workflow](#package-implementation-workflow), and [BML Self-Description Roadmap](#bml-self-description-roadmap).

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

## Repository Structure

See `15_dev_setup.md` for workspace configuration, build scripts, and implementation order.

### BlockML node packages

All modules — renderer, core, parser, domain libraries, future compiler targets — are **npm packages with a BlockML extension**. They are ordinary Node modules (`package.json`, optional `src/` / `dist/` / `lib/`) **plus** a `blocks/` folder that holds `.bml` files.

**`blocks/` is the SSOT for that package.** Types, documentation, services, examples, and other package knowledge that belongs in the grammar live there as BML — not in Markdown in this repo, and not as a second inventory beside the package.

```text
@scope/name/
  package.json              — normal npm package
  blocks/                   — BlockML SSOT for this package
    <domain>/…/*.bml
  src/ · dist/              — TypeScript when the package has runtime code
  lib/ · config/ · …        — optional native artifacts (e.g. SCAD runtime)
```

This is a further step toward **total self-description**: BlockML and every package describe themselves in BML inside their own node module. The Markdown files under `docs/` are a **transitional** solution. The goal is that all information lives in the respective npm packages as BML. **MD files are deleted** once every package is implemented and all of their information has been transferred into the corresponding BML libraries.

Creating or implementing a package follows the [Package Implementation Workflow](#package-implementation-workflow): own BlockML library first (linked from `package.json`), migrate that package’s Markdown into the library, then implement **only** from the library.

### npm organizations

Two organizations are registered on npm. They are the **root** for all future packages:

| Scope | Owns |
|---|---|
| `@blockml` | BlockML toolchain — `core`, and later `parser`, `serializer`, `validator`, `compiler`, `cli`, targets, … |
| `@machineblocks` | MachineBlocks domain — `core` today; later the compiler **render target** as a separate package |

Parser, serializer, and other BlockML packages are grouped under **`@blockml`**. Each will have its own `blocks/` folder — SSOT for that package — exactly as `@blockml/core` and `@machineblocks/core` already do.

The MachineBlocks **compiler target** (MBOM → SCAD) is **not** part of `@machineblocks/core`. It will be a separate `@machineblocks/*` package, developed under `packages/` in this repo.

### Working tree

After `npm install`, packages live under `node_modules/`.

```text
blockml/
  package.json                 — root workspace; depends on @blockml/core, @machineblocks/core, …
  docs/                        — transitional Markdown (migrate into package BML; not an implementation SSOT)

  node_modules/
    @blockml/
      core/                    — BlockML Core
        package.json
        blocks/org/blockml/bml/          — SSOT (org.blockml.bml.*)
    @machineblocks/
      core/                    — MachineBlocks domain library
        package.json
        blocks/com/machineblocks/bml/    — SSOT: docs, types, bricks, examples
        lib/ · config/ · pattern/        — SCAD reference renderer / runtime

  packages/                    — @blockml/* and @machineblocks/* as they are authored here
                                 (each package: package.json + blocks/ + src/)
```

| npm package | Role | Path after `npm install` |
|---|---|---|
| `@blockml/core` | Framework BML SSOT in `blocks/` (language, services, diagnostics) | `node_modules/@blockml/core` |
| `@blockml/bom` | Urmodell TypeScript (`BomDocument`, `bomEquals`, B26 result types) | `packages/bom` → `@blockml/bom` |
| `@machineblocks/core` | MachineBlocks docs (BML), SCAD reference renderer, BML + SCAD examples | `node_modules/@machineblocks/core` |
| `@blockml/parser` | BML → BomDocument; own `blocks/` SSOT when it ships | `packages/parser` → `@blockml/parser` |
| `@blockml/compiler` | Facade + Target Registry; own `blocks/` SSOT when it ships | `node_modules/@blockml/compiler` (when published) |
| `@machineblocks/*` target | Compiler render target (MBOM → SCAD) — **separate** from `core`; lives under `packages/` | `node_modules/@machineblocks/…` (when published) |

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

Built-in services (`#math`, `#strings`, `#numbers`, `#lists`, `#bools`) are defined as BML service files in `node_modules/@blockml/core` — **SSOT**. Pre-rendered SCAD in `node_modules/@machineblocks/core/blocks/org/blockml/bml/service/`. Thymeleaf-aligned `#` utility names; `#math` is BlockML-specific.

The library follows Thymeleaf's `#` utility object naming — plural for utilities (`#strings`, `#lists`, …), extended with `#math` which Thymeleaf does not provide.

```text
node_modules/@blockml/core/
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

BML files are **SSOT**. SCAD files in `@machineblocks/core` are pre-rendered compile artifacts — not hand-edited.

All Transformation Capabilities use structured Object `inputType` with named keys — enabling both positional and named call syntax. Single-parameter Capabilities use the primitive type directly:

```text
#math.max       → inputType: { a: Float, b: Float }, outputType: Float
#math.floor     → inputType: Float, outputType: Integer
#math.clamp     → inputType: { x: Float, lo: Float, hi: Float }, outputType: Float
#math.round_n   → inputType: { x: Float, n: Integer }, outputType: Float
#lists.concat   → inputType: { a: Object[0..n], b: Object[0..n] }, outputType: Object[0..n]
#numbers.formatDecimal → inputType: { x: Float, minInt: Integer, decPoint: String, minFrac: Integer }, outputType: String
```

Each Capability has a TypeScript implementation in `<implementation language="org.blockml.bml.language.TypeScript">`. SCAD equivalents live in `node_modules/@machineblocks/core/blocks/org/blockml/bml/service/` — one `.scad` file per service. The ScadBlockProcessor automatically adds `use` imports for each service file referenced by a Block's expressions.

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

> **Architecture decision:** **XSD files are Render Target output**, not a Stage-1 parser dependency. The **XSD Render Target** (Phase C; package `@blockml/xsd-target`, registry name `"xsd"`) generates `.xsd` from BML / Definition meta-model. **Validating** authored BML against those schemas is enabled only after that target exists — and must remain **always disableable** via CLI `--no-xsd` **and** `bom.config.json` → `xsdValidation: false` (see `07_cli.md` — XSD validation escape hatch), so intentional language/meta changes can still regenerate schemas when they no longer match the previous `.xsd`.

### Planned toolchain Render Targets (BlockDoc-first, then beside MachineBlocks SCAD)

MachineBlocks SCAD is the primary **product** target. **V1 Stage-3 control gate is BlockDoc** — browseable HTML of the corpus for verification after roundtrip. Other toolchain targets and SCAD follow.

**Decided names:** npm package + CLI/registry short name (not the same string).

| Order | Target | Package | Registry / CLI `<target>` | Minimal output | Role |
|---|---|---|---|---|---|
| **1st** | **BlockDoc** | `@blockml/blockdoc-target` | `blockdoc` | Static HTML files whose URLs follow the **package / FQN hierarchy** (JavaDoc-like browse). Later: richer site, graphs, cross-links | **V1 control gate** — human/LLM review of the block corpus |
| 2nd+ | **XSD** | `@blockml/xsd-target` | `xsd` | `.xsd` artifacts | **Universal** `block.xsd` + optional **domain** XSDs; particle shape aligns with **`bml:xml`** |
| 2nd+ | **FatBlock** | `@blockml/fatblock-target` | `fatblock` | One `.bml` with transitive deps in root `<embeddedBlocks>` | Portable artifact; registry closure + embed model; Stage 2 first (`19` D2) |
| Later | **SCAD (product)** | `@machineblocks/machineblocks-v3-scad-target` | `machineblocks-v3-scad` | `.scad` (+ maps, …) | MachineBlocks V3 reference product target |

`bom.config.json` → **`targets[]` is V1** (default `["blockdoc"]`) — see `07_cli.md` · `14_compiler_runtime.md` C3 · `15_dev_setup.md` Phase C.

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

machineblocks.com schemas (generated from `@machineblocks/core` BML; packaging with the SCAD target when it exists):
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
       uri="./node_modules/@machineblocks/machineblocks-v3-scad-target/schemas/machineblocks/core.xsd" />
  <uri name="http://machineblocks.com/schema/bricks"
       uri="./node_modules/@machineblocks/machineblocks-v3-scad-target/schemas/machineblocks/bricks.xsd" />
</catalog>
```

---

## Package Overview

### `@blockml/core`

The BlockML Core library, installed at `node_modules/@blockml/core`. A BlockML node module: `package.json` + `blocks/` (SSOT for `org.blockml.bml.*`). Browser and Node compatible. **Owns the BML language** — grammar, types, services, diagnostics. Does **not** own Urmodell TypeScript (see `@blockml/bom`).

```text
  - BomDocument / BlockDefinition / member model (Property, Aggregation, Association, Capability)
  - Composition, Preset, Library, Catalog shapes
  - Expression AST types (`ExpressionNode`) — parse/eval utilities live here; Canonical BOM stores `raw` only
  - TypeRegistry (FQN-based, dynamic)
  - Framework utilities (`resolve*`, `parseExpression`, `validate*`)
  - Bootstraps framework BML from `node_modules/@blockml/core` (`org.blockml.bml.*`)
  - No domain-specific types, no render logic, no Node-only APIs
```

### `@blockml/bom`

The Urmodell runtime package. Browser and Node compatible. **Owns** shared TypeScript BOM contracts (`BomDocument`, `BlockDefinition`, `Diagnostic`, `ParseResult`, `bomEquals`, …) used by parser, serializer, validator, compiler, and LSP. BML language rules remain in `@blockml/core`.

### `@blockml/parser`

The universal BML → BOM mapper. Browser and Node compatible. Produces `BomDocument` types from `@blockml/bom` — does not own those interfaces.

**BML library is SSOT:** `packages/parser/blocks/org/blockml/bml/compiler/parser/` — start at `org.blockml.bml.compiler.parser.documentation.Introduction`. TypeScript in `packages/parser/src/` implements it; parity tests in `packages/parser/test/`.

```text
  - XML DOM via `@xmldom/xmldom` (B18; same in Node and browser — see `06_compiler.md` [2])
  - Public entry: parse(source, options?) → ParseResult (B26)
  - JSON BML parser — not planned for V1/V2; XML only (see `02_mbml.md`)
  - Namespace resolver (xmlns → FQN)
  - XSD loader — optional IDE aid; not required for parse
  - BML → BOM mapper (per root type, extensible)
  - Parse diagnostics (using @blockml/bom Diagnostic)
  - No render output
```

**V1:** Implemented and tested **before** compiler. See `15_dev_setup.md` — V1 Implementation Strategy.

### `@blockml/serializer`

BOM → canonical BML XML. Browser and Node compatible. Inverse of the parser mapping — enables the **BML → BOM → BML** roundtrip. Consumes `BomDocument` from `@blockml/bom` (no dependency on `@blockml/parser` or `@blockml/validator`).

**BML library is SSOT:** `packages/serializer/blocks/org/blockml/bml/compiler/serializer/` — start at `org.blockml.bml.compiler.serializer.documentation.Introduction`. TypeScript in `packages/serializer/src/` implements it; parity tests in `packages/serializer/test/`.

```text
- BOM → BML XML (V1: hardcoded inverse — rules in serializer BML, not this MD)
- Public entry: serialize(document, options?) → SerializeResult (B26)
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
- bom new block <fqn> [--format bml]   # XML only; JSON authoring not planned
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

### `@blockml/lsp` (V2, planned — package name **decided**)

VS Code Language Server for BML. Thin LSP adapter — **reuses** parser, validator, serializer, and core. No parallel IDE AST. Display name in the editor may still be “BlockML Language Server”; the npm package stays `@blockml/lsp`.

```text
- Language Server Protocol host (Node)
- Document sync → @blockml/parser → Urmodell
- Diagnostics → @blockml/validator (pragmatic fork)
- Format document → @blockml/serializer
- Hover / outline / go-to-definition → TypeRegistry + Urmodell
- Tolerant parse for mid-edit documents
- Does not implement BomBuilder (V3) — text editing only in V2
```

See `01_bom_core.md` — Language Server — planned IDE integration (V2).

### `@machineblocks/core` (domain library)

MachineBlocks **domain library** — not the compiler render target, and not a separate `mbom` package.

Installed at `node_modules/@machineblocks/core`. A BlockML node module: `package.json` + `blocks/` (SSOT). It contains:

```text
- General MachineBlocks documentation as BML
    blocks/com/machineblocks/bml/documentation/
- Domain grammar (MBOM) — Block, NativeBlock, Set, types, bricks, …
    blocks/com/machineblocks/bml/core/ · type/ · bricks/ · …
- SCAD library as the reference renderer / runtime
    lib/ · config/ · pattern/
- Examples in BML and SCAD
    blocks/com/machineblocks/bml/examples/
    blocks/com/machineblocks/scad/
```

Path for domain BML: `node_modules/@machineblocks/core/blocks/com/machineblocks/bml`

```text
- com.machineblocks.bml.core.* — Block, NativeBlock, CompositeBlock, Set, Step, …
- com.machineblocks.bml.type.* — SizeXYZ, Direction, WallGap, Color, …
- NativeBlock.bml + type/*.bml — MB native parameter / type SSOT
- bricks/, calibration/, examples/ — library blocks and fixtures
```

### `@machineblocks/*` compiler target (future)

The MachineBlocks V3 SCAD **Render Target** for the BML compiler is a **separate** package under `@machineblocks`, developed in this repo under `packages/`. It is not `@machineblocks/core`. It will follow the same BlockML node-module shape (`package.json` + `blocks/` SSOT + TypeScript). Browser and Node compatible. Registers under the name `"machineblocks-v3-scad"`.

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
- Domain library / SCAD reference: `@machineblocks/core`
```

---

## Naming Conventions

### FQN Namespaces — Mandatory `bml` package

Every BML definition must reside under `<domain>.bml.*`. See `01_bom_core.md` — Mandatory BML namespace.

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
mb__com__machineblocks__scad__bricks__StandardBrick
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

## Package Implementation Workflow

> **Normative for every new and not-yet-implemented package.** `@blockml/parser`, `@blockml/serializer`, `@blockml/validator`, `@blockml/compiler`, `@blockml/cli`, toolchain targets, `@blockml/engine-maker`, `@blockml/lsp`, the `@machineblocks/*` SCAD target — the same three steps. No exceptions for “just a first TypeScript slice”.

Markdown under `docs/` is a **holding handbook** until the owning package is implemented. It is **not** the implementation SSOT. TypeScript, tests, and further BML for a package are written from that package’s BML library only.

### Step 1 — Package-own BlockML library

Create a BlockML library **inside the package**, following `@blockml/core`:

```text
<package>/
  package.json                 — npm package + blockml.library pointer (required)
  blocks/<domain>/bml/…        — package SSOT
    Library.bml                — catalog (baseType core:BlockLibrary)
    README.bml                 — ReadFirst entry (when the library has docs)
    …                          — types, documentation, diagnostics, tasks, …
  src/                         — TypeScript (only after Steps 1–2)
```

The library is a normal `Library.bml` catalog: filename `Library.bml`, `baseType="core:BlockLibrary"`, membership **only** via the `blocks` list (not by directory). Physical paths mirror FQNs under `<domain>.bml.*`. Nested libraries follow `01_bom_core.md` / `.cursor/rules/blockml-libraries-versioning.mdc`.

**`package.json` must link the library** — same field as `@blockml/core`:

```json
{
  "name": "@blockml/core",
  "blockml": {
    "library": "./blocks/org/blockml/bml/Library.bml"
  }
}
```

Reference: `node_modules/@blockml/core/package.json` (and `@machineblocks/core`: `"library": "./blocks/com/machineblocks/bml/Library.bml"`).

A new package uses the same key, pointing at **its** `Library.bml`. Example for `@blockml/parser`:

```json
{
  "name": "@blockml/parser",
  "blockml": {
    "library": "./blocks/org/blockml/bml/compiler/parser/Library.bml"
  }
}
```

FQN path follows the package’s namespace (e.g. `org.blockml.bml.compiler.parser.Library`). Do not omit `blockml.library`. Do not point at `@blockml/core`’s library instead of an own catalog.

**Done when:** `package.json` has `blockml.library`; `Library.bml` exists at that path; the package is a BlockML node module (`package.json` + `blocks/`).

### Step 2 — Migrate the package’s Markdown into the library

The package BML library is the **SSOT of the package**. Transfer **all** information from the Markdown files that belong to this package (see [MD → package map](#md--package-map) below) into that library: documentation blocks, types, diagnostics, tasks, mapping rules, APIs, invariants, examples.

```text
docs/*.md  (transitional)  →  <package>/blocks/…  (SSOT)
```

Rules:

- Every fact needed to implement or use the package must exist in the package BML. MD may still be readable as a handbook during migration; it is not a second inventory.
- Shared MD (one file, several packages) is **split by section**: each section has one owning package. Language rules that already live in `@blockml/core` stay there; the new library **links** them (`see` / `ReadFirst`) instead of copying.
- Do not start Step 3 while package-relevant MD content is still only in Markdown.

**MD files are transitional.** They are **deleted** when **all** packages are implemented **and** every piece of information has been transferred into the corresponding BML libraries. Until then, migrated sections in MD become pointers to FQNs (same pattern as `02_mbml.md`).

**Done when:** a reader (human or LLM) can implement and review the package from `Library.bml` / `README.bml` and the exported blocks alone.

### Step 3 — Implement from the package BML library only

Implementation (TypeScript, tests, further BML, schemas) uses **exclusively** the package’s BML library as basis.

```text
allowed:   package BML library  →  src/, tests/, further BML in the same package
forbidden: docs/*.md            →  src/   (direct implementation from Markdown)
```

If something is missing, contradictory, or only found in Markdown:

1. **Stop** implementation from that MD passage.
2. **Update the package BML library** with the missing or corrected information.
3. **Resume implementation from the library.**

No implementation on the direct basis of MD files — not for a “first slice”, not for tests, not for “the MD is still more detailed”. Detail that is needed belongs in the library first.

Existing libraries (`@blockml/core`, `@machineblocks/core`) already have Step 1. Remaining Core- or domain-owned MD still follows Steps 2–3 **before** further implementation from those packages (e.g. Core TypeScript from `12_bom_object_model.md`: migrate into Core BML, then implement).

### MD → package map

Primary owner of each transitional Markdown file. Implement the owner → migrate that file (or its owned sections) in Step 2.

| Transitional MD | Owning package BML library |
|---|---|
| `01_bom_core.md`, `02_mbml.md`, `08_managed_object.md`, `10_expression_language.md`, `16_framework_base_types.md`, `17_type_system_bml.md`, `18_constraints_and_suggestions.md`, `19_definition_blocks_and_bml_xml.md`, `20_value_type_instance_configuration.md`, `21_constant_value_type.md`, `22_function_mapping.md`, `WOT_Reference.md` | `@blockml/core` (language already largely in Core BML; leftover MD still migrates here) |
| `12_bom_object_model.md` | `@blockml/bom` (Urmodell interfaces, B26, bomEquals — not `@blockml/core`) |
| `13_bml_to_bom_mapping.md` | Transitional TOC — parser SSOT → `@blockml/parser` BML; serializer SSOT → `@blockml/serializer` BML |
| `06_compiler.md`, `14_compiler_runtime.md` | `@blockml/compiler` |
| `07_cli.md` | `@blockml/cli` |
| `03_mbom.md`, `04_types.md` | `@machineblocks/core` (native params/types already BML SSOT) |
| `05_scad_renderer.md` | `@machineblocks/*` SCAD target |
| BlockDoc / XSD / FatBlock slices in `00` / `06` / `14` / `19` | `@blockml/blockdoc-target`, `@blockml/xsd-target`, `@blockml/fatblock-target` |
| Engine slices in `00` / `06` / `14` | `@blockml/engine-maker` |
| Language Server slices in `01` | `@blockml/lsp` |
| `00_system.md`, `15_dev_setup.md` | Split into owning packages last; remaining repo handbook until all packages exist |

---

## BML Self-Description Roadmap

BlockML should eventually be the language in which BlockML **and every package** are understood. Each npm package carries that knowledge in its own `blocks/` folder (see [BlockML node packages](#blockml-node-packages)).

The Markdown files in this repository (`docs/*.md`) are a **transitional** solution. **Goal:** all information lives in the respective node packages as BML. **MD files are deleted** when all packages are implemented and all information has been transferred. The operational path is the [Package Implementation Workflow](#package-implementation-workflow) — not a later documentation-only cleanup.

V1 must not overload **Core** BML with the entire toolchain. Toolchain and domain packages each get **their own** library when they are implemented.

### Decision criterion

When choosing whether content belongs in **Core** BML or still sits in Markdown **until the owning package is implemented**:

```text
Does this information belong to a package that is being implemented now?

  yes  →  migrate it into that package’s BML library (workflow Steps 1–2), then implement
  no   →  keep Markdown as holding handbook; do not implement from it

Does this information belong in @blockml/core (language, types, services)?

  yes  →  prefer Core BML (already largely so)
  no   →  it belongs in the owning toolchain/domain package library, not in Core
```

### V1 — MachineBlocks-focused Core BML · per-package libraries on implement

V1 does **not** model the full compiler in **Core** BML. Core BML holds what you actively extend, validate, or author against. Pipeline, parser, CLI, and target detail stay in Markdown **only until that package is implemented** — then the workflow applies and that package’s BML becomes SSOT.

| In Core BML (V1) | Stays Markdown until the owning package is implemented |
|---|---|
| Parameter definitions | Compiler pipeline architecture → `@blockml/compiler` |
| Property types | Parser architecture → `@blockml/parser` |
| Primitive, Struct, Enum, Generic container types | CLI specification → `@blockml/cli` |
| Native MachineBlocks properties | Target implementation details → owning target package |
| Defaults and computed defaults | Design rationale for a package → that package’s BML (with the package) |
| Suggestions / customizer metadata | Runtime and bootstrap internals → `@blockml/compiler` |
| Built-in services used in expressions | Full replacement of existing docs (when all packages have libraries) |
| Framework base types for validation and authoring | Self-hosting of the entire toolchain (per package, at implement time) |
| Definition meta-model (`org.blockml.bml.definition.*`, `core.Definition`) | Meta-driven `bml:xml` parser and BOM → XML serializer → parser/serializer libraries |

Markdown is a **transitional handbook**, not an implementation SSOT. Package BML under `blocks/` wins wherever it exists. When a package is implemented, its MD is migrated first — see [Package Implementation Workflow](#package-implementation-workflow).

**Exception (already in force):** MachineBlocks **native parameters and type shapes** — sole SSOT is `NativeBlock.bml` + `com.machineblocks.bml.type.*`. Markdown/YAML are pointer/commentary only — do not maintain a second parameter inventory.

**V1:** Authored Capabilities in BML; no synthetic accessor generation. Renderer interprets Capabilities target-specifically — see `08_managed_object.md`.

### V2 — Documentation migration · Language Server

From V2 onward, remaining cross-cutting handbook prose shortens. Per-package migration does **not** wait for V2 — it happens in the [Package Implementation Workflow](#package-implementation-workflow) when each package is built. Roles split as follows:

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

**Language Server (V2):** `@blockml/lsp` (**decided**) — VS Code Language Server that **reuses** `@blockml/parser`, `@blockml/validator`, `@blockml/serializer`, and `@blockml/core`. Diagnostics, hover, outline, go-to-definition, format-on-save. Text/XML editing only; structural BomBuilder editing is V3. See `01_bom_core.md` — Language Server — planned IDE integration (V2).

### V3 — Compiler as BlockML system · BomBuilder

Pipeline, stages, targets, processors, diagnostics, CLI, and tests are **predominantly** described as Blocks. Prose remains only for core principles and rationale.

**BomBuilder (V3)** (**decided** name) ships as the writable authoring API: DOM-like navigation (`querySelector`, …) and mutation **within** existing BlockML definitions, then `seal()` to Urmodell. Same consumers as parse-origin documents. **Out of V3 scope:** changing BlockML’s own meta/grammar structure — deferred to a possible **V4** BomBuilder evolution (direction TBD). See `01_bom_core.md` — BomBuilder — Scope: V3 vs V4.

### Phases

```text
Phase 1 / V1   MachineBlocks-focused Core BML SSOT
               Types, properties, framework base types, service blocks, authoring metadata
               Goal: practical usability — not complete self-description of the toolchain in Core
               Per package: Package Implementation Workflow (library → migrate MD → implement from BML)
               Constraint: BOM types + serialize/validate provenance-agnostic;
                           source spans on parse (optional on types) — LSP- and Builder-ready

Phase 2 / V2   Remaining handbook shortening + Language Server
               Leftover cross-cutting MD → owning package BML; Markdown becomes ToC / commentary
               @blockml/lsp: Parser / Validator / Serializer / TypeRegistry behind LSP
               Constraint: keep construction-friendly factories; no parse-only type traps

Phase 3 / V3   Compiler as BlockML system + BomBuilder
               Pipeline, stages, targets, diagnostics, CLI largely in BML
               BomBuilder: DOM-like session within BlockML definitions → seal() → Urmodell
               (language-structure mutation → V4, not V3)
```

Type-level migration within V1 (`04_types.md` → BML, XSD deprecation) is specified in `17_type_system_bml.md` — Migration from XSD and 04_types.md. Framework bootstrap scope is in `16_framework_base_types.md`.

---

## Documentation Architecture

```text
00_system.md           — this document (architecture, packages, conventions, project structure)
                           transitional Markdown — package BML is SSOT; see Package Implementation Workflow
01_bom_core.md         — BOM Core: abstract model (Block, Member, Preset, Library, Catalog, Target System)
02_mbml.md             — BML format, document types, namespaces, schema
03_mbom.md             — MBOM: MachineBlocks domain model, properties, aggregations, expressions
04_types.md            — MBOM type system, serialization rules
05_scad_renderer.md    — SCAD Render Target: Block Renderers, assembly patterns, naming, source maps
06_compiler.md         — compiler pipeline, Stage numbering glossary, Target Registry, testing (incl. toolchain RT sketches)
07_cli.md              — CLI commands, configuration, watch mode, scaffolding
12_bom_object_model.md — formal BOM data structures (BomDocument, BlockDefinition, CompositionNode)
13_bml_to_bom_mapping.md — BML → BOM algorithm (parser implementation contract)
14_compiler_runtime.md — compiler runtime (Facade, bootstrap, RenderContext, cache, thumbnails)
15_dev_setup.md        — tooling, package layout, build, test, IDE setup
16_framework_base_types.md — framework base types as BML (abstract, final)
17_type_system_bml.md  — ValueType, Language, Block hierarchy
18_constraints_and_suggestions.md — property constraints and suggestions
19_definition_blocks_and_bml_xml.md — Definition meta-model BML (specified); bml:xml meta-serializer (not implemented)
20_value_type_instance_configuration.md — ValueType `{…}` instance configuration
21_constant_value_type.md — Constant(T){value} singleton domains
22_function_mapping.md — Capability call argument mapping (FunctionMapping)
09_mbom_properties.yml — pointer stub only (inventory removed; see NativeBlock.bml)

node_modules/@machineblocks/core/   — BlockML node module (docs, SCAD reference renderer, examples)
  package.json
  lib/                 — SCAD Runtime (every generated SCAD file uses this)
  config/              — mb_config.scad
  pattern/             — assembly patterns
  blocks/              — package SSOT
    com/machineblocks/bml/
      documentation/         — general MachineBlocks docs as BML
      core/ type/ bricks/    — MBOM grammar
      examples/              — BML examples
      ...
```

**Native MBOM / SCAD parameters — sole SSOT (already today):**  
`node_modules/@machineblocks/core/blocks/com/machineblocks/bml/core/NativeBlock.bml` + `…/type/*.bml`.  
Markdown (`03`/`04`/`05`/…), `09_mbom_properties.yml`, and MachineBlocks API notes **must follow or only link** — they are not a second inventory. Conventions (XY / XYZ / AB) stay in `04_types.md`.

**BML vs Markdown (general):** Markdown in `docs/` is **transitional** and is **not** an implementation SSOT. For **MachineBlocks native params and type shapes**, BML in `@machineblocks/core` is already the sole SSOT — do not duplicate parameter tables in Markdown. When a package is implemented, its MD is migrated into that package’s BML library first; implementation uses only the library. **MD files are deleted** once all packages are implemented and all information has been transferred — see [BlockML node packages](#blockml-node-packages), [Package Implementation Workflow](#package-implementation-workflow), and [BML Self-Description Roadmap](#bml-self-description-roadmap).
