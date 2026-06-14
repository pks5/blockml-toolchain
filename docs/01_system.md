# MachineBlocks Compiler — System

version: 1.0.0

## Purpose

This documentation describes the MachineBlocks Compiler project (`mbc`) — the toolchain that translates MBML (MachineBlocks Markup Language) source files into SCAD render target files via MBOM (MachineBlocks Object Model).

The MachineBlocks V3 SCAD Library is the reference render target. Its documentation is available under `docs/scad-reference/` (Git Submodule).

---

## Architecture

MachineBlocks follows a layered architecture:

```text
MBML Source (.mbml / .json)
  ↓ parse + validate
MBOM (MachineBlocks Object Model)
  ↓ compile
SCAD Render Target  ←  docs/scad-reference/
  ↓ render
STL / 3MF
```

**MBML** is the declarative authoring format. It is XML-based (reference format) with JSON as an equally supported alternative. Block definitions, sets, and presets are all authored in MBML.

**MBOM** is the canonical, typed object model. It is the internal representation of all block data. MBOM is renderer-independent — it has no knowledge of SCAD syntax or parameters.

**SCAD** is the render target. The SCAD Renderer serializes MBOM into OpenSCAD files compatible with the MachineBlocks V3 SCAD Library.

**The Compiler** is the pipeline that connects MBML → MBOM → SCAD. It runs in both browser (React) and Node.js environments.

**The CLI** (`mbc`) is the Node.js command-line interface for compiling, validating, watching, and scaffolding MBML projects.

---

## Key Design Principles

**MBML is not SCAD with XML syntax.** MBML describes semantic MachineBlocks objects. SCAD is only a render target.

**MBOM is not a SCAD AST.** MBOM is the typed object model. The SCAD Renderer is a backend that serializes MBOM.

**The Core is browser-compatible.** No Node.js-only APIs (`fs`, `path`, `child_process`) in `@machineblocks/mbom`, `@machineblocks/mbml`, `@machineblocks/scad-renderer`, or `@machineblocks/compiler`.

**All mappings are declarative and configurable.** No MBOM types, MBOM properties, or MBOM→SCAD mappings are hardcoded in compiler logic. Changes to mappings require only configuration changes, not code changes.

---

## Monorepo Structure

```text
machineblocks-compiler/
  packages/
    mbom/           — MBOM object model, type registry, expression AST, validation
    mbml/           — XML/JSON parser, namespace resolver, MBML→MBOM mapper
    scad-renderer/  — MBOM→SCAD compiler, settings renderer, assembly patterns
    compiler/       — Facade: compileMbmlToScad(), compileMbomToScad()
    cli-tools/      — Node-only: mbc CLI commands, file watcher

  docs/
    scad-reference/ — Git Submodule → MachineBlocks V3 SCAD Library Docs

  README.md
```

---

## Package Overview

### `@machineblocks/mbom`

The MBOM object model. Browser and Node compatible.

```text
- Block, CompositeBlock, Set classes
- Property model (typed, native and custom)
- Aggregation, Association, Composition model
- Expression AST (typed, SpEL-based)
- Type Registry (FQN-based)
- Validation API
- No SCAD logic, no Node-only APIs
```

### `@machineblocks/mbml`

The MBML parser and MBOM builder. Browser and Node compatible.

```text
- XML parser (browser-compatible)
- JSON parser
- Namespace resolver (xmlns → FQN)
- XSD / JSON Schema loader
- MBML → MBOM mapper (per root type)
- Diagnostics and error reporting
- No SCAD output
```

### `@machineblocks/scad-renderer`

The SCAD render backend. Browser and Node compatible.

```text
- MBOM → SCAD renderer
- Module name resolver (FQN → mb_block__com__...)
- Settings renderer (MBOM properties → SCAD settings array)
- Expression renderer (Expression AST → SCAD)
- Composite block renderer (compositions → nested mb_block() calls)
- Set renderer (total / print / step / instance views)
- Customizer generator
- Import resolver
- Assembly pattern mapping (mb_assembly_groove, mb_assembly_offset, etc.)
- Source map generation (Source Map Spec V3)
- Reference: docs/scad-reference/
```

### `@machineblocks/compiler`

Facade over mbom + mbml + scad-renderer. Browser and Node compatible.

```text
- compileMbmlToMbom(source)
- compileMbomToScad(model)
- compileMbmlToScad(source)
```

### `@machineblocks/cli-tools`

Node.js-only CLI tools.

```text
- mbc new block <fqn> [--format mbml|json]
- mbc compile <file>
- mbc compile --all
- mbc validate <file>
- mbc inspect <file>
- mbc watch [--src <dir>] [--out <dir>]
- mbc activate-config <profileName>
```

---

## Naming Conventions

### FQN (Fully Qualified Name)

All MBOM types use Java-style reverse-domain FQNs with dot separators:

```text
com.machineblocks.core.Block
com.machineblocks.bricks.StandardBrick
com.martianmicro.anyclosure.Wall
com.martianmicro.anyclosure.Corner
```

Package segments are lowercase. Class names are PascalCase.

### SCAD Module Names

FQN segments are separated by double underscores. Package segments are lowercase, class names are PascalCase:

```scad
mb_block__com__machineblocks__bricks__StandardBrick
mb_block__com__martianmicro__anyclosure__Wall
mb_block__com__martianmicro__anyclosure__Wall__Bottom      ← subclass
mb_block__com__martianmicro__anyclosure__Wall__help__myHelper  ← private helper
mb_block__com__martianmicro__anyclosure__Wall__func__myFunc    ← private function
```

### SCAD File Paths

```text
FQN:   com.martianmicro.anyclosure.Wall
File:  scad/com/martianmicro/anyclosure/Wall.scad
```

Multiple block classes may exist in one SCAD file. The file is named after the primary class.

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

All property names, parameter names, and attribute names use camelCase in MBML, MBOM, and SCAD:

```text
MBML attribute:  baseCutoutType="groove"
MBOM property:   baseCutoutType
SCAD parameter:  baseCutoutType
```

---

## Project File Structure

```text
src/                          — MBML source files (configurable via srcDir)
  com/machineblocks/bricks/
    StandardBrick.mbml        — block definition
    StandardBrickSet.mbml     — set definition
    StandardBrickPresets.mbml — block presets

scad/                         — SCAD output files (configurable via outDir)
  com/machineblocks/bricks/
    StandardBrick.scad        — compiled block
    StandardBrick.json        — compiled presets (OpenSCAD Customizer format)
    StandardBrickSet.scad     — compiled set
```

Root element of the MBML file determines the document type — not the filename or path.

---

## SCAD Output per Document Type

```text
<block>        → scad/com/.../ClassName.scad
                 Block module + customizer

<set>          → scad/com/.../ClassName.scad
                 Assembly instructions: all block instances
                 positioned with assembly/renderGroups logic

<blockPresets> → scad/com/.../ClassName.json
                 OpenSCAD Customizer preset file
                 Same name as the referenced block's SCAD output
```

---

## Configuration Files

### `mbc.config.json`

Project-level configuration:

```json
{
  "srcDir": "src",
  "outDir": "scad",
  "mbLibPath": "../machineblocks",
  "activeConfig": "prusa_pla"
}
```

### `mbc-cli.config.json`

CLI-level configuration (command names, argument names, shortcuts):

```json
{
  "commands": {
    "compile": "compile",
    "watch": "watch",
    "validate": "validate",
    "activateConfig": "activate-config"
  }
}
```

---

## Config Profiles

Config profiles are project-wide parameter presets that define hardware-specific or rendering-specific defaults (printer calibration, filament shrinkage, scale, etc.).

They use the same format as `<blockPresets>` and share the same parameter namespace as block properties.

```text
config/prusa_pla.mbml   — printer + filament profile
config/scale_2x.mbml    — scale profile
```

Only one config profile is active at a time:

```bash
mbc activate-config prusa_pla
```

Merge priority (ascending):

```text
configProfile < blockPreset < inline property
```

---

## Documentation Architecture

```text
01_system.md           — this document (architecture, packages, conventions)
02_mbml.md             — MBML format, document types, namespaces, schema
03_mbom.md             — MBOM object model, properties, aggregations, expressions
04_types.md            — MBOM type system, serialization rules
05_scad_renderer.md    — MBOM→SCAD mapping, assembly patterns, naming, source maps
06_compiler.md         — compiler pipeline, error handling, testing strategy
07_cli.md              — CLI commands, configuration, watch mode, scaffolding
09_mbom_properties.yml — native property definitions (authoritative)

docs/
  scad-reference/      — Git Submodule: MachineBlocks V3 SCAD Library Docs
```

`09_mbom_properties.yml` is the authoritative source for all native MBOM property definitions (types, defaults, constraints). The Markdown documents explain concepts, relationships, and decision logic.
