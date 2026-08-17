# BOM Compiler — BML

version: 3.0.0 · **BML Core is SSOT for language rules**

## Purpose of this Document

This file is the **table of contents** for BML authoring — **transitional Markdown**. Normative language rules live in
BlockML Core documentation and definition blocks under `org.blockml.bml.*`
(`node_modules/@blockml/core/blocks/org/blockml/bml/`). Each node package's `blocks/` folder is the SSOT for that package (`00_system.md` — BlockML node packages). The long-term goal is that all information lives in those packages as BML.

Start reading at `org.blockml.bml.README` (`relation=ReadFirst`). Use `relation=TaskIndex` for
procedural fixes and `org.blockml.bml.diagnostic.*` for validator codes.

Historical long-form prose and examples (pre–self-description migration) are archived at
[`archive/02_mbml_historical.md`](archive/02_mbml_historical.md). Do not treat the archive as SSOT.

---

## How to use this index

| Need | Go to |
|---|---|
| Mental learning path | `org.blockml.bml.README` |
| Fix a validator code | `org.blockml.bml.diagnostic.<CODE>` → `relation=Resolves` TaskGuide |
| Author a new Block | `org.blockml.bml.task.AuthorNewBlock` |
| Formal BOM AST / parser contracts | `12_bom_object_model.md`, `13_bml_to_bom_mapping.md` |
| Expression EBNF / AST utility contract | `10_expression_language.md` (DeepDive; surface rules in BML) |
| MachineBlocks domain authoring | `@machineblocks/core` BML (`node_modules/@machineblocks/core/blocks/com/machineblocks/bml`) / `03_mbom.md` — **not** Core language SSOT |

---

## Language map — former § → BML FQN

### Overview · serialization · documents

| Topic | BML SSOT |
|---|---|
| Goals, `.bml`, XML-only | `org.blockml.bml.documentation.Introduction` |
| Everything is a Block | `org.blockml.bml.documentation.EverythingIsABlock` |
| Definition vs instance | `org.blockml.bml.documentation.BlockAndInstance` |

### Namespaces · annotations · implicit NS

| Topic | BML SSOT |
|---|---|
| `domain.bml.*`, xmlns Package vs Annotation, prefix convention | `org.blockml.bml.documentation.BmlNamespace` |
| Context-bound unqualified names | `org.blockml.bml.documentation.ImplicitNamespaceResolution` |
| Annotation namespaces, facets, directive taxonomy | `org.blockml.bml.documentation.AnnotationModel` |
| `bml:` directives catalogue | `org.blockml.bml.annotation.BmlAnnotation` · `…documentation.BmlDirectives` |
| Property value facets | `org.blockml.bml.definition.PropertyDefinition` · `…documentation.AnnotationModel` |

### Type references · identity · Sub-Blocks

| Topic | BML SSOT |
|---|---|
| FQN forms, root/Sub-Block derivation | `org.blockml.bml.documentation.TypeIdentityDerivation` |
| Sub-Blocks, embeds, reference scope, utility | `org.blockml.bml.documentation.SubBlockModel` |
| PascalCase `<name>` | `org.blockml.bml.documentation.BlockNameConvention` |
| Meta-model shapes | `…definition.RootBlockDefinition` · `SubBlockDefinition` · `EmbeddedBlockDefinition` |

### Documentation model · library

| Topic | BML SSOT |
|---|---|
| `is` / `summary` / `documentation` / `references` | `org.blockml.bml.documentation.DocumentationModel` |
| Library / ReadMe / Bootstrap | `org.blockml.bml.documentation.LibrarySystem` · `BootstrapModel` |
| TaskGuides · Diagnostics navigation | `org.blockml.bml.documentation.TaskGuideModel` |

### Members · visibility · overrides

| Topic | BML SSOT |
|---|---|
| Visibility naming & access | `org.blockml.bml.documentation.MemberVisibility` |
| Partial overrides, abstract/final/readOnly | `org.blockml.bml.documentation.PartialMemberOverrides` |
| Member meta-model | `org.blockml.bml.definition.MemberDefinition` |
| Properties / Aggregations / Associations / Capabilities | `…definition.PropertyDefinition` · `AggregationDefinition` · `AssociationDefinition` · `CapabilityDefinition` |

### Composition · directives

| Topic | BML SSOT |
|---|---|
| Composition placement & recursion | `org.blockml.bml.documentation.CompositionModel` |
| `bml:each` / `if` / `container` / `with` / `xml` | `org.blockml.bml.documentation.BmlDirectives` |

### Type system

| Topic | BML SSOT |
|---|---|
| Four ValueType kinds | `org.blockml.bml.documentation.TypeSystemOverview` |
| Multiplicity · unions | `org.blockml.bml.documentation.TypeExpressions` |
| Generics · defaultType | `org.blockml.bml.documentation.GenericsModel` |
| `{…}` instance configuration | `org.blockml.bml.documentation.ValueTypeConfiguration` |
| `Constant(T){value: …}` | `org.blockml.bml.documentation.ConstantValueType` |
| FunctionMapping | `org.blockml.bml.documentation.FunctionMappingModel` |
| Contracts / `satisfiesTypeBound` | `org.blockml.bml.documentation.ContractsModel` |

### Expressions

| Topic | BML SSOT |
|---|---|
| `${ }` language, scope, V1 | `org.blockml.bml.documentation.Expressions` |
| `<$ $>` in implementations | `org.blockml.bml.documentation.EmbeddedExpressions` |
| Fix expression errors | `org.blockml.bml.task.FixExpressionErrors` |

### Modeling patterns

| Topic | BML SSOT |
|---|---|
| baseType, contracts, capabilities, constraints | `org.blockml.bml.documentation.ModelingGuidelines` |
| Constraints and suggestions | `org.blockml.bml.documentation.ConstraintsModel` |
| Capability kinds | `org.blockml.bml.documentation.CapabilitySemantics` |
| PseudoCode | `org.blockml.bml.documentation.PseudoCode` |

---

## Out of Core language SSOT

These topics remain outside `org.blockml.bml` language self-description:

| Topic | Where |
|---|---|
| MachineBlocks Set / Presets / Config Profiles / SCAD set output | Domain MBOM / SCAD docs (`03_mbom.md`, `05_scad_renderer.md`) — see archive for old co-located text |
| Compiler pipeline · CLI · monorepo layout | `00_system.md`, `06_compiler.md`, `07_cli.md`, `14_compiler_runtime.md`, `15_dev_setup.md` |
| Formal BOM types · BML↔BOM mapping algorithms | `12_bom_object_model.md`, `13_bml_to_bom_mapping.md` |
| Full expression EBNF / AST TypeScript shapes | `10_expression_language.md` |
| `bml:xml` Stage hybrid / open decisions | `19_definition_blocks_and_bml_xml.md` |

---

## Cluster TaskGuides (quick)

| Task | FQN |
|---|---|
| Unknown type | `org.blockml.bml.task.DebugUnknownType` |
| Visibility | `org.blockml.bml.task.FixVisibilityAccess` |
| Overrides | `org.blockml.bml.task.FixMemberOverride` |
| Composition | `org.blockml.bml.task.FixCompositionPlacement` |
| Type identity | `org.blockml.bml.task.FixTypeIdentity` |
| Expressions | `org.blockml.bml.task.FixExpressionErrors` |
| New Block | `org.blockml.bml.task.AuthorNewBlock` |
| Constraints | `org.blockml.bml.task.AddConstraint` |

---

## Related Documents

- `00_system.md` — BML Self-Description Roadmap  
- `docs/TODOs/bml_self_description_gap_matrix.md` — migration status  
- `archive/02_mbml_historical.md` — pre-migration long form  
- `org.blockml.bml.Library` — exported Core catalogue  
