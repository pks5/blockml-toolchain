# MachineBlocks Compiler — System

version: 1.0.0

## Purpose

This documentation describes the MachineBlocks Compiler project (`mbc`) — the toolchain that translates MBML (MachineBlocks Markup Language) source files into SCAD render target files via MBOM (MachineBlocks Object Model).

MBOM is a domain-specific specialization of BOM Core (`00_bom_core.md`) — the abstract, domain-agnostic object model for parametric, composable units. BOM Core defines the structural foundation (Block, Preset, Set, Place, Step, Library, Catalog, Expression system). MBOM extends it with MachineBlocks-specific types, properties, and the SCAD render target.

The MachineBlocks V3 SCAD Library is the reference render target. It is included as a Git Submodule at `machineblocks/` in the MBC installation directory.

---

## Architecture

MachineBlocks follows a layered architecture:

```text
MBML Source (.mbml / .json)
  ↓ parse + validate
MBOM (MachineBlocks Object Model)   ←  specializes BOM Core
  ↓ compile
SCAD Render Target  ←  machineblocks/docs/scad-reference/
  ↓ render
STL / 3MF
```

**MBML** is the declarative authoring format. It is XML-based (reference format) with JSON as an equally supported alternative. Block definitions, sets, and presets are all authored in MBML.

**MBOM** is the canonical, typed object model. It is the internal representation of all block data. MBOM is renderer-independent — it has no knowledge of SCAD syntax or parameters. MBOM is a domain-specific specialization of BOM Core — it extends the abstract Block, Set, Place, Step, Library, and Catalog concepts with MachineBlocks-specific types and properties.

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

## Tool vs. Content

`mbc` is a standalone tool — it is installed or cloned once and used across multiple content projects. Content projects (MBML sources, SCAD output) live in separate directories and are not part of the MBC repository.

```text
~/.../machineblocks-compiler/   ← MBC tool (installed once)
~/.../my-enclosure-project/     ← content project (MBML sources, SCAD output)
~/.../another-project/          ← another content project
```

This is analogous to `tsc` or `webpack` — the tool is global, content projects each have their own `mbc.config.json`.

---

## Monorepo Structure

```text
machineblocks-compiler/
  packages/
    mbom/           — MBOM object model, type registry, expression AST, validation
    mbml/           — XML/JSON parser, namespace resolver, MBML→MBOM mapper
    scad-renderer/  — MBOM→SCAD compiler, settings renderer, assembly patterns
    compiler/       — Facade: compileMbmlToScad(), compileMbomToScad()
    cli-tools/      — Node-only: mbc CLI commands, file watcher, thumbnail renderer

  machineblocks/    — Git Submodule: MachineBlocks V3 SCAD Library (full repository)
    lib/            — SCAD Library source
    examples/       — example SCAD files (useful for compiler development and testing)
    docs/
      scad-reference/ — SCAD API reference docs (used by renderer and compiler)

  README.md
```

### Why the full repository?

The entire MachineBlocks V3 SCAD Library repository is included as a submodule — not just the `docs/` folder — because:

- `machineblocks/lib/` is the runtime the generated SCAD files depend on
- `machineblocks/examples/` provides verified SCAD output for correctness testing
- `machineblocks/docs/scad-reference/` is the API reference for the renderer

Git does not support including only a subdirectory of a foreign repository as a submodule. Including the full repository is the pragmatic and reliable choice.

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
- Reference: machineblocks/docs/scad-reference/
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
- OpenSCAD executable resolver
- Thumbnail renderer (Sharp-based, Node-only)
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

### Thumbnail File Names

Thumbnails are generated per preset. The naming schema is:

```text
{BlockName}__{preset-name-in-kebab-case}.webp

Examples:
  Wall__brick-2x4.webp
  Wall__brick-1x1.webp
  StandardBrick__standard-2x4-yellow.webp
```

Preset name transformation: lowercase, spaces replaced with `-`, special characters stripped.

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
    StandardBrick.scad.map    — source map
    StandardBrick.json        — compiled presets (OpenSCAD Customizer format)
    StandardBrick__brick-2x4.webp  — thumbnail per preset
    StandardBrick__brick-1x1.webp
    StandardBrickSet.scad     — compiled set
```

Thumbnail files are placed alongside the SCAD output by default. The output directory for thumbnails is configurable via `thumbsDir` in `mbc.config.json`.

Root element of the MBML file determines the document type — not the filename or path.

---

## SCAD Output per Document Type

```text
<block>        → scad/com/.../ClassName.scad
                 scad/com/.../ClassName.scad.map
                 Block module + customizer. No thumbnails.

<set>          → scad/com/.../ClassName.scad
                 scad/com/.../ClassName.scad.map
                 Assembly instructions. No thumbnails.

<blockPresets> → scad/com/.../ClassName.scad        (implicit compile of referenced block)
                 scad/com/.../ClassName.scad.map
                 scad/com/.../ClassName.json         (OpenSCAD Customizer preset file)
                 scad/com/.../ClassName__{preset}.webp  (one thumbnail per preset)
```

Compiling a `<blockPresets>` document is the standard entry point when generating visible output. It triggers compilation of the referenced block and produces all artifacts in one step.

---

## Configuration Files

### `mbc.config.json`

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

## Library Resolution

The MachineBlocks V3 SCAD Library (`machineblocks/`) is bundled with the MBC installation as a Git Submodule. Content projects do not need to install or reference the library separately.

Resolution order for the library path:

```text
1. mbc.config.json → "mbLibPath"  (explicit override, highest priority)
2. Environment variable MACHINEBLOCKS_LIB_PATH
3. Resolved relative to the mbc executable:
     path.join(dirname(mbc_executable), "../machineblocks")
```

If none of the above yields a valid library path, the CLI reports a clear error:

```text
ERROR: MachineBlocks V3 SCAD Library not found.
  Set "mbLibPath" in mbc.config.json or MACHINEBLOCKS_LIB_PATH to the library root.
```

This resolution is implemented in `@machineblocks/cli-tools` as `resolveMbLib.ts`.

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
00_bom_core.md         — BOM Core abstract model (Block, Set, Library, Catalog, ...)
01_system.md           — this document (architecture, packages, conventions)
02_mbml.md             — MBML format, document types, namespaces, schema
03_mbom.md             — MBOM object model, properties, aggregations, expressions
04_types.md            — MBOM type system, serialization rules
05_scad_renderer.md    — MBOM→SCAD mapping, assembly patterns, naming, source maps
06_compiler.md         — compiler pipeline, error handling, testing strategy
07_cli.md              — CLI commands, configuration, watch mode, scaffolding
09_mbom_properties.yml — native property definitions (authoritative)

machineblocks/                    — Git Submodule: MachineBlocks V3 SCAD Library
  docs/
    scad-reference/               — SCAD API reference (used by renderer)
  lib/                            — SCAD Library runtime
  examples/                       — example SCAD files (used in correctness tests)
```

`09_mbom_properties.yml` is the authoritative source for all native MBOM property definitions (types, defaults, constraints). The Markdown documents explain concepts, relationships, and decision logic.
