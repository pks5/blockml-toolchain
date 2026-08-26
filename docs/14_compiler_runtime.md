# Compiler Runtime

version: 1.0.0 · **@blockml/compiler BML library is SSOT**

## Purpose of this Document

Transitional **table of contents** only. Normative compiler facade, Target Registry, compile scope, RenderContext, Compile I/O, and Phase C decisions **C1–C7** live in `@blockml/compiler` BML under `packages/compiler/blocks/org/blockml/bml/compiler/runtime/`.

**Start reading:** `org.blockml.bml.compiler.runtime.documentation.Introduction` → ReadNext chain.

TypeScript in `packages/compiler/src/` implements the library; tests in `packages/compiler/test/` verify behavioral contracts.

Cross-package references: `07_cli.md` / `org.blockml.bml.cli.*` (host bootstrap, write, C5/C6), target Introduction FQNs (emit), `13_bml_to_bom_mapping.md` (parser/serializer), `00_system.md` (Zielbild), `06_compiler.md` (pipeline handbook + SCAD example steps).

> **MachineBlocks** (NativeBlock / `mb_block`, SCAD I/O conventions) are **domain Blaupause** — not BlockML core. Normative home: MachineBlocks mono-repo + `@machineblocks/*`.

---

## Documentation map — narrative specs

| Topic | BML FQN |
|---|---|
| Package purpose & scope | `org.blockml.bml.compiler.runtime.documentation.Introduction` |
| Layer separation (runtime vs CLI vs targets vs parser) | `org.blockml.bml.compiler.runtime.documentation.LayerSeparation` |
| Architecture & module map | `org.blockml.bml.compiler.runtime.documentation.ArchitectureOverview` |
| V1 implemented vs stub / exclusions | `org.blockml.bml.compiler.runtime.documentation.V1Scope` |
| Public API surface | `org.blockml.bml.compiler.runtime.documentation.PublicApi` |
| Compile I/O (C4) | `org.blockml.bml.compiler.runtime.documentation.CompileIO` |
| Compile scope & accepts (C7) | `org.blockml.bml.compiler.runtime.documentation.CompileScopeRules` |
| Target Registry contract (C3) | `org.blockml.bml.compiler.runtime.documentation.TargetRegistry` |
| RenderSession / RenderContext (C1) | `org.blockml.bml.compiler.runtime.documentation.RenderContextRules` |
| Diagnostics envelope | `org.blockml.bml.compiler.runtime.documentation.Diagnostics` |
| Design decisions C1–C7 | `org.blockml.bml.compiler.runtime.documentation.DesignDecisions` |
| Package ownership | `org.blockml.bml.compiler.runtime.documentation.PackageOwnership` |
| Scope exclusions (C5/C6, SCAD, …) | `org.blockml.bml.compiler.runtime.documentation.ScopeExclusions` |

---

## Model map — types, config, capabilities

| Concern | BML FQN |
|---|---|
| CompileRequest / CompileScope / CompileOptions | `org.blockml.bml.compiler.runtime.api.CompileRequest` (and siblings) |
| RenderTarget / RenderOutput / RenderContext | `org.blockml.bml.compiler.runtime.api.RenderTarget` (and siblings) |
| Diagnostic codes | `org.blockml.bml.compiler.runtime.config.RuntimeConstants` |
| Public facade | `org.blockml.bml.compiler.runtime.capability.CompileToOutput` |
| Scope resolve | `org.blockml.bml.compiler.runtime.capability.ResolveScope` |
| Target registry | `org.blockml.bml.compiler.runtime.capability.RegisterTarget` |

---

## Host / domain wiring (not compiler SSOT)

| Concern | Owner |
|---|---|
| `blockml.config.json` `targets[]`, `bootstrapTargets`, write files, exit codes | `org.blockml.bml.cli.*` — start `org.blockml.bml.cli.documentation.Introduction` |
| Incremental cache (C5), thumbnails (C6) | CLI ScopeExclusions / planned CLI |
| BlockDoc / XSD / FatBlock emit | Target libraries (`…target.blockdoc|xsd|fatblock.documentation.Introduction`) |
| Parser / serializer / validator algorithms | `org.blockml.bml.compiler.parser|serializer|validator.*` |
| TypeRegistry bootstrap internals | `org.blockml.bml.framework.*` |
| MachineBlocks SCAD / NativeBlock | MachineBlocks mono-repo |

---

## Phase C decision index (C1–C7)

Normative text: `org.blockml.bml.compiler.runtime.documentation.DesignDecisions`.

| ID | One-line |
|---|---|
| C1 | RenderSession + forked RenderContext |
| C2 | `compileToOutput` facade; document sugar; BOM sugar stub in V1 |
| C3 | Empty Target Registry; hosts register (CLI owns `targets[]` loading) |
| C4 | No mandatory I/O cardinality; opaque RenderOutput |
| C5 | Incremental build CLI-only |
| C6 | Thumbnails CLI-only; not in RenderOutput |
| C7 | Scope `document` \| `library` \| `corpus` \| `auto`; `accepts[]`; opaque `targetOptions` |

---

Pre-migration long-form prose from doc 14 v0.9.0 lives in `org.blockml.bml.compiler.runtime.documentation.*` (BlockML core) or remains out of scope for MB sections. Do not treat this Markdown file as implementation SSOT.
