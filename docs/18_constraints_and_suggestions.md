# Constraints and Suggestions

version: 0.2.0

## Purpose of this Document

This document specifies how **constraints** and **suggestions** are modeled in BlockML — as Block instances, not enums or hardcoded compiler behavior.

Constraints may be attached to **Blocks**, **Properties**, **Aggregations**, **Associations**, and **Capabilities** via a single shared `<constraints>` container.

For BML syntax see `02_mbml.md`.
For the abstract object model see `00_bom_core.md`.
For constraint generic binding see `17_type_system_bml.md`.
For BOM mapping see `13_bml_to_bom_mapping.md`.
For compiler diagnostics see `06_compiler.md`.

---

## Design Decision

Constraints and validation are **separate concepts**:

| Concept | Role |
|---|---|
| **Constraint** | Describes a semantic restriction or recommendation |
| **Validation** | Describes whether and how BlockML itself should enforce that constraint |

The same Constraint type can be used both as metadata for renderers, editors, or runtimes **and** as a compile-time validation rule — without introducing separate Constraint types or separate containers per target kind.

```text
Constraint   →  describes the condition
Validation   →  describes how a violation is handled
```

**Central architecture decision:** one shared `<constraints>` mechanism, but **separate branches** for value rules, member-definition rules, and Block-level rules.

Intrinsic language rules (missing baseType, invalid member override, visibility violations, …) remain **fixed in the validator** — constraints are additional semantic rules, not a replacement for core syntax validation.

---

## Constraint Hierarchy

**FQN:** `org.blockml.bml.core.Constraint` — universal abstract root.

```text
org.blockml.bml.core.Constraint
│
├── org.blockml.bml.constraint.ValueConstraint<T extends ValueType>
│     org.blockml.bml.constraint.Min
│     org.blockml.bml.constraint.Max
│     org.blockml.bml.constraint.MinLength
│     org.blockml.bml.constraint.MaxLength
│     org.blockml.bml.constraint.Pattern
│     org.blockml.bml.constraint.MinItems
│     org.blockml.bml.constraint.MaxItems
│     org.blockml.bml.constraint.ValuePresent
│
└── org.blockml.bml.constraint.StructuralConstraint<T extends Definition>
      │
      ├── org.blockml.bml.constraint.BlockConstraint<T extends BlockDefinition>
      │     org.blockml.bml.constraint.RequiresMember
      │
      └── org.blockml.bml.constraint.MemberConstraint<T extends MemberDefinition>
            ├── org.blockml.bml.constraint.PropertyConstraint<T extends PropertyDefinition>
            │     org.blockml.bml.constraint.MustBeReadOnly
            ├── org.blockml.bml.constraint.AggregationConstraint<T extends AggregationDefinition>
            │     org.blockml.bml.constraint.AllowedChildType
            ├── org.blockml.bml.constraint.AssociationConstraint<T extends AssociationDefinition>
            │     org.blockml.bml.constraint.NoSelfReference
            └── org.blockml.bml.constraint.CapabilityConstraint<T extends CapabilityDefinition>
                  org.blockml.bml.constraint.RequiresImplementation
```

All branch types are **abstract**. Domain libraries may extend any branch with additional concrete constraints.

### Branch semantics

| Branch | Validates | Typical examples |
|---|---|---|
| **ValueConstraint** | Concrete property **value** / ValueType content | Min, Max, Pattern, ValuePresent |
| **PropertyConstraint** | Property **definition** shape | MustBeReadOnly, MustBeFinal |
| **AggregationConstraint** | Aggregation definition or child instances | AllowedChildType, UniqueBy |
| **AssociationConstraint** | Association definition or targets | NoSelfReference, TargetExists |
| **CapabilityConstraint** | Capability definition or implementation | RequiresImplementation, Pure |
| **BlockConstraint** | Block as a whole; may span members | RequiresMember, MutuallyExclusive |

**ValueConstraint vs StructuralConstraint:** ValueConstraint checks authored or bound **values**. StructuralConstraint checks **definition shape** — member presence, readOnly flags, allowed child types, implementation bindings, cross-member rules.

---

## Placement — single `<constraints>` container

The **embedding context** determines the constraint target. No `target` property is introduced.

```xml
<block>
  <constraints>
    <constraint:RequiresMember name="width" validation="Error"/>
  </constraints>
  <properties>
    <width type="Integer">
      <constraints>
        <constraint:Min value="1" validation="Error"/>
        <constraint:MustBeReadOnly validation="Warning"/>
      </constraints>
    </width>
  </properties>
  <aggregations>
    <children type="core:Block[]">
      <constraints>
        <constraint:AllowedChildType type="core:Block" validation="Error"/>
      </constraints>
    </children>
  </aggregations>
  <associations>
    <owner type="InstanceReference(core:Block)">
      <constraints>
        <constraint:NoSelfReference validation="Error"/>
      </constraints>
    </owner>
  </associations>
  <capabilities>
    <render type="cap:Transformation">
      <constraints>
        <constraint:RequiresImplementation validation="Error"/>
      </constraints>
    </render>
  </capabilities>
</block>
```

Allowed placement:

| Container parent | Valid constraint branches |
|---|---|
| `<block>` | BlockConstraint |
| `<property>` | ValueConstraint, PropertyConstraint |
| `<aggregation>` | AggregationConstraint |
| `<association>` | AssociationConstraint |
| `<capability>` | CapabilityConstraint |

Wrong branch for context → `BML_CONSTRAINT_TARGET_MISMATCH`.

Example — **invalid**:

```xml
<capabilities>
  <render type="cap:Transformation">
    <constraints>
      <constraint:Min value="1" validation="Error"/>
    </constraints>
  </render>
</capabilities>
```

`Min` is a ValueConstraint; a Capability requires CapabilityConstraint.

---

## Automatic generic target binding

Authors never specify generic type arguments in BML. The validator binds `T` from the embedding context:

```text
ValueConstraint under Property          → T = effective ValueType of the Property
PropertyConstraint under Property       → T = effective PropertyDefinition
AggregationConstraint under Aggregation → T = effective AggregationDefinition
AssociationConstraint under Association → T = effective AssociationDefinition
CapabilityConstraint under Capability   → T = effective CapabilityDefinition
BlockConstraint under Block             → T = effective org.blockml.bml.definition.BlockDefinition type
                                          (including SubBlockDefinition and RootBlockDefinition subtypes)
```

Binding rules and branch compatibility are resolved at validate time. **Resolved generics and target types are not stored in the Canonical BOM.**

---

## Validation property

Every `org.blockml.bml.core.Constraint` has an optional `validation` property referencing `org.blockml.bml.core.Validation`.

```xml
<constraint:Min value="0" validation="Error"/>
```

### Default behaviour

When `validation` is omitted:

- `validateConstraints()` **does not enforce** the constraint rule.
- The constraint instance remains in the BOM as semantic metadata.
- The instance itself is still validated (known type, branch compatibility, property values, generic binding).

When `validation` is present, the referenced Validation block determines reporting (`Error` → `BML_CONSTRAINT_VIOLATION`, etc.).

---

## validateConstraints() pipeline

Stage [8] — after `resolveEffectiveMembers()` and instance value binding where applicable:

```text
1. Resolve constraint instance typeFqn
2. Determine constraint branch via baseType chain
3. Determine embedding context (Block / Property / Aggregation / Association / Capability)
4. Check branch ↔ context compatibility (BML_CONSTRAINT_TARGET_MISMATCH)
5. Bind generic T automatically from context
6. Validate constraint instance (properties, validation reference, generic binding)
7. If validation is set and understood → evaluate the constraint rule
```

**ValuePresent** is evaluated after full member resolution and instance binding. **Expression** constraints (future BlockConstraint) are syntax- and type-checked only — not executed at validate time.

Inherited constraints merge with effective definition members the same way as other member metadata.

---

## Standard value constraints

| FQN | Branch | Compatible context | Properties |
|---|---|---|---|
| `org.blockml.bml.constraint.Min` | ValueConstraint | Property (numeric ValueType) | `value` |
| `org.blockml.bml.constraint.Max` | ValueConstraint | Property (numeric ValueType) | `value` |
| `org.blockml.bml.constraint.MinLength` | ValueConstraint | Property (Text) | `value` |
| `org.blockml.bml.constraint.MaxLength` | ValueConstraint | Property (Text) | `value` |
| `org.blockml.bml.constraint.Pattern` | ValueConstraint | Property (Text) | `value` |
| `org.blockml.bml.constraint.MinItems` | ValueConstraint | Property (collection) | `value` |
| `org.blockml.bml.constraint.MaxItems` | ValueConstraint | Property (collection) | `value` |
| `org.blockml.bml.constraint.ValuePresent` | ValueConstraint | Property (any ValueType) | — |

### ValuePresent

Requires an authored property value after full model resolution. Only authored values count — expression evaluation does not satisfy ValuePresent.

```xml
<count type="Integer">
  <constraints>
    <constraint:ValuePresent validation="Error"/>
  </constraints>
</count>
```

---

## Reference structural constraints

Minimal concrete constraints — one per new branch (for tests and validator bootstrap):

| FQN | Branch | Properties |
|---|---|---|
| `org.blockml.bml.constraint.RequiresMember` | BlockConstraint | `name` |
| `org.blockml.bml.constraint.MustBeReadOnly` | PropertyConstraint | — |
| `org.blockml.bml.constraint.AllowedChildType` | AggregationConstraint | `type` |
| `org.blockml.bml.constraint.NoSelfReference` | AssociationConstraint | — |
| `org.blockml.bml.constraint.RequiresImplementation` | CapabilityConstraint | — |

---

## Validation Branch

**FQN:** `org.blockml.bml.core.Validation` — abstract base for enforcement semantics.

```text
org.blockml.bml.core.Block
  org.blockml.bml.core.Validation
    org.blockml.bml.validation.Error
    org.blockml.bml.validation.Warning
    org.blockml.bml.validation.Information
```

| FQN | Semantics | Diagnostic |
|---|---|---|
| `org.blockml.bml.validation.Error` | Compilation must fail | `BML_CONSTRAINT_VIOLATION` |
| `org.blockml.bml.validation.Warning` | Warning emitted | `BML_CONSTRAINT_WARNING` |
| `org.blockml.bml.validation.Information` | Informational | `BML_CONSTRAINT_INFORMATION` |

---

## BOM model

Constraints are stored losslessly on constrainable definitions:

```typescript
interface ConstrainableDefinition {
  /** Constraint Block instances — document order preserved. Target binding not stored. */
  constraints?: BlockInstance[]
}
```

Applied via:

- `BlockDefinition` (root, Sub-Block, embedded)
- `PropertyDefinition`, `AggregationDefinition`, `AssociationDefinition`, `CapabilityDefinition`

Suggestions remain **Property-only** — unchanged from prior spec.

The Canonical BOM stores constraint instances verbatim. Generic binding, branch resolution, and rule evaluation happen only in the validator.

---

## Suggestions

A Property may declare a list of suggested values. Each suggestion is a Block instance of the **same type as the property** — no special base type.

```xml
<textColor type="Text">
  <value>#303D4E</value>
  <suggestions>
    <TextEntity value="#303D4E"/>
    <TextEntity value="#EAC645"/>
  </suggestions>
</textColor>
```

Suggestions are purely metadata. Properties typed with an EnumType **must not** carry `<suggestions>` (`BML_SUGGESTIONS_ON_ENUM`).

---

## Compiler Diagnostics

| Code | When |
|---|---|
| `BML_CONSTRAINT_UNKNOWN` | Constraint type not in TypeRegistry or not a Constraint sub-type |
| `BML_CONSTRAINT_TYPE_MISMATCH` | Generic T incompatible with bound target type |
| `BML_CONSTRAINT_TARGET_MISMATCH` | Constraint branch incompatible with embedding context |
| `BML_CONSTRAINT_VALUE_MISMATCH` | Constraint instance property value incompatible with bound T |
| `BML_VALIDATION_UNKNOWN` | Validation type not in TypeRegistry |
| `BML_CONSTRAINT_VIOLATION` | Rule fails with `validation="Error"` |
| `BML_CONSTRAINT_WARNING` | Rule fails with `validation="Warning"` |
| `BML_CONSTRAINT_INFORMATION` | Rule fails with `validation="Information"` |
| `BML_SUGGESTION_TYPE_MISMATCH` | Suggestion type ≠ property type |

Constraints without `validation` produce no rule-enforcement diagnostics.

---

## Related Documents

| Topic | Document |
|---|---|
| Property BML syntax | `02_mbml.md` |
| Abstract object model | `00_bom_core.md` |
| Type system · generic binding | `17_type_system_bml.md` |
| BOM mapping | `13_bml_to_bom_mapping.md` |
| Compiler diagnostics | `06_compiler.md` |
| Framework base types | `16_framework_base_types.md` |
| Constraint test fixtures | `packages/core/test/constraints/` |
