# BOM Compiler — CLI

version: 2.1.0

## Purpose of this Document

This document defines the `blockml` CLI tool — its commands, configuration files, watch mode, scaffolding, config profile management, and (where applicable) post-compile hooks. The command name is the product (`blockml`); BOM remains the object model (`@blockml/bom`). Project config stays `bom.config.json` in V1.

For the compiler pipeline and Target Registry see `06_compiler.md`.
For compiler runtime (bootstrap, RenderContext, compile I/O model) see `14_compiler_runtime.md`.
For the project file structure and library resolution see `00_system.md`.
For the recommended **domain host** pattern see [Dual CLI model](#dual-cli-model) and `00_system.md` — Zielbild.

---

## Dual CLI model

```text
@blockml/cli  (blockml)           — universal toolchain CLI (THIS REPO)
  validate · compile blockdoc|xsd|fatblock · watch · scaffold
  domain-agnostic; targets[] / plugins; no MachineBlocks hardcoding

@machineblocks/cli                — thin MachineBlocks host (MACHINEBLOCKS MONO-REPO)
  depends on @blockml/* packages
  registerTarget(MachineBlocksV3ScadTarget)
  MB defaults (mbLibPath, SCAD thumbnails, …)
  MB users check out one repo → full product chain
```

**Recommended for MachineBlocks users:** use `@machineblocks/cli` from the MachineBlocks mono-repo. They do not need to clone this BlockML repo.

**Interop:** when `@machineblocks/machineblocks-v3-scad-target` is installed, a future plugin loader may allow `blockml compile machineblocks-v3-scad`. That is optional; product UX stays with the domain CLI.

> **OUT OF SCOPE for `@blockml/cli` implementation:** MachineBlocks-specific defaults, OpenSCAD thumbnail pipeline as a hard dependency, bundling the SCAD library, or shipping `@machineblocks/*` under this repo. Sections below that still describe SCAD/MB behaviour are **transitional Blaupause** text pending move to MachineBlocks docs / `@machineblocks/cli`.

---

## Overview

The CLI is implemented in `@blockml/cli`. It is Node.js-only — it may use `fs`, `path`, `chokidar`, `child_process`, and other Node-only APIs. The CLI wraps `@blockml/compiler` and adds file system operations, watching, scaffolding, and optional post-compile hooks. Domain hosts (e.g. `@machineblocks/cli`) may own domain-specific post-steps such as SCAD thumbnails.

**CLI orchestration:** builds a `CompileRequest` per target kind, then calls `compileToOutput`. Document targets loop one file per call; library/corpus targets (BlockDoc, XSD) use one scope-based call per run. See `14_compiler_runtime.md` — Compile Scope (C7).

Command names, argument names, and shorthand flags are configurable via `bom-cli.config.json`.

---

## Runtime Bootstrap

Before compile or watch, the CLI bootstraps two registries in a fixed order. See `14_compiler_runtime.md` for full specification.

```text
1. load bom.config.json
2. bootstrapTypeRegistry()   — discover + parse project/library BML (B5)
3. bootstrapTargets()        — register render targets (C3)
4. build CompileRequest from target.accepts + flags + config
   document target + <file>  →  scope.kind = document
   document target + --all   →  loop srcDir (one request per file)
   library/corpus target     →  scope.kind = auto (libraries[] + srcDir fallback)
5. shouldSkip(artifact) ? skip : compileToOutput(request, target, options)
6. write RenderOutput.files[] to disk
7. generateThumbnails(...)   — preset blocks + SCAD target only (C6)
8. writeStoredHash(...)      — update .bom-cache (C5)
```

Incremental skip checks (step 4) and hash writes (step 7) are CLI-only. See `14_compiler_runtime.md` — Incremental Build (C5).

### TypeRegistry bootstrap (B5)

Scans `srcDir`, `libraries[]`, and dependency paths; parses all BML sources; populates `TypeRegistry`. Required for `blockml validate`, `blockml inspect`, and `blockml compile` when cross-file references exist.

Implemented in `@blockml/cli` as `bootstrapTypeRegistry.ts`. **Separate from compile scope** — registry answers “what types exist”; scope answers “what to render” (see `14_compiler_runtime.md` — C7).

### Target bootstrap (C3)

Registers render targets in `@blockml/compiler` before compile. Called by `blockml compile` and `blockml watch`; **not** by `blockml validate` or `blockml inspect`.

**V1 (decided):** `bootstrapTargets()` reads `bom.config.json` → **`targets[]`** and registers those **toolchain** packages. **First / default control target is `blockdoc`**. Domain targets (e.g. MachineBlocks SCAD) are registered by domain thin CLIs — not hardcoded in `@blockml/cli`. See Dual CLI model.

```typescript
bootstrapTargets(config);   // V1: register names from config.targets (default ["blockdoc"])
```

Implemented in `@blockml/cli` as `bootstrapTargets.ts` — idempotent, single entry point.

The `<target>` CLI argument remains **required** on compile/watch — `targets[]` defines what is *available* to bootstrap, not which target this run uses.

See `14_compiler_runtime.md` — Target Bootstrap · `15_dev_setup.md` — Phase C ordering (BlockDoc-first).

---

## Installation

### Universal toolchain (`blockml`)

Clone this repository, then `npm install` (`@blockml/*` workspace packages). Domain libraries such as `@machineblocks/core` may appear as optional dependencies / fixtures — they are **not authored here**.

```bash
git clone https://github.com/.../blockml
cd blockml
npm install
```

### MachineBlocks product chain (recommended for MB users)

> **OUT OF SCOPE for this repo.** Check out the **MachineBlocks mono-repo** and use `@machineblocks/cli` (thin host over `@blockml/*`). One clone covers BML SSOT, SCAD lib, SCAD target, and CLI. See `00_system.md` — Zielbild · `07_cli.md` — Dual CLI model.

### 2. Build and link

```bash
npm install
npm run build
npm link
```

`npm link` makes the `blockml` command available globally. This step only needs to be run once.

### 3. Verify

```bash
blockml --version
```

### Updating

When pulling new changes from the repository:

```bash
git pull
npm install
npm run build
```

`npm link` does not need to be repeated after updates.

---

## Commands

### `blockml init`

Initializes a new BOM content project in the current directory.

```bash
blockml init
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

### `blockml new block`

Scaffolds a new block definition file with the required structure.

```bash
blockml new block <fqn> [--format bml]   # XML only; JSON authoring not planned
```

```text
<fqn>       — fully qualified name, e.g. com.martianmicro.anyclosure.Wall
--format    — serialization format: bml (XML only). JSON authoring is not planned.
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

### `blockml compile`

Compiles to a registered render target. **Input shape depends on the target** — document targets require a `<file>`; library/corpus targets compile from `libraries[]` and/or `srcDir` scope.

```bash
# Document target — single file (SCAD, FatBlock root)
blockml compile <file> <target>

# Document target — all files in srcDir
blockml compile --all <target>

# Library/corpus target — scope from config (BlockDoc, XSD)
blockml compile <target>

# Library/corpus target — explicit Library.bml roots
blockml compile <target> --libraries path/to/Library.bml,path/to/other/Library.bml
```

```text
<file>         — path to a .bml file; required for document targets only
<target>       — registered target name (**decided**):
                 blockdoc | xsd | fatblock | machineblocks-v3-scad
--all          — compile every .bml in srcDir; **document targets only**
--libraries    — comma-separated Library.bml paths (overrides config.libraries[])
--src          — override srcDir (default: from bom.config.json)
--out          — override outDir (default: from bom.config.json)
--force        — ignore hash cache, recompile everything
--no-xsd       — disable XSD schema validation for this run (see § XSD validation escape hatch)
```

**Target ↔ CLI matrix:**

| Target | `<file>` | `--all` | Scope source |
|---|---|---|---|
| `machineblocks-v3-scad` | required | yes (loop srcDir) | `document` |
| `fatblock` | required | yes | `document` |
| `blockdoc` | omit | no (ignored) | `auto`: `libraries[]` → `srcDir` |
| `xsd` | omit | no | `auto`: `libraries[]` |

`--all` processes every `.bml` in `srcDir` **for document targets only**. Each file is hash-checked independently. Library/corpus targets run **once** per invocation and produce a combined output (e.g. one BlockDoc site or merged/per-library sites per `targetOptions.blockdoc.siteMode`).

A Block referenced by both a direct `<block>` compile and an implicit compile from a preset block is only built once — the hash check prevents redundant work (SCAD target).

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

### `blockml validate`

Validates one or all BML source files without producing any output.

```bash
blockml validate <file>
blockml validate --all
```

Runs Stage 1 (parser) and Stage 2 (semantic validator). Reports all diagnostics. Produces no output files. No target is required — validation is universal. Exit code / abort policy is CLI-owned (non-zero on errors).

**XSD checks (when an XSD target / catalog exists):** optional and **always disableable** via CLI **and** config — see § XSD validation escape hatch. Schema validation must never be a hard prerequisite for regenerating `.xsd` via the XSD Render Target after intentional BML/meta changes. See `13_bml_to_bom_mapping.md` — B8 · `00_system.md` — XSD Schema Structure.

---

### `blockml inspect`

Prints the BOM representation of a compiled BML file for debugging.

```bash
blockml inspect <file>
```

Outputs a human-readable dump of the Urmodell (`BomDocument`) produced by parsing the given BML file. No target output is produced. Does not require validation to succeed.

---

### `blockml watch`

Watches the source directory and recompiles changed files automatically.

```bash
blockml watch [--src <dir>] [--out <dir>] <target>
```

```text
<target>  — registered target name, e.g. "machineblocks-v3-scad"
--src     — source directory to watch (default: srcDir from bom.config.json)
--out     — output directory (default: outDir from bom.config.json)
```

Behavior (document targets — e.g. SCAD):

```text
- On startup: compiles all files in srcDir (equivalent to blockml compile --all <target>)
- On file change: recompiles the changed file only
- On file add: compiles the new file
- On file delete: removes the corresponding output file(s)
- Prints diagnostics to stdout for each compilation
- Continues running until interrupted (Ctrl+C)
```

Behavior (library/corpus targets — e.g. BlockDoc):

```text
- On startup: one scope compile (equivalent to blockml compile <target>)
- On any .bml change under watched roots: recompile the whole scope (site regen)
- On file delete: remove stale HTML if target tracks deletions
```

Thumbnail generation follows the same rules as `blockml compile` — thumbnails are generated automatically when a preset block file changes (SCAD target only).

Conceptually equivalent to TypeScript watch mode (`tsc --watch`).

---

### `blockml activate-config`

Sets the active config profile for the project.

```bash
blockml activate-config <profileName>
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

Thumbnails run automatically as part of `blockml compile machineblocks-v3-scad` when the input is a preset block. There is no separate thumbnail command.

### Architecture boundary

```text
@blockml/compiler   →  Wall.scad, Wall.scad.map, Wall.json  (RenderOutput.files[])
@blockml/cli        →  Wall__brick-2x4.webp, …               (generateThumbnails.ts)
```

Browser `compileToOutput` never produces thumbnails — no OpenSCAD dependency in the compiler package.

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
  "libraries":     [],
  "targetOptions": {},
  "thumbsDir":     null,
  "mbLibPath":     null,
  "openscadPath":  null,
  "activeConfig":  "prusa_pla",
  "bmlExtensions": [".bml"]
}
```

| Field | Default | Description |
|---|---|---|
| `srcDir` | `"src"` | Root directory for project BML; corpus-scope fallback for BlockDoc |
| `outDir` | `"scad"` | Root directory for target output files |
| `libraries` | `[]` | Paths to `Library.bml` catalog roots for library-scope compiles (BlockDoc, XSD). CLI `--libraries` overrides per run |
| `targetOptions` | `{}` | Per-target opaque options; keys = registry names (e.g. `"blockdoc": { "siteMode": "merged" }`). Typed in each target package |
| `thumbsDir` | `null` | Output directory for thumbnails. `null` = alongside output files in `outDir` |
| `mbLibPath` | `null` | Path to the MachineBlocks V3 SCAD Library root (`node_modules/@machineblocks/core/`). `null` = resolved from blockml executable location |
| `openscadPath` | `null` | Path to the OpenSCAD executable. `null` = auto-resolved |
| `activeConfig` | `null` | Name of the active config profile |
| `bmlExtensions` | `[".bml"]` | File suffixes scanned by `compile --all` / `validate --all` |
| `xsdValidation` | `true` (when schemas exist) | When `false`, skip optional XSD schema validation of authoring. Ignored until XSD validation exists. See § XSD validation escape hatch |
| `targets` | `["blockdoc"]` | **V1.** Registry names to bootstrap via `bootstrapTargets()`. CLI `<target>` still required per run. Missing field → default `["blockdoc"]`. See § Target list |

Example BlockDoc project:

```json
{
  "outDir": "doc",
  "libraries": [
    "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml"
  ],
  "targets": ["blockdoc"],
  "targetOptions": {
    "blockdoc": {
      "siteMode": "merged",
      "outLayout": "fqn"
    }
  }
}
```

Compile: `blockml compile blockdoc` → static HTML under `doc/`. BlockDoc options/layout/page rules SSOT: `org.blockml.bml.target.blockdoc.documentation.Introduction`. Host scope wiring: `14_compiler_runtime.md` — Compile Scope (C7).

#### Target list (`targets[]`) — **V1 decided**

```json
{
  "targets": ["blockdoc"]
}
```

| Rule | Detail |
|---|---|
| **Purpose** | Which Render Targets this project **loads** into the Target Registry |
| **Not** | Which target a given `blockml compile` uses — that remains the CLI `<target>` argument |
| **Default** | `["blockdoc"]` when omitted — BlockDoc is the V1 **control** target |
| **Allowed names (this repo / `@blockml/cli`)** | `blockdoc`, `xsd`, `fatblock` (toolchain targets) |
| **Domain names** | e.g. `machineblocks-v3-scad` — registered by **domain hosts** (`@machineblocks/cli`) or a future plugin loader; **not** authored in this repo |
| **`blockml init`** | Scaffold includes `"targets": ["blockdoc"]` |

Example multi-target **toolchain** project:

```json
{ "targets": ["blockdoc", "xsd", "fatblock"] }
```

MachineBlocks product projects use `@machineblocks/cli` (or install the SCAD target as a plugin). See Dual CLI model · `00_system.md` — Zielbild.
#### XSD validation escape hatch (**decided**)

Optional authoring checks against generated / catalog `.xsd` (after the XSD Render Target exists) must always be disableable:

| Mechanism | Form | Role |
|---|---|---|
| **Config** | `bom.config.json` → `"xsdValidation": false` | Project default off (e.g. during meta refactors) |
| **CLI** | `--no-xsd` on `blockml compile` / `blockml validate` (and other commands that run XSD checks) | Per-run off |

**Precedence:**

```text
No schemas / Phase A          →  XSD validation N/A (not a Stage-1 requirement)
xsdValidation omitted/true    →  on (once schemas exist)
xsdValidation: false          →  off for the project
CLI --no-xsd                  →  off for this invocation (overrides config on)
```

`--no-xsd` does **not** disable the XSD **Render Target** itself (`blockml compile … xsd`) — only validation of authoring against schemas.

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
<block xmlns="http://blockml.org/bml" ...>

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
blockml activate-config prusa_pla
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
