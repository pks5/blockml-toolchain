# TODO: MemberGroups-Achsen absichern (Category + AiUsage)

## Kontext

`MemberDefinition.groups` ist eine Aggregation
`TypeReferenceEntity(core:MemberGroup)[]`. In MachineBlocks gibt es zwei
orthogonale Zweige:

- `com.machineblocks.bml.group.Category` — UI-/Parameter-Kategorien
- `com.machineblocks.bml.group.AiUsage` — AI-Nutzungsfacetten

NativeBlock folgt der Konvention **genau eine Category + genau eine AiUsage**
pro Member. Das ist derzeit **nicht** im Modell erzwungen.

## Ziel

Validator-Policy (Constraint), die sicherstellt:

1. Höchstens / genau **eine** Group mit `baseType`-Kette ⊇ `mbgroup:Category`
2. Höchstens / genau **eine** Group mit `baseType`-Kette ⊇ `mbgroup:AiUsage`
3. Keine Referenz auf die abstrakten Basistypen `Category` / `AiUsage` selbst
4. Keine zweite Category bzw. AiUsage am selben Member

Optional: Members ohne `groups` erlauben (0) vs. Pflicht, sobald `groups`
gesetzt ist.

## Warum nicht Stock-Constraints?

| Vorhanden | Reicht nicht, weil |
|---|---|
| `RequiresMember` (BlockConstraint) | Prüft nur Member-Existenz am Block, nicht `groups[]`-Inhalt |
| `AllowedChildType` (AggregationConstraint) | Ein erlaubter Child-Typ, keine „genau einer pro Zweig“-Zählung |
| `MinItems` / `MaxItems` (ValueConstraint) | Property-Werte, nicht TypeReference-Kinder nach Subtyp |

## Empfohlene Ansätze

### A — AggregationConstraint auf `groups` (bevorzugt)

Neue Constraint-Art (Core oder MB), z.B.:

- `ExactlyOneOfBranch` / `CountByTypeBound`
- Placement: auf `MemberDefinition.groups` bzw. MB-Override
- Semantik: zähle Kinder, deren resolved type `satisfiesTypeBound(…, Branch)`

Vorteil: Regel sitzt am richtigen Target (`groups`), gilt überall, wo die
Aggregation gesetzt wird.

### B — BlockConstraint auf MB-Block

Neue Domain-Constraint, z.B.:

- `com.machineblocks.bml.constraint.MemberGroupsAxes extends BlockConstraint`
- Placement: `<constraints>` auf `mbcore:Block` / `NativeBlock`
- Semantik: für jedes Member mit `groups` die Achsen-Invariante prüfen

Vorteil: Policy nur für MachineBlocks-Blöcke, ohne Core zu belasten.
Nachteil: indirekter als Constraint direkt auf `groups`.

### Empfehlung

- **MB-only Policy** → Ansatz **B** (BlockConstraint auf `mbcore:Block`)
- **Wiederverwendbare Gruppen-Achsen-Semantik** → Ansatz **A**
  (AggregationConstraint), ggf. generisch parametrisiert mit Branch-FQN

Beides braucht **neue Constraint-Semantik** im Validator — out of the box
gibt es das noch nicht.

## Abgrenzung

- Core `MemberGroup` / `groups` bewusst domain-agnostisch belassen.
- Keine feste 2-Achsen-Regel in Core, solange nur MB sie braucht.
- YAML `09_api_parameters.yml` bleibt Mirror; BML (NativeBlock) ist SSOT.

## Status

- [ ] Constraint-Typ wählen (A und/oder B)
- [ ] BML-Constraint-Block anlegen + in Library exportieren
- [ ] Validator-Semantik implementieren
- [ ] Diagnostics-Codes (z.B. `BML_MEMBER_GROUPS_AXIS_*`)
- [ ] NativeBlock / mbcore:Block mit Constraint verdrahten
- [ ] Tests für: ok, doppelte Category, fehlende AiUsage, Basis-Typ referenziert
