# Development Setup

version: 0.6.0

## Purpose of this Document

This document defines the **development setup** for the BlockML toolchain (`blockml` repository) — tooling, package layout, build order, scripts, testing, and IDE configuration.

**This repo authors `@blockml/*` only.** All `@machineblocks/*` packages (core, SCAD target, domain CLI) are **out of scope** here — they live in the **MachineBlocks mono-repo** (npm packages remain split). See `00_system.md` — Zielbild.

For architecture and package responsibilities see `00_system.md` (including **BlockML node packages**).
For compiler runtime (bootstrap, facade, cache) see `14_compiler_runtime.md` TOC → `org.blockml.bml.compiler.runtime.documentation.Introduction` (C5/C6 → CLI).
For testing strategy see `06_compiler.md` — Testing Strategy.
For the dual CLI model see `07_cli.md`.

Implementation code is scaffolded according to this document. **Libraries and toolchain packages** are **BlockML node modules** (`package.json` + `blocks/` SSOT) under `node_modules/` / `packages/`. See `00_system.md` — BlockML node packages · Package Implementation Workflow. TypeScript surfaces are added **after** the package BML library exists and that package’s Markdown has been migrated into it.

---

## Design Decisions (Phase D)

| Topic | Decision |
|---|---|
| **Monorepo tool** | **npm workspaces** (root `package.json` → `workspaces[]`) |
| **Language** | TypeScript 5.x, **`strict: true`** |
| **Module format** | **ESM** (`"type": "module"`) for all packages |
| **Build** | **`tsc --build`** (project references) → `dist/` per package |
| **Tests** | **Vitest** — unit + correctness + snapshots |
| **CLI link** | `npm link` from `@blockml/cli` after first build |
| **Node version** | **Node 20 LTS** minimum (22 supported) |
| **Package scope (this repo)** | **`@blockml/*` only** — toolchain |
| **Domain scope** | **`@machineblocks/*`** authored in MachineBlocks mono-repo (out of scope here) |
| **Package shape** | Normal npm module (`package.json`) **+ `blocks/`** — BML in `blocks/` is the package SSOT |
| **Browser packages** | No `fs`, `path`, `child_process` in core/parser/compiler/targets |

---

## Prerequisites

```text
git                 — clone
Node.js >= 20       — build + CLI + Vitest
npm >= 10           — workspaces + package install (bundled with Node 20+)
OpenSCAD (optional) — thumbnail generation only; not required for build/test
```

---

## First-Time Setup

```bash
git clone https://github.com/pks5/blockml-toolchain.git blockml
cd blockml
npm install
# node_modules/@blockml/core         — BlockML Core BML SSOT
# node_modules/@machineblocks/core   — MachineBlocks SCAD library + MBOM
```

After Phase A workspace scaffold exists:

```bash
npm run build
npm link -w @blockml/cli    # exposes `blockml` globally (once)
blockml --version
```

`npm install` is **required** for framework BML (`@blockml/core`) and MachineBlocks fixtures (`@machineblocks/core`, Test Layer B/C and T3 corpus).

After pulling updates:

```bash
git pull
npm install
npm run build
```

---

## Repository Layout

### Working tree (specs + npm libraries)

Every package is a **BlockML node module**: `package.json` + `blocks/` (SSOT). See `00_system.md` — BlockML node packages.

```text
blockml/                         ← THIS REPO — @blockml/* toolchain only
  docs/                          — transitional Markdown; domain MD (03/04/05) → move to MachineBlocks
  package.json                   — @blockml/* workspaces; optional @machineblocks/core as fixture dep
  node_modules/
    @blockml/core/               — BlockML Core
      package.json
      blocks/org/blockml/bml/   — package SSOT (Library.bml, README.bml, …)
    @machineblocks/core/         — optional installed fixture (authored in MachineBlocks mono-repo)
  packages/                      — @blockml/* ONLY (each: package.json + blocks/ + src/)
  scripts/
```

**There is no `@blockml/core-services` package.** Built-in services (`Math`, `Strings`, …) live under `node_modules/@blockml/core/blocks/org/blockml/bml/service/`. **Do not author `@machineblocks/*` under this `packages/`.**

### Target packages (end state)

| npm package | Path | When |
|---|---|---|
| `@blockml/core` | `node_modules/@blockml/core` | Installed — `blocks/` SSOT; BOM TS as it ships |
| `@blockml/bom` | `packages/bom` → `@blockml/bom` | Phase A — Urmodell TS + own `blocks/` SSOT |
| `@blockml/parser` | `packages/parser` → `@blockml/parser` | Phase A — own `blocks/` SSOT |
| `@blockml/serializer` | `packages/serializer` → `@blockml/serializer` | Phase A — own `blocks/` SSOT |
| `@blockml/validator` | `packages/validator` → `@blockml/validator` | Phase B |
| `@blockml/compiler` | `packages/compiler` → `@blockml/compiler` | Phase C; **SSOT:** `org.blockml.bml.compiler.runtime.documentation.Introduction` |
| `@blockml/blockdoc-target` | `packages/blockdoc-target` | Phase C — **first** Stage-3 / V1 control RT; registry `"blockdoc"` |
| `@blockml/xsd-target` | `packages/xsd-target` | Phase C — after BlockDoc; registry `"xsd"`; **SSOT:** `org.blockml.bml.target.xsd.documentation.Introduction` |
| `@blockml/fatblock-target` | `packages/fatblock-target` | Phase C — after / beside XSD; registry `"fatblock"`; **SSOT:** `org.blockml.bml.target.fatblock.documentation.Introduction` |
| `@blockml/cli` | `packages/cli-tools` | Phase C — reads `targets[]` (default `["blockdoc"]`); universal CLI only |
| `@blockml/engine-maker` | `packages/` / `engines/` | Phase C — reusable engine; SCAD product path consumes it from MachineBlocks |
| `@machineblocks/core` | *installed dep / fixture* | **OUT OF SCOPE** — MachineBlocks mono-repo |
| `@machineblocks/*` SCAD target | *published from MB mono-repo* | **OUT OF SCOPE** — not under this `packages/` |
| `@machineblocks/cli` | *MachineBlocks mono-repo* | **OUT OF SCOPE** — thin domain host; recommended MB entry |
| `@blockml/lsp` | `packages/lsp` | V2 — package name **decided** |

### Target tree

After scaffolding (from `00_system.md`):

```text
blockml/
  package.json                 — root workspace + npm library dependencies
  tsconfig.base.json
  tsconfig.json
  catalog.xml                  — XSD catalog (when schemas ship)
  .gitignore

  node_modules/
    @blockml/core/             — BlockML Core BML (org.blockml.bml.*)
    @machineblocks/core/       — optional installed fixture (authored in MachineBlocks mono-repo)

  packages/                    — @blockml/* ONLY (no @machineblocks/* here)
    bom/                       — @blockml/bom (Urmodell TS)
    parser/                    — @blockml/parser
      package.json · blocks/ · src/
    serializer/                — @blockml/serializer
    validator/                 — @blockml/validator
    compiler/                  — @blockml/compiler
    xsd-target/                — @blockml/xsd-target — registry "xsd"
    blockdoc-target/           — @blockml/blockdoc-target — registry "blockdoc"
    fatblock-target/           — @blockml/fatblock-target — registry "fatblock"
    cli-tools/                 — @blockml/cli          (Node-only, universal)
    lsp/                       — @blockml/lsp          (V2)

  engines/
    maker-engine/              — @blockml/engine-maker (local until published)

  tests/
    roundtrip/                 — parse → serialize → parse (V1 gate)
    correctness/               — after compiler exists (may use MB fixtures as deps)
    snapshots/

  docs/                        — toolchain MD; domain MD (03/04/05) = holding text → move to MB

MachineBlocks mono-repo (separate; not this tree):
  @machineblocks/core
  @machineblocks/machineblocks-v3-scad-target
  @machineblocks/cli           — thin host; recommended MB user entry
```

**Scaffold next (Phase A):** `@blockml/bom` library + migrate `12` Urmodell slice → BOM TS; `@blockml/parser` and `@blockml/serializer` BML libraries (done). Framework BML remains in `@blockml/core` (npm). **Do not scaffold `@machineblocks/*` under this `packages/`.**

---

## npm Workspaces

Root `package.json`:

```json
{
  "name": "blockml",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*",
    "engines/*"
  ],
  "dependencies": {
    "@blockml/core": "^1.0.1",
    "@machineblocks/core": "^3.0.0-A1"
  },
  "scripts": {
    "build": "tsc --build",
    "clean": "tsc --build --clean",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:roundtrip": "vitest run tests/roundtrip",
    "test:correctness": "vitest run tests/correctness",
    "lint": "eslint .",
    "typecheck": "tsc --build --emitDeclarationOnly"
  },
  "engines": {
    "node": ">=20"
  }
}
```

Published libraries (`@blockml/core`, `@machineblocks/core`) are ordinary npm dependencies. Local workspace packages still use `"workspace:*"` (npm 7+).

---

## TypeScript Configuration

### `tsconfig.base.json` (root)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Browser-compatible packages add `"lib": ["ES2022", "DOM"]` where needed. **XML parse (B18):** `@blockml/parser` depends on `@xmldom/xmldom` in Node and browser (do not rely on the host `DOMParser` alone).

`@blockml/cli` may use `"lib": ["ES2022"]` with `@types/node`.

### Root `tsconfig.json` (project references)

Build order encoded in references:

```json
{
  "files": [],
  "references": [
    { "path": "packages/bom" },
    { "path": "packages/parser" },
    { "path": "packages/serializer" },
    { "path": "packages/validator" },
    { "path": "packages/compiler" },
    { "path": "engines/maker-engine" },
    { "path": "packages/cli-tools" }
  ]
}
```

Each package `tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../core" }
  ]
}
```

---

## Package Conventions

Every package is a **normal Node module** (`package.json`) **with a BlockML extension**: a `blocks/` folder. The `.bml` files in `blocks/` are the **SSOT for that package** — same pattern as `@blockml/core` (and domain packages such as `@machineblocks/core` in their own mono-repo). This repo authors **`@blockml/*` only**. `@machineblocks/*` packages follow the same shape in the **MachineBlocks mono-repo**. See `00_system.md` — Zielbild · BlockML node packages · Package Implementation Workflow.

Markdown under `docs/` is **transitional**. The goal is total self-description: all package information lives as BML in that package's `blocks/`. MD files are **deleted** when all packages are implemented and all information has been transferred. **Do not implement a package from Markdown.**

### Package Implementation Workflow (mandatory)

Normative detail: `00_system.md` — Package Implementation Workflow · [BML library requirements (every package)](00_system.md#bml-library-requirements-every-package). Same three steps for every new package:

```text
1. Own BlockML library     — Library.bml after @blockml/core; link it in package.json
2. Migrate package MD      — all facts from that package’s docs/*.md into the library (SSOT)
3. Implement from BML only — TypeScript / tests / further BML from the library
                             If MD is still needed or contradicts BML: update the library first,
                             then continue from BML. Never implement directly from MD.
```

**BML library rules (summary):**

| Rule | Detail |
|---|---|
| **Complete library** | Every package needs a full BML library: migrated MD facts **plus** a model of the package (types, capabilities, config, documentation). Templates: `@blockml/bom`, `@blockml/parser`, `@blockml/serializer`. |
| **Stay in sync** | Keep BML and TypeScript aligned throughout development; parity tests (BML ↔ TS) where runtime code exists. Ideal: regenerate implementation from BML. |
| **Timing** | The library need not be finished before the first code slice — Steps 2 and 3 may iterate. **Done** means BML is complete, synchronized, and the documentation SSOT. |

See `00_system.md` — BML library requirements (every package) for the full normative text.

**Step 1 — `package.json` library pointer** (required). Copy the field from `@blockml/core`:

```json
{
  "name": "@blockml/core",
  "blockml": {
    "library": "./blocks/org/blockml/bml/Library.bml"
  }
}
```

`@machineblocks/core` uses `"library": "./blocks/com/machineblocks/bml/Library.bml"`. A new package points at **its** catalog, e.g. `@blockml/parser`:

```json
{
  "name": "@blockml/parser",
  "blockml": {
    "library": "./blocks/org/blockml/bml/compiler/parser/Library.bml"
  }
}
```

**Step 2** uses the MD → package map in `00_system.md`. Shared files (e.g. `13_bml_to_bom_mapping.md`) are split by section across owning libraries; Core language stays in `@blockml/core` and is linked, not copied.

**Step 3:** if a contradiction or a gap appears during implementation, stop, amend the package BML library, then resume. Implementation never proceeds on the direct basis of MD files.

Existing packages (`@blockml/core`, `@machineblocks/core`) already have a library. Remaining owned MD still migrates (Step 2) before further implementation from those packages (e.g. Core TS).

### FQN namespaces vs. npm packages

npm names (`@blockml/core`, `@blockml/parser`, `@blockml/compiler`, …) are **deployment units**. They are not the same as FQN package segments.

```text
node_modules/@blockml/core/               — BlockML node module
  package.json
  blocks/org/blockml/bml/core/*.bml       →  Block FQNs (org.blockml.bml.core.Block, …)
  blocks/org/blockml/bml/…                →  definition, type, service, documentation, …

node_modules/@machineblocks/core/         — BlockML node module
  package.json
  blocks/com/machineblocks/bml/           →  docs, MBOM grammar, examples (BML)
  lib/ · config/ · pattern/               →  SCAD reference renderer
```

Each root domain defines BML under `<domain>.bml.*`. No Block FQN or xmlns may exist outside the domain's `bml` namespace. See `01_bom_core.md` — Mandatory BML namespace.

### Standard library package

```json
{
  "name": "@blockml/core",
  "version": "0.0.0",
  "type": "module",
  "sideEffects": false,
  "blockml": {
    "library": "./blocks/org/blockml/bml/Library.bml"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "blocks", "schemas"],
  "scripts": {
    "build": "tsc --build"
  }
}
```

Entry point: `src/index.ts` — re-exports public API only.

### `@blockml/core` (BOM TypeScript + BML SSOT)

A BlockML node module (`package.json` + `blocks/`). Framework BML SSOT is `blocks/org/blockml/bml/`
([blockml-core](https://github.com/pks5/blockml-core), published as `@blockml/core`). Owns the shared TypeScript BOM contracts (once scaffolded). Parser,
serializer, validator, and compiler depend on the TS API — they do not redefine `BomDocument`.

**Today:** BML under `node_modules/@blockml/core/blocks/org/blockml/bml/`.

**Target layout:**

```text
node_modules/@blockml/core/                 — npm package root (= Library root)
  package.json
  blocks/org/blockml/bml/                   — package SSOT
    Library.bml · README.bml
    core/ · definition/ · service/ · type/ · …
```

Consumed by:

- TypeRegistry bootstrap (CLI scans `@blockml/core` + workspace + `@machineblocks/core`)
- Roundtrip corpus (T0/T1) and correctness tests
- Pre-rendered SCAD artifacts in `node_modules/@machineblocks/core/blocks/org/blockml/bml/service/`

### `@blockml/cli` (Node-only)

```json
{
  "name": "@blockml/cli",
  "version": "0.0.0",
  "type": "module",
  "bin": {
    "blockml": "./dist/cli.js"
  },
  "dependencies": {
    "@blockml/compiler": "workspace:*",
    "@blockml/core": "workspace:*",
    "@machineblocks/machineblocks-v3-scad-target": "workspace:*",
    "chokidar": "^4",
    "sharp": "^0.33"
  }
}
```

CLI modules (from runtime specs):

```text
src/
  cli.ts
  bootstrapTypeRegistry.ts
  bootstrapTargets.ts
  incrementalBuild.ts
  generateThumbnails.ts
  resolveMbLib.ts
  resolveOpenScad.ts
```

---

## Dependency Graph

Target dependency order after packages exist (Phase A starts at `@blockml/bom` TS + parser + serializer):

```text
@blockml/core (BML under blocks/ — npm; language SSOT, no Urmodell TS in Phase A)

@blockml/bom (TS: BomDocument, Diagnostic, bomEquals, B26 result types)
  ↑
@blockml/parser          @blockml/serializer
  ↑                            ↑
  └──────── @blockml/validator ─┘
                  ↑
           @blockml/compiler ──→ @blockml/engine-maker
                  ↑                    ↑
           @machineblocks/core BML         │
           (com.machineblocks.bml.*)      │
                  ↑                    │
           @machineblocks/machineblocks-v3-scad-target
                  ↑
           @blockml/cli
```

Implement packages **bottom-up**. Each package follows the Package Implementation Workflow **before** TypeScript: own BML library (`blockml.library` in `package.json`) → migrate that package’s Markdown into the library → implement from the library only. First TypeScript milestone: export types/interfaces that the **package BML** describes, with passing empty or smoke tests. See `00_system.md` — Package Implementation Workflow.

See **V1 Implementation Strategy** below — parser and serializer (with roundtrip tests) ship **before** validator and compiler.

---

## Build

```bash
npm run build          # tsc --build — all packages in dependency order
npm run clean          # remove dist/
```

Per-package during development:

```bash
npm run build -w @blockml/core
npm run build -w @blockml/parser
```

`tsc --build` is incremental — only rebuilds changed packages.

### Browser vs Node boundary

| Package | Browser-safe |
|---|---|
| `@blockml/core` | Yes |
| `@blockml/parser` | Yes |
| `@blockml/serializer` | Yes |
| `@blockml/validator` | Yes |
| `@blockml/compiler` | Yes |
| `@blockml/engine-maker` | Yes |
| `@machineblocks/machineblocks-v3-scad-target` | Yes |
| `@blockml/cli` | **No** — Node-only |

Enforced by: no `@types/node` in browser packages; ESLint `import/no-nodejs-modules` rule on browser packages (optional V1).

---

## Testing

Tool: **Vitest** (see `06_compiler.md`).

Root `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
  },
});
```

### Test layers

```text
1. Unit tests          — per package, colocated src/**/*.test.ts
2. Roundtrip tests     — tests/roundtrip/ (V1 gate — before compiler)
3. Correctness tests   — tests/correctness/<fixture>/input + .expected.*
4. Snapshot tests      — tests/snapshots/ (after correctness baseline)
```

**V1 priority:** Roundtrip tests are the first integration gate. See **V1 Implementation Strategy** below.

Correctness fixtures may reference `@machineblocks/core` examples:

```text
tests/correctness/
  calibrator/
    Calibrator.bml              — copy or symlink from @machineblocks/core
    Calibrator.expected.scad
  standard-brick/
    StandardBrickPresets.bml
    StandardBrick.expected.json
```

Run:

```bash
npm test                      # all
npm run test:roundtrip        # roundtrip only (V1 gate)
npm run test:correctness      # correctness only (after compiler)
npm test -- -u                # update snapshots (intentional changes)
```

Thumbnail / OpenSCAD tests: **optional** integration suite — skipped in CI when `OPENSCAD_PATH` unset.

---

## Root Scripts Summary

| Script | Action |
|---|---|
| `npm install` | Install all workspace dependencies |
| `npm run build` | Compile all packages → `dist/` |
| `npm run clean` | Remove build outputs |
| `npm test` | Vitest — unit + integration |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:roundtrip` | Roundtrip tests only (V1 gate) |
| `npm run test:correctness` | SCAD/JSON correctness tests (after compiler) |
| `npm link -w @blockml/cli` | Global `blockml` command |
| `npm run lint` | ESLint (when configured) |

---

## IDE Setup

### XSD / BML authoring

Copy or generate `catalog.xml` at repo root (see `00_system.md` — catalog.xml). Points namespace URLs to:

```text
schemas/bml.xsd
node_modules/@machineblocks/machineblocks-v3-scad-target/schemas/machineblocks/*.xsd
```

VS Code / Cursor: install **XML** extension; set `xml.catalog.catalogs` to `./catalog.xml`.

Until schema packages exist, authors reference published URLs in `xsi:schemaLocation` — local catalog activates after first `npm install`.

**V2:** `@blockml/lsp` provides semantic IDE backend via stdio LSP (`blockml-lsp`): diagnostics from parse + validate. XSD catalog remains useful for XML completion until LSP covers the same ground. IDE grammar/extensions stay in external packages. See `01_bom_core.md` — Language Server.

### Recommended editor settings (`.vscode/settings.json`)

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.formatOnSave": true,
  "files.associations": {
    "*.bml": "xml"
  }
}
```

---

## `.gitignore` (repository)

```text
node_modules/
dist/
coverage/
.bom-cache/
*.tsbuildinfo

# OS
.DS_Store

# Vitest / temp
.vitest/
tmp/
```

Content projects (outside this repo) also ignore `scad/` output and `.bom-cache/` — see `07_cli.md`.

---

## Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `MACHINEBLOCKS_LIB_PATH` | CLI | Override `@machineblocks/core` root (`mbLibPath`) |
| `OPENSCAD_PATH` | CLI | OpenSCAD executable for thumbnails |
| `NODE_ENV` | Vitest | `test` in test runs |

---

## CI Sketch (GitHub Actions)

```yaml
name: ci
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm test
      # OpenSCAD + thumbnail tests: optional job with openscad installed
```

---

## V1 Implementation Strategy

> **Decision (V1):** Implement **parser and serializer first**, prove correctness via **roundtrip tests** against the existing BML corpus, **before** validator, compiler, targets, or CLI compile paths.

This follows the core principle **BML → BOM → BML must always be possible** (`01_bom_core.md`, `13_bml_to_bom_mapping.md`). The roundtrip loop validates the language layer in isolation — without render targets, engines, or SCAD output.

### Phase A slice — what to implement (normative)

Full language rules live in Core BML (`org.blockml.bml.*`) plus the parser/serializer package libraries once migrated. Transitional MD (`02` / `13` / `19`) is the holding handbook until Step 2 of the Package Implementation Workflow. **Phase A implements and gates only this slice** (same table as `13_bml_to_bom_mapping.md` — V1 Parser / Serializer Scope) — after those rules are in the owning package BML:

| In Phase A | Out of Phase A |
|---|---|
| XML `.bml` → Urmodell (parser steps `[1]`–`[5]`; DOM via `@xmldom/xmldom` B18) | JSON authoring (not planned) |
| Hardcoded map + hardcoded inverse serialize | Meta-`bml:xml` drive (`19`) |
| `ExpressionValue.raw` (+ embedded `{ raw, start, end }`) | `parseExpression()` / AST |
| Directives unexpanded on Urmodell | Expansion / effective members |
| Single-file parse | TypeRegistry / cross-file |
| Tolerant parse without XSD files | XSD as hard requirement |
| Preserve authored `bml:xml` for roundtrip | Interpret Definition grammar |
| Preserve XML comments on elements (B11) | PIs; formatting whitespace (B13 — may normalize) |
| Canonical emit order from Definition members (B12) — V1 hardcoded | V2: order read dynamically from Definition `.bml` |
| Dual element\|attribute authoredPlacement (D9) | Collapse dual forms to D1 without storing choice |
| Visibility prefixes from visibility on emit (B14) | Emit logical names without `_`/`__` for private/protected |
| Boolean value casing normalize (B15); Boolean.True/False as types (B16) | Collapse Boolean.True to literal true |
| Omit-by-default emit (B17) | Emit all default-false / empty noise |
| Test Layer A roundtrip (T0–T3) | Stage 2 validate, Stage 3 compile |

**Definition of Done:** `parse(serialize(parse(f)))` deep-equals `parse(f)` for the corpus **modulo provenance (B20)** — no validator, no target, no bootstrap. XML source fidelity is **not** required (B10).

```text
INPUT (BML-centric)
  @blockml/parser       — BML → Urmodell / Canonical BOM (Stage 1, no semantics)
  @blockml/validator    — Urmodell → diagnostics + pragmatic model (Stage 2) — after roundtrip gate
                          Does not abort callers; returns diagnostics only

OUTPUT (roundtrip)
  @blockml/serializer   — Urmodell → canonical BML XML (lossless inverse of parser mapping)
                          Must accept any Urmodell provenance (parse today; BomBuilder seal in V3)
                          No validator dependency

ORCHESTRATION (CLI / IDE / LSP)
  Hosts call parse → optional validate → serialize/compile
  Abort-on-diagnostics is host policy (e.g. refuse compile on errors; still allow format)

ORCHESTRATION (later)
  @blockml/compiler     — Facade + Target Registry + render pipeline

AUTHORING (V3)
  BomBuilder            — writable session → seal() → Urmodell (same types as parser output)
                          See `01_bom_core.md` — BomBuilder; V1 must stay Builder-ready

IDE (V2)
  @blockml/lsp          — Language Server; reuses parser + validator + serializer + core
                          See `01_bom_core.md` — Language Server; V1 must populate source spans
```

The serializer is **not** a render target emitter (SCAD, JSON, …). Target output stays in `@blockml/compiler` and domain target packages.

**V1 serializer note:** The meta-driven serializer from `19_definition_blocks_and_bml_xml.md` is the long-term target. V1 ships a **hardcoded inverse mapper** aligned with `13_bml_to_bom_mapping.md` — same approach as the V1 parser. Roundtrip tests still catch mapping gaps and information loss.

**Builder- and LSP-ready constraint (V1 onward):** BOM interfaces in `@blockml/bom` must remain construction-friendly and provenance-agnostic (optional source spans; factory helpers for nodes). Parser **should populate spans** for diagnostics and future LSP. Do not bake parse-only invariants into types. Structural authoring stays off the pragmatic resolve path. Tolerant parse is preferred where it does not undermine roundtrip tests on valid corpus files.

### Build phases

```text
Phase A — Language loop (V1 gate)
  1. BOM types + Diagnostic          — @blockml/bom TS from BOM BML (migrate `12` Urmodell slice)
                                      ExpressionValue = { raw } only; no AST fields on Urmodell
  2. Parser                          — @blockml/parser BML library (done); maintain TS parity → steps [1]–[5]
  3. Serializer                      — @blockml/serializer BML library (done); implement/maintain emit from BML SSOT
  4. Roundtrip tests                 — tests/roundtrip/ against BML corpus

Phase B — Semantic layer
  5. parseExpression() + ExpressionNode — @blockml/core utility (AST as ParsedExpression;
                                      never written back into Canonical BOM)
  6. Validator                       — @blockml/validator (TypeRegistry + semantic checks;
                                      may call parseExpression for expression correctness)

Phase C — Compile pipeline (BlockDoc-first)
  7. Compiler facade                 — @blockml/compiler (C2, C3, C7)
     — SSOT: org.blockml.bml.compiler.runtime.documentation.Introduction
  8. CLI + targets[]                 — @blockml/cli; SSOT: org.blockml.bml.cli.documentation.Introduction
  9. **First Stage-3 gate: BlockDoc** — @blockml/blockdoc-target / CLI `blockdoc`
     — SSOT: org.blockml.bml.target.blockdoc.documentation.Introduction
     — compile scope: library/corpus (`blockml compile blockdoc`), not per-file --all
     — proves Facade + Target Registry with minimal domain surface
 10. Further toolchain RTs (after BlockDoc control path works)
     a. XSD target      — @blockml/xsd-target / `xsd`
        — SSOT: org.blockml.bml.target.xsd.documentation.Introduction (generate only)
     b. FatBlock target — @blockml/fatblock-target / `fatblock`
        — SSOT: org.blockml.bml.target.fatblock.documentation.Introduction (V1 folder pool)
     — XSD *validation* of authoring only after (a) can generate schemas (CLI-owned)
     — XSD validation must stay **disableable** (`--no-xsd` / `xsdValidation`)
 11. Engine (optional in this repo)  — @blockml/engine-maker for consumers
 12. Correctness + snapshot tests    — tests/correctness/, tests/snapshots/
                                       (MB product path is OUT OF SCOPE — MachineBlocks mono-repo)
```

**Do not start Phase C until Phase A roundtrip tests pass** for the agreed corpus tiers (see below).

**Phase C ordering (**decided**):**

| Order | Target | Why | Where |
|---|---|---|---|
| **1st** | **BlockDoc** (`blockdoc`) | **Control gate** — browseable HTML of the BML corpus | this repo |
| 2nd+ | **XSD** (`xsd`) | Schemas for IDE / later validation — **SSOT:** `org.blockml.bml.target.xsd.documentation.Introduction` | this repo |
| 2nd+ | **FatBlock** (`fatblock`) | Portable `.bml` folder bundle (V1); closure planned v2 | this repo |
| Later | **machineblocks-v3-scad** | Product SCAD target + thin `@machineblocks/cli` | **MachineBlocks mono-repo (out of scope here)** |

BlockDoc is the V1 **first implemented** Stage-3 target for pipeline + corpus control (`blockml compile blockdoc`, library/corpus scope — see `org.blockml.bml.compiler.runtime.documentation.CompileScopeRules`). `bom.config.json` → `targets[]` is **V1** (default `["blockdoc"]`) — see `07_cli.md` · `14_compiler_runtime.md` TOC. MachineBlocks users use `@machineblocks/cli` from the MachineBlocks mono-repo for the product chain.

### Roundtrip test contract

```text
original.bml
  → parse()      → ParseResult { document, diagnostics, success }
  → serialize()  → SerializeResult { text, diagnostics, success }
  → parse()      → ParseResult'
  → bomEquals(document, document')   // B20 — strip provenance
```

**Public API (B26 — decided):** Sync string in/out; results carry `diagnostics[]` (same `Diagnostic` as validator/compiler). Authoring errors do **not** throw. See § Public API below.

**Authoritative gate (B10 + B20):** BOM deep equality of the **semantic** Urmodell only. A test fails if and only if `BomDocument` ≠ `BomDocument'` **after stripping provenance** (`source` / `sourceLocation` / optional end spans on every node). Offsets and `file` paths always change across `serialize → parse`; they must not fail Phase A.

**Not a gate:** byte-identical or normalized XML equality of `reserialized.bml` vs `original.bml`. XML diffs may be logged as diagnostics / optional snapshots for humans; they must not fail Phase A. Serializer emit may differ in whitespace, attribute order, Boolean casing (`True`→`true`), self-closing style, and other surface details so long as re-parse yields an equal Urmodell (modulo B20).

**Equality helper:** prefer a shared `bomEquals(a, b)` / `stripProvenance(doc)` in `@blockml/bom` so roundtrip, correctness, and future LSP fixtures share one definition of “same BOM”.

Parser is **single-file scoped** — roundtrip tests do not require TypeRegistry bootstrap (`13_bml_to_bom_mapping.md`).

### Public API (`parse` / `serialize`) — B26

> **Normative for Phase A.** Result/options types and `bomEquals` live in `@blockml/bom` (`org.blockml.bml.bom.documentation.PublicApi`). **Parser entry and mapping rules:** `@blockml/parser` BML — `org.blockml.bml.compiler.parser.documentation.PublicApi` → ReadNext chain. **Serializer entry and emit rules:** `@blockml/serializer` BML — `org.blockml.bml.compiler.serializer.documentation.PublicApi` → ReadNext chain.

**Principles:** sync only (no FS/network in these functions); no throw on recoverable authoring/mapping errors (internal bugs may throw); tolerant parse by default; shared `Diagnostic` with Stage 2 / compiler; no `validate` option on parse.

```typescript
// ——— @blockml/bom ———

interface ParseResult {
  /** null only on hard fail (format / malformed XML / no usable root) */
  document: BomDocument | null
  diagnostics: Diagnostic[]
  /** false if any diagnostic has severity === "error" */
  success: boolean
}

interface SerializeResult {
  /** null only if serialize cannot produce text */
  text: string | null
  diagnostics: Diagnostic[]
  success: boolean
}

interface ParseOptions {
  /** default: "<memory>" — written to BomDocument.source.filePath */
  filePath?: string
  /** default true — keep mapping after errors; attach document when possible */
  continueOnError?: boolean
}

interface SerializeOptions {
  /** default 2 — pretty-print spaces (B13); 0 = compact */
  indent?: number
  /** default false — omit <?xml …?> (B17 / B24) */
  xmlDeclaration?: boolean
}

/** Structural equality modulo provenance (B20) */
function bomEquals(a: BomDocument, b: BomDocument): boolean
function stripProvenance<T>(node: T): T

// ——— @blockml/parser ———
function parse(source: string, options?: ParseOptions): ParseResult

// ——— @blockml/serializer ———
function serialize(document: BomDocument, options?: SerializeOptions): SerializeResult
```

**`parse`:** See `org.blockml.bml.compiler.parser.documentation.PublicApi`. B24 detect → [2] xmldom → [3]–[5] map. Hard fail → `document: null`. Mapping errors/warnings → `diagnostics`; with `continueOnError` (default) still return a document when possible. Warnings alone leave `success: true`.

**`serialize`:** See `org.blockml.bml.compiler.serializer.documentation.PublicApi`. Emit per B12–B25 / D8–D9. `BML_NAMESPACE_UNBOUND` → error diagnostic; prefer still emitting `text` when possible (host may abort). Does **not** call the validator.

**Not in V1 API:** `parseFile` / `serializeFile`, async variants, streaming, `parse({ validate: true })`.

Aligned with `CompilerResult<T>` (`06_compiler.md`) — same diagnostics model.

### BML test corpus (fixture tiers)

Run roundtrip tests against files already in the repository — grow tiers as parser coverage expands:

| Tier | Source | Examples |
|---|---|---|
| **T0 — Minimal** | `node_modules/@blockml/core/blocks/org/blockml/bml/language/`, `node_modules/@blockml/core/blocks/org/blockml/bml/service/` | `TypeScript.bml`, `Math.bml` |
| **T1 — Framework** | `node_modules/@blockml/core/blocks/` | `Block.bml`, `BlockDefinition.bml`, `MemberDefinition.bml` |
| **T2 — Domain** | `node_modules/@machineblocks/core/blocks/com/machineblocks/bml/` | `NativeBlock.bml`, `CompositeBlock.bml`, `Set.bml` |
| **T3 — Real-world** | `node_modules/@machineblocks/core/blocks/com/machineblocks/bml/` | `Calibrator.bml`, `Standard.bml`, `Cross.bml` |

Add new framework BML to T1 as it lands — the Definition meta-model corpus is the highest-value roundtrip fixture set.

### What is explicitly deferred

| Concern | When |
|---|---|
| Expression AST (`parseExpression`) | Phase B — after roundtrip gate; AST never written into Canonical BOM |
| Cross-file reference resolution | Phase B (validator + TypeRegistry bootstrap) |
| Constraint / inheritance validation | Phase B |
| XSD as hard Stage-1 requirement | Never for Phase A — see below |
| BlockDoc Render Target (HTML docs) | Phase C — **first** Stage-3 / V1 control RT (`blockdoc`); default in `targets[]` |
| XSD Render Target (generate `.xsd`) | Phase C — after BlockDoc; `@blockml/xsd-target` / CLI `xsd`; **SSOT:** `org.blockml.bml.target.xsd.documentation.Introduction` |
| FatBlock Render Target (embed bundle) | Phase C — after / beside XSD; `@blockml/fatblock-target` / CLI `fatblock`; **Stage 2 first** |
| XSD validation of BML authoring | **After** XSD Render Target ships; **always disableable** (`--no-xsd` / `xsdValidation`) |
| Meta-driven `bml:xml` parser/serializer | Post–Phase A (see `19_definition_blocks_and_bml_xml.md`) |
| SCAD / Customizer JSON render output | Phase C **product** path (after BlockDoc control gate) |
| CLI `blockml compile` + `targets[]` | Phase C / V1 — config bootstraps available targets; default `["blockdoc"]` |

---

## Implementation Order

Recommended first coding milestones (aligned with **V1 Implementation Strategy** above):

```text
1. @blockml/bom BML + TS       — packages/bom; migrate `12` Urmodell slice; BomDocument + Diagnostic + bomEquals
2. @blockml/core BML          — already present (node_modules/@blockml/core) — language SSOT only
3. @blockml/parser            — BML library migrated (mapping SSOT); maintain TS parity → `@xmldom/xmldom` + steps [1]–[5]
4. @blockml/serializer        — BML library migrated (emit rules SSOT); maintain TS parity → BOM → BML
5. Roundtrip tests            — tests/roundtrip/ (T0 → T3 corpus tiers; may use @machineblocks/core as fixture dep)
6. parseExpression()          — @blockml/core utility (AST as ParsedExpression; no Urmodell write-back)
7. @blockml/validator         — library + migrate owned MD → Stage 2
8. @blockml/compiler          — SSOT: org.blockml.bml.compiler.runtime.documentation.Introduction (C1–C7); migrate done from 06/14
9. BlockDoc RT first          — library + owned slices → @blockml/blockdoc-target (control gate)
10. XSD / FatBlock RTs         — XSD SSOT: org.blockml.bml.target.xsd.documentation.Introduction; FatBlock SSOT: org.blockml.bml.target.fatblock.documentation.Introduction
11. @blockml/engine-maker      — library + owned MD → RenderEngine stub (consumed by domain targets)
12. @blockml/cli               — SSOT: org.blockml.bml.cli.documentation.Introduction; V1 validate/compile

OUT OF SCOPE for this repo (MachineBlocks mono-repo):
  — @machineblocks/core BML + SCAD lib
  — @machineblocks/…-scad-target (migrate 05)
  — @machineblocks/cli (thin host)
  — MB correctness fixtures as product ownership (may still be npm deps for toolchain tests)
```

Every numbered package step includes the Package Implementation Workflow (library → migrate MD → implement from BML). There is no TypeScript-first shortcut.

Specs dependency:

```text
Phase A  ✅  12_bom_object_model, Expression AST
Phase B  ✅  13_bml_to_bom_mapping
Phase C  ✅  14_compiler_runtime
Phase D  ✅  15_dev_setup (this document)
```

---

## Related Documents

| Topic | Document |
|---|---|
| Repository architecture | `00_system.md` |
| Package Implementation Workflow | `00_system.md` — Package Implementation Workflow |
| BML library requirements | `00_system.md` — BML library requirements (every package) |
| BOM types + ParseResult (B26) | `12_bom_object_model.md` (migrate into `@blockml/bom` BML before BOM TS) |
| Public `parse` / `serialize` (B26) | this document — Public API |
| Parser mapping | `13_bml_to_bom_mapping.md` (migrate into parser/serializer BML before implement) |
| Runtime / Facade (C1–C7) | `org.blockml.bml.compiler.runtime.*` · `14_compiler_runtime.md` TOC |
| Cache / thumbnails (C5/C6) | `org.blockml.bml.cli.documentation.ScopeExclusions` |
| CLI commands | `07_cli.md` |
| SCAD fixtures | `node_modules/@machineblocks/core/` |
