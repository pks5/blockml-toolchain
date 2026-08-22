# Compiler Runtime

version: 0.9.0

## Purpose of this Document

This document defines the **compiler runtime** — how `@blockml/compiler`, host CLIs (`@blockml/cli` and thin domain CLIs such as `@machineblocks/cli`), and render targets orchestrate parsing, validation, and rendering after the BOM model and BML mapping rules are fixed.

For BOM types see `12_bom_object_model.md`.
For BML mapping see `13_bml_to_bom_mapping.md`.
For SCAD rendering details see `05_scad_renderer.md` (**OUT OF SCOPE** for this repo — MachineBlocks mono-repo).
For pipeline stages see `06_compiler.md`.
For repo / domain ownership see `00_system.md` — Zielbild.

> **MachineBlocks sections below** (NativeBlock / `mb_block`, SCAD I/O conventions, thumbnails prerequisites) describe the **reference domain Blaupause**. They are **not** BlockML core rules and are **out of scope for implementation in this repo**. Normative home: MachineBlocks mono-repo + `@machineblocks/*` packages.

---

## Design Decisions (Phase C)

| Topic | Decision |
|---|---|
| **Compile I/O (C4)** | **BlockML:** no mandatory input↔output mapping; targets define cardinality (0..n files, side effects). **MachineBlocks convention (domain):** 1 BML → 1 primary SCAD (+ side artifacts) |
| **Compile scope (C7)** | **Decided:** unified `compileToOutput(CompileRequest, …)`; scope kinds `document` \| `library` \| `corpus` \| `auto`; targets declare `accepts[]`; `targetOptions` opaque at compiler, typed per target |
| **NativeBlock = mb_block** | **MachineBlocks convention (domain, out of scope here):** `com.machineblocks.bml.core.NativeBlock` maps to SCAD `mb_block()` — not a global BlockML rule |
| **Composition leaves** | **MachineBlocks convention (domain):** leaf geometry → `mb_block()` — authored as `<core:NativeBlock>` or lowered from domain instances |
| **Sub-Blocks** | Same-document Sub-Blocks → sub-modules embedded in the parent output SCAD file *(MB convention)* |
| **Library blocks** | Pre-rendered `.scad` in scad-lib; re-compiled only when their own `.bml` is compiled *(MB convention)* |
| **JSON BML authoring** | **Not planned** — not equivalent to XML; not V1/V2; may never ship (`02_mbml.md`) |
| **Facade API (C2)** | **`compileToOutput(CompileRequest, targetName, CompileOptions)`** — single Stage-3 entry; `compileBmlToOutput` = document-scope sugar; explicit `TypeRegistry`; host CLI writes files |
| **Target bootstrap (C3)** | V1: `bom.config.json` → `targets[]` (default `["blockdoc"]` for `@blockml/cli`); CLI `<target>` still required per run. Domain CLIs register their own targets (e.g. `@machineblocks/cli` → `machineblocks-v3-scad`) |
| **Host CLIs** | **`@blockml/cli`** = universal toolchain. **Domain thin CLIs** (e.g. `@machineblocks/cli`) = recommended product entry; same `registerTarget` / `compileToOutput` contract |
| **RenderContext (C1)** | `RenderSession` (immutable) + forked `RenderContext` per render node; `PropertyResolver` on-demand; internal API |
| **Thumbnails (C6)** | Host-CLI concern (OpenSCAD + Sharp); not in `RenderOutput`. For MachineBlocks: prefer `@machineblocks/cli` (out of scope for this repo) |
| **Incremental build (C5)** | CLI-only cache (`.bom-cache/`); SHA-256 canonical input hash; skip before compile; dedup by output path |
| **SCAD settings format** | V1 MB convention: pseudo-map `[["key", val], …]`; renderer uses SettingsBundle + pluggable SettingsEmitter; future: OpenSCAD `object()` |

---

## NativeBlock Render Model

> **OUT OF SCOPE (this repo) — MachineBlocks SCAD target only.** Render targets are free in output shape — see `17_type_system_bml.md` — Renderer freedom. Normative implementation home: MachineBlocks mono-repo.

### Core rule

In the MachineBlocks SCAD library, **`mb_block()` is the native geometry primitive** (`lib/block.scad`). In MBOM this is modeled as **`com.machineblocks.bml.core.NativeBlock`**.

```text
MBML:  <core:NativeBlock size="[2, 4, 3]" studs="true" ... />
SCAD:  mb_block(config, settings = [ ["size", [2, 4, 3]], ["studs", true], ... ]);
```

`NativeBlock` is **final** — it cannot be used as `baseType` on a Block definition. It appears only as a composition child. See `03_mbom.md` — NativeBlock.

### Domain blocks → NativeBlock at render time

Composite Block **types** (e.g. `com.machineblocks.bml.bricks.Standard`, `com.martianmicro.anyclosure.Wall`) are Block **definitions** with properties, Sub-Blocks, and composition structure.

When a composition needs **leaf brick geometry**, it is always rendered through **NativeBlock / `mb_block()`** — not through a typed `mb__…__Standard()` module call and not through `use <Standard.scad>`.

Evidence from scad-lib (`Calibrator.scad`):

```text
Calibrator.bml references  bricks:StandardBrick  (many instances)
Calibrator.scad emits       mb_block(config, settings=[...])   — no use <Standard.scad>
```

Domain-typed composition children (e.g. `bricks:StandardBrick`) carry native MB property values. The ScadBlockProcessor **lowers** them to `mb_block()` settings — same as explicit `<core:NativeBlock>`.

```text
Authoring options (equivalent at render time):
  <core:NativeBlock size="[1,1,1]" studs="false" ... />
  <bricks:StandardBrick size="[1,1,1]" studs="false" ... />   → lowered to mb_block()

Both produce:  mb_block(config, settings = [ native property settings ... ])
```

Typed block modules (e.g. `mb__com__machineblocks__scad__bricks__Standard`) exist for **standalone compile** of a Block definition file — Customizer entry point, library artifact — not for composition references.

### Leaf-only blocks — optimize to direct `mb_block()`

Some Block types are **semantically** Composite Blocks but **effectively** a single NativeBlock — all properties map 1:1 to native MB settings with no inner composition structure (e.g. `com.machineblocks.bml.bricks.Standard`).

For **standalone compile** of such blocks, the ScadBlockProcessor **optimizes internally to `mb_block()`** — emitting a direct main call:

```scad
mb_block(config = mb_config, settings = [ ["size", size], ["studs", studs], ... ]);
```

instead of:

```scad
mb__com__machineblocks__scad__bricks__Standard(config, settings = [...]);  // ✗ avoid
  → module extracts mb_param_* …
  → mb_block(...)
```

**Why:** skips the typed module indirection and duplicate parameter extraction — one `mb_block()` call with Customizer variables passed as settings.

```text
Standalone Standard.bml compile:
  Optimized:   Customizer vars → mb_block(config, settings=[...])     ✓
  Not:         Customizer vars → typed module → mb_param_* → mb_block  ✗

Standard referenced inside Calibrator composition:
  Always:      mb_block(config, settings=[...])   (same as NativeBlock)
```

The optimization applies when the BlockProcessor detects a **leaf-only** pattern (no Sub-Blocks, single NativeBlock-equivalent property surface). Composite blocks with real inner structure (Calibrator, Wall) still emit typed modules + sub-modules.

### Composite blocks → typed module + mb_block children

A Composite Block compiles to **one SCAD file** with:

```text
1. Typed entry module     mb__…__Calibrator(config, settings)
2. Sub-Block sub-modules  mb__…__Calibrator__Base(...), …     (same file)
3. Leaf instances         mb_block(...) inside sub-modules     (NativeBlock)
4. Utils Sub-Blocks  inline functions in same file
```

Sub-Blocks are **not** separate output files.

### Wrapper mb_block

When a Composite Block has **2+ composition children**, the processor emits an outer **wrapper** `mb_block()` (layout container, `base=false`, `studs=false`). Children inside are NativeBlock / lowered `mb_block()` calls. See `05_scad_renderer.md` — Wrapper mb_block() Logic.

---

## Compile I/O Model (C4)

BlockML imposes **no fixed relationship** between BML inputs and render outputs. The compiler pipeline ends at **`RenderTarget` + `BlockProcessor`** — they decide what happens after validation.

### BlockML rules (core)

```text
No mandatory 1:1 mapping     — one BML file may produce 0, 1, or many output artifacts
Multi-input → one output     — a processor may consume multiple BomDocuments → one artifact
One input → arbitrary output — a single BML file may emit files, API calls, or nothing
Zero file output is valid    — success with empty files[] and/or side effects only
RenderOutput is opaque       — shape defined per target, not by @blockml/compiler
Facade envelope only         — CompileRequest.scope kind + roots; target interprets payload
                               (document vs library vs corpus — see Compile Scope C7)
```

The compiler **does not** assume every compile produces files on disk. A target may:

```text
Emit text/binary artifacts     →  files[] in RenderOutput (SCAD, JSON, KiCad, …)
Perform side effects only      →  service calls, HTTP deploy, DB writes, message publish
Combine both                   →  files + side effects in one RenderOutput
Return success with no output  →  validate-and-register, dry-run deploy, analysis-only
```

### Architecture layers

```text
@blockml/compiler (generic)
  compileBmlToBom(input)              → BomDocument        (Stage 1+2; always document-scoped)
  compileBomToOutput(model, target)   → RenderOutput       (Stage 3 from one BOM — advanced)
  compileToOutput(request, target)    → RenderOutput       (Stage 1+2+3; normative entry)

RenderTarget (domain-specific)
  accepts: scope kinds the target understands
  render(request, ctx)               → RenderOutput       (target decides cardinality)
  may merge N BomDocuments           → one site / bundle / schema set
  may emit zero files                → side effects only

@blockml/cli (orchestration — not a BlockML rule)
  builds CompileRequest from config + CLI flags + target.accepts
  document targets: loop srcDir files (--all) or single <file>
  library/corpus targets: one compileToOutput per run (no --all file loop)
  writes files[] when present; runs post-steps (thumbnails, cache)
```

### RenderOutput variants (examples)

BOM Core defines only the **`RenderOutput` opaque contract**. Targets choose structure:

```typescript
/** File-based target (MachineBlocks SCAD) */
interface ScadRenderOutput {
  files: ScadFile[]              // may be empty on no-op compile
  sideEffects?: RenderSideEffect[]   // optional — future targets
}

/** Side-effect-only target (illustrative) */
interface DeployRenderOutput {
  files: []                      // intentionally empty
  sideEffects: [
    { kind: "http-post", url: "...", body: "..." },
    { kind: "service-call", service: "com.example.Registry", method: "register" },
  ]
}

/** Multi-input aggregation (illustrative) */
interface BundleRenderOutput {
  files: [{ path: "bundle.scad", content: "..." }]   // merged from N blocks
  sourceInputs: string[]         // provenance — which BML files contributed
}
```

`CompilerResult.success === true` with `output.files.length === 0` is **valid** when the target's job is side effects or registration only.

### Input cardinality

| Pattern | BlockML | Example |
|---|---|---|
| 1 BML → 0 outputs | Allowed | Deploy target registers block metadata via API |
| 1 BML → 1 output | Common | MachineBlocks SCAD default |
| 1 BML → N outputs | Allowed | Preset block → `.scad` + `.json` |
| N BML → 1 output | Allowed | Set/library processor bundles blocks into one file |
| N BML → M outputs | Allowed | Target-defined batch policy |

Stage 3 input is **`CompileRequest`** — a thin envelope (see **Compile Scope (C7)**). The platform does **not** mandate one BML file per compile. Targets declare which scope kinds they accept; the CLI builds the matching request.

**Deprecated pattern (do not use in new text):** implicit multi-input via “pass one file, target pulls the rest from TypeRegistry only”. Library/corpus targets receive an explicit scope.

### MachineBlocks convention (not a BlockML rule)

The **reference SCAD target** follows a project convention that the CLI implements:

```text
Standard case:   1 .bml  →  1 primary .scad (+ .map)
Preset block:       1 presets block  →  .scad + .json (+ CLI thumbnails)
No transitive compile of dependency .scad files into project output
Sub-Blocks embedded in parent .scad — not separate output files
```

Other domains or future targets may differ without changing `@blockml/compiler`.

### Per input file (MachineBlocks SCAD)

```text
blockml compile src/.../Calibrator.bml machineblocks-v3-scad
  → scad/.../Calibrator.scad
  → scad/.../Calibrator.scad.map
  (does NOT emit Standard.scad — even though Calibrator references StandardBrick)
```

```text
blockml compile src/.../Standard.bml machineblocks-v3-scad
  → scad/.../Standard.scad        (standalone library / customizer entry)
```

### Preset compile chain

See Thumbnails (C6) for the full split between compiler and CLI.

```text
WallPresets.bml  (baseType = com.machineblocks.bml.core.Block, _presets composition)
  ── @blockml/compiler (preset block render) ──
  → implicit compile of referenced Wall block → Wall.scad + Wall.scad.map
  → Wall.json (OpenSCAD Customizer)
  ── @blockml/cli (after compile success) ──
  → Wall__brick-2x4.webp, Wall__brick-1x1.webp  (one per preset)
```

Direct `<block>` compile produces `.scad` + `.map` only — no `.json`, no thumbnails.

See `07_cli.md` — Thumbnail Generation.

### TypeRegistry vs. compile scope

External references pin `typeFqn` + `version` for **validation** (strict from V1). They do **not** trigger transitive compilation of dependency `.scad` files into the project output. See `13_bml_to_bom_mapping.md` — Cross-File Resolution.

---

## SCAD Imports (what gets `use <>`)

Every generated SCAD file includes:

```scad
use <{mbLibPath}/lib/block.scad>;      // NativeBlock = mb_block
include <{mbLibPath}/config/mb_config.scad>;
```

Additionally when needed:

```scad
use <{mbLibPath}/blocks/org/blockml/bml/service/Math.scad>;   // #built-in, when not native-mapped
```

**Not generated** for composition children:

```scad
use <../bricks/Standard.scad>;   // ✗ — domain leaves use mb_block(), not typed module imports
```

Block-to-block `use` imports apply to **Set `_blocks` dispatch** (block configurations referenced by `blockId`) — to be specified when Set MBML examples land in scad-lib. Ordinary Composite Block compositions do not import dependency SCAD files.

---

## Compiler Facade API (C2)

`@blockml/compiler` exposes **`compileToOutput`** as the single normative Stage-3 entry. Stage 1–2 helpers remain document-scoped.

The platform defines a **minimal request envelope** only. Targets own input semantics and output cardinality — the compiler does not prescribe “one `.bml` file in, one artifact out” globally.

### Types

```typescript
/** Document payload — used inside CompileScope and by compileBmlToBom */
interface CompileInput {
  source: string
  filePath: string
  format?: "xml"
}

type CompileScopeKind = "document" | "library" | "corpus" | "auto"

interface CompileScope {
  kind: CompileScopeKind

  /** document scope — one .bml file */
  document?: CompileInput

  /** library scope — paths to Library.bml catalog roots */
  libraries?: string[]

  /** corpus scope — directory roots (srcDir scan, blocks/ trees) */
  roots?: string[]

  /** resolve transitive dependencies / subLibraries (default true for library/corpus) */
  includeDependencies?: boolean
}

interface CompileRequest {
  scope: CompileScope
  /** Opaque for @blockml/compiler; typed in each target package (e.g. BlockDocOptions) */
  targetOptions?: unknown
}

interface CompileOptions {
  typeRegistry?: TypeRegistry
  activeConfig?: string
  outputBasePath?: string
  mbLibPath?: string
}

interface CompilerResult<T> {
  output: T | null
  diagnostics: Diagnostic[]
  success: boolean
}

interface RenderTarget {
  name: string
  /** Scope kinds this target accepts — CLI validates before compile */
  accepts: CompileScopeKind[]
  validateRequest?(request: CompileRequest): Diagnostic[]
  render(request: CompileRequest, ctx: RenderContext): RenderOutput
}
```

`CompileOptions` is **session-level** (one compile invocation). Per-block render state is `RenderContext` (C1).

### Functions

```typescript
/** Stage 1 + Stage 2: parse + validate. Always document-scoped. */
compileBmlToBom(
  input: CompileInput,
  options?: CompileOptions
): CompilerResult<BomDocument>

/** Stage 3 from an existing BOM — advanced / tests. */
compileBomToOutput(
  model: BomDocument,
  targetName: string,
  options?: CompileOptions
): CompilerResult<RenderOutput>

/** Normative full pipeline: Stage 1 → 2 → 3. Scope interpreted by target. */
compileToOutput(
  request: CompileRequest,
  targetName: string,
  options?: CompileOptions
): CompilerResult<RenderOutput>

/** Sugar — equivalent to compileToOutput({ scope: { kind: "document", document: input } }, …) */
compileBmlToOutput(
  input: CompileInput,
  targetName: string,
  options?: CompileOptions
): CompilerResult<RenderOutput>
```

### Design rules

```text
TypeRegistry        — explicit in CompileOptions; bootstrap is separate from compile scope
                      (registry = “what types exist”; scope = “what to render now”)

Scope validation    — if request.scope.kind ∉ target.accepts (after auto resolution) →
                      BML_TARGET_SCOPE_MISMATCH

File output         — RenderOutput.files[] with relative paths + content;
                      CLI writes to disk; browser uses content in-memory

Stage 1–2           — always per-document (parse / validate one BomDocument)

Diagnostics         — reference paths from scope (document.filePath or library/roots)
```

### CLI example — document target (SCAD)

```typescript
const registry = bootstrapTypeRegistry({ srcDir, libraries, mbLibPath, bmlExtensions });

const result = compileToOutput(
  {
    scope: {
      kind: "document",
      document: {
        source: fs.readFileSync("src/com/.../Calibrator.bml", "utf8"),
        filePath: "src/com/.../Calibrator.bml",
      },
    },
  },
  "machineblocks-v3-scad",
  {
    typeRegistry: registry,
    outputBasePath: config.outDir,
    mbLibPath: resolveMbLibPath(config),
    activeConfig: config.activeConfig,
  }
);
```

### CLI example — library/corpus target (BlockDoc)

```typescript
const registry = bootstrapTypeRegistry({ srcDir, libraries, mbLibPath, bmlExtensions });

const result = compileToOutput(
  {
    scope: { kind: "auto", libraries: config.libraries, roots: [config.srcDir] },
    targetOptions: config.targetOptions?.blockdoc,
  },
  "blockdoc",
  { typeRegistry: registry, outputBasePath: config.outDir ?? "doc" }
);
```

### Browser example

```typescript
registerTarget(new MachineBlocksV3ScadTarget(new MakerEngine()));

const result = compileToOutput(
  {
    scope: {
      kind: "document",
      document: { source: xmlSource, filePath: "Wall.bml" },
    },
  },
  "machineblocks-v3-scad",
  { typeRegistry: preloadedRegistry }
);
```

---

## Compile Scope (C7)

Compile scope separates **what to render** from **what types exist** (TypeRegistry). Parser and serializer remain strictly **document-scoped** (one file ↔ one `BomDocument`). Stage 3 uses scope kinds:

| Kind | Meaning | Typical targets |
|---|---|---|
| `document` | One `.bml` file | `machineblocks-v3-scad`, `fatblock` (host + `--src` peer pool) |
| `library` | One or more `Library.bml` roots + dependency closure | `blockdoc`, `xsd` |
| `corpus` | Directory roots (`srcDir`, `blocks/` trees) | `blockdoc`, `xsd` |
| `auto` | Resolve from request fields, then config (see below) | CLI default |

### Scope resolution (`kind: "auto"`)

```text
1. request.scope.libraries present?     → library scope (resolve Library graph:
                                             dependencies, subLibraries, blocks[])
2. else request.scope.roots present?      → corpus scope (scan *.bml under roots)
3. else bom.config.json libraries[]       → library scope
4. else bom.config.json srcDir            → corpus scope
5. else                                   → BML_COMPILE_SCOPE_EMPTY
```

**Library-first, directory fallback** — both are first-class. Without a `Library.bml`, all `.bml` files under a root are discovered and registered (existing B5 fallback).

### Target `accepts` matrix (V1)

| Target | `accepts` | Primary scope payload |
|---|---|---|
| `blockdoc` | `library`, `corpus`, `auto` | `libraries[]` and/or `roots[]` |
| `xsd` | `library`, `corpus`, `auto` | Definition / domain `Library.bml` roots and/or corpus roots — **SSOT:** `org.blockml.bml.target.xsd.documentation.Introduction` |
| `fatblock` | `document` | `document` + `targetOptions.srcDir` peer pool — **SSOT:** `org.blockml.bml.target.fatblock.documentation.Introduction` |
| `machineblocks-v3-scad` | `document` | `document` |

CLI behaviour:

```text
document target + <file>     →  compileToOutput({ scope: { kind: "document", document } })
document target + --all      →  loop srcDir; one compileToOutput per file
library/corpus target        →  compileToOutput({ scope: buildFromConfig() }) once
                               (--all is invalid / ignored for library/corpus targets)
```

### BlockDoc target (`@blockml/blockdoc-target`)

**BML library is SSOT:** `packages/blockdoc-target/blocks/org/blockml/bml/target/blockdoc/` — start at `org.blockml.bml.target.blockdoc.documentation.Introduction` → ReadNext chain (options, path/layout, page chrome, site assembly, BD1–BD23).

TypeScript in `packages/blockdoc-target/src/` implements it. Host wiring only here:

- `accepts`: `library` | `corpus` | `auto` (see matrix above)
- Opaque `CompileRequest.targetOptions` → typed as `BlockDocOptions` in the target package
- CLI passes `config.targetOptions?.blockdoc`; default `outDir` for this target is `doc/`

Example `bom.config.json`:

```json
{
  "outDir": "doc",
  "libraries": [
    "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml"
  ],
  "targetOptions": {
    "blockdoc": { "siteMode": "perLibrary" }
  }
}
```

### XSD target (`@blockml/xsd-target`)

**BML library is SSOT:** `packages/xsd-target/blocks/org/blockml/bml/target/xsd/` — start at `org.blockml.bml.target.xsd.documentation.Introduction` → ReadNext chain (particles, vocabularies, catalog, XSD1–XSD18).

TypeScript in `packages/xsd-target/src/` implements it. Host wiring only here:

- `accepts`: `library` | `corpus` | `auto` (see matrix above)
- Opaque `CompileRequest.targetOptions` → typed as `XsdOptions` in the target package
- CLI default `outDir` for this target is `schemas/`; `catalog.xml` via `rootFiles`
- Authoring XSD validation (`--no-xsd` / `xsdValidation`) is CLI-owned — not part of this target

### Scope diagnostics

| Code | When |
|---|---|
| `BML_TARGET_SCOPE_MISMATCH` | Resolved scope kind not in `target.accepts` |
| `BML_COMPILE_SCOPE_EMPTY` | `auto` resolution found no libraries or roots |
| `BML_LIBRARY_RESOLVE_ERROR` | `Library.bml` path missing or invalid graph |

---

## Target Bootstrap (C3)

Before a render target can resolve by name, the caller must populate the **Target Registry** via `registerTarget()`. `@blockml/compiler` ships **no default targets** — targets live in packages (e.g. `@blockml/blockdoc-target`; domain targets such as `@machineblocks/machineblocks-v3-scad-target` live in the **MachineBlocks mono-repo**).

### V1 decision — `targets[]` + BlockDoc-first

In V1, **`@blockml/cli` bootstraps toolchain targets from `bom.config.json` → `targets[]`**. The first / default control target is **`blockdoc`** (`@blockml/blockdoc-target`). MachineBlocks SCAD is **not** a default and is **not** authored in this repo — domain thin CLIs (e.g. `@machineblocks/cli`) register their own targets.

```typescript
// @blockml/cli — bootstrapTargets.ts (sketch)
import { registerTarget } from "@blockml/compiler";
import { BlockDocTarget } from "@blockml/blockdoc-target";
// … map name → package as other targets ship

const DEFAULT_TARGETS = ["blockdoc"];

export function bootstrapTargets(config: { targets?: string[] }): void {
  if (bootstrapped) return;
  const names = config.targets?.length ? config.targets : DEFAULT_TARGETS;
  for (const name of names) {
    registerTarget(loadTarget(name)); // e.g. "blockdoc" → new BlockDocTarget()
  }
  bootstrapped = true;
}
```

| Name | Package | V1 role |
|---|---|---|
| `blockdoc` | `@blockml/blockdoc-target` | **First Stage-3 gate** — browseable corpus HTML for control / review |
| `xsd` | `@blockml/xsd-target` | After BlockDoc; **SSOT:** `org.blockml.bml.target.xsd.documentation.Introduction` |
| `fatblock` | `@blockml/fatblock-target` | After / beside XSD |
| `machineblocks-v3-scad` | `@machineblocks/machineblocks-v3-scad-target` | Primary **product** target — after toolchain control |

Commands that require a target call `bootstrapTargets()` before `compileToOutput()`:

```text
blockml compile <file> <target>          — document targets only
blockml compile <target>                 — library/corpus targets (blockdoc, xsd)
blockml compile --all <target>           — document targets only (loop srcDir)
blockml watch <target>                   — target-dependent (see 07_cli.md)
```

Typical V1 control compile:

```bash
blockml compile blockdoc
# optional explicit library roots:
blockml compile blockdoc --libraries node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml
```

Commands that do **not** call `bootstrapTargets()`:

```text
blockml validate   — Stage 1 + Stage 2 only; no target required
blockml inspect    — Urmodell dump only; no target required
```

### Planned configurability

| Hook | V1 | Later |
|---|---|---|
| `bootstrapTargets(config)` | Reads `bom.config.json` → `targets[]` (default `["blockdoc"]`) | Plugin loader / more names |
| CLI `<target>` argument | Required on compile/watch | Unchanged — config does not replace the argument |
| `@blockml/compiler` | `registerTarget()` / `getTarget()` only | Unchanged — no built-in targets |
| `bom.config.json` → `targets` | **V1** — list of registry names to bootstrap | Same |
| Target packages | Import map name → package in CLI | Dynamic import by name |

```json
{
  "targets": ["blockdoc"]
}
```

`blockml init` scaffolds `"targets": ["blockdoc"]`. Missing `targets` → default `["blockdoc"]`.

### Bootstrap order (CLI)

**CLI-owned steps SSOT:** `org.blockml.bml.cli.documentation.RuntimeBootstrap` (load config → TypeRegistry → targets → compile → write files).

```text
1. load bom.config.json
2. bootstrapTypeRegistry({ srcDir, libraries, … })   — B5 / @blockml/framework
3. bootstrapTargets()                                 — C3 / @blockml/cli
4. build CompileRequest from CLI flags + target.accepts + config
5. compileToOutput(request, targetName, compileOptions)
6. write RenderOutput.files[] to disk                 — CLI only
```

`bootstrapTypeRegistry`, compile **scope**, and `bootstrapTargets` are **three separate concerns**:

```text
TypeRegistry   — “what types exist?” (cross-file resolution)
CompileScope   — “what do we render in this invocation?”
Target Registry — “how do we render?”
```

### Browser / tests

Hosts that call `@blockml/compiler` directly (browser playground, unit tests) call `registerTarget()` themselves — there is no CLI bootstrap. Same registry API, different host responsibility.

```typescript
registerTarget(new MachineBlocksV3ScadTarget(new MakerEngine()));
compileToOutput(request, "machineblocks-v3-scad", { typeRegistry });
```

### Unknown target

If `<target>` is not in the registry after bootstrap, the CLI exits with code **2** (configuration error). Register via `targets[]` (or default `blockdoc`) before compiling that name.

---

## RenderContext (C1)

`RenderContext` is the **per-block render state** passed to `RenderEngine.compile()`. It is **internal** to `@blockml/compiler` and render targets — not part of the public Facade API (C2).

Session-level options live in `CompileOptions`. `RenderContext` carries what changes as the renderer walks the composition tree after directive expansion (SCAD renderer step [10]).

### Separation from CompileOptions

```text
CompileOptions (C2)     RenderContext (C1)
─────────────────       ───────────────────────────
Public Facade API       Internal — compiler + targets only
One per compile call    One per render node (forked)
Immutable               Immutable per node; fork via child()
typeRegistry      ──→   session.typeRegistry
outputBasePath    ──→   session.outputBasePath
mbLibPath         ──→   session.mbLibPath
activeConfig      ──→   session.activeConfig
filePath          ──→   session.sourceFilePath
                        + blockFqn, partId, instance, withScope, …
```

### Types

```typescript
/** Immutable session — built once from CompileOptions + compile metadata */
interface RenderSession {
  typeRegistry:    TypeRegistry
  sourceFilePath:  string          // CompileInput.filePath
  outputBasePath:  string          // CompileOptions.outputBasePath
  targetName:      string          // e.g. "machineblocks-v3-scad"
  documentKind:    BomDocumentKind // V1: always "block"
  /** True when root block has _presets composition (MachineBlocks preset block) */
  isPresetBlock: boolean
  activeConfig?:   string          // CompileOptions.activeConfig
  mbLibPath?:      string          // CompileOptions.mbLibPath — SCAD import paths
}

/** Per-block / per-instance render state — forked via child() */
interface RenderContext {
  session: RenderSession

  /** Block definition FQN currently being rendered */
  blockFqn: string

  /** Primary output path relative to outputBasePath (e.g. com/.../Wall.scad) */
  outputRelativePath: string

  /** Composition identity — SCAD renderer step [10]; undefined at document root */
  parentPartId?: string
  partId?: string
  // partIdPath (computed): parentPartId ? `${parentPartId}::${partId}` : partId

  /** Composition instance — undefined when rendering block definition shell */
  instance?: BlockInstance

  /** bml:with locals — visible to this node and descendants */
  withScope: ReadonlyMap<string, ExpressionValue>

  /** Innermost bml:each bindings — undefined outside loops */
  loopScope?: ReadonlyMap<string, ExpressionValue>

  /** Preset block compile — active preset id when serializing JSON / thumbnail input */
  activePresetId?: string

  /** Fork for nested render — session unchanged, per-node fields overridden */
  child(overrides: Partial<Omit<RenderContext, "session" | "child">>): RenderContext
}
```

### Lifecycle

```text
compileBomToOutput(input, targetName, options)
  │
  ├─ buildRenderSession(options, input, targetName)     ← once per compile
  │
  └─ BlockProcessor.process(block, engine)
       │
       ├─ engine.compile(blockDef, processor, rootContext)
       │
       └─ CompositionRenderer (after SCAD renderer step [10] directive expansion)
            └─ for each expanded instance:
                 context.child({ parentPartId, partId, instance, withScope, loopScope })
                 engine.compile(...)
```

`RenderContext` is **forked** via `child()` — not mutated in place.

### Session fields

| Field | Source | Used for |
|---|---|---|
| `typeRegistry` | `CompileOptions` | Preset lookup, config profile, effective members, Sub-Block defs |
| `sourceFilePath` | `CompileInput.filePath` | Source maps, diagnostics |
| `outputBasePath` | `CompileOptions` | Output path computation |
| `targetName` | CLI / caller argument | Target-specific behavior, diagnostics |
| `documentKind` | `BomDocument.kind` | Always `"block"` in V1 |
| `isPresetBlock` | root block has `_presets` composition | Preset block vs composable render paths |
| `activeConfig` | `CompileOptions` | Property merge — config profile layer |
| `mbLibPath` | `CompileOptions` | SCAD `use` / `include` relative paths |

### Per-node fields

| Field | Used for |
|---|---|
| `blockFqn` | Module name, property definitions, processor dispatch |
| `outputRelativePath` | Import resolver (Set `_blocks` `use` paths), file output |
| `parentPartId` / `partId` | Nested SCAD identity (`mb_block_id`, SCAD renderer step [10]) |
| `instance` | Inline properties, `basePresets` — property merge layers 1–2 |
| `withScope` | Expression rendering for `bml:with` variables |
| `loopScope` | Expression rendering for `bml:each` loop variables |
| `activePresetId` | Preset JSON + thumbnail filename (`Wall__brick-2x4.webp`) |

### Render modes

```text
Definition render (Wall.bml → Wall.scad)
  instance = undefined
  partId   = undefined at root module level
  → Customizer parameters from Block properties

Instance render (composition children after SCAD renderer step [10])
  instance = BlockInstance { memberValues, basePresets, … }
  partId   = resolved id expression
  parentPartId = parent's partIdPath
  → mb_block() settings, nested sub-modules
```

### Property resolution

**Renderer stage** — preset/config merge happens here, not in the parser. See `01_bom_core.md` — Renderer Boundary.

Resolved property values are **not cached** on `RenderContext` in V1. A `PropertyResolver` computes effective values on demand from the **authored BOM** plus merge rules:

```text
resolveProperty(name, blockDef, context):
  1. context.instance?.memberValues[name]     — inline (authored form)
  2. basePresets merge from context.instance  — via session.typeRegistry + compiler merge helpers
  3. config from context.session.activeConfig — via session.typeRegistry
  4. blockDef property value
```

Merge order: `inline > preset > config > default` — defaults from `NativeBlock.bml` (SSOT).

The merge result is a **render-time view** — it is not written back to `BomDocument`.

### Accessor Capabilities (Draft · V1 preparation)

> **Status:** Draft — see `08_managed_object.md`. **Not active in V1 render.**

Post-V1, property resolution **may** consult authored Capability definitions as translation metadata. The Renderer decides merge order and optional handling.

**V1 rule:** `PropertyResolver` reads `memberValues` in authored form directly. An optional `AccessorInvoker` stub may exist for future wiring. SCAD emission uses `04_types.md` and NativeBlock type / `scad:value` metadata (`09_mbom_properties.yml` is a pointer stub only).

### Not in RenderContext

```text
Block / BlockDefinition     — separate argument to compile()
CompileInput / CompileOptions — session level; mapped into RenderSession only
Auto-IDs                    — not in BomDocument; assigned at SCAD renderer step [10], stored in partId
Resolved property cache     — PropertyResolver on-demand (V1)
Diagnostics collector       — separate pipeline object
RenderOutput / file buffer  — accumulated by processor, not in context
```

### BlockProcessor signature (V1)

V1 keeps `BlockProcessor.process(block, engine)` unchanged. The processor builds the root `RenderContext` internally from `CompileOptions`. Post-V1 optional extension: `process(block, engine, context)`.

---

## Thumbnails (C6)

Thumbnails (`.webp`) are **CLI-only** — not produced by `@blockml/compiler` and **not** included in `RenderOutput`. This keeps the compiler browser-compatible (no `child_process`, no Sharp).

### Responsibility split

| Artifact | Producer | Package |
|---|---|---|
| `.scad`, `.scad.map` | Compiler (implicit block render) | `@blockml/compiler` + SCAD target |
| `.json` (Customizer) | Compiler (preset block render) | `@blockml/compiler` + SCAD target |
| `.webp` (thumbnails) | CLI post-step | `@blockml/cli` only |

### Compiler — preset block render

When the root block has a `_presets` composition (MachineBlocks preset block), the SCAD target render pipeline:

```text
1. Walk preset instances in _presets → collect referenced block types
2. Implicit block render per referenced type → .scad + .scad.map in RenderOutput.files[]
3. Preset property merge per instance (own properties → basePresets chain → default)
4. Customizer JSON → .json in RenderOutput.files[]
```

No thumbnail step. `RenderOutput` contains **text artifacts only** (`.scad`, `.map`, `.json`).

### CLI — after compile success

```typescript
const result = compileToOutput(
  {
    scope: {
      kind: "document",
      document: input,
    },
  },
  "machineblocks-v3-scad",
  options
);

if (result.success && session.isPresetBlock) {
  writeRenderOutputFiles(result.output, config.outDir);

  await generateThumbnails({
    scadPath:  path.join(outDir, findFile(output, /\.scad$/).path),
    jsonPath:  path.join(outDir, findFile(output, /\.json$/).path),
    thumbsDir: resolveThumbsDir(config, scadRelativePath),
    openscad:  resolveOpenScad(config),
  });
}
```

Implemented in `@blockml/cli` as `generateThumbnails.ts`. Uses `resolveOpenScad.ts` for executable resolution.

### Thumbnail pipeline (per preset)

CLI iterates `parameterSets` in the compiled `.json`:

```text
1. Filename:  {BlockName}__{preset-id}.webp     ← Preset id (kebab-case)
2. OpenSCAD:    openscad --p Wall.json --P "Brick 2x4" -o tmp.png Wall.scad
                                                      ↑ Preset name (UI label)
3. Sharp:       border + label overlay + resize → .webp
4. Cleanup:     delete temporary PNG
```

### Trigger and scope

```text
Trigger:     blockml compile <StandardPresets.bml> machineblocks-v3-scad
             blockml watch (same rules on file change)
Not triggered: blockml compile <block.bml>  — no thumbnails
               blockml validate / blockml inspect
               Browser compileToOutput — no OpenSCAD available
No separate bom thumbnail command
```

### OpenSCAD missing

If OpenSCAD is not found, the CLI reports an error **for the thumbnail step only**. Compiler output (`.scad`, `.json`) is still written when compile succeeded. Exit code: **2** if thumbnails were required and OpenSCAD is unavailable.

Thumbnail skip logic uses the incremental build cache (C5) — see `.webp` artifact below.

### Extension points

```text
generateThumbnails()     — single CLI entry point; post-V1 may move to @blockml/thumbnail-scad
RenderOutput             — never includes binary files (.webp)
@blockml/compiler        — never depends on OpenSCAD or Sharp
Thumbnail backend        — post-V1: swap OpenSCAD renderer without touching compiler
```

---

## Incremental Build (C5)

Incremental builds skip unchanged output artifacts during `blockml compile --all` and `blockml watch`. Like thumbnails (C6), caching is **CLI-only** — `@blockml/compiler` has no filesystem cache and no skip logic.

### Strategy

```text
Before compile/render/thumbnail for an artifact:
  1. Compute hash inputs for this output path
  2. SHA-256(canonicalInputBlob) → candidateHash
  3. Read stored hash from .bom-cache/<output-path>.hash
  4. Match → skip (do not invoke compiler / OpenSCAD)
  5. Mismatch or missing → run step, write outputs, store new hash

--force  →  skip steps 3–4, always rebuild
```

Cache key is the **output artifact path** (relative to `outDir`), not the input BML path. This deduplicates implicit and direct compiles of the same block:

```text
blockml compile Wall.bml …           →  scad/.../Wall.scad
blockml compile WallPresets.bml …    →  same Wall.scad (implicit) — same .hash file, skip if unchanged
```

`.scad.map` is not hashed separately — written together with `.scad`, skipped together.

### Algorithm

```text
Hash function:  SHA-256
Input encoding: canonical JSON (sorted keys, stable array order) → UTF-8 → SHA-256 → hex
Hash file:      .bom-cache/<mirror-of-outDir-path>.hash
                content: single line  sha256:<hex>
Schema:         schemaVersion: 1  (bump invalidates all caches)
```

Implemented in `@blockml/cli` as `incrementalBuild.ts` (`computeArtifactHash`, `readStoredHash`, `writeStoredHash`, `shouldSkip`).

The compiler Facade is unaware of caching. Browser hosts never use `.bom-cache`.

### Hash inputs by artifact

#### `.scad` (block definition compile)

```typescript
{
  schemaVersion: 1,
  kind: "scad-block",
  sourceContentHash: sha256(Wall.bml),           // input file bytes
  externalRefs: [                                // sorted by typeFqn
    { typeFqn: "com.machineblocks.bml.bricks.StandardBrick", version: "3.0.0" },
    …
  ],
  activeConfigHash: sha256(configProfile.bml) | null,
  targetVersion: "machineblocks-v3-scad@<pkg-version>",
  compilerVersion: "@blockml/compiler@<pkg-version>"
}
```

`externalRefs`: every **external** `BlockInstance` reference in the source file (direct refs only — no transitive dependency file contents; aligns with C4). Same-document Sub-Blocks are not listed.

`activeConfigHash`: hash of the active config profile BML file (`src/config/<activeConfig>.bml`), or `null` when `activeConfig` is unset.

#### `.json` (preset block compile)

```typescript
{
  schemaVersion: 1,
  kind: "scad-presets-json",
  sourceContentHash: sha256(WallPresets.bml),
  scadArtifactHash: readStoredHash("…/Wall.scad"),   // cascade from block output
  activeConfigHash: …,
  targetVersion: …,
  compilerVersion: …
}
```

`scadArtifactHash`: the **stored** hash of the implicit block `.scad` (computed from `Wall.bml`, not from `WallPresets.bml`). When the block definition changes, the JSON step invalidates even if the presets file is unchanged — ensuring downstream thumbnails refresh.

If implicit `.scad` must be compiled first, CLI computes/resolves its hash before deciding whether to skip `.json`.

#### `.webp` (thumbnail — CLI only)

```typescript
{
  schemaVersion: 1,
  kind: "thumbnail-webp",
  presetId: "brick-2x4",
  jsonArtifactHash: readStoredHash("…/Wall.json"),
  scadArtifactHash: readStoredHash("…/Wall.scad"),
  openscadVersion: "<openscad --version output>",
  thumbnailPipelineVersion: "1"                    // bump when Sharp layout/branding changes
}
```

Per-preset hash files: `.bom-cache/.../Wall__brick-2x4.webp.hash`

### Dependency graph

```text
Wall.bml
  └─→ Wall.scad (+ .map)          hash from Wall.bml inputs

WallPresets.bml
  └─→ Wall.json                   hash includes Wall.scad stored hash

Wall.scad + Wall.json
  └─→ Wall__<preset-id>.webp      hash includes both stored hashes + OpenSCAD version
```

### `--all` behavior

```text
For each BML file in srcDir (every file evaluated independently):

  <block> (composable)        →  check Wall.scad hash → compile or skip
  <block> (preset block)  →  check Wall.scad hash (implicit, same key as direct compile)
                              →  check Wall.json hash → compile or skip
                              →  check each .webp hash → thumbnail or skip
```

No special coupling between files in the scan loop — deduplication comes from shared output-path hash keys.

### Hash storage

```text
.bom-cache/
  com/martianmicro/anyclosure/
    Wall.scad.hash
    Wall.json.hash
    Wall__brick-2x4.webp.hash
    Wall__brick-1x1.webp.hash
```

Mirror `outDir` / `thumbsDir` structure. Add `.bom-cache/` to `.gitignore`.

### Invalidation triggers

| Change | Invalidates |
|---|---|
| `Wall.bml` content | `.scad` → cascades to `.json`, `.webp` |
| External ref version pin | `.scad` of referencing file |
| `WallPresets.bml` content | `.json` → `.webp` |
| `activeConfig` / profile file | All artifacts using that config layer |
| Target package version bump | All artifacts for that target |
| Compiler package version bump | All artifacts |
| OpenSCAD version change | `.webp` only |
| `schemaVersion` bump | All artifacts (cache wipe) |

### Not cached

```text
blockml validate / blockml inspect     — no output artifacts
Browser compileToOutput          — no .bom-cache
Single-file `blockml compile <file>` — same hash logic applies (not only --all)
```

---

## Open Decisions (Phase C — remaining)

| ID | Topic | Status |
|---|---|---|
| C1 | `RenderContext` — `RenderSession` + forked per-node context | **Decided** |
| C2 | Facade API — `compileToOutput(CompileRequest, …)`; `compileBmlToOutput` = document sugar | **Decided** |
| C3 | Target bootstrap — `targets[]` in V1; default / first control target `blockdoc` | **Decided** |
| C4 | Compile I/O — no fixed input↔output mapping; MachineBlocks SCAD 1:1 convention | **Decided** |
| C5 | Incremental build — SHA-256, CLI cache, output-path keys | **Decided** |
| C6 | Thumbnails — CLI-only; not in RenderOutput | **Decided** |
| C7 | Compile scope — `document` \| `library` \| `corpus` \| `auto`; target `accepts[]`; `targetOptions` | **Decided** |

Phase C complete.

---

## Related Documents

| Topic | Document |
|---|---|
| NativeBlock MBOM type | `03_mbom.md` |
| Wrapper + composition render | `05_scad_renderer.md` |
| Incremental build (C5) | `14_compiler_runtime.md` |
| CLI compile outputs | `07_cli.md` |
| Monorepo / build / test | `15_dev_setup.md` |
