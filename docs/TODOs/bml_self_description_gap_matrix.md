# Gap-Matrix: `02_mbml.md` → BlockML Core BML

Stand: 2026-08-01  
Ziel: BlockML BML Core selbstbeschreibend genug für Repo-Extraktion / Submodule — ohne externe MD als Sprach-SSOT.

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
| OK | ~18 |
| PARTIAL | ~35 |
| GAP | ~12 |
| OUT | ~14 |

**Kritisch für Submodule (müssen vor Split in BML):** Member Visibility (Vollregeln), Partial Overrides, Composition Placement, Sub-Block Visibility/utility, Directive-Semantik (über Katalog hinaus), FQN-/Identity-Algorithmen (Canonical derivation).

**Bereits stark in BML:** Documentation-Modell, Implicit Namespace, Library-Format, Member abstract/final/override (Kern), Property facets (Kern), Sub-/Root-/Embedded-Definition-Shapes, BmlAnnotation-Directive-Katalog.

---

## Matrix nach `02_mbml.md`

### Overview / Serialization

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Overview · File Extensions | **OK** | `documentation/Introduction.bml` | — |
| Serialization Formats | **OK** | `Introduction.bml` (XML sole; JSON not planned) | Detailvergleiche JSON-Beispiele |
| Document Types | **PARTIAL** | `Introduction.bml` (ein Root `<block>`) | Legacy-Root-Withdrawal-Liste, Document-Type-Tabelle |
| JSON as authoring form | **OK** / OUT | `Introduction.bml` | Explizite JSON-Beispiele (bewusst OUT) |

### Namespaces

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Namespaces | **PARTIAL** | `documentation/BmlNamespace.bml`, `core/Annotation.bml` | Vollständige Prefix-/Binding-Matrix aus MD |
| Annotations | **PARTIAL** | `annotation/BmlAnnotation.bml`, `core/Annotation.bml`, `PropertyDefinition.bml` | Ausführliche Annotation-Authoring-Guide als Doc-Block |
| Property value facets | **OK** | `definition/PropertyDefinition.bml` (values[], facets, Diagnostics) | — (MD-Verweis bleibt DeepDive) |
| XML prefix convention | **PARTIAL** | `BmlNamespace.bml`, `MemberDefinition.bml` | Kurze Norm-Tabelle „short = BlockML, domain token = domain“ |
| Context-Bound Implicit Namespace | **OK** | `documentation/ImplicitNamespaceResolution.bml` | — |

### Type References and Block Identity

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Type references in attributes/values | **PARTIAL** | `type/TypeReference.bml`, `BlockDefinition.bml` | Vollständige Auflösungsreihenfolge |
| Sub-Block type references | **PARTIAL** | `definition/SubBlockDefinition.bml` | Alle Edge Cases aus MD |
| Unqualified nested type resolution | **PARTIAL** | `SubBlockDefinition.bml` | Algorithmus „enclosing-chain first“ als Doc-Block |
| Root Block identity | **PARTIAL** | `definition/RootBlockDefinition.bml`, `BlockDefinition.bml` | Canonical-Ableitungstabellen |
| Sub-Block identity | **PARTIAL** | `SubBlockDefinition.bml` | Vollständige Mismatch-/Depth-Regeln |
| Canonical derivation summary | **GAP** | nur Fragmente in Definition-Docs | Eigener Doc-Block `TypeIdentityDerivation` empfohlen |

### Schema Validation

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Schema Validation | **PARTIAL** / Toolchain | `Library.schemas`, XSD-Hinweise | XSD-Rolle vs BML-SSOT — eher Toolchain-MD |

### Block Definition — Documentation Model

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Required Fields | **OK** | `core/Block.bml`, `DocumentationModel.bml`, `BlockDefinition.bml` | — |
| Terminology — Urbild | **PARTIAL** | `DocumentationModel.bml`, `Block.bml` | Dedizierte Urbild-/WOT-Abgrenzung (teilweise `WOTFoundation`) |
| Documentation prose rules | **PARTIAL** | `DocumentationModel.bml` | Stilregeln / „several words“-Normen aus MD |
| Definition identity first — `<is>` | **OK** | `DocumentationModel.bml`, `Block.bml` | — |
| `<summary>` | **OK** | `StructuralDefinition.bml`, `DocumentationModel.bml` | — |
| `<keywords>` | **OK** | `StructuralDefinition`, `meta/Fixed*`, `FreeText*` | — |
| `<language>` | **OK** | `Block.bml`, `DocumentationModel.bml`, `ImplicitNamespaceResolution` | — |
| `<documentation>` | **OK** | `StructuralDefinition`, `DocumentationModel` | — |
| Documentation facets and i18n | **OK** | `StructuralDefinition.bml` (facets ≠ locales) | — |
| `<isnot>` | **OK** | `BlockDefinition`, `DocumentationModel`, `Block` | — |
| `<aliases>` | **OK** | `BlockDefinition`, `meta/*Alias`, `DocumentationModel` | — |
| Documentation extensions | **OK** | `StructuralDefinition` (changelog, examples, references) | — |
| Task guides and diagnostics | **PARTIAL** | `TaskGuideModel`, `BootstrapModel`, 3 Tasks, 1 Diagnostic | ~155 weitere Diagnostic-Blocks; MD-lange Task-Beispiele |
| `<status>` | **OK** | `StructuralDefinition.status`, `status/*` | — |
| Block Name Convention | **PARTIAL** | `BlockDefinition` / Diagnostics `BML_INVALID_BLOCK_NAME` | Explizite Naming-Regeln als Doc-Block |
| Optional Fields | **OK** | Definition-Branch Members | — |
| Type Modifiers | **OK** | `StructuralDefinition` abstract/final | — |
| Contracts | **PARTIAL** | `ModelingGuidelines.bml`, `BlockDefinition.contracts` | Merge-Reihenfolge, Ignorierregeln (subBlocks/compositions) vollständig |
| Namespace Declarations | **PARTIAL** | `BmlNamespace`, `MemberDefinition` | Member-xmlns Authoring-Beispiele |
| Member Namespace | **OK** | `MemberDefinition.bml` | — |
| Conventions / Minimal / Full examples | **GAP** (examples) | Task `AuthorNewBlock` | Volle MD-Beispiele → `examples` auf Doc-/Task-Blocks |

### Members

| MD-Sektion | Status | Primäre BML-Abdeckung | Fehlt in BML |
|---|---|---|---|
| Member Element Names | **OK** | `MemberDefinition` (`bml:xml="${ #this.name }"`) | — |
| Definition Content Containers | **OK** | `BlockDefinition` properties/aggregations/… | — |
| Block Instances | **PARTIAL** | `BlockAndInstance.bml`, Aggregation composition | Instanz-Serialisierungsregeln vollständig |
| **Member Visibility** | **OK** | `documentation/MemberVisibility.bml` + `MemberDefinition.visibility` | MD nur noch DeepDive/Beispiele |
| Common Member Attributes | **OK** | `MemberDefinition` | — |
| Abstract, final, and override | **OK** | `MemberDefinition`, `StructuralDefinition`, `ModelingGuidelines` | Wenige Edge Cases nur in MD |
| readOnly Members | **PARTIAL** | `MemberDefinition.readOnly`, `MustBeReadOnly` | Ausführliche Instanz-vs-Definition-Semantik |
| Member Namespace (Element QName) | **OK** | `MemberDefinition`, Property/Aggregation Docs | — |
| **Partial Member Overrides** | **OK** | `documentation/PartialMemberOverrides.bml` + `MemberDefinition` | MD nur noch DeepDive/Beispiele |
| Properties | **OK** | `PropertyDefinition.bml` | — |
| Property Value (`<value>`) | **OK** | `PropertyDefinition` | — |
| Type Resolution | **PARTIAL** | `PropertyDefinition`, `TypeSystemOverview` | Verweis auf `17_*` für Generics/Unions |
| Enum Types vs. Suggestions | **OK** | `PropertyDefinition.suggestions`, `EnumType` | Detail in `18_*` |
| Aggregations | **OK** | `AggregationDefinition.bml` | Composition-Details → Composition-GAP |
| Associations | **OK** | `AssociationDefinition.bml`, `InstanceReference` | — |
| Capabilities | **PARTIAL** | `CapabilityDefinition`, `CapabilitySemantics` | Authoring-Beispiele, Implementation-Placement aus MD |

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
| Sub-Block Visibility | **GAP** | — | Visibility-on-SubBlock-Norm |
| Optional `<visibility>` on Sub-Blocks | **GAP** | — | Property/Regel fehlt oder nur MD |
| FQN Auto-Resolution | **PARTIAL** | `SubBlockDefinition` | Canonical summary Doc-Block |
| Embedded Blocks (Inline Library) | **OK** | `RootBlockDefinition`, `EmbeddedBlockDefinition` | Edge Cases aus MD |
| Composition Block References | **PARTIAL** | `BlockAndInstance`, TypeReference | Qualifier/`::`-Regeln vollständig |
| Sub-Block reference scope | **PARTIAL** | `SubBlockDefinition` | Scope-Tabelle |
| Sub-Block naming vs parent | **PARTIAL** | `SubBlockDefinition` | Naming-Collision-Regeln |
| utility Sub-Blocks | **GAP** | praktisch keine | utility-Semantik |
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
| ~156 `BML_*` | **45** (P0/P1-Cluster + Docs-Modell/Library) | Rest ~110 (Expression, Constraint, …) offen |

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
- [ ] `02_mbml.md` auf ToC + Links zu FQNs gekürzt (Roadmap V2)
- [ ] Typsystem-DeepDive aus `17_*` / `20_*` verdichten (nächste Gap-Welle)
- [ ] Restliche ~110 `BML_*` Codes aus Docs (Expression, Constraint, …) als Diagnostic-Blocks

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
