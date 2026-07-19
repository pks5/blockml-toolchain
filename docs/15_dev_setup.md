# Development Setup

version: 0.1.0

## Purpose of this Document

This document defines the **monorepo development setup** for the BOM Compiler (`blockml` repository) — tooling, package layout, build order, scripts, testing, and IDE configuration.

For architecture and package responsibilities see `00_system.md`.
For compiler runtime (bootstrap, facade, cache) see `14_compiler_runtime.md`.
For testing strategy see `06_compiler.md` — Testing Strategy.

Implementation code is scaffolded according to this document. **As of now** the repo holds **specs + BML corpus** only — see § Repository Layout. TypeScript packages and the root npm workspace are added incrementally (Phase A first).

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
| **Package scope** | `@blockml/*`, `@machineblocks/*` — no `@bom/*` |
| **Browser packages** | No `fs`, `path`, `child_process` in core/parser/compiler/targets |

---

## Prerequisites

```text
git                 — clone + submodules
Node.js >= 20       — build + CLI + Vitest
npm >= 10           — workspaces (bundled with Node 20+)
OpenSCAD (optional) — thumbnail generation only; not required for build/test
```

---

## First-Time Setup

Until the workspace is scaffolded, clone + submodules is enough to browse specs and BML:

```bash
git clone <repo-url> blockml
cd blockml
git submodule update --init --recursive
# scad-lib under domains/machineblocks/machineblocks-v3-scad-target/runtimes/
```

After Phase A workspace scaffold exists:

```bash
npm install
npm run build
npm link -w @blockml/cli    # exposes `bom` globally (once)
bom --version
```

`git submodule update --init --recursive` is **required** for scad-lib fixtures (Test Layer B/C and T3 corpus).

After pulling updates:

```bash
git pull
git submodule update --recursive
npm install
npm run build
```

---

## Repository Layout

### As of now (specs + BML corpus)

No root `package.json` / npm workspaces yet. TypeScript packages (`parser`, `serializer`, …) are **not** scaffolded.

```text
blockml/
  docs/                          — specifications (authoritative Markdown)
  packages/
    core/
      blocks/org/blockml/bml/    — framework BML SSOT (core, definition, type, service, …)
      src/org/blockml/language/  — Language blocks (TypeScript.bml, OpenSCAD.bml, …)
      test/                      — BML/constraint fixtures (not Vitest packages yet)
  domains/
    machineblocks/
      mbom/blocks/com/machineblocks/bml/   — MBOM domain BML (NativeBlock, types, …)
      machineblocks-v3-scad-target/
        runtimes/scad-lib/                 — Git submodule (SCAD runtime + example .bml/.scad)
  scripts/
```

**There is no `@blockml/core-services` package.** Built-in services (`Math`, `Strings`, …) live under `packages/core/blocks/org/blockml/bml/service/`.

### Target packages (end state)

| npm package | Path | When |
|---|---|---|
| `@blockml/core` | `packages/core` | Phase A — add TS (`BomDocument`, …) beside existing BML |
| `@blockml/parser` | `packages/parser` | Phase A |
| `@blockml/serializer` | `packages/serializer` | Phase A |
| `@blockml/validator` | `packages/validator` | Phase B |
| `@blockml/compiler` | `packages/compiler` | Phase C |
| `@blockml/blockdoc-target` | `packages/blockdoc-target` | Phase C — **first** Stage-3 / V1 control RT; registry `"blockdoc"` |
| `@blockml/xsd-target` | `packages/xsd-target` | Phase C — after BlockDoc; registry `"xsd"` |
| `@blockml/fatblock-target` | `packages/fatblock-target` | Phase C — after / beside XSD; registry `"fatblock"` |
| `@blockml/cli` | `packages/cli-tools` | Phase C — reads `targets[]` (default `["blockdoc"]`) |
| `@blockml/engine-maker` | `engines/maker-engine` | Phase C — needed for SCAD product path |
| `@machineblocks/mbom` | `domains/machineblocks/mbom` | Phase C (BML already present; package shell + exports) |
| `@machineblocks/machineblocks-v3-scad-target` | `domains/machineblocks/machineblocks-v3-scad-target` | Phase C — **product** RT; after BlockDoc control gate |
| `@blockml/lsp` | `packages/lsp` | V2 — package name **decided** |

### Target monorepo tree

After scaffolding (from `00_system.md`):

```text
blockml/
  package.json                 — root workspace (to create)
  tsconfig.base.json
  tsconfig.json
  catalog.xml                  — XSD catalog (when schemas ship)
  .gitignore

  packages/
    core/                      — @blockml/core (BML + BOM TS + utilities)
    parser/                    — @blockml/parser
    serializer/                — @blockml/serializer
    validator/                 — @blockml/validator
    compiler/                  — @blockml/compiler
    xsd-target/                — @blockml/xsd-target — registry "xsd"
    blockdoc-target/           — @blockml/blockdoc-target — registry "blockdoc"
    fatblock-target/           — @blockml/fatblock-target — registry "fatblock"
    cli-tools/                 — @blockml/cli          (Node-only)
    lsp/                       — @blockml/lsp          (V2)

  engines/
    maker-engine/              — @blockml/engine-maker

  domains/
    machineblocks/
      mbom/                    — @machineblocks/mbom
        blocks/com/machineblocks/bml/
      machineblocks-v3-scad-target/
        src/                   — target implementation
        runtimes/scad-lib/     — Git submodule

  tests/
    roundtrip/                 — parse → serialize → parse (V1 gate)
    correctness/               — after compiler exists
    snapshots/

  docs/
```

**Scaffold next (Phase A):** root workspace + `packages/parser`, `packages/serializer`, and TypeScript entrypoints under `packages/core/src/` for BOM types. Empty shells: `package.json`, `tsconfig.json`, `src/index.ts` per package below.

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
    "engines/*",
    "domains/machineblocks/mbom",
    "domains/machineblocks/machineblocks-v3-scad-target"
  ],
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

Workspace dependency links use `"@blockml/core": "workspace:*"` (npm 7+).

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
    { "path": "packages/core" },
    { "path": "packages/parser" },
    { "path": "packages/serializer" },
    { "path": "packages/validator" },
    { "path": "packages/compiler" },
    { "path": "engines/maker-engine" },
    { "path": "domains/machineblocks/mbom" },
    { "path": "domains/machineblocks/machineblocks-v3-scad-target" },
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

### FQN namespaces vs. npm packages

npm workspace names (`@blockml/core`, `@blockml/parser`, `@blockml/compiler`, …) are **deployment units**. They are not the same as FQN package segments.

```text
@blockml/core npm package may contain:
  blocks/org/blockml/bml/core/*.bml       →  Block FQNs (org.blockml.bml.core.Block, …)
  blocks/org/blockml/bml/compiler/*.bml   →  compiler domain Blocks (org.blockml.bml.compiler.*, …)
  src/**/*.ts                             →  BOM interfaces (BomDocument, …), TypeRegistry, framework utilities
```

Each root domain defines BML under `<domain>.bml.*`. No Block FQN or xmlns may exist outside the domain's `bml` namespace. See `01_bom_core.md` — Mandatory BML namespace.

### Standard library package

```json
{
  "name": "@blockml/core",
  "version": "0.0.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "schemas"],
  "scripts": {
    "build": "tsc --build"
  }
}
```

Entry point: `src/index.ts` — re-exports public API only.

### `@blockml/core` (BML SSOT + BOM TypeScript)

Owns framework BML **and** (once scaffolded) the shared TypeScript BOM contracts. Parser, serializer, validator, and compiler depend on the TS API — they do not redefine `BomDocument`.

**Today:** BML under `blocks/` and language samples under `src/org/blockml/language/`. No `package.json` / `tsc` yet.

**Target layout:**

```text
packages/core/
  package.json          — name: @blockml/core, private: true
  blocks/
    org/blockml/bml/core/         — Block, Entity, …
    org/blockml/bml/definition/   — BlockDefinition, …
    org/blockml/bml/service/      — Math, Strings, Numbers, Lists, Bools  (NOT a separate npm package)
    org/blockml/bml/type/         — …
  src/
    org/blockml/language/         — TypeScript.bml, OpenSCAD.bml (present today)
    index.ts                      — re-exports BomDocument, Diagnostic, TypeRegistry, utilities (Phase A)
```

Consumed by:

- TypeRegistry bootstrap (CLI scans workspace + scad-lib)
- Roundtrip corpus (T0/T1) and correctness tests
- Pre-rendered SCAD artifacts in `scad-lib/blocks/org/blockml/bml/service/`

### `@blockml/cli` (Node-only)

```json
{
  "name": "@blockml/cli",
  "version": "0.0.0",
  "type": "module",
  "bin": {
    "bom": "./dist/cli.js"
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

Target dependency order after packages exist (Phase A starts at `core` TS + parser + serializer):

```text
@blockml/core (BML under blocks/ + language under src/ — no package deps)

@blockml/core (TS: BomDocument types, TypeRegistry, framework utilities)
  ↑
@blockml/parser          @blockml/serializer
  ↑                            ↑
  └──────── @blockml/validator ─┘
                  ↑
           @blockml/compiler ──→ @blockml/engine-maker
                  ↑                    ↑
           @machineblocks/mbom        │
                  ↑                    │
           @machineblocks/machineblocks-v3-scad-target
                  ↑
           @blockml/cli
```

Implement packages **bottom-up**. Each package's first milestone: export types/interfaces from spec (`12_bom_object_model.md`, etc.) with passing empty or smoke tests.

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
| `@machineblocks/mbom` | Yes |
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

Correctness fixtures may reference scad-lib examples:

```text
tests/correctness/
  calibrator/
    Calibrator.bml              — copy or symlink from scad-lib
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
| `npm link -w @blockml/cli` | Global `bom` command |
| `npm run lint` | ESLint (when configured) |

---

## IDE Setup

### XSD / BML authoring

Copy or generate `catalog.xml` at repo root (see `00_system.md` — catalog.xml). Points namespace URLs to:

```text
node_modules/@blockml/core/schemas/core/*.xsd
node_modules/@machineblocks/mbom/schemas/machineblocks/*.xsd
```

VS Code / Cursor: install **XML** extension; set `xml.catalog.catalogs` to `./catalog.xml`.

Until schema packages exist, authors reference published URLs in `xsi:schemaLocation` — local catalog activates after first `npm install`.

**V2:** `@blockml/lsp` becomes the semantic IDE backend (diagnostics, hover, format via parser/validator/serializer). XSD catalog remains useful for XML completion until LSP covers the same ground. See `01_bom_core.md` — Language Server.

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
| `MACHINEBLOCKS_LIB_PATH` | CLI | Override scad-lib root (`mbLibPath`) |
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
        with:
          submodules: recursive
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

Full language rules live in `02` / `13` / `19`. **Phase A implements and gates only this slice** (same table as `13_bml_to_bom_mapping.md` — V1 Parser / Serializer Scope):

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

**Definition of Done:** `parse(serialize(parse(f)))` deep-equals `parse(f)` for the corpus — no validator, no target, no bootstrap. XML source fidelity is **not** required (B10).

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

**Builder- and LSP-ready constraint (V1 onward):** BOM interfaces in `@blockml/core` must remain construction-friendly and provenance-agnostic (optional source spans; factory helpers for nodes). Parser **should populate spans** for diagnostics and future LSP. Do not bake parse-only invariants into types. Structural authoring stays off the pragmatic resolve path. Tolerant parse is preferred where it does not undermine roundtrip tests on valid corpus files.

### Build phases

```text
Phase A — Language loop (V1 gate)
  1. BOM types + Diagnostic          — @blockml/core TS (12_bom_object_model.md)
                                      ExpressionValue = { raw } only; no AST fields on Urmodell
  2. Parser                          — @blockml/parser (parser steps [1]–[5]; preserve expression raw)
  3. Serializer                      — @blockml/serializer (inverse mapping; emit raw)
  4. Roundtrip tests                 — tests/roundtrip/ against BML corpus

Phase B — Semantic layer
  5. parseExpression() + ExpressionNode — @blockml/core utility (AST as ParsedExpression;
                                      never written back into Canonical BOM)
  6. Validator                       — @blockml/validator (TypeRegistry + semantic checks;
                                      may call parseExpression for expression correctness)

Phase C — Compile pipeline (BlockDoc-first)
  7. Compiler facade                 — @blockml/compiler (C2, C3)
  8. CLI + targets[]                 — @blockml/cli; bom.config.json targets (default ["blockdoc"])
  9. **First Stage-3 gate: BlockDoc** — @blockml/blockdoc-target / CLI `blockdoc`
     — static HTML by package/FQN hierarchy — corpus control / review
     — proves Facade + Target Registry with minimal domain surface
 10. Further toolchain RTs (after BlockDoc control path works)
     a. XSD target      — @blockml/xsd-target / `xsd`
     b. FatBlock target — @blockml/fatblock-target / `fatblock`
     — XSD *validation* of authoring only after (a) can generate schemas
     — XSD validation must stay **disableable** (`--no-xsd` / `xsdValidation`)
 11. Engine + MachineBlocks SCAD     — product path after toolchain control
     — @blockml/engine-maker, machineblocks-v3-scad-target
 12. Correctness + snapshot tests    — tests/correctness/, tests/snapshots/
```

**Do not start Phase C until Phase A roundtrip tests pass** for the agreed corpus tiers (see below).

**Phase C ordering (**decided**):**

| Order | Target | Why |
|---|---|---|
| **1st** | **BlockDoc** (`blockdoc`) | **Control gate** — browseable HTML of the BML corpus (package/FQN hierarchy); ideal to verify structure after roundtrip |
| 2nd+ | **XSD** (`xsd`) | Schemas for IDE / later validation; always-disableable validation escape hatch |
| 2nd+ | **FatBlock** (`fatblock`) | Registry closure + embed model; Stage 2 first |
| Later | **machineblocks-v3-scad** | Primary **product** target — more domain surface (NativeBlock, engine, scad-lib) |

MachineBlocks SCAD remains the reference **product** target. BlockDoc is the V1 **first implemented** Stage-3 target for pipeline + corpus control. `bom.config.json` → `targets[]` is **V1** (default `["blockdoc"]`) — see `07_cli.md` · `14_compiler_runtime.md` C3.

### Roundtrip test contract

```text
original.bml
  → parse()      → BomDocument
  → serialize()  → reserialized.bml
  → parse()      → BomDocument'
  → deepEqual(BomDocument, BomDocument')
```

**Authoritative gate (B10):** BOM deep equality only. A test fails if and only if `BomDocument` ≠ `BomDocument'`.

**Not a gate:** byte-identical or normalized XML equality of `reserialized.bml` vs `original.bml`. XML diffs may be logged as diagnostics / optional snapshots for humans; they must not fail Phase A. Serializer emit may differ in whitespace, attribute order, Boolean casing (`True`→`true`), self-closing style, and other surface details so long as re-parse yields an equal Urmodell.

Parser is **single-file scoped** — roundtrip tests do not require TypeRegistry bootstrap (`13_bml_to_bom_mapping.md`).

### BML test corpus (fixture tiers)

Run roundtrip tests against files already in the repository — grow tiers as parser coverage expands:

| Tier | Source | Examples |
|---|---|---|
| **T0 — Minimal** | `packages/core/src/org/blockml/language/`, `packages/core/blocks/org/blockml/bml/service/` | `TypeScript.bml`, `Math.bml` |
| **T1 — Framework** | `packages/core/blocks/` | `Block.bml`, `BlockDefinition.bml`, `MemberDefinition.bml` |
| **T2 — Domain** | `domains/machineblocks/mbom/blocks/` | `NativeBlock.bml`, `CompositeBlock.bml`, `Set.bml` |
| **T3 — Real-world** | `domains/machineblocks/machineblocks-v3-scad-target/runtimes/scad-lib/blocks/` | `Calibrator.bml`, `Standard.bml`, `Cross.bml` |

Add new framework BML to T1 as it lands — the Definition meta-model corpus is the highest-value roundtrip fixture set.

### What is explicitly deferred

| Concern | When |
|---|---|
| Expression AST (`parseExpression`) | Phase B — after roundtrip gate; AST never written into Canonical BOM |
| Cross-file reference resolution | Phase B (validator + TypeRegistry bootstrap) |
| Constraint / inheritance validation | Phase B |
| XSD as hard Stage-1 requirement | Never for Phase A — see below |
| BlockDoc Render Target (HTML docs) | Phase C — **first** Stage-3 / V1 control RT (`blockdoc`); default in `targets[]` |
| XSD Render Target (generate `.xsd`) | Phase C — after BlockDoc; `@blockml/xsd-target` / CLI `xsd` |
| FatBlock Render Target (embed bundle) | Phase C — after / beside XSD; `@blockml/fatblock-target` / CLI `fatblock`; **Stage 2 first** |
| XSD validation of BML authoring | **After** XSD Render Target ships; **always disableable** (`--no-xsd` / `xsdValidation`) |
| Meta-driven `bml:xml` parser/serializer | Post–Phase A (see `19_definition_blocks_and_bml_xml.md`) |
| SCAD / Customizer JSON render output | Phase C **product** path (after BlockDoc control gate) |
| CLI `bom compile` + `targets[]` | Phase C / V1 — config bootstraps available targets; default `["blockdoc"]` |

---

## Implementation Order

Recommended first coding milestones (aligned with **V1 Implementation Strategy** above):

```text
1. @blockml/core BML          — org.blockml.bml.core.*, org.blockml.bml.service.*
2. @machineblocks/mbom BML    — com.machineblocks.bml.core.*
3. @blockml/core TS           — types from 12_bom_object_model.md + Diagnostic
                              (ExpressionValue = raw only; ExpressionNode types may land with step 7)
4. @blockml/parser            — `@xmldom/xmldom` + steps [1]–[5] + unit tests (preserve expression raw)
5. @blockml/serializer        — BOM → BML (V1 hardcoded inverse map)
6. Roundtrip tests            — tests/roundtrip/ (T0 → T3 corpus tiers)
7. parseExpression()          — @blockml/core utility (AST as ParsedExpression; no Urmodell write-back)
8. @blockml/validator         — Stage 2 (TypeRegistry + validate; may call parseExpression)
9. @blockml/compiler          — Facade + Target Registry (C2, C3)
10. BlockDoc RT first          — @blockml/blockdoc-target (control gate)
11. XSD / FatBlock RTs         — after BlockDoc
12. @blockml/engine-maker      — RenderEngine stub (for SCAD strategies)
13. @machineblocks/mbom        — domain package shell + NativeBlock.bml SSOT
14. @machineblocks/...-scad-target — ScadBlockProcessor MVP (product path)
14. @blockml/cli               — bom validate, then bom compile
15. Correctness tests         — Calibrator, Standard, Cross from scad-lib
```

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
| Monorepo architecture | `00_system.md` |
| BOM types (implement first) | `12_bom_object_model.md` |
| Parser mapping | `13_bml_to_bom_mapping.md` |
| Runtime / Facade / Cache | `14_compiler_runtime.md` |
| CLI commands | `07_cli.md` |
| SCAD fixtures | `domains/.../scad-lib/` |
