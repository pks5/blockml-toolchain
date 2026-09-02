# BOM Compiler — CLI

version: 2.2.0 · **@blockml/cli BML library is SSOT**

## Purpose of this Document

Transitional **table of contents** only. Normative CLI commands, configuration, bootstrap order, target matrix, exit codes, and dual-CLI model live in `@blockml/cli` BML under `packages/cli-tools/blocks/org/blockml/bml/cli/`.

**Start reading:** `org.blockml.bml.cli.documentation.Introduction` → ReadNext chain.

TypeScript in `packages/cli-tools/src/` implements the library; tests in `packages/cli-tools/test/` verify behavioral contracts.

Cross-package references (still Markdown until migrated): `06_compiler.md`, `14_compiler_runtime.md` (compile facade, C3/C5/C6), `00_system.md` (Zielbild, dual CLI).

---

## Documentation map — narrative specs

| Topic | BML FQN |
|---|---|
| Package purpose & scope | `org.blockml.bml.cli.documentation.Introduction` |
| Layer separation (cli vs compiler vs framework vs targets) | `org.blockml.bml.cli.documentation.LayerSeparation` |
| Architecture & module map | `org.blockml.bml.cli.documentation.ArchitectureOverview` |
| V1 implemented vs planned commands | `org.blockml.bml.cli.documentation.V1Scope` |
| Public API (runCli, parseArgs, …) | `org.blockml.bml.cli.documentation.PublicApi` |
| Runtime bootstrap order | `org.blockml.bml.cli.documentation.RuntimeBootstrap` |
| Command inventory | `org.blockml.bml.cli.documentation.Commands` |
| blockml compile | `org.blockml.bml.cli.documentation.CompileCommand` |
| blockml validate | `org.blockml.bml.cli.documentation.ValidateCommand` |
| blockml inspect | `org.blockml.bml.cli.documentation.InspectCommand` |
| blockml.config.json | `org.blockml.bml.cli.documentation.Configuration` |
| targets[] bootstrap (C3) | `org.blockml.bml.cli.documentation.TargetBootstrap` |
| Per-target CLI matrix | `org.blockml.bml.cli.documentation.TargetCliMatrix` |
| Exit codes & diagnostics | `org.blockml.bml.cli.documentation.ExitCodesAndDiagnostics` |
| Dual CLI model | `org.blockml.bml.cli.documentation.DualCliModel` |
| Installation | `org.blockml.bml.cli.documentation.Installation` |
| Design decisions CLI1–CLI20 | `org.blockml.bml.cli.documentation.DesignDecisions` |
| Package ownership | `org.blockml.bml.cli.documentation.PackageOwnership` |
| V1 scope exclusions (watch, init, thumbnails, …) | `org.blockml.bml.cli.documentation.ScopeExclusions` |

---

## Model map — types, config, capabilities

| Concern | BML FQN |
|---|---|
| blockml.config.json shape | `org.blockml.bml.cli.api.BomConfig` |
| Parsed CLI arguments | `org.blockml.bml.cli.api.ParsedArgs` |
| Exit result | `org.blockml.bml.cli.api.CliResult` |
| Config defaults | `org.blockml.bml.cli.config.DefaultBomConfig` |
| Exit codes | `org.blockml.bml.cli.config.ExitCodes` |
| Target CLI matrix | `org.blockml.bml.cli.config.CompileTargetMatrix` |
| Command registry | `org.blockml.bml.cli.config.CommandRegistry` |
| Public entry | `org.blockml.bml.cli.capability.RunCli` |
| Parse args | `org.blockml.bml.cli.capability.ParseArgs` |
| Load config | `org.blockml.bml.cli.capability.LoadConfig` |
| Bootstrap targets | `org.blockml.bml.cli.capability.BootstrapTargets` |
| Bootstrap TypeRegistry | `org.blockml.bml.cli.capability.BootstrapProjectTypeRegistry` |
| Write output files | `org.blockml.bml.cli.capability.WriteOutputFiles` |

---

## Host wiring (not CLI SSOT)

| Concern | Owner |
|---|---|
| `compileToOutput`, `CompileRequest`, scope `auto` resolution | `org.blockml.bml.compiler.runtime.*` — start `org.blockml.bml.compiler.runtime.documentation.Introduction` |
| `bootstrapTypeRegistry` detail | `org.blockml.bml.framework.*` |
| RenderTarget `targetOptions` types | Target libraries (blockdoc, xsd, fatblock) |
| Incremental cache (C5), thumbnails (C6) | Planned CLI; see `ScopeExclusions` |
| MachineBlocks SCAD CLI | `@machineblocks/cli` (MachineBlocks mono-repo) |

---

Pre-migration long-form prose from doc 07 v2.1.0 lives in `org.blockml.bml.cli.documentation.*`. Do not treat this Markdown file as implementation SSOT.
