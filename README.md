# BlockML

Domain-agnostic toolchain that turns **BML** (Block Markup Language, `.bml` / XML) into a typed **BOM** (Block Object Model), then into render-target outputs (BlockDoc HTML, XSD, FatBlock, …).

This monorepo authors **`@blockml/*` only** — language/BOM, parser, serializer, validator, framework, compiler runtime, universal CLI (`blockml`), and toolchain targets. Domain products (for example MachineBlocks) live in separate repositories.

## Documentation (SSOT)

Start here for humans and LLMs:

| | |
|---|---|
| **Library** | [`blocks/org/blockml/bml/workspace/Library.bml`](blocks/org/blockml/bml/workspace/Library.bml) |
| **FQN** | `org.blockml.bml.workspace.Library` |

Read the library `README` → `documentation.Introduction`, then follow the linked package libraries. Package contracts live under `packages/*/blocks/`; this workspace library is the hub and links **workspace → packages only**.

Markdown under [`docs/`](docs/) is transitional holding text until fully migrated into BML.

## Repository layout

```text
blocks/           Workspace BML library (monorepo hub / SSOT entry)
packages/         @blockml/* npm packages (each with its own blocks/ library)
docs/             Transitional Markdown
schemas/          Checked-in XSD / catalog aids
```

## CLI

Build first (`npm run build`), then use the `blockml` binary from `@blockml/cli` (`packages/cli-tools`).

### `validate`

Parse and semantically validate BML. No target bootstrap; no output files.

```bash
blockml validate [file] [--all] [--src dir] [--libraries a,b]
```

### `compile`

Emit render-target output. V1 targets: `blockdoc` (default), `xsd`, `fatblock`.

```bash
# Library / corpus targets
blockml compile blockdoc|xsd [--out dir] [--src dir] [--libraries a,b]

# FatBlock of the current package library (package.json blockml.library as host + source)
blockml compile fatblock [--include a,b] [--out dir]

# Document-scope fatblock with an explicit host
blockml compile file.bml fatblock [--src dir] [--include a,b] [--out dir]
```

Default output directories: `blockdoc` (blockdoc), `schemas` (xsd), project root (fatblock, `*.fat.bml`).

### npm script wrappers

| Script | Command |
|--------|---------|
| `npm run validate` | `blockml validate` |
| `npm run compile:blockdoc` | `blockml compile blockdoc` |
| `npm run compile:xsd` | `blockml compile xsd` |
| `npm run compile:fatblock` | `blockml compile fatblock` |

Exit codes: `0` success · `1` diagnostics · `2` config / unknown command / unsupported target.

Full CLI SSOT: `org.blockml.bml.cli.Library` → [`packages/cli-tools/blocks/org/blockml/bml/cli/Library.bml`](packages/cli-tools/blocks/org/blockml/bml/cli/Library.bml).

## Development

Requires Node.js ≥ 20.

```bash
npm install
npm run build
npm test
```

Other useful scripts: `npm run typecheck`, `npm run clean`, and per-package `test:*` targets (see root `package.json`).
