# TODO: Klareren Namen für `<embeddedBlocks>` finden

## Kontext

Im BlockML Definition-Meta-Modell gibt es die Root-only-Aggregation
`<embeddedBlocks>` (`RootBlockDefinition`) mit Einträgen vom Typ
`EmbeddedBlockDefinition`. Semantik laut Docs: **Inline Library** — flache
Liste virtueller `.bml`-Dateien im selben BomDocument (FQN = jeweiliges
`<type>`, nicht unter dem Root genestet).

Der Name `embeddedBlocks` betont die technische Einbettung in eine Datei, aber
nicht klar genug die Rolle (**Inline-Library / virtuelle Dokumente**) und lädt
zur Verwechslung mit Sub-Blocks oder Composition-Kindern ein.

## Ziel

Einen Namen finden, der:

1. die Rolle als Inline-Library / virtuelle Block-Dokumente klar macht
2. sich von `subBlocks`, Composition-Kindern und Library-`blocks` unterscheidet
3. in BML-Element, BOM-Feld und Typ-FQN (`…EmbeddedBlockDefinition`) konsistent
   umbenannt werden kann (oder bewusst nur das Element + Alias-Übergang)

## Offene Fragen

- Soll der Name **Library-/Dokument-Metapher** betonen (inline library, virtual
  files) oder eher **Scope** (local / nested — riskant wegen Sub-Blocks)?
- Breaking change vs. Alias / `bml:xml`-Übergang?
- Bleibt `EmbeddedBlockDefinition` parallel umbenannt oder nur das Aggregations-
  Element?

## Kandidaten (Skizze — zu bewerten)

- `inlineLibrary` / `virtualBlocks` / `virtualDocuments`
- `bundledBlocks` / `colocatedBlocks`
- anderer Name nach Review von `docs/02_mbml.md` (Embedded Blocks) und BOM

## Scope der Umbenennung (wenn entschieden)

- [ ] BML-Element / Aggregation-Name (`embeddedBlocks`)
- [ ] `EmbeddedBlockDefinition` Typ / Datei / Library-Export
- [ ] BOM-Felder und Mapping-Docs
- [ ] Validator-Diagnostics (`BML_EMBEDDED_BLOCKS_*`, `BML_NESTED_EMBEDDED_BLOCKS`, …)
- [ ] Beispiele und Guides

## Status

- [ ] Semantik in einem Absatz als Rename-SSOT festnageln
- [ ] Namenskandidaten gegen Verwechslungsrisiken prüfen
- [ ] Entscheidung dokumentieren
- [ ] Rename umsetzen (separater Change)
