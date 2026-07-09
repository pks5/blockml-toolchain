# Development Setup

version: 0.1.0

## Purpose of this Document

This document defines the **monorepo development setup** for the BOM Compiler (`blockml` repository) — tooling, package layout, build order, scripts, testing, and IDE configuration.

For architecture and package responsibilities see `01_system.md`.
For compiler runtime (bootstrap, facade, cache) see `14_compiler_runtime.md`.
For testing strategy see `06_compiler.md` — Testing Strategy.

Implementation code is scaffolded according to this document. The repo currently contains **specs + fixtures**; TypeScript packages are added incrementally.

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

```bash
git clone <repo-url> blockml
cd blockml

git submodule update --init --recursive
# Initializes domains/.../scad-lib (MachineBlocks V3 SCAD Library)

npm install
npm run build
npm link -w @blockml/cli    # exposes `bom` globally (once)

bom --version
```

`git submodule update --init --recursive` is **required** — correctness tests and SCAD fixtures live in `scad-lib`.

After pulling updates:

```bash
git pull
git submodule update --recursive
npm install
npm run build
```

---

## Repository Layout

Current and target layout (from `01_system.md`):

```text
blockml/
  package.json                 — root workspace
  tsconfig.base.json           — shared compiler options
  tsconfig.json                — solution-style project references
  catalog.xml                  — XSD namespace → node_modules (IDE)
  .gitignore

  packages/
    core/                      — @blockml/core (framework + built-in service BML)
    parser/                    — @blockml/parser
    compiler/                  — @blockml/compiler
    cli-tools/                 — @blockml/cli          (Node-only)

  engines/
    maker-engine/              — @blockml/engine-maker

  domains/
    machineblocks/
      mbom/                    — @machineblocks/mbom
      machineblocks-v3-scad-target/
        src/                   — target implementation (planned)
        runtimes/
          scad-lib/            — Git submodule (fixtures + SCAD runtime)

  tests/
    unit/                      — per-package unit tests (colocated or mirrored)
    correctness/               — hand-verified reference outputs
    snapshots/                 — Vitest snapshot output

  docs/                        — specifications (authoritative)
```

**Present today:** `docs/`, `packages/core/blocks/**/*.bml`, `domains/.../scad-lib/` (submodule).

**Scaffold next:** empty package shells with `package.json`, `tsconfig.json`, `src/index.ts` per build order below.

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

Browser-compatible packages add `"lib": ["ES2022", "DOM"]` where needed (XML parser in browser).

`@blockml/cli` may use `"lib": ["ES2022"]` with `@types/node`.

### Root `tsconfig.json` (project references)

Build order encoded in references:

```json
{
  "files": [],
  "references": [
    { "path": "packages/core" },
    { "path": "packages/parser" },
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
  blocks/org/blockml/core/*.bml  →  language FQNs (org.blockml.core.Block, …)
  src/org/blockml/bom/*.ts       →  BOM interfaces (org.blockml.bom.BlockDefinition, …)
  src/org/blockml/compiler/*.ts  →  only if colocated; prefer @blockml/compiler package
```

Reserved language namespaces (`org.blockml.core`, `org.blockml.type`, `org.blockml.service`, `org.blockml.capability`, `org.blockml.language`) are for **public BML grammar only**. Internal types use `org.blockml.bom`, `org.blockml.parser`, `org.blockml.compiler`, etc. See `00_bom_core.md` — Reserved Language Namespaces.

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

### `@blockml/core` (BML SSOT)

No TypeScript build. Package contains BML source files only:

```text
packages/core/
  package.json          — name: @blockml/core, private: true
  blocks/
    org/blockml/core/
      Block.bml · ServiceBlock.bml · FunctionBlock.bml · …
    org/blockml/service/
      Math.bml
      Strings.bml
      …
  src/                  — reserved for future TypeScript (none today)
```

Consumed by:

- TypeRegistry bootstrap (CLI scans workspace + scad-lib)
- Correctness tests (expression builtins)
- Pre-rendered SCAD artifacts in `scad-lib/blocks/org/blockml/service/`

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

```text
@blockml/core (BML files — no TS deps)

@blockml/core
  ↑
@blockml/parser
  ↑
@blockml/compiler ──→ @blockml/engine-maker
  ↑                         ↑
@machineblocks/mbom         │
  ↑                         │
@machineblocks/machineblocks-v3-scad-target
  ↑
@blockml/cli
```

Implement packages **bottom-up**. Each package's first milestone: export types/interfaces from spec (`12_bom_object_model.md`, etc.) with passing empty or smoke tests.

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
2. Correctness tests   — tests/correctness/<fixture>/input + .expected.*
3. Snapshot tests      — tests/snapshots/ (after correctness baseline)
```

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
npm run test:correctness      # correctness only
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
| `npm link -w @blockml/cli` | Global `bom` command |
| `npm run lint` | ESLint (when configured) |

---

## IDE Setup

### XSD / BML authoring

Copy or generate `catalog.xml` at repo root (see `01_system.md` — catalog.xml). Points namespace URLs to:

```text
node_modules/@blockml/core/schemas/core/*.xsd
node_modules/@machineblocks/mbom/schemas/machineblocks/*.xsd
```

VS Code / Cursor: install **XML** extension; set `xml.catalog.catalogs` to `./catalog.xml`.

Until schema packages exist, authors reference published URLs in `xsi:schemaLocation` — local catalog activates after first `npm install`.

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

## Implementation Order

Recommended first coding milestones:

```text
1. @blockml/core BML          — org.blockml.core.*, org.blockml.service.*
2. @machineblocks/mbom BML    — com.machineblocks.core.*
3. @blockml/core              — types from 12_bom_object_model.md + Diagnostic
4. @blockml/parser            — stage [5] mapper skeleton + tests
5. @blockml/core              — TypeRegistry + validate (stages 6–8)
6. @blockml/compiler          — Facade + Target Registry (C2, C3)
7. @blockml/engine-maker      — RenderEngine stub
8. @machineblocks/mbom        — domain types + property registry from 09_mbom_properties.yml
9. @machineblocks/...-scad-target — ScadBlockProcessor MVP
9. @blockml/cli         — bom validate, then bom compile
10. Correctness tests   — Calibrator, Standard, Cross from scad-lib
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
| Monorepo architecture | `01_system.md` |
| BOM types (implement first) | `12_bom_object_model.md` |
| Parser mapping | `13_bml_to_bom_mapping.md` |
| Runtime / Facade / Cache | `14_compiler_runtime.md` |
| CLI commands | `07_cli.md` |
| SCAD fixtures | `domains/.../scad-lib/` |
