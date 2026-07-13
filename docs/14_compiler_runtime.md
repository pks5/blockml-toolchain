# Compiler Runtime

version: 0.7.0

## Purpose of this Document

This document defines the **compiler runtime** — how `@blockml/compiler`, `@blockml/cli`, and render targets orchestrate parsing, validation, and rendering after the BOM model and BML mapping rules are fixed.

For BOM types see `12_bom_object_model.md`.
For BML mapping see `13_bml_to_bom_mapping.md`.
For SCAD rendering details see `05_scad_renderer.md`.
For pipeline stages see `06_compiler.md`.

---

## Design Decisions (Phase C)

| Topic | Decision |
|---|---|
| **Compile I/O (C4)** | **BlockML:** no mandatory input↔output mapping; targets define cardinality (0..n files, side effects). **MachineBlocks convention:** 1 BML → 1 primary SCAD (+ side artifacts) |
| **NativeBlock = mb_block** | **MachineBlocks convention:** `com.machineblocks.bml.core.NativeBlock` maps to SCAD `mb_block()` — not a global BlockML rule; other targets need not emit blocks |
| **Composition leaves** | **MachineBlocks convention:** leaf geometry → `mb_block()` — authored as `<core:NativeBlock>` or lowered from domain instances |
| **Sub-Blocks** | Same-document Sub-Blocks → sub-modules embedded in the parent output SCAD file |
| **Library blocks** | Pre-rendered `.scad` in scad-lib; re-compiled only when their own `.bml` is compiled |
| **JSON BML** | Deferred (TBD — not V1) |
| **Facade API (C2)** | `CompileInput` + `CompileOptions`; explicit `TypeRegistry`; CLI writes files |
| **Target bootstrap (C3)** | V1: CLI hardcoded `bootstrapTargets()`; configurability planned — early hooks, no `targets[]` in V1 |
| **RenderContext (C1)** | `RenderSession` (immutable) + forked `RenderContext` per render node; `PropertyResolver` on-demand; internal API |
| **Thumbnails (C6)** | CLI-only (OpenSCAD + Sharp); not in `RenderOutput`; compiler produces `.scad` + `.json` prerequisites |
| **Incremental build (C5)** | CLI-only cache (`.bom-cache/`); SHA-256 canonical input hash; skip before compile; dedup by output path |
| **SCAD settings format** | V1: pseudo-map `[["key", val], …]`; renderer uses SettingsBundle + pluggable SettingsEmitter; future: OpenSCAD `object()` |

---

## NativeBlock Render Model

> **Scope:** MachineBlocks SCAD target only. Render targets are free in output shape — see `17_type_system_bml.md` — Renderer freedom.

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

Typed block modules (e.g. `mb__com__machineblocks__bricks__Standard`) exist for **standalone compile** of a Block definition file — Customizer entry point, library artifact — not for composition references.

### Leaf-only blocks — optimize to direct `mb_block()`

Some Block types are **semantically** Composite Blocks but **effectively** a single NativeBlock — all properties map 1:1 to native MB settings with no inner composition structure (e.g. `com.machineblocks.bml.bricks.Standard`).

For **standalone compile** of such blocks, the ScadBlockProcessor **optimizes internally to `mb_block()`** — emitting a direct main call:

```scad
mb_block(config = mb_config, settings = [ ["size", size], ["studs", studs], ... ]);
```

instead of:

```scad
mb__com__machineblocks__bricks__Standard(config, settings = [...]);  // ✗ avoid
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
Facade is input-oriented     — compileBmlToOutput(input) passes one BomDocument; targets
                               may pull additional inputs from TypeRegistry internally
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
  compileBmlToBom(input)           → BomDocument        (1 input → 1 BOM)
  compileBomToOutput(model, target)  → RenderOutput       (target decides cardinality)

RenderTarget / BlockProcessor (domain-specific)
  process(block, engine)             → RenderOutput       (per block or batch — target policy)
  may merge multiple blocks          → one combined output
  may emit zero files                → side effects only

@blockml/cli (orchestration — not a BlockML rule)
  typically: one file per compileBmlToOutput call
  writes files[] when present; runs post-steps (thumbnails, cache)
  side effects: CLI may invoke Node-only follow-ups; browser hosts handle RenderOutput themselves
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

The Facade V1 API takes **one `CompileInput`** per call. Multi-input aggregation is a **target/orchestrator concern**:

```text
Option A — target reads TypeRegistry, pulls related BomDocuments during render
Option B — orchestrator calls compileBmlToBom N times, passes merged model to compileBomToOutput
Option C — future CompileBatchInput { inputs: CompileInput[] } on Facade (extension point)
```

V1 does not require Option C — targets may aggregate via TypeRegistry (Option A).

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
bom compile src/.../Calibrator.bml machineblocks-v3-scad
  → scad/.../Calibrator.scad
  → scad/.../Calibrator.scad.map
  (does NOT emit Standard.scad — even though Calibrator references StandardBrick)
```

```text
bom compile src/.../Standard.bml machineblocks-v3-scad
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

`@blockml/compiler` exposes three public functions. Input is structured — not a bare `string`.

### Types

```typescript
interface CompileInput {
  /** Raw BML source text */
  source: string
  /** Project-relative or absolute path — used in SourceInfo and Diagnostic.source.file */
  filePath: string
  /** V1: always "xml". Default: inferred from filePath extension or first non-whitespace char */
  format?: "xml"
}

interface CompileOptions {
  /** Pre-bootstrapped registry (CLI scans srcDir + libraries before compile). Required for validate/compile with cross-file refs. */
  typeRegistry?: TypeRegistry
  /** Active config profile name — from bom.config.json activeConfig */
  activeConfig?: string
  /** Output root (outDir) — used by render targets for relative output paths and SCAD import resolution */
  outputBasePath?: string
  /** MachineBlocks SCAD library root — mbLibPath; required for SCAD target import paths */
  mbLibPath?: string
}

interface CompilerResult<T> {
  output:      T | null
  diagnostics: Diagnostic[]
  success:     boolean
}
```

`CompileOptions` is **session-level** (one compile invocation). Per-block render state is `RenderContext` (C1) — see RenderContext (C1) below.

### Functions

```typescript
/** Stages 1–8: parse + validate. No target required. */
compileBmlToBom(
  input: CompileInput,
  options?: CompileOptions
): CompilerResult<BomDocument>

/** Stages 9–19: render. Target must be registered. */
compileBomToOutput(
  model: BomDocument,
  targetName: string,
  options?: CompileOptions
): CompilerResult<RenderOutput>

/** Full pipeline: stages 1–19. */
compileBmlToOutput(
  input: CompileInput,
  targetName: string,
  options?: CompileOptions
): CompilerResult<RenderOutput>
```

### Design rules

```text
TypeRegistry     — explicit in CompileOptions, not a hidden global singleton
                   CLI bootstraps registry (B5) and passes it on every call

File output      — Facade returns RenderOutput.files[] with relative paths + content
                   CLI writes to disk; browser uses content in-memory

validate         — compileBmlToBom only; no targetName; typeRegistry required when
                   the file has external references

Diagnostics      — always reference input.filePath + line/column from parse
```

### CLI example

```typescript
const registry = bootstrapTypeRegistry({ srcDir, mbLibPath, bmlExtensions });

const input: CompileInput = {
  source: fs.readFileSync("src/com/.../Calibrator.bml", "utf8"),
  filePath: "src/com/.../Calibrator.bml",
};

const result = compileBmlToOutput(input, "machineblocks-v3-scad", {
  typeRegistry: registry,
  outputBasePath: config.outDir,
  mbLibPath: resolveMbLibPath(config),
  activeConfig: config.activeConfig,
});

if (result.success) {
  for (const file of (result.output as ScadRenderOutput).files) {
    fs.writeFileSync(path.join(config.outDir, file.path), file.content);
  }
}
```

### Browser example

```typescript
registerTarget(new MachineBlocksV3ScadTarget(new MakerEngine()));

const result = compileBmlToOutput(
  { source: xmlSource, filePath: "Wall.bml" },
  "machineblocks-v3-scad",
  { typeRegistry: preloadedRegistry }
);
```

---

## Target Bootstrap (C3)

Before stage [9] can resolve a target by name, the caller must populate the **Target Registry** via `registerTarget()`. `@blockml/compiler` ships **no default targets** — targets live in domain packages (e.g. `@machineblocks/machineblocks-v3-scad-target`).

### V1 decision — CLI hardcoded

In V1, **`@blockml/cli` registers targets explicitly** in a dedicated bootstrap function — not via `bom.config.json`.

```typescript
// @blockml/cli — bootstrapTargets.ts
import { registerTarget } from "@blockml/compiler";
import { MakerEngine } from "@blockml/engine-maker";
import { MachineBlocksV3ScadTarget } from "@machineblocks/machineblocks-v3-scad-target";

let bootstrapped = false;

/** Idempotent — safe to call on every compile/watch invocation. */
export function bootstrapTargets(): void {
  if (bootstrapped) return;
  registerTarget(new MachineBlocksV3ScadTarget(new MakerEngine()));
  bootstrapped = true;
}
```

V1 registers exactly one target: `"machineblocks-v3-scad"`.

Commands that require a target call `bootstrapTargets()` before `compileBmlToOutput()`:

```text
bom compile <file> <target>
bom compile --all <target>
bom watch <target>
```

Commands that do **not** call `bootstrapTargets()`:

```text
bom validate   — stages 1–8 only; no target required
bom inspect    — BOM dump only; no target required
```

### Planned configurability (post-V1)

Target selection will become configurable. V1 sets the following **extension points** so later changes stay localized:

| Hook | V1 | Planned |
|---|---|---|
| `bootstrapTargets(config?)` | Hardcoded SCAD target | Reads `bom.config.json` → `targets[]` and/or plugin manifest |
| CLI `<target>` argument | Required on compile/watch | Stays required; config defines *available* targets, not implicit default |
| `@blockml/compiler` | `registerTarget()` / `getTarget()` only | Unchanged — no built-in targets |
| `bom.config.json` → `targets` | **Not read in V1** (field reserved, TBD) | List of target names to bootstrap for this project |
| Target packages | Direct import in CLI | Dynamic import / plugin loader by target name |

**Reserved config field (TBD — not V1):**

```json
{
  "targets": ["machineblocks-v3-scad"]
}
```

Do not add this field to `bom init` scaffolding in V1. When implemented, missing `targets` should fall back to the V1 hardcoded set for backward compatibility.

### Bootstrap order (CLI)

```text
1. load bom.config.json
2. bootstrapTypeRegistry({ srcDir, mbLibPath, bmlExtensions })   — B5; validate + compile
3. bootstrapTargets()                                             — C3; compile + watch only
4. compileBmlToOutput(input, targetName, compileOptions)
5. write RenderOutput.files[] to disk                           — CLI only
```

`bootstrapTypeRegistry` and `bootstrapTargets` are **separate concerns** — do not merge them. TypeRegistry answers “what types exist?”; Target Registry answers “how do we render?”.

### Browser / tests

Hosts that call `@blockml/compiler` directly (browser playground, unit tests) call `registerTarget()` themselves — there is no CLI bootstrap. Same registry API, different host responsibility.

```typescript
registerTarget(new MachineBlocksV3ScadTarget(new MakerEngine()));
compileBmlToOutput(input, "machineblocks-v3-scad", { typeRegistry });
```

### Unknown target

If `<target>` is not in the registry after bootstrap, the CLI exits with code **2** (configuration error). V1 only registers `"machineblocks-v3-scad"` — any other name fails immediately with a clear message.

---

## RenderContext (C1)

`RenderContext` is the **per-block render state** passed to `RenderEngine.compile()`. It is **internal** to `@blockml/compiler` and render targets — not part of the public Facade API (C2).

Session-level options live in `CompileOptions`. `RenderContext` carries what changes as the renderer walks the composition tree after directive expansion (stage [10]).

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

  /** Composition identity — stage [10]; undefined at document root */
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
       └─ CompositionRenderer (after stage [10] directive expansion)
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
| `parentPartId` / `partId` | Nested SCAD identity (`mb_block_id`, stage [10]) |
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

Instance render (composition children after stage [10])
  instance = BlockInstance { memberValues, basePresets, … }
  partId   = resolved id expression
  parentPartId = parent's partIdPath
  → mb_block() settings, nested sub-modules
```

### Property resolution

**Renderer stage** — preset/config merge happens here, not in the parser. See `00_bom_core.md` — Renderer Boundary.

Resolved property values are **not cached** on `RenderContext` in V1. A `PropertyResolver` computes effective values on demand from the **authored BOM** plus merge rules:

```text
resolveProperty(name, blockDef, context):
  1. context.instance?.memberValues[name]     — inline (authored form)
  2. basePresets merge from context.instance  — via session.typeRegistry + compiler merge helpers
  3. config from context.session.activeConfig — via session.typeRegistry
  4. blockDef property value
```

Merge order: `inline > preset > config > default` — see `09_mbom_properties.yml`.

The merge result is a **render-time view** — it is not written back to `BomDocument`.

### Accessor Capabilities (Draft · V1 preparation)

> **Status:** Draft — see `08_managed_object.md`. **Not active in V1 render.**

Post-V1, property resolution **may** consult authored Capability definitions as translation metadata. The Renderer decides merge order and optional handling.

**V1 rule:** `PropertyResolver` reads `memberValues` in authored form directly. An optional `AccessorInvoker` stub may exist for future wiring. SCAD emission uses `04_types.md` and `09_mbom_properties.yml` type metadata.

### Not in RenderContext

```text
Block / BlockDefinition     — separate argument to compile()
CompileInput / CompileOptions — session level; mapped into RenderSession only
Auto-IDs                    — not in BomDocument; assigned at stage [10], stored in partId
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
const result = compileBmlToOutput(input, "machineblocks-v3-scad", options);

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
Trigger:     bom compile <StandardPresets.bml> machineblocks-v3-scad
             bom watch (same rules on file change)
Not triggered: bom compile <block.bml>  — no thumbnails
               bom validate / bom inspect
               Browser compileBmlToOutput — no OpenSCAD available
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

Incremental builds skip unchanged output artifacts during `bom compile --all` and `bom watch`. Like thumbnails (C6), caching is **CLI-only** — `@blockml/compiler` has no filesystem cache and no skip logic.

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
bom compile Wall.bml …           →  scad/.../Wall.scad
bom compile WallPresets.bml …    →  same Wall.scad (implicit) — same .hash file, skip if unchanged
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
bom validate / bom inspect     — no output artifacts
Browser compileBmlToOutput     — no .bom-cache
Single-file bom compile <file> — same hash logic applies (not only --all)
```

---

## Open Decisions (Phase C — remaining)

| ID | Topic | Status |
|---|---|---|
| C1 | `RenderContext` — `RenderSession` + forked per-node context | **Decided** |
| C2 | Facade API — `CompileInput` + `CompileOptions` | **Decided** |
| C3 | Target bootstrap — CLI hardcoded V1; config/plugins planned | **Decided** |
| C4 | Compile scope + NativeBlock model | **Decided** |
| C5 | Incremental build — SHA-256, CLI cache, output-path keys | **Decided** |
| C6 | Thumbnails — CLI-only; not in RenderOutput | **Decided** |

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
