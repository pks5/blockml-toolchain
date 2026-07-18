# BOM Compiler — CLI

version: 2.0.0

## Purpose of this Document

This document defines the `bom` CLI tool — its commands, configuration files, watch mode, scaffolding, config profile management, and thumbnail generation.

For the compiler pipeline and Target Registry see `06_compiler.md`.
For compiler runtime (bootstrap, RenderContext, compile I/O model) see `14_compiler_runtime.md`.
For the project file structure and library resolution see `01_system.md`.

---

## Overview

The CLI is implemented in `@blockml/cli`. It is Node.js-only — it may use `fs`, `path`, `chokidar`, `child_process`, and other Node-only APIs. The CLI wraps `@blockml/compiler` and adds file system operations, watching, scaffolding, and (for the SCAD target) thumbnail rendering.

**CLI orchestration convention:** one BML file per `compileBmlToOutput` call, writing `RenderOutput.files[]` to disk. This reflects the **MachineBlocks 1→1 convention**, not a BlockML platform rule. Targets may return empty `files[]` or side effects — the CLI handles each target's output shape accordingly.

Command names, argument names, and shorthand flags are configurable via `bom-cli.config.json`.

---

## Runtime Bootstrap

Before compile or watch, the CLI bootstraps two registries in a fixed order. See `14_compiler_runtime.md` for full specification.

```text
1. load bom.config.json
2. bootstrapTypeRegistry()   — discover + parse project/library BML (B5)
3. bootstrapTargets()        — register render targets (C3)
4. for each file (or single file):
     shouldSkip(artifact) ? skip : compileBmlToOutput(...)
5. write RenderOutput.files[] to disk
6. generateThumbnails(...)   — preset blocks + SCAD target only (C6)
7. writeStoredHash(...)      — update .bom-cache (C5)
```

Incremental skip checks (step 4) and hash writes (step 7) are CLI-only. See `14_compiler_runtime.md` — Incremental Build (C5).

### TypeRegistry bootstrap (B5)

Scans `srcDir` and library paths, parses all BML sources, populates `TypeRegistry`. Required for `bom validate`, `bom inspect`, and `bom compile` when cross-file references exist.

Implemented in `@blockml/cli` as `bootstrapTypeRegistry.ts`.

### Target bootstrap (C3)

Registers render targets in `@blockml/compiler` before stage [9]. **V1:** hardcoded — registers `"machineblocks-v3-scad"` only. Called by `bom compile` and `bom watch`; **not** by `bom validate` or `bom inspect`.

Implemented in `@blockml/cli` as `bootstrapTargets.ts` — idempotent, single entry point. Post-V1 this module will read `bom.config.json` → `targets[]` (field reserved, TBD — not V1).

```typescript
bootstrapTargets();   // V1: MachineBlocksV3ScadTarget only
```

The `<target>` CLI argument remains required in V1. Configurable target lists will define *available* targets later, not replace the explicit argument.

---

## Installation

The BOM Compiler is installed from source by cloning the repository. No npm registry is required.

### 1. Clone and initialize

```bash
git clone https://github.com/.../bom-compiler
cd bom-compiler
git submodule update --init --recursive
```

`git submodule update --init --recursive` initializes all runtime submodules (e.g. `domains/machineblocks/runtimes/scad-lib/`).

### 2. Build and link

```bash
npm install
npm run build
npm link
```

`npm link` makes the `bom` command available globally. This step only needs to be run once.

### 3. Verify

```bash
bom --version
```

### Updating

When pulling new changes from the repository:

```bash
git pull
git submodule update --recursive
npm install
npm run build
```

`npm link` does not need to be repeated after updates.

---

## Commands

### `bom init`

Initializes a new BOM content project in the current directory.

```bash
bom init
```

Creates the following structure:

```text
./
  bom.config.json       — project configuration (srcDir, outDir, etc.)
  bom-cli.config.json   — CLI configuration (optional, defaults apply)
  src/
    config/             — config profiles go here
```

If `bom.config.json` already exists, the command exits with an error without modifying anything.

---

### `bom new block`

Scaffolds a new block definition file with the required structure.

```bash
bom new block <fqn> [--format bml]   # json deferred (TBD — not V1)
```

```text
<fqn>       — fully qualified name, e.g. com.martianmicro.anyclosure.Wall
--format    — serialization format: bml (XML, default). JSON deferred (TBD — not V1)
```

Output file location follows the FQN → path convention:

```text
FQN:   com.martianmicro.anyclosure.Wall
File:  src/com/martianmicro/anyclosure/Wall.bml
```

The generated file contains the minimum required structure:

```xml
<block xmlns="http://www.machineblocks.com/mbml/block.xsd">

  <name>Wall</name>
  <type>com.martianmicro.anyclosure.Wall</type>
  <baseType>com.machineblocks.bml.core.Block</baseType>
  <version>1.0.0</version>

  <properties>
  </properties>

  <aggregations>
  </aggregations>

  <compositions>
  </compositions>

</block>
```

---

### `bom compile`

Compiles one or all BML source files to a specified render target. Output depends on the document type of the input file and the selected target.

```bash
# Compile a single file
bom compile <file> <target>

# Compile all files in srcDir
bom compile --all <target>
```

```text
<file>    — path to a .bml file. JSON BML deferred (TBD)
<target>  — registered target name, e.g. "machineblocks-v3-scad"
--all     — compile all source files in srcDir
--src     — override srcDir (default: from bom.config.json)
--out     — override outDir (default: from bom.config.json)
--force   — ignore hash cache, recompile everything
```

`--all` processes every `.bml` source file in `srcDir`. Each file is evaluated against its stored hash — unchanged artifacts are skipped.

A Block referenced by both a direct `<block>` compile and an implicit compile from a preset block is only built once — the hash check prevents redundant work.

#### Output by document type (SCAD target)

**`<block>` document:**

```text
src/com/martianmicro/anyclosure/Wall.bml
→  scad/com/martianmicro/anyclosure/Wall.scad
→  scad/com/martianmicro/anyclosure/Wall.scad.map
```

No thumbnails are generated when compiling a block definition directly.

**Preset block** (`baseType="com.machineblocks.bml.core.Block"` with `_presets` composition):

```text
src/com/martianmicro/anyclosure/WallPresets.bml
→  scad/com/martianmicro/anyclosure/Wall.scad        (implicit compile of referenced block types)
→  scad/com/martianmicro/anyclosure/Wall.scad.map
→  scad/com/martianmicro/anyclosure/Wall.json
→  scad/com/martianmicro/anyclosure/Wall__brick-2x4.webp   (one per preset id)
→  scad/com/martianmicro/anyclosure/Wall__brick-1x1.webp
```

Compiling a preset block is a standard entry point for generating Customizer output. It triggers implicit compilation of referenced block types, then produces the Customizer JSON and one thumbnail per preset.

#### Exit codes

```text
0  — success
1  — compiler errors
2  — configuration error (unknown target, missing config, etc.)
```

---

### `bom validate`

Validates one or all BML source files without producing any output.

```bash
bom validate <file>
bom validate --all
```

Runs Stage 1 (parser) and Stage 2 (semantic validator). Reports all diagnostics. Produces no output files. No target is required — validation is universal. Exit code / abort policy is CLI-owned (non-zero on errors).

---

### `bom inspect`

Prints the BOM representation of a compiled BML file for debugging.

```bash
bom inspect <file>
```

Outputs a human-readable dump of the Urmodell (`BomDocument`) produced by parsing the given BML file. No target output is produced. Does not require validation to succeed.

---

### `bom watch`

Watches the source directory and recompiles changed files automatically.

```bash
bom watch [--src <dir>] [--out <dir>] <target>
```

```text
<target>  — registered target name, e.g. "machineblocks-v3-scad"
--src     — source directory to watch (default: srcDir from bom.config.json)
--out     — output directory (default: outDir from bom.config.json)
```

Behavior:

```text
- On startup: compiles all files in srcDir (equivalent to bom compile --all <target>)
- On file change: recompiles the changed file only
- On file add: compiles the new file
- On file delete: removes the corresponding output file(s)
- Prints diagnostics to stdout for each compilation
- Continues running until interrupted (Ctrl+C)
```

Thumbnail generation follows the same rules as `bom compile` — thumbnails are generated automatically when a preset block file changes (SCAD target only).

Conceptually equivalent to TypeScript watch mode (`tsc --watch`).

---

### `bom activate-config`

Sets the active config profile for the project.

```bash
bom activate-config <profileName>
```

```text
<profileName>  — name of the config profile (without path or extension)
                 Profile file must exist at src/config/<profileName>.bml
```

Updates `bom.config.json`:

```json
{
  "activeConfig": "prusa_pla"
}
```

Only one config profile is active at a time. Activating a new profile replaces the previous one.

---

## Thumbnail Generation (SCAD Target)

Thumbnails are **CLI-only** (C6) — not part of `@blockml/compiler` or `RenderOutput`. The compiler produces `.scad` and `.json`; the CLI renders `.webp` afterward using OpenSCAD + Sharp. See `14_compiler_runtime.md` — Thumbnails (C6).

Thumbnails run automatically as part of `bom compile machineblocks-v3-scad` when the input is a preset block. There is no separate thumbnail command.

### Architecture boundary

```text
@blockml/compiler   →  Wall.scad, Wall.scad.map, Wall.json  (RenderOutput.files[])
@blockml/cli        →  Wall__brick-2x4.webp, …               (generateThumbnails.ts)
```

Browser `compileBmlToOutput` never produces thumbnails — no OpenSCAD dependency in the compiler package.

### CLI orchestration

```typescript
if (result.success && isBlockPresetsInput(input)) {
  writeRenderOutputFiles(result.output, config.outDir);
  await generateThumbnails({ scadPath, jsonPath, thumbsDir, openscad });
}
```

If OpenSCAD is not found, compiler artifacts are still written; the CLI reports exit code **2** for the thumbnail step.

### Pipeline

For each preset in the compiled `<blockName>.json`:

```text
1. Use preset id directly as filename component (already kebab-case)
     id: "brick-2x4"  →  Wall__brick-2x4

2. Render PNG via OpenSCAD:
     openscad
       --p  scad/.../Wall.json
       --P  "Brick 2x4"
       -o   <tmpdir>/Wall__brick-2x4.png
       scad/.../Wall.scad

3. Compose WebP via Sharp (Node):
     - Add border
     - Overlay with preset label and branding
     - Resize to half width
     - Save as Wall__brick-2x4.webp in thumbsDir

4. Delete temporary PNG
```

Existing thumbnails are always overwritten without prompting.

### Preset ID → Filename

Thumbnails use the Preset **id** directly — no transformation needed:

```text
Preset id:  brick-2x4
Filename:   Wall__brick-2x4.webp

Full pattern:  {BlockName}__{preset-id}.webp
```

The `id` is kebab-case by convention. No transformation step required. The Preset **`name`** ("Brick 2x4") is used as the OpenSCAD `--P` argument and in the Customizer JSON — not in filenames.

### Output Location

Thumbnails are placed alongside the SCAD output files by default. Configurable via `thumbsDir` in `bom.config.json`:

```json
{
  "thumbsDir": null
}
```

`null` (default) → same directory as the compiled SCAD file (`outDir` structure).
Any path → thumbnails are placed there, mirroring the `outDir` package structure.

---

## OpenSCAD Executable Resolution (SCAD Target)

Thumbnail generation requires a local OpenSCAD installation. The CLI resolves the OpenSCAD executable using the following order (highest priority first):

```text
1. bom.config.json → "openscadPath"   (explicit project override)
2. Environment variable OPENSCAD_PATH
3. OS-specific default paths (checked in order):

   macOS:
     /Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD
     /Applications/OpenSCAD-Preview.app/Contents/MacOS/OpenSCAD

   Windows:
     C:\Program Files\OpenSCAD\openscad.exe
     C:\Program Files (x86)\OpenSCAD\openscad.exe

   Linux:
     /usr/bin/openscad
     /usr/local/bin/openscad
     /snap/bin/openscad

4. PATH lookup:  which openscad  /  where openscad
```

If a path is found but the file is not executable, a dedicated error is reported.
If no path is found, the CLI reports:

```text
ERROR: OpenSCAD executable not found.
  Set "openscadPath" in bom.config.json or the OPENSCAD_PATH environment variable.
```

This logic is implemented in `@blockml/cli` as `resolveOpenScad.ts`.

---

## Configuration Files

### `bom.config.json`

Project-level configuration. Located at the project root.

```json
{
  "srcDir":        "src",
  "outDir":        "scad",
  "thumbsDir":     null,
  "mbLibPath":     null,
  "openscadPath":  null,
  "activeConfig":  "prusa_pla",
  "bmlExtensions": [".bml"]
}
```

| Field | Default | Description |
|---|---|---|
| `srcDir` | `"src"` | Root directory for BML source files |
| `outDir` | `"scad"` | Root directory for target output files |
| `thumbsDir` | `null` | Output directory for thumbnails. `null` = alongside output files in `outDir` |
| `mbLibPath` | `null` | Path to the MachineBlocks V3 SCAD Library root (`scad-lib/`). `null` = resolved from bom executable location |
| `openscadPath` | `null` | Path to the OpenSCAD executable. `null` = auto-resolved |
| `activeConfig` | `null` | Name of the active config profile |
| `bmlExtensions` | `[".bml"]` | File suffixes scanned by `compile --all` / `validate --all` |
| `targets` | *(not V1)* | **Reserved (TBD).** Future: target names to bootstrap via `bootstrapTargets()`. V1 ignores this field. |

---

### `bom-cli.config.json`

CLI-level configuration. Located at the project root. All fields are optional — defaults apply when absent.

```json
{
  "commands": {
    "new":            "new",
    "compile":        "compile",
    "validate":       "validate",
    "inspect":        "inspect",
    "watch":          "watch",
    "activateConfig": "activate-config"
  },
  "args": {
    "format":  "--format",
    "all":     "--all",
    "src":     "--src",
    "out":     "--out"
  },
  "shortcuts": {
    "format":  "-f",
    "all":     "-a",
    "src":     "-s",
    "out":     "-o"
  }
}
```

Command names, argument names, and shorthand flags can all be renamed. This allows projects and teams to use their preferred CLI conventions, and enables extension packages to register additional commands.

---

## Config Profiles

Config profiles define project-wide property defaults. They are preset blocks and share the same property namespace as block properties.

### File Location

```text
src/config/prusa_pla.bml
src/config/scale_2x.bml
```

### Format

```xml
<block xmlns="http://blockml.org/schema/block" ...>

  <name>PrusaPla</name>
  <type>com.machineblocks.bml.config.PrusaPla</type>
  <baseType>com.machineblocks.bml.core.Block</baseType>
  <version>1.0.0</version>

  <composition aggregation="_presets">
    <ConfigBlock bml:id="default" name="Default" ... />
  </composition>

</block>
```

### Merge Order

```text
configProfile < blockPreset < inline property
```

A property set inline on a block instance always wins over a preset, which always wins over the config profile.

### Activation

```bash
bom activate-config prusa_pla
```

Sets `"activeConfig": "prusa_pla"` in `bom.config.json`. The compiler reads the active profile on every compilation run.

---

## Project Directory Layout

```text
<project-root>/
  bom.config.json
  bom-cli.config.json

  src/
    config/
      prusa_pla.bml
      scale_2x.bml
    com/
      martianmicro/
        anyclosure/
          Wall.bml
          Corner.bml
          DefaultEnclosureSet.bml
          WallPresets.bml

  scad/
    com/
      martianmicro/
        anyclosure/
          Wall.scad
          Wall.scad.map
          Wall.json                        ← compiled from WallPresets.bml
          Wall__brick-2x4.webp             ← thumbnail per preset
          Wall__brick-1x1.webp
          Corner.scad
          Corner.scad.map
          DefaultEnclosureSet.scad
          DefaultEnclosureSet.scad.map
```

---

## Diagnostics Output

The CLI prints diagnostics to stdout in a human-readable format:

```text
ERROR  [BML_UNKNOWN_TYPE]  src/com/martianmicro/anyclosure/Wall.bml:12:5
  Referenced type 'com.machineblocks.bml.bricks.UnknownBrick' not found.

WARNING  [BML_UNKNOWN_PROPERTY]  src/com/martianmicro/anyclosure/Wall.bml:18:3
  Property 'myCustomProp' not found in type definition. Treating as custom property.

✓  src/com/martianmicro/anyclosure/Corner.bml  →  scad/.../Corner.scad
✓  src/com/martianmicro/anyclosure/WallPresets.bml  →  Wall.scad, Wall.json, 2 thumbnails
✗  src/com/martianmicro/anyclosure/Wall.bml    →  1 error, 1 warning
```

In watch mode, diagnostics are reprinted on every recompilation of a changed file.
