# Compiler Runtime

version: 0.1.0

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

## Open Decisions (Phase C — remaining)

| ID | Topic | Status |
|---|---|---|
| C1 | `RenderContext` fields | Pending |
| C2 | Facade API / `CompileInput` | Pending |
| C3 | Target bootstrap V1 (hardcoded vs config) | Pending |
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
