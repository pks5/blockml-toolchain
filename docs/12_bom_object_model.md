# BOM Object Model

version: 1.5.0 · **@blockml/bom BML library is SSOT**

## Purpose of this Document

This file is the **table of contents** for the BlockML Urmodell (Canonical BOM) — **transitional Markdown**. Normative type contracts, design decisions, and validation rules live in the `@blockml/bom` BML library at `packages/bom/blocks/org/blockml/bml/bom/`. TypeScript in `packages/bom/src/` implements that library; parity tests in `packages/bom/test/` verify alignment.

Start reading at `org.blockml.bml.bom.README` (`relation=ReadFirst`).

For conceptual foundations see `01_bom_core.md`.
For BML authoring syntax see `02_mbml.md`.
For BML → BOM mapping see `13_bml_to_bom_mapping.md` (`@blockml/parser`).
For BML meta-model (what block documents mean) see `org.blockml.bml.definition.*` in `@blockml/core` — **distinct layer** from Urmodell types below.

---

## Layer separation

| Layer | FQN prefix | Package | Role |
|---|---|---|---|
| BML meta-model | `org.blockml.bml.definition.*` | `@blockml/core` | Describes BML syntax / block document shape |
| Urmodell (BOM) | `org.blockml.bml.bom.*` | `@blockml/bom` | Parse-result data structures (`BomDocument` graph) |

Same names (e.g. `BlockDefinition`) may appear on both layers — different semantics. See `19_definition_blocks_and_bml_xml.md`.

---

## How to use this index

| Need | Go to |
|---|---|
| Library entry point | `org.blockml.bml.bom.README` |
| Design decisions (immutability, directives, …) | `org.blockml.bml.bom.rules.DesignDecisions` |
| Validator responsibilities | `org.blockml.bml.bom.rules.ValidationResponsibilities` |
| Calibrator reference example | `org.blockml.bml.bom.document.BomDocument` — `<examples>` |
| Roundtrip equality (B20) | `org.blockml.bml.bom.capability.BomEquals` · `StripProvenance` |
| Public parse/serialize API (B26) | `org.blockml.bml.bom.api.ParseResult` · `SerializeResult` |

---

## Urmodell type map — TS export → BML FQN

Library catalog: `org.blockml.bml.bom.Library` (`packages/bom/blocks/org/blockml/bml/bom/Library.bml`).

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

| Topic | Owner |
|---|---|
| `EffectiveMemberSet` | `@blockml/core` utility — computed, not stored in Urmodell |
| `TypeRegistry` | `@blockml/core` — bootstrap / lookup API |
| BML → BOM mapping algorithm | `@blockml/parser` — `13_bml_to_bom_mapping.md` |
| Expression AST node union | `10_expression_language.md` |
| BML meta-model blocks | `org.blockml.bml.definition.*` in `@blockml/core` |

---

## Package ownership (summary)

```text
@blockml/bom     — Urmodell BML library (SSOT) + TypeScript implementation + bomEquals (B20)
@blockml/parser  — BML → BomDocument mapper; owns doc 13
@blockml/serializer — BomDocument → BML XML
@blockml/core    — TypeRegistry, resolveEffectiveMembers(), validateTypes(), …
```

Full ownership matrix: `00_system.md` — Package map · `15_dev_setup.md` — Phase A.

---

## Historical content

The pre-migration long-form interface definitions, validation checklists, and Calibrator walkthrough that previously lived in this file are now in the BML library blocks listed above. Do not treat this Markdown file as an implementation SSOT.
