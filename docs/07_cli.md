# MachineBlocks Compiler — CLI

version: 1.0.0

## Purpose of this Document

This document defines the `mbc` CLI tool — its commands, configuration files, watch mode, scaffolding, and config profile management.

For the compiler pipeline see `06_compiler.md`.
For the project file structure see `01_system.md`.

---

## Overview

The CLI is implemented in `@machineblocks/cli-tools`. It is Node.js-only — it may use `fs`, `path`, `chokidar`, and other Node-only APIs. The CLI wraps `@machineblocks/compiler` and adds file system operations, watching, and scaffolding.

Command names, argument names, and shorthand flags are configurable via `mbc-cli.config.json`.

---

## Commands

### `mbc new block`

Scaffolds a new block definition file with the required structure.

```bash
mbc new block <fqn> [--format mbml|json]
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

### `mbc compile`

Compiles one or all MBML source files to SCAD.

```bash
# Compile a single file
mbc compile <file>

# Compile all files in srcDir
mbc compile --all
```

```text
<file>    — path to a .mbml or .json file
--all     — compile all source files in srcDir
--src     — override srcDir (default: from mbc.config.json)
--out     — override outDir (default: from mbc.config.json)
```

Output files are placed in `outDir` preserving the package directory structure:

```text
src/com/martianmicro/anyclosure/Wall.mbml
→  scad/com/martianmicro/anyclosure/Wall.scad
→  scad/com/martianmicro/anyclosure/Wall.scad.map
```

For `<blockPresets>` documents:

```text
src/com/martianmicro/anyclosure/WallPresets.mbml
→  scad/com/martianmicro/anyclosure/Wall.json
```

Exit codes:

```text
0  — success
1  — compiler errors
2  — configuration error
```

---

### `mbc validate`

Validates one or all MBML source files without producing SCAD output.

```bash
mbc validate <file>
mbc validate --all
```

Runs the full compiler pipeline up to and including the Semantic Validator (stages 1–8). Reports all diagnostics. Produces no output files.

---

### `mbc inspect`

Prints the MBOM representation of a compiled MBML file for debugging.

```bash
mbc inspect <file>
```

Outputs a human-readable dump of the MBOM object graph produced from the given MBML file. No SCAD output is produced.

---

### `mbc watch`

Watches the source directory and recompiles changed files automatically.

```bash
mbc watch [--src <dir>] [--out <dir>]
```

```text
--src   — source directory to watch (default: srcDir from mbc.config.json)
--out   — output directory (default: outDir from mbc.config.json)
```

Behavior:

```text
- On startup: compiles all files in srcDir (equivalent to mbc compile --all)
- On file change: recompiles the changed file only
- On file add: compiles the new file
- On file delete: removes the corresponding output file(s)
- Prints diagnostics to stdout for each compilation
- Continues running until interrupted (Ctrl+C)
```

Conceptually equivalent to TypeScript watch mode (`tsc --watch`).

---

### `mbc activate-config`

Sets the active config profile for the project.

```bash
mbc activate-config <profileName>
```

```text
<profileName>  — name of the config profile (without path or extension)
                 Profile file must exist at src/config/<profileName>.mbml
```

Updates `mbc.config.json`:

```json
{
  "activeConfig": "prusa_pla"
}
```

Only one config profile is active at a time. Activating a new profile replaces the previous one.

---

## Configuration Files

### `mbc.config.json`

Project-level configuration. Located at the project root.

```json
{
  "srcDir":      "src",
  "outDir":      "scad",
  "mbLibPath":   "../machineblocks",
  "activeConfig": "prusa_pla"
}
```

| Field | Default | Description |
|---|---|---|
| `srcDir` | `"src"` | Root directory for MBML source files |
| `outDir` | `"scad"` | Root directory for SCAD output files |
| `mbLibPath` | — | Path to the MachineBlocks V3 SCAD Library (required) |
| `activeConfig` | `null` | Name of the active config profile |

`mbLibPath` is used to generate import paths in SCAD output:

```scad
use <{relative_mbLibPath}/lib/block.scad>;
include <{relative_mbLibPath}/config/mb_config.scad>;
```

The path is resolved relative to each output SCAD file's location.

---

### `mbc-cli.config.json`

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

Config profiles define project-wide hardware or rendering defaults. They use the same format as `<blockPresets>` and share the same property namespace as block properties.

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

When a config profile is active, its values are applied with the lowest priority:

```text
configProfile < blockPreset < inline property
```

A property set inline on a block instance always wins over a preset, which always wins over the config profile.

### Activation

```bash
mbc activate-config prusa_pla
```

Sets `"activeConfig": "prusa_pla"` in `mbc.config.json`. The compiler reads the active profile on every compilation run.

---

## Project Directory Layout

```text
<project-root>/
  mbc.config.json
  mbc-cli.config.json

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
          Corner.scad
          Corner.scad.map
          DefaultEnclosureSet.scad
          DefaultEnclosureSet.scad.map
          Wall.json                      ← compiled from WallPresets.mbml

  docs/
    scad-reference/                      ← Git Submodule
```

---

## Diagnostics Output

The CLI prints diagnostics to stdout in a human-readable format:

```text
ERROR  [MBML_UNKNOWN_TYPE]  src/com/martianmicro/anyclosure/Wall.mbml:12:5
  Referenced type 'com.machineblocks.bricks.UnknownBrick' not found.

WARNING  [MBML_UNKNOWN_PROPERTY]  src/com/martianmicro/anyclosure/Wall.mbml:18:3
  Property 'myCustomProp' not found in type definition. Treating as custom property.

✓  src/com/martianmicro/anyclosure/Corner.mbml  →  scad/com/martianmicro/anyclosure/Corner.scad
✗  src/com/martianmicro/anyclosure/Wall.mbml    →  1 error, 1 warning
```

In watch mode, diagnostics are reprinted on every recompilation of a changed file.
