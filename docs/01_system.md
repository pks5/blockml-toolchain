# BOM Compiler — System

version: 2.0.0

## Purpose

This document describes the BOM Compiler project (`bom`) — the universal toolchain that translates BML (Block Markup Language) source files into domain-specific render target files via a typed BOM (Block Object Model).

The compiler is domain-agnostic. It understands the BML format and the BOM object model. Domain-specific knowledge lives exclusively in Render Targets. MachineBlocks is the reference implementation (Blaupause) — the first domain built on this foundation.

The architecture is designed to accommodate domain BOMs and Render Targets that are not yet known. Adding a new domain requires no changes to the core.

---

## Architecture

The BOM Compiler follows a layered architecture:

```text
BML Source (.mbml / .json)      content-type: bml
  ↓ parse + validate
BOM (Block Object Model)        domain-agnostic, typed
  ↓ compile
Render Target                   domain-specific
  ↓ render
Target Output (SCAD, KiCad, JSX, ...)
```

**BML** (Block Markup Language) is the universal declarative authoring format. File extension `.mbml` (for tooling compatibility). Content-type `bml`. XML is the reference format; JSON is equally supported. Block definitions, composite blocks, and presets are all authored in BML.

**BOM** (Block Object Model) is the canonical, typed, domain-agnostic object model. It is the internal representation of all block data. BOM is renderer-independent — it has no knowledge of any render target, syntax, or parameters. BOM specializations (MBOM, EBOM, etc.) extend the abstract BOM Core with domain-specific types and properties.

**Render Target** is the domain-specific output backend. A Target declares which `baseType` FQNs it supports, and contains one or more Block Renderers that serialize BOM Blocks into target-specific output files. Targets are registered centrally in the compiler.

**The Compiler** is the universal pipeline that connects BML → BOM → Render Target. It runs in both browser (React) and Node.js environments.

**The CLI** (`bom`) is the Node.js command-line interface for compiling, validating, watching, and scaffolding BML projects.

### Reference Implementation: MachineBlocks

MachineBlocks is the first and reference domain. Its BOM specialization is **MBOM** (MachineBlocks Object Model). Its Render Target is the **SCAD Renderer**, producing OpenSCAD files compatible with the MachineBlocks V3 SCAD Library.

```text
BML Source (.mbml)
  ↓ parse + validate
MBOM (MachineBlocks Object Model)   ←  specializes BOM Core
  ↓ compile (scad target)
SCAD Render Target  ←  machineblocks/docs/scad-reference/
  ↓ render
STL / 3MF
```

---

## Key Design Principles

**BML is not a SCAD wrapper.** BML describes semantic BOM objects. Any render target is just one possible output — SCAD, KiCad, JSX, JSON, or anything else.

**BOM is not a render target AST.** BOM is the typed object model. Render Targets are backends that serialize BOM.

**The core is browser-compatible.** No Node.js-only APIs (`fs`, `path`, `child_process`) in `@blockml/core`, `@blockml/parser`, `@blockml/compiler`, or any Render Target package. Only the CLI tools package may use Node-only APIs.

**All mappings are declarative and configurable.** No BOM types, properties, or render mappings are hardcoded in compiler logic. Changes to mappings require only configuration changes, not code changes.

**Domain BOMs extend, never modify core.** Adding EBOM, UBOM, or any future BOM does not change `@blockml/core`, `@blockml/parser`, or `@blockml/compiler`.

---

## Tool vs. Content

`bom` is a standalone tool — installed or cloned once and used across multiple content projects. Content projects (BML sources, render target output) live in separate directories and are not part of the compiler repository.

```text
~/.../bom-compiler/             ← BOM Compiler tool (installed once)
~/.../my-enclosure-project/     ← content project (BML sources, SCAD output)
~/.../my-electronics-project/   ← another content project
```

This is analogous to `tsc` or `webpack` — the tool is global, content projects each have their own `bom.config.json`.

---

## Monorepo Structure

```text
bom-compiler/
  packages/
    core/              — @blockml/core
    parser/            — @blockml/parser
    compiler/          — @blockml/compiler (Rahmen + Target Registry)
    cli-tools/         — @blockml/cli
    core-services/     — @blockml/core-services (built-in ServiceBlock BML definitions)

  engines/
    maker-engine/      — @blockml/engine-maker (V1 engine: compile + template + copy + llm)

  domains/
    machineblocks/
      mbom/            — @machineblocks/mbom
      machineblocks-v3-scad-target/
        src/
          target.ts
          processors/
            ScadBlockProcessor/      — compile strategy
              processor.ts
            ScadSetProcessor/        — compile strategy
              processor.ts
            MathServiceProcessor/    — copy strategy (copies scad-lib math helpers)
              processor.ts
            FunctionBlockProcessor/  — compile strategy (TS → SCAD transpilation)
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

  README.md
```

### The First Engine: `@blockml/engine-maker`

V1 ships with a single engine that covers all rendering strategies needed for the MakerUniverse use cases. BlockProcessors within any target call whichever engine method fits their needs:

```text
engine.compile(...)         — deterministic code transformation
engine.renderTemplate(...)  — template file + variable substitution
engine.copyTemplate(...)    — pure file copy, no transformation
engine.callLLM(...)         — LLM-based generation (deferred to later)
```

This means a single RenderTarget can mix strategies freely — some Processors compile, others use templates, others copy. The engine is the infrastructure; the Processors make the strategy decisions.

New engines can always be built as independent packages. They implement the same `RenderEngine` interface. The first engine is named `maker-engine` because it is designed around the use cases that emerge from the MakerUniverse — physical blocks, electronics, services.

### Built-in ServiceBlock Definitions

Built-in ServiceBlocks (`#math`, `#string`, `#numbers`, `#lists`) are defined as BML Block files in `@blockml/core-services`. This makes their Capabilities formally typed, editor-discoverable, and testable:

```text
packages/core-services/
  src/
    com/bom/service/
      MathService.mbml
      StringService.mbml
      NumbersService.mbml
      ListsService.mbml
```

Each domain target registers a BlockProcessor for these ServiceBlock types. For SCAD, `MathServiceProcessor` uses the copy strategy — it copies or references the relevant SCAD helper functions from `scad-lib/`.

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

Engines are always independent packages implementing the `RenderEngine` interface. There is no fixed set — any engine can be built and published separately:

```text
@blockml/engine-maker      — V1 engine (bundled): compile, template, copy, llm
@mycorp/engine-xslt    — XSLT transformation (third party example)
@mycorp/engine-rust    — Rust code generator (third party example)
```

---

## XSD Schema Structure

BML uses XSD schemas for IDE validation, autocomplete, and Enum enforcement. Schemas are distributed as part of npm packages and referenced via `xsi:schemaLocation` in every BML document.

### Namespace URLs

```text
BlockML Core (blockml.org):
  http://blockml.org/schema/block      ← default xmlns for <block> documents
  http://blockml.org/schema/bml        ← bml: directives namespace
  http://blockml.org/schema/data       ← data: custom metadata namespace
  http://blockml.org/schema/service    ← org.blockml.service.*
  http://blockml.org/schema/blockPresets ← <blockPresets> documents
  http://blockml.org/schema/library    ← library.xml documents

MachineBlocks (machineblocks.com):
  http://machineblocks.com/schema/core        ← MB Core, NativeBlock, Set
  http://machineblocks.com/schema/bricks      ← com.machineblocks.bricks.*
  http://machineblocks.com/schema/calibration ← com.machineblocks.calibration.*
```

### Schema Files

```text
blockml.org schemas (in @blockml/core package):
  schemas/core/
    block.xsd          ← BML document structure, bml:* directives, data:*
    types.xsd          ← org.blockml.type.* primitives
    service.xsd        ← org.blockml.service.* hierarchy
    blockPresets.xsd   ← <blockPresets> document structure
    library.xsd        ← library.xml document structure

machineblocks.com schemas (in @machineblocks/mbom package):
  schemas/machineblocks/
    core.xsd           ← MB Core Block, NativeBlock, Set, native properties
    bricks.xsd         ← com.machineblocks.bricks.* + Enum types
    calibration.xsd    ← com.machineblocks.calibration.*
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

The BOM object model. Browser and Node compatible.

```text
- Block class (metadata, members, compositions)
- Member model: Property, Aggregation, Association, Capability (shared namespace)
- Composition model
- Preset model
- Library and Catalog model
- Expression AST (typed)
- Type Registry (FQN-based, dynamic)
- Validation API
- Target Registry interface
- No domain-specific types, no render logic, no Node-only APIs
```

### `@blockml/parser`

The universal BML parser and BOM builder. Browser and Node compatible.

```text
- XML parser (browser-compatible)
- JSON parser
- Namespace resolver (xmlns → FQN)
- XSD / JSON Schema loader
- BML → BOM mapper (per root type, extensible)
- Diagnostics and error reporting
- No render output
```

### `@blockml/compiler`

Facade and Target Registry. Browser and Node compatible.

```text
- Target Registry: registerTarget(target), getTarget(name)
- compileBmlToBom(source): CompilerResult<BomDocument>
- compileBomToOutput(model, targetName): CompilerResult<RenderOutput>
- compileBmlToOutput(source, targetName): CompilerResult<RenderOutput>
```

### `@blockml/cli`

Node.js-only CLI tools.

```text
- bom new block <fqn> [--format mbml|json]
- bom compile <file> <target>
- bom compile --all <target>
- bom validate <file>
- bom inspect <file>
- bom watch [--src <dir>] [--out <dir>] <target>
- bom activate-config <profileName>
- OpenSCAD executable resolver (for SCAD target)
- Thumbnail renderer (Sharp-based, Node-only, for SCAD target)
```

### `@machineblocks/mbom`

The MachineBlocks domain BOM. Browser and Node compatible.

```text
- MBOM Block class (extends BOM Core Block)
- MachineBlocks-specific member types (Size3D, Direction, WallGap, Color, ...)
- Native property definitions (from 09_mbom_properties.yml)
- MB-specific Aggregation defaults (_parts)
- No SCAD logic, no Node-only APIs
```

### `@machineblocks/scad-renderer`

The SCAD Render Target. Browser and Node compatible.

```text
- Atomic Target: registers for com.machineblocks.core.Block and com.machineblocks.core.Set
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

### FQN (Fully Qualified Name)

All BOM types use Java-style reverse-domain FQNs with dot separators:

```text
org.blockml.core.Block
com.machineblocks.core.Block
com.machineblocks.bricks.StandardBrick
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
  com.martianmicro.anyclosure.Wall::bottom   ← FQN as fallback when no instance ID
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
  com/machineblocks/bricks/
    StandardBrick.mbml        — block definition
    StandardBrickSet.mbml     — composite block (MachineBlocks Set)
    StandardBrickPresets.mbml — block presets

scad/                         — SCAD output files (configurable via outDir)
  com/machineblocks/bricks/
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
<block>        → scad/com/.../ClassName.scad
                 scad/com/.../ClassName.scad.map
                 Block module + customizer. No thumbnails.

<blockPresets> → scad/com/.../ClassName.scad        (implicit compile of referenced block)
                 scad/com/.../ClassName.scad.map
                 scad/com/.../ClassName.json         (OpenSCAD Customizer preset file)
                 scad/com/.../ClassName__{preset}.webp  (one thumbnail per preset)
```

Compiling a `<blockPresets>` document is the standard entry point when generating visible output. It triggers compilation of the referenced block and produces all artifacts in one step.

A MachineBlocks Set is a `<block>` document with `baseType = com.machineblocks.core.Set`. The SCAD Renderer detects this and produces STEPS-based output.

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

They use the same format as `<blockPresets>` and share the same property namespace as block properties.

```text
config/prusa_pla.mbml   — printer + filament profile
config/scale_2x.mbml    — scale profile
```

Only one config profile is active at a time:

```bash
bom activate-config prusa_pla
```

Merge priority (ascending):

```text
configProfile < blockPreset < inline property
```

---

## Documentation Architecture

```text
00_bom_core.md         — BOM Core: abstract model (Block, Member, Preset, Library, Catalog, Target System)
01_system.md           — this document (architecture, packages, conventions, project structure)
02_mbml.md             — BML format, document types, namespaces, schema
03_mbom.md             — MBOM: MachineBlocks domain model, properties, aggregations, expressions
04_types.md            — MBOM type system, serialization rules
05_scad_renderer.md    — SCAD Render Target: Block Renderers, assembly patterns, naming, source maps
06_compiler.md         — compiler pipeline, Target Registry, error handling, testing strategy
07_cli.md              — CLI commands, configuration, watch mode, scaffolding
09_mbom_properties.yml — MBOM native property definitions (authoritative)

domains/machineblocks/runtimes/scad-lib/
  lib/                 — SCAD Runtime (every generated SCAD file uses this)
  config/              — mb_config.scad
  docs/                — SCAD API reference (used by the scad-renderer)
  blocks/              — pre-rendered reference Blocks
    com/machineblocks/
      bricks/          — StandardBrick.scad, StandardBrick.json, thumbnails, ...
      ...
```

`09_mbom_properties.yml` is the authoritative source for all native MBOM property definitions (types, defaults, constraints). The Markdown documents explain concepts, relationships, and decision logic.
