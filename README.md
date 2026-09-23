# BlockML

Domain-agnostic toolchain that turns **BML** (Block Markup Language, `.bml` / XML) into a typed **BOM** (Block Object Model), then into render-target outputs (BlockDoc HTML, XSD, FatBlock, …). The same corpus is searchable, inspectable, and graph-queryable from the `blockml` CLI. A language server (`blockml-lsp`) reports parser and validator diagnostics over stdio.

This monorepo authors **`@blockml/*` only** — language/BOM, parser, serializer, validator, framework, compiler runtime, search, graph, inspect, transformer, builder, universal CLI (`blockml`), language server, and toolchain targets. Domain products (for example MachineBlocks) live in separate repositories.

## Documentation (SSOT)

Start here for humans and LLMs:

| | |
|---|---|
| **Library** | [`blocks/org/blockml/bml/workspace/Library.bml`](blocks/org/blockml/bml/workspace/Library.bml) |
| **FQN** | `org.blockml.bml.workspace.Library` |

Read the library `README` → `documentation.Introduction`, then follow the linked package libraries. Package contracts live under `packages/*/blocks/`; this workspace library is the hub and links **workspace → packages only**.

Markdown under [`docs/`](docs/) is transitional holding text until fully migrated into BML.

CLI help is `npx blockml --help` and `npx blockml <command> --help`. Normative command text lives in `org.blockml.bml.cli.Library`.

## Packages

| npm | Role |
|---|---|
| `@blockml/core` | Language core (external dependency) |
| `@blockml/bom` | BOM (Urmodell) TypeScript contracts |
| `@blockml/parser` | BML XML → BOM |
| `@blockml/serializer` | BOM → canonical BML XML |
| `@blockml/validator` | Semantic validation of BOM documents |
| `@blockml/framework` | TypeRegistry, fork/resolve, expressions, type validation |
| `@blockml/builder` | Writable authoring session (`BomBuilder`) |
| `@blockml/compiler` | Compile facade, target registry, render pipeline |
| `@blockml/search` | Local full-text search over the project corpus |
| `@blockml/graph` | Structural graph (inheritance, uses, paths) |
| `@blockml/inspect` | Compact resolved projection of one Block |
| `@blockml/transformer` | Sequential model operations with registered executors |
| `@blockml/cli` | `blockml` CLI (`packages/cli-tools`) |
| `@blockml/lsp` | Language server (`blockml-lsp`) |
| `@blockml/blockdoc-target` | Browseable HTML documentation |
| `@blockml/xsd-target` | XML Schema generation |
| `@blockml/fatblock-target` | Portable `.bml` folder bundles |

Package → BML FQN map: `org.blockml.bml.workspace.documentation.PackageMap`.

## Repository layout

```text
blocks/           Workspace BML library (monorepo hub / SSOT entry)
packages/         @blockml/* npm packages (each with its own blocks/ library)
docs/             Transitional Markdown
schemas/          Checked-in XSD / catalog aids
scripts/          Version bump and publish helpers
tests/            Cross-package tests (roundtrip, validation, targets)
```

## CLI

Build first (`npm run build`), then use the `blockml` binary from `@blockml/cli` (`packages/cli-tools`), or `npx blockml`.

Discover the model with the CLI. Generic grep and file reads stay allowed; they are not the first way in.

```text
task → search or scan → FQNs → inspect (graph if structure)
     → targeted BML read → smallest BML edit → validate
     → update companions (compile and/or edit)
```

| Command | Purpose |
|---|---|
| `search <query>` | Find FQNs. `search index [--force]` rebuilds the index. |
| `scan package\|type <selector>…` | Packages or types matching selectors. |
| `inspect <fqn>` | Resolved Block (effective members). |
| `graph uses\|used-by\|neighbors\|ancestors\|descendants\|members <fqn>` | How a Block connects. Also `path`, `query`, `schema`, `index`. |
| `new <fqn>` | Create a Block `.bml` under the owning Library. |
| `init <package-fqn>` | Scaffold a BlockML project (Library, `package.json`, `AGENTS.md`). |
| `validate` | Parser and semantic check. Default: project sources, not npm. |
| `compile blockdoc\|xsd\|fatblock` | Render a registered target. |
| `transform apply <execution-fqn>` | Run a model transformation. |

Shared flags: `--src dir`, `--libraries a,b`, `--json`, `--help` / `-h`. The corpus for `search`, `scan`, `inspect`, and `graph` is the same as `validate --all`.

### `compile`

```bash
# Library / corpus targets (default target: blockdoc)
blockml compile blockdoc|xsd [--out dir] [--src dir] [--libraries a,b]

# FatBlock of the current package library (package.json blockml.library as host)
blockml compile fatblock [--include a,b] [--out dir]

# One FatBlock per local package.json blockml.library (this package + packages/*)
blockml compile fatblock --per-package [--out dir]

# Document-scope fatblock with an explicit host
blockml compile file.bml fatblock [--src dir] [--include a,b] [--out dir]
```

Default output directories: `blockdoc` (blockdoc), `schemas` (xsd), invocation directory (fatblock, `{hostFqn}.fat.bml`).

### npm script wrappers

| Script | Command |
|--------|---------|
| `npm run validate` | `blockml validate` |
| `npm run search:index` | `blockml search index` |
| `npm run compile:blockdoc` | `blockml compile blockdoc` |
| `npm run compile:xsd` | `blockml compile xsd` |
| `npm run compile:fatblock` | `blockml compile fatblock --per-package` |

Exit codes: `0` success · `1` diagnostics · `2` usage or configuration error.

Full CLI SSOT: `org.blockml.bml.cli.Library` → [`packages/cli-tools/blocks/org/blockml/bml/cli/Library.bml`](packages/cli-tools/blocks/org/blockml/bml/cli/Library.bml).

## Development

Requires Node.js ≥ 20.

```bash
npm install
npm run build
npm test
```

Other useful scripts: `npm run typecheck`, `npm run clean`, and per-package `test:*` targets (see root `package.json`).
