# BOM Compiler — CLI

version: 2.0.0

## Purpose of this Document

This document defines the `bom` CLI tool — its commands, configuration files, watch mode, scaffolding, config profile management, and thumbnail generation.

For the compiler pipeline and Target Registry see `06_compiler.md`.
For the project file structure and library resolution see `01_system.md`.

---

## Overview

The CLI is implemented in `@bom/cli`. It is Node.js-only — it may use `fs`, `path`, `chokidar`, `child_process`, and other Node-only APIs. The CLI wraps `@bom/compiler` and adds file system operations, watching, scaffolding, and (for the SCAD target) thumbnail rendering.

Command names, argument names, and shorthand flags are configurable via `bom-cli.config.json`.

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
bom new block <fqn> [--format mbml|json]
```

```text
<fqn>       — fully qualified name, e.g. com.martianmicro.anyclosure.Wall
--format    — output format: mbml (default) or json
```

Output file location follows the FQN → path convention:

```text
FQN:   com.martianmicro.anyclosure.Wall
File:  src/com/martianmicro/anyclosure/Wall.mbml
```

The generated file contains the minimum required structure:

```xml
<block xmlns="http://www.machineblocks.com/mbml/block.xsd">

  <name>Wall</name>
  <fullQualifiedName>com.martianmicro.anyclosure.Wall</fullQualifiedName>
  <baseType>com.machineblocks.core.Block</baseType>
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
<file>    — path to a .mbml or .json file
<target>  — registered target name, e.g. "scad"
--all     — compile all source files in srcDir
--src     — override srcDir (default: from bom.config.json)
--out     — override outDir (default: from bom.config.json)
--force   — ignore hash cache, recompile everything
```

`--all` processes every `.mbml` file in `srcDir` independently. Each file is evaluated against its stored hash — unchanged artifacts are skipped. There is no special logic for "does this block have a preset?" — every file is checked, the hash decides.

A Block referenced by both a direct `<block>` compile and an implicit compile from a `<blockPresets>` document is only built once — the hash check prevents redundant work.

#### Output by document type (SCAD target)

**`<block>` document:**

```text
src/com/martianmicro/anyclosure/Wall.mbml
→  scad/com/martianmicro/anyclosure/Wall.scad
→  scad/com/martianmicro/anyclosure/Wall.scad.map
```

No thumbnails are generated when compiling a block definition directly.

**`<blockPresets>` document:**

```text
src/com/martianmicro/anyclosure/WallPresets.mbml
→  scad/com/martianmicro/anyclosure/Wall.scad        (implicit compile of referenced block)
→  scad/com/martianmicro/anyclosure/Wall.scad.map
→  scad/com/martianmicro/anyclosure/Wall.json
→  scad/com/martianmicro/anyclosure/Wall__brick-2x4.webp   (one per preset)
→  scad/com/martianmicro/anyclosure/Wall__brick-1x1.webp
```

Compiling a `<blockPresets>` document is the standard entry point for generating visible output. It triggers an implicit compile of the referenced block, then produces the Customizer JSON and one thumbnail per preset.

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

Runs the full compiler pipeline up to and including the Semantic Validator (stages 1–8). Reports all diagnostics. Produces no output files. No target is required — validation is universal.

---

### `bom inspect`

Prints the BOM representation of a compiled BML file for debugging.

```bash
bom inspect <file>
```

Outputs a human-readable dump of the BOM object graph produced from the given BML file. No target output is produced.

---

### `bom watch`

Watches the source directory and recompiles changed files automatically.

```bash
bom watch [--src <dir>] [--out <dir>] <target>
```

```text
<target>  — registered target name, e.g. "scad"
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

Thumbnail generation follows the same rules as `bom compile` — thumbnails are generated automatically when a `<blockPresets>` file changes (SCAD target only).

Conceptually equivalent to TypeScript watch mode (`tsc --watch`).

---

### `bom activate-config`

Sets the active config profile for the project.

```bash
bom activate-config <profileName>
```

```text
<profileName>  — name of the config profile (without path or extension)
                 Profile file must exist at src/config/<profileName>.mbml
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

Thumbnails are generated automatically as part of `bom compile scad` when the input is a `<blockPresets>` document. There is no separate thumbnail command.

### Pipeline

For each preset in the compiled `<blockName>.json`:

```text
1. Resolve preset name → kebab-case filename
     "Brick 2x4"  →  Wall__brick-2x4

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

### Preset Name → Filename

```text
Rule:    lowercase, spaces → "-", strip special characters
Example: "Brick 2x4"  →  "brick-2x4"

Full filename:  {BlockName}__{preset-kebab-name}.webp
Example:        Wall__brick-2x4.webp
```

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

This logic is implemented in `@bom/cli` as `resolveOpenScad.ts`.

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
  "activeConfig":  "prusa_pla"
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

Config profiles define project-wide property defaults. They use the same format as `<blockPresets>` and share the same property namespace as block properties.

### File Location

```text
src/config/prusa_pla.mbml
src/config/scale_2x.mbml
```

### Format

Config profiles use the `<blockPresets>` root element with no `<blockType>` — they apply globally:

```xml
<blockPresets xmlns="http://www.machineblocks.com/mbml/blockPresets.xsd">

  <fullQualifiedName>com.machineblocks.config.PrusaPla</fullQualifiedName>
  <version>1.0.0</version>

  <preset name="default">
    <printerNozzleDiameter>0.4</printerNozzleDiameter>
    <printerLayerHeight>0.2</printerLayerHeight>
  </preset>

</blockPresets>
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
      prusa_pla.mbml
      scale_2x.mbml
    com/
      martianmicro/
        anyclosure/
          Wall.mbml
          Corner.mbml
          DefaultEnclosureSet.mbml
          WallPresets.mbml

  scad/
    com/
      martianmicro/
        anyclosure/
          Wall.scad
          Wall.scad.map
          Wall.json                        ← compiled from WallPresets.mbml
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
ERROR  [BML_UNKNOWN_TYPE]  src/com/martianmicro/anyclosure/Wall.mbml:12:5
  Referenced type 'com.machineblocks.bricks.UnknownBrick' not found.

WARNING  [BML_UNKNOWN_PROPERTY]  src/com/martianmicro/anyclosure/Wall.mbml:18:3
  Property 'myCustomProp' not found in type definition. Treating as custom property.

✓  src/com/martianmicro/anyclosure/Corner.mbml  →  scad/.../Corner.scad
✓  src/com/martianmicro/anyclosure/WallPresets.mbml  →  Wall.scad, Wall.json, 2 thumbnails
✗  src/com/martianmicro/anyclosure/Wall.mbml    →  1 error, 1 warning
```

In watch mode, diagnostics are reprinted on every recompilation of a changed file.
