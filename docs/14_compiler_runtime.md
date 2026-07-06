# Compiler Runtime

version: 0.3.0

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
| **Compile scope (C4)** | One input file → one primary output artifact; no transitive compile of composition dependencies |
| **NativeBlock = mb_block** | `com.machineblocks.core.NativeBlock` is the direct BML representation of SCAD `mb_block()` — the only geometry primitive at render time |
| **Composition leaves** | All leaf geometry in compositions renders as `mb_block()` — authored as `<core:NativeBlock>` or lowered from domain block instances |
| **Sub-Blocks** | Same-document Sub-Blocks → sub-modules embedded in the parent output SCAD file |
| **Library blocks** | Pre-rendered `.scad` in scad-lib; re-compiled only when their own `.mbml` is compiled |
| **JSON BML** | Deferred (TBD — not V1) |
| **Facade API (C2)** | `CompileInput` + `CompileOptions`; explicit `TypeRegistry`; CLI writes files |
| **Target bootstrap (C3)** | V1: CLI hardcoded `bootstrapTargets()`; configurability planned — early hooks, no `targets[]` in V1 |

---

## NativeBlock Render Model (C4)

### Core rule

In the MachineBlocks SCAD library, **`mb_block()` is the native geometry primitive** (`lib/block.scad`). In MBOM this is modeled as **`com.machineblocks.core.NativeBlock`**.

```text
MBML:  <core:NativeBlock size="[2, 4, 3]" studs="true" ... />
SCAD:  mb_block(config, settings = [ ["size", [2, 4, 3]], ["studs", true], ... ]);
```

`NativeBlock` is **final** — it cannot be used as `baseType` on a Block definition. It appears only as a composition child. See `03_mbom.md` — NativeBlock.

### Domain blocks → NativeBlock at render time

Composite Block **types** (e.g. `com.machineblocks.bricks.Standard`, `com.martianmicro.anyclosure.Wall`) are Block **definitions** with properties, Sub-Blocks, and composition structure.

When a composition needs **leaf brick geometry**, it is always rendered through **NativeBlock / `mb_block()`** — not through a typed `mb__…__Standard()` module call and not through `use <Standard.scad>`.

Evidence from scad-lib (`Calibrator.scad`):

```text
Calibrator.mbml references  bricks:StandardBrick  (many instances)
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

Some Block types are **semantically** Composite Blocks but **effectively** a single NativeBlock — all properties map 1:1 to native MB settings with no inner composition structure (e.g. `com.machineblocks.bricks.Standard`).

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
Standalone Standard.mbml compile:
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
4. Utils / FunctionBlock  inline functions in same file
```

Sub-Blocks are **not** separate output files.

### Wrapper mb_block

When a Composite Block has **2+ composition children**, the processor emits an outer **wrapper** `mb_block()` (layout container, `base=false`, `studs=false`). Children inside are NativeBlock / lowered `mb_block()` calls. See `05_scad_renderer.md` — Wrapper mb_block() Logic.

---

## Compile Scope

### Per input file

```text
bom compile src/.../Calibrator.mbml machineblocks-v3-scad
  → scad/.../Calibrator.scad
  → scad/.../Calibrator.scad.map
  (does NOT emit Standard.scad — even though Calibrator references StandardBrick)
```

```text
bom compile src/.../Standard.mbml machineblocks-v3-scad
  → scad/.../Standard.scad        (standalone library / customizer entry)
```

### Preset compile chain

```text
WallPresets.bml
  → implicit compile of referenced Wall block → Wall.scad
  → Wall.json (Customizer)
  → thumbnails (CLI-only, Node)
```

See `07_cli.md` — bom compile.

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
use <{mbLibPath}/blocks/org/blockml/service/Math.scad>;   // #built-in, when not native-mapped
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

`CompileOptions` is **session-level** (one compile invocation). Per-block render state is `RenderContext` (C1) — built internally by the BlockProcessor from `CompileOptions`.

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
  source: fs.readFileSync("src/com/.../Calibrator.mbml", "utf8"),
  filePath: "src/com/.../Calibrator.mbml",
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

## Open Decisions (Phase C — remaining)

| ID | Topic | Status |
|---|---|---|
| C1 | `RenderContext` fields | Pending |
| C2 | Facade API — `CompileInput` + `CompileOptions` | **Decided** |
| C3 | Target bootstrap — CLI hardcoded V1; config/plugins planned | **Decided** |
| C4 | Compile scope + NativeBlock model | **Decided** |
| C5 | Incremental build hash algorithm | Pending |
| C6 | Thumbnails — CLI-only vs compiler | Pending |

---

## Related Documents

| Topic | Document |
|---|---|
| NativeBlock MBOM type | `03_mbom.md` |
| Wrapper + composition render | `05_scad_renderer.md` |
| CLI compile outputs | `07_cli.md` |
| Incremental build sketch | `06_compiler.md` |
