# BOM Object Model

version: 1.6.0 · **@blockml/bom BML library is SSOT**

## Purpose of this Document

Transitional **table of contents** only. Normative Urmodell contracts, design decisions, validation rules, and narrative documentation live in `@blockml/bom` BML under `packages/bom/blocks/org/blockml/bml/bom/`.

**Start reading:** `org.blockml.bml.bom.documentation.Introduction` → ReadNext chain.

TypeScript in `packages/bom/src/` implements the library; parity tests in `packages/bom/test/` verify BML ↔ TS alignment.

Cross-package references (still Markdown until migrated): `01_bom_core.md`, `13_bml_to_bom_mapping.md`, `10_expression_language.md`.

---

## Documentation map — narrative specs

| Topic | BML FQN |
|---|---|
| Package purpose & scope | `org.blockml.bml.bom.documentation.Introduction` |
| Layer separation (bom vs definition) | `org.blockml.bml.bom.documentation.LayerSeparation` |
| Architecture pipeline | `org.blockml.bml.bom.documentation.ArchitectureOverview` |
| Abstraction & roundtrip | `org.blockml.bml.bom.documentation.AbstractionPrinciple` |
| Stores vs interprets table | `org.blockml.bml.bom.documentation.AuthoredSurfaceTable` |
| Design decisions (full) | `org.blockml.bml.bom.documentation.DesignDecisions` |
| Package ownership | `org.blockml.bml.bom.documentation.PackageOwnership` |
| Public API B26 | `org.blockml.bml.bom.documentation.PublicApi` |
| XML comments B11/B22 | `org.blockml.bml.bom.documentation.XmlComments` |
| Sub-Blocks & embedded blocks | `org.blockml.bml.bom.documentation.SubBlockAndEmbeddedBlocks` |
| Type expressions overview | `org.blockml.bml.bom.documentation.TypeExpressionsOverview` |
| Member value semantics | `org.blockml.bml.bom.documentation.MemberValueSemantics` |
| Composition directives | `org.blockml.bml.bom.documentation.CompositionDirectives` |
| Instance ID rules | `org.blockml.bml.bom.documentation.InstanceIdRules` |
| Version rules | `org.blockml.bml.bom.documentation.VersionRules` |
| Validation checklist | `org.blockml.bml.bom.documentation.ValidationResponsibilities` |
| Related diagnostics | `org.blockml.bml.bom.documentation.RelatedDiagnostics` |
| Calibrator walkthrough | `org.blockml.bml.bom.documentation.CalibratorExample` |
| Out-of-scope topics | `org.blockml.bml.bom.documentation.ScopeExclusions` |

Library entry: `org.blockml.bml.bom.README` · Catalog: `org.blockml.bml.bom.Library`

---

## Urmodell type map — TS export → BML FQN

### Root document

| TS type | BML FQN |
|---|---|
| `BomDocument` | `org.blockml.bml.bom.document.BomDocument` |

### Common / provenance / diagnostics

| TS type | BML FQN |
|---|---|
| `SourceLocation` | `org.blockml.bml.bom.common.SourceLocation` |
| `SourceInfo` | `org.blockml.bml.bom.common.SourceInfo` |
| `XmlTrivia` | `org.blockml.bml.bom.common.XmlTrivia` |
| `MemberSectionName` | `org.blockml.bml.bom.common.MemberSectionName` |
| `MetadataElementTrivia` | `org.blockml.bml.bom.common.MetadataElementTrivia` |
| `XmlNodeKind` | `org.blockml.bml.bom.common.XmlNodeKind` |
| `CharacterDataForm` | `org.blockml.bml.bom.common.CharacterDataForm` |
| `XmlRenderingBlock` | `org.blockml.bml.bom.common.XmlRenderingBlock` |
| `XmlRenderingMember` | `org.blockml.bml.bom.common.XmlRenderingMember` |
| `DiagnosticSeverity` | `org.blockml.bml.bom.common.DiagnosticSeverity` |
| `Diagnostic` | `org.blockml.bml.bom.common.Diagnostic` |

### Block definition cluster

| TS type | BML FQN |
|---|---|
| `BlockDefinition` | `org.blockml.bml.bom.block.BlockDefinition` |
| `GenericType` | `org.blockml.bml.bom.block.GenericType` |
| `TypeReferenceEntityInstance` | `org.blockml.bml.bom.block.TypeReferenceEntityInstance` |
| `KeywordEntry` | `org.blockml.bml.bom.block.KeywordEntry` |
| `DocumentationProseEntry` | `org.blockml.bml.bom.block.DocumentationProseEntry` |
| `AliasEntry` | `org.blockml.bml.bom.block.AliasEntry` |
| `ChangelogEntry` | `org.blockml.bml.bom.block.ChangelogEntry` |
| `DocumentationExample` | `org.blockml.bml.bom.block.DocumentationExample` |
| `DocumentationReference` | `org.blockml.bml.bom.block.DocumentationReference` |

### Member definitions

| TS type | BML FQN |
|---|---|
| `MemberDefinition` | `org.blockml.bml.bom.member.MemberDefinition` (union) |
| `ConstrainableDefinition` | `org.blockml.bml.bom.member.ConstrainableDefinition` |
| `MemberDefinitionBase` | `org.blockml.bml.bom.member.MemberDefinitionBase` |
| `PropertyDefinition` | `org.blockml.bml.bom.member.PropertyDefinition` |
| `PropertyValueEntry` | `org.blockml.bml.bom.member.PropertyValueEntry` |
| `AggregationDefinition` | `org.blockml.bml.bom.member.AggregationDefinition` |
| `AssociationDefinition` | `org.blockml.bml.bom.member.AssociationDefinition` |
| `CapabilityDefinition` | `org.blockml.bml.bom.member.CapabilityDefinition` |
| `ImplementationBlock` | `org.blockml.bml.bom.member.ImplementationBlock` |
| `EmbeddedExpression` | `org.blockml.bml.bom.member.EmbeddedExpression` |

### Composition tree

| TS type | BML FQN |
|---|---|
| `CompositionTemplate` | `org.blockml.bml.bom.composition.CompositionTemplate` |
| `InstanceAggregationComposition` | `org.blockml.bml.bom.composition.InstanceAggregationComposition` |
| `CompositionNode` | `org.blockml.bml.bom.composition.CompositionNode` (union) |
| `BlockInstanceNode` | `org.blockml.bml.bom.composition.BlockInstanceNode` |
| `VirtualContainerNode` | `org.blockml.bml.bom.composition.VirtualContainerNode` |
| `BlockInstance` | `org.blockml.bml.bom.composition.BlockInstance` |
| `DirectiveAttribute` | `org.blockml.bml.bom.composition.DirectiveAttribute` (union) |
| `EachDirective` | `org.blockml.bml.bom.composition.EachDirective` |
| `IfDirective` | `org.blockml.bml.bom.composition.IfDirective` |
| `UnlessDirective` | `org.blockml.bml.bom.composition.UnlessDirective` |
| `WithDirective` | `org.blockml.bml.bom.composition.WithDirective` |
| `WithBinding` | `org.blockml.bml.bom.composition.WithBinding` |

### Type expressions (parse-time AST)

| TS type | BML FQN |
|---|---|
| `TypeExpression` | `org.blockml.bml.bom.type.TypeExpression` (union) |
| `TypeDescriptor` | `org.blockml.bml.bom.type.TypeDescriptor` (V1 alias) |
| `Multiplicity` | `org.blockml.bml.bom.type.Multiplicity` |
| `InstanceConfiguration` | `org.blockml.bml.bom.type.InstanceConfiguration` |
| `NamedTypeReference` | `org.blockml.bml.bom.type.NamedTypeReference` |
| `UnionTypeExpression` | `org.blockml.bml.bom.type.UnionTypeExpression` |
| `GenericParameterReference` | `org.blockml.bml.bom.type.GenericParameterReference` |
| `SelfTypeReference` | `org.blockml.bml.bom.type.SelfTypeReference` |
| `AnonymousStructType` | `org.blockml.bml.bom.type.AnonymousStructType` |
| `StructField` | `org.blockml.bml.bom.type.StructField` |

### Member values

| TS type | BML FQN |
|---|---|
| `MemberValue` | `org.blockml.bml.bom.value.MemberValue` (union) |
| `LiteralValue` | `org.blockml.bml.bom.value.LiteralValue` |
| `ExpressionValue` | `org.blockml.bml.bom.value.ExpressionValue` |
| `AddressValue` | `org.blockml.bml.bom.value.AddressValue` |
| `Address` | `org.blockml.bml.bom.value.Address` |

### Public API (B26)

| TS type | BML FQN |
|---|---|
| `ParseResult` | `org.blockml.bml.bom.api.ParseResult` |
| `SerializeResult` | `org.blockml.bml.bom.api.SerializeResult` |
| `ParseOptions` | `org.blockml.bml.bom.api.ParseOptions` |
| `SerializeOptions` | `org.blockml.bml.bom.api.SerializeOptions` |

### Runtime capabilities

| TS function | BML FQN |
|---|---|
| `bomEquals()` | `org.blockml.bml.bom.capability.BomEquals` |
| `stripProvenance()` | `org.blockml.bml.bom.capability.StripProvenance` |

---

## Intentionally not in @blockml/bom

See `org.blockml.bml.bom.documentation.ScopeExclusions`.

---

## Historical content

Pre-migration long-form prose from doc 12 v1.4.0 lives in `org.blockml.bml.bom.documentation.*`. Do not treat this Markdown file as implementation SSOT.
