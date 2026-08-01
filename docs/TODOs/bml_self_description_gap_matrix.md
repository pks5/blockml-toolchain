# Gap-Matrix: `02_mbml.md` → BlockML Core BML

Stand: 2026-08-02  
Ziel: BlockML BML Core selbstbeschreibend genug für Repo-Extraktion / Submodule — ohne externe MD als Sprach-SSOT.

**Aktuell:** `docs/02_mbml.md` ist ToC → FQN-Index; Langform in `docs/archive/02_mbml_historical.md`.
README: 33 Doc-Blocks · **152 Diagnostics** (alle in Docs genannten `BML_*`) · 8 TaskGuides.

## Legende

| Status | Bedeutung |
|---|---|
| **OK** | Normative Regeln weitgehend in BML (Definition-/Doc-Blöcke); MD höchstens DeepDive |
| **PARTIAL** | Struktur/Kurzfassung in BML; Detailregeln, Edge Cases oder Algorithmen nur in MD |
| **GAP** | Kein oder nur stubartiger BML-Inhalt; MD ist alleinige SSOT |
| **OUT** | Nicht Core-Sprache (Domain/Toolchain) — gehört nicht in Core-SSOT |

**Abdeckungstiefe** (zusätzlich):

- *structure* — Members / Typen existieren
- *prose* — `<documentation>` trägt die Regel
- *doc-block* — eigener `documentation.*`-Block im README-Lernpfad
- *machine* — Constraint / Diagnostic / Annotation-SubBlock (maschinenlesbar)

---

## Zusammenfassung

| Status | Anzahl Sektionen (### / ## inhaltlich) |
|---|---|
| OK | Mehrheit der Sprach-Sektionen |
| PARTIAL | Expressions-Grammar, `bml:xml` Stage-Hybrid, Doc-Stil/Urbild, Instanz-Serialisierung |
| GAP | Beispiele-Aggregation; BML→BOM Mapping (Parser-Vertrag) |
| OUT | Domain / Toolchain |

**Sprachregeln (02/17/18/…):** weitgehend in BML. Verbleibende MD-SSOT: Toolchain (`12`/`13`/`10` EBNF/AST), Domain, optional Prose-Feinschliff.

---

## Matrix nach `02_mbml.md`

### Overview / Serialization

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Overview · File Extensions | **OK** | `documentation/Introduction.bml` | — |
| Serialization Formats | **OK** | `Introduction.bml` (XML sole; JSON not planned) | Detailvergleiche JSON-Beispiele |
| Document Types | **OK** | `Introduction.bml` (ein Root `<block>`; Legacy-Roots withdrawn) | — |
| JSON as authoring form | **OK** / OUT | `Introduction.bml` | Explizite JSON-Beispiele (bewusst OUT) |

### Namespaces

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Namespaces | **OK** | `documentation/BmlNamespace.bml` (+ AnnotationModel) | — |
| Annotations | **OK** | `documentation/AnnotationModel.bml` + `core/Annotation.bml` + `BmlAnnotation` | — |
| Property value facets | **OK** | `definition/PropertyDefinition.bml` (values[], facets, Diagnostics) | — (MD-Verweis bleibt DeepDive) |
| XML prefix convention | **OK** | `BmlNamespace.bml` (short = BlockML, domain token = domain) | — |
| Context-Bound Implicit Namespace | **OK** | `documentation/ImplicitNamespaceResolution.bml` | — |

### Type References and Block Identity

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Type references in attributes/values | **OK** | `documentation/TypeIdentityDerivation.bml` | — |
| Sub-Block type references | **OK** | `TypeIdentityDerivation` + `SubBlockDefinition` | — |
| Unqualified nested type resolution | **OK** | `TypeIdentityDerivation` (enclosing-chain first) | — |
| Root Block identity | **OK** | `TypeIdentityDerivation` + `RootBlockDefinition` | — |
| Sub-Block identity | **OK** | `TypeIdentityDerivation` + `SubBlockDefinition` | — |
| Canonical derivation summary | **OK** | `documentation/TypeIdentityDerivation.bml` | — |

### Schema Validation

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Schema Validation | **PARTIAL** / Toolchain | `Library.schemas`, XSD-Hinweise | XSD-Rolle vs BML-SSOT — eher Toolchain-MD |

### Block Definition — Documentation Model

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Required Fields | **OK** | `core/Block.bml`, `DocumentationModel.bml`, `BlockDefinition.bml` | — |
| Terminology — Urbild | **OK** | `DocumentationModel.bml` + `WOTFoundation` | — |
| Documentation prose rules | **OK** | `DocumentationModel.bml` | — |
| Definition identity first — `<is>` | **OK** | `DocumentationModel.bml`, `Block.bml` | — |
| `<summary>` | **OK** | `StructuralDefinition.bml`, `DocumentationModel.bml` | — |
| `<keywords>` | **OK** | `StructuralDefinition`, `meta/Fixed*`, `FreeText*` | — |
| `<language>` | **OK** | `Block.bml`, `DocumentationModel.bml`, `ImplicitNamespaceResolution` | — |
| `<documentation>` | **OK** | `StructuralDefinition`, `DocumentationModel` | — |
| Documentation facets and i18n | **OK** | `StructuralDefinition.bml` (facets ≠ locales) | — |
| `<isnot>` | **OK** | `BlockDefinition`, `DocumentationModel`, `Block` | — |
| `<aliases>` | **OK** | `BlockDefinition`, `meta/*Alias`, `DocumentationModel` | — |
| Documentation extensions | **OK** | `StructuralDefinition` (changelog, examples, references) | — |
| Task guides and diagnostics | **OK** / PARTIAL | `TaskGuideModel`, 8 Tasks, 152 Diagnostics | Optional: MD-lange Task-Beispiele in `examples` |
| `<status>` | **OK** | `StructuralDefinition.status`, `status/*` | — |
| Block Name Convention | **OK** | `documentation/BlockNameConvention.bml` | — |
| Optional Fields | **OK** | Definition-Branch Members | — |
| Type Modifiers | **OK** | `StructuralDefinition` abstract/final | — |
| Contracts | **OK** | `documentation/ContractsModel.bml` | — |
| Namespace Declarations | **OK** | `BmlNamespace` + `MemberDefinition` + `AnnotationModel` | Beispiele optional in `examples` |
| Member Namespace | **OK** | `MemberDefinition.bml` | — |
| Conventions / Minimal / Full examples | **GAP** (examples) | Task `AuthorNewBlock` | Volle MD-Beispiele → `examples` auf Doc-/Task-Blocks |

### Members

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Member Element Names | **OK** | `MemberDefinition` (`bml:xml="${ #this.name }"`) | — |
| Definition Content Containers | **OK** | `BlockDefinition` properties/aggregations/… | — |
| Block Instances | **OK** | `BlockAndInstance.bml` + `CompositionModel` | — |
| **Member Visibility** | **OK** | `documentation/MemberVisibility.bml` + `MemberDefinition.visibility` | MD nur noch DeepDive/Beispiele |
| Common Member Attributes | **OK** | `MemberDefinition` | — |
| Abstract, final, and override | **OK** | `MemberDefinition`, `StructuralDefinition`, `ModelingGuidelines` | Wenige Edge Cases nur in MD |
| readOnly Members | **OK** | `PartialMemberOverrides.bml` + `MemberDefinition.readOnly` | — |
| Member Namespace (Element QName) | **OK** | `MemberDefinition`, Property/Aggregation Docs | — |
| **Partial Member Overrides** | **OK** | `documentation/PartialMemberOverrides.bml` + `MemberDefinition` | MD nur noch DeepDive/Beispiele |
| Properties | **OK** | `PropertyDefinition.bml` | — |
| Property Value (`<value>`) | **OK** | `PropertyDefinition` | — |
| Type Resolution | **OK** | `TypeExpressions` / `GenericsModel` / `TypeSystemOverview` | DeepDive `17_*` |
| Enum Types vs. Suggestions | **OK** | `ConstraintsModel` + `PropertyDefinition.suggestions` | DeepDive `18_*` |
| Aggregations | **OK** | `AggregationDefinition.bml` + `CompositionModel` | — |
| Associations | **OK** | `AssociationDefinition.bml`, `InstanceReference` | — |
| Capabilities | **OK** | `CapabilitySemantics` + `CapabilityDefinition` + `PseudoCode` | Beispiele optional |

### Composition

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Unified Container Concept | **OK** | `documentation/CompositionModel.bml` | — |
| Placement Rules | **OK** | `CompositionModel.bml` | — |
| Recursive Composition | **OK** | `CompositionModel.bml` | — |
| Expressions in Compositions | **PARTIAL** | `CompositionModel` + `Expressions.bml` | Volle Grammar → `10_expression_language.md` |
| Sharing Values Between Siblings | **OK** | `CompositionModel.bml` (`bml:with`) | — |

### BML Directives

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Directive Placement | **OK** | `documentation/BmlDirectives.bml` + `BmlAnnotation` | — |
| `bml:xml` | **PARTIAL** | `BmlDirectives.bml` + Definition `bml:xml` | Open Decisions / Stage-Hybrid-Details noch in `19_*` |
| `bml:each` | **OK** | `BmlDirectives` + `BmlAnnotation.Each` | — |
| `bml:if` / `bml:unless` | **OK** | `BmlDirectives` + `BmlAnnotation.If` / `Unless` | — |
| `bml:container` | **OK** | `BmlDirectives` + `BmlAnnotation.Container` | — |
| Dynamic Instance ID | **OK** | `BmlDirectives` + `CompositionModel` | — |
| `bml:with` | **OK** | `BmlDirectives` + `CompositionModel` | Expression-Grammar-Details → `10_*` DeepDive |

### Sub-Blocks

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Format | **OK** | `SubBlockDefinition.bml` | — |
| Sub-Block Visibility | **OK** | `SubBlockModel` + `MemberVisibility` | — |
| Optional `<visibility>` on Sub-Blocks | **OK** | `SubBlockModel` | — |
| FQN Auto-Resolution | **OK** | `TypeIdentityDerivation` + `SubBlockModel` | — |
| Embedded Blocks (Inline Library) | **OK** | `SubBlockModel` + `EmbeddedBlockDefinition` | — |
| Composition Block References | **OK** | `SubBlockModel` + `CompositionModel` | — |
| Sub-Block reference scope | **OK** | `SubBlockModel` | — |
| Sub-Block naming vs parent | **OK** | `SubBlockModel` + `BlockNameConvention` | — |
| utility Sub-Blocks | **OK** | `SubBlockModel` | — |
| Calibrator Example / Visibility repeats | **OUT**/examples | — | Beispiele → examples-Aggregation |

### Domain (nicht Core)

| MD-Sektion | Status | Hinweis |
|---|---|---|
| MachineBlocks Set Definition | **OUT** | → `com.machineblocks.bml.*` / Domain-Docs |
| Presets (MachineBlocks) | **OUT** | Domain; nur beiläufige Erwähnungen in Core |
| Config Profiles | **OUT** | Domain |
| SCAD Set/Preset Output | **OUT** | Renderer |

### Library Format

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Library Format · Nested · Structure | **OK** | `LibrarySystem.bml`, `core/BlockLibrary.bml`, `Library.bml` | Monorepo-Layout (`15_dev_setup`) bleibt Toolchain |

### BML→BOM Mapping (Abschnitt in 02)

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| BML→BOM Mapping · Default Resolution | **GAP** / Toolchain | Verweise auf `13_*` | Mapping-Algorithmus — Parser-Vertrag; mittelfristig eigene Compiler-Blocks (V2/V3 Roadmap) |

---

## Empfohlene neue Doc-Blocks (Core)

Priorität für README `ReadFirst` / `ReadNext`-Kette:

| Neu | Ersetzt / verdichtet MD-Kapitel | Prio |
|---|---|---|
| `doc:MemberVisibility` | 02 — Member Visibility | P0 ✅ |
| `doc:PartialMemberOverrides` | 02 — Partial Member Overrides | P0 ✅ |
| `doc:CompositionModel` | 02 — Composition (*) | P0 ✅ |
| `doc:BmlDirectives` | 02 — BML Directives + Teile 10/19 | P0 ✅ |
| `doc:TypeIdentityDerivation` | 02 — Type References / Canonical derivation | P1 ✅ |
| `doc:SubBlockModel` | 02 — Sub-Block Visibility, utility, scope | P1 ✅ |
| `doc:ContractsModel` | 02/17 — Contracts merge rules | P1 ✅ |
| `doc:BlockNameConvention` | 02 — Block Name Convention | P1 ✅ |
| `doc:ConstraintsModel` | 18 / 02 — Constraints & suggestions | ✅ |
| `doc:AnnotationModel` | 02 — Annotations · value facets | ✅ |

Bestehende Blocks erweitern (statt neu):

| Block | Erweiterung |
|---|---|
| `ImplicitNamespaceResolution` | OK belassen |
| `DocumentationModel` | OK; Beispiele in `examples` |
| `ModelingGuidelines` | Contracts-Merge aus MD nachziehen |
| `DefinitionModel` | Link auf `19` durch eigene `bml:xml`-Norm ersetzen |
| `Expressions` | Normative Untermenge aus `10_*` (Core-relevant) |
| `BmlAnnotation` SubBlocks | Prose von „See 10_…“ → auf `doc:BmlDirectives` |

---

## Diagnostics-Gap (quer zu 02)

| In Docs (ca.) | Als `diagnostic/*.bml` | Status |
|---|---|---|
| ~156 `BML_*` | **152** (alle genannten Codes) | Optional: Prose schärfen (Fallback-Texte) |

Cluster-TaskGuides: `FixVisibilityAccess`, `FixMemberOverride`, `FixCompositionPlacement`, `FixTypeIdentity` (+ bestehend `DebugUnknownType`).

---

## Abgrenzung andere MD (nicht in dieser Matrix detailliert)

| MD | Rolle für Core-Selbstbeschreibung |
|---|---|
| `17_type_system_bml.md` | Nächste Gap-Matrix; Overview/ValueTypeConfiguration nur Summary |
| `19_definition_blocks_and_bml_xml.md` | `bml:xml`-Norm → in Definition-Docs + `BmlDirectives` |
| `12` / `13` | BOM/Mapping — Parser-SSOT; Core braucht Auszug der Sprachregeln |
| `10_expression_language.md` | Expression-SSOT; Core-Doc nur Untermenge |
| `00` / `06` / `07` / `14` / `15` | Toolchain — nicht Core-Sprach-SSOT |
| `03` / `04` / `05` | Domain MachineBlocks |

---

## Migrations-Checkliste (Submodule-reif)

- [x] P0 Doc-Blocks geschrieben und in `Library.blocks` + `README` ReadFirst/ReadNext eingehängt (2026-08-01)
- [x] P1 Doc-Blocks geschrieben und eingehängt (2026-08-01): TypeIdentityDerivation, SubBlockModel, ContractsModel, BlockNameConvention
- [x] Visibility / Partial Override / Composition: keine `see file="02_mbml.md"` mehr als *AuthoringGuide* (höchstens DeepDive/Historie)
- [x] `BmlAnnotation.*` verweist auf Core-Doc-Blocks, nicht auf `10_*` als Norm
- [x] Diagnostic-Blocks für Codes aus P0/P1-Kapiteln (2026-08-01) — 45 diagnostics + 4 cluster TaskGuides
- [ ] Domain-Abschnitte (Set/Preset) aus Core-Lernpfad entfernt oder klar als OUT markiert
- [x] `02_mbml.md` → ToC + FQN-Links; Langform nach `archive/02_mbml_historical.md`
- [x] Typsystem-DeepDive verdichtet (2026-08-01): TypeExpressions, GenericsModel, ConstantValueType, FunctionMappingModel (+ 17 Typ-Diagnostics)
- [x] Expressions verdichtet (2026-08-02): Expressions + EmbeddedExpressions + FixExpressionErrors + 15 Expr-Diagnostics
- [x] Alle in Docs genannten `BML_*` Codes als Diagnostic-Blocks (2026-08-02) — 152
- [x] `ConstraintsModel` Doc-Block (+ AddConstraint verdrahtet)
- [x] `AnnotationModel` Doc-Block (2026-08-02) — Annotation-Authoring + Facets
- [x] Prefix-Matrix / Namespace-Norm in `BmlNamespace` (2026-08-02)
- [x] CapabilitySemantics + readOnly-Semantik verdichtet; Gap-Matrix Sprach-Sektionen auf OK
- [x] Diagnostic-Prose Batch-Expand (summary + Remedy) für dünne Fallbacks
- [ ] Optional: `10_*` EBNF / `12`/`13` bleiben DeepDive/Parser-Vertrag
- [ ] Optional: Doc-Stil/Urbild, Instanz-Serialisierung, `bml:xml` Stage-Hybrid; Beispiele in `examples`

---

## Schnellreferenz: stärkste bestehende BML-Quellen

| Thema | Datei |
|---|---|
| Lernpfad | `README.bml` |
| Docs-Modell | `documentation/DocumentationModel.bml` |
| Implicit NS | `documentation/ImplicitNamespaceResolution.bml` |
| Library | `documentation/LibrarySystem.bml`, `core/BlockLibrary.bml` |
| Members / visibility Kern | `definition/MemberDefinition.bml` |
| Properties / facets | `definition/PropertyDefinition.bml` |
| Aggregations / composition hook | `definition/AggregationDefinition.bml` |
| Sub-/Root-/Embedded | `definition/SubBlockDefinition.bml`, `RootBlockDefinition.bml`, `EmbeddedBlockDefinition.bml` |
| Directives Katalog | `annotation/BmlAnnotation.bml` |
| Modeling patterns | `documentation/ModelingGuidelines.bml` |
