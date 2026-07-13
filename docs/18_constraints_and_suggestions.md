# Constraints and Suggestions

version: 0.1.0

## Purpose of this Document

This document specifies how **property constraints** and **suggestions** are modeled in BlockML — as Block instances, not enums or hardcoded compiler behavior.

For BML property syntax see `02_mbml.md`.
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

The same Constraint type can be used both as metadata for renderers, editors, or runtimes **and** as a compile-time validation rule — without introducing separate Constraint types.

```text
Constraint   →  describes the condition
Validation   →  describes how a violation is handled
```

This follows the BlockML philosophy that semantic information should be represented as Blocks rather than fixed enums or hardcoded compiler behavior.

---

## Constraint Branch

**FQN:** `org.blockml.bml.core.Constraint` — abstract base for property constraints.

```text
org.blockml.bml.core.Block
  org.blockml.bml.core.Constraint                    ← abstract; generic Constraint<T>
    org.blockml.bml.constraint.Min
    org.blockml.bml.constraint.Max
    org.blockml.bml.constraint.MinLength
    org.blockml.bml.constraint.MaxLength
    org.blockml.bml.constraint.Pattern
    org.blockml.bml.constraint.MinItems
    org.blockml.bml.constraint.MaxItems
    …
```

Each concrete constraint extends `org.blockml.bml.core.Constraint` and declares its own properties. The generic parameter `T` is bound automatically to the property type (or element type for collection constraints) at validate time — authors never specify the type argument in BML.

### Standard constraints

| FQN | Compatible property types | Properties |
|---|---|---|
| `org.blockml.bml.constraint.Min` | `Number` sub-types | `value` |
| `org.blockml.bml.constraint.Max` | `Number` sub-types | `value` |
| `org.blockml.bml.constraint.MinLength` | `Text` | `value` |
| `org.blockml.bml.constraint.MaxLength` | `Text` | `value` |
| `org.blockml.bml.constraint.Pattern` | `Text` | `value` (regex) |
| `org.blockml.bml.constraint.MinItems` | collection types (`T[]`) | `value` |
| `org.blockml.bml.constraint.MaxItems` | collection types (`T[]`) | `value` |

Domain libraries may define additional constraint types (for example `com.machineblocks.bml.constraint.PreferredRange`).

### Authoring

Constraints are declared as child elements inside `<constraints>` on a Property:

```xml
<textSize type="Integer">
  <value>9</value>
  <constraints>
    <constraint:Min value="1" validation="Error"/>
    <constraint:Max value="72" validation="Error"/>
  </constraints>
</textSize>
```

Constraint instance properties serialize as attributes on the constraint element (same pattern as composition children).

---

## Validation Property

Every `org.blockml.bml.core.Constraint` receives an optional property:

```text
validation : org.blockml.bml.core.Validation
```

This is a normal Block reference (not an enum).

```xml
<constraint:Min
    value="0"
    validation="Error"/>
```

```xml
<constraint:PreferredRange
    min="10"
    max="20"/>
```

### Default behaviour

When `validation` is omitted:

- The BlockML validator **completely ignores** the constraint.
- The constraint remains part of the BOM and is available to renderers, editors, runtimes, and custom validators.

Constraints are **metadata by default**.

When `validation` is present, the BlockML validator still validates the constraint instance itself (type compatibility, generic binding, constraint property values) — only **value enforcement** against the enclosing property is skipped when `validation` is omitted.

---

## Validation Branch

**FQN:** `org.blockml.bml.core.Validation` — abstract base for enforcement semantics.

```text
org.blockml.bml.core.Block
  org.blockml.bml.core.Validation                    ← abstract
    org.blockml.bml.validation.Error
    org.blockml.bml.validation.Warning
    org.blockml.bml.validation.Information
```

The validator interprets the referenced Validation block to determine how a violated constraint should be reported:

| FQN | Semantics | Diagnostic |
|---|---|---|
| `org.blockml.bml.validation.Error` | Compilation must fail | `BML_CONSTRAINT_VIOLATION` |
| `org.blockml.bml.validation.Warning` | Compilation succeeds; warning emitted | `BML_CONSTRAINT_WARNING` |
| `org.blockml.bml.validation.Information` | Compilation succeeds; informational diagnostic | `BML_CONSTRAINT_INFORMATION` |

Examples:

```xml
<constraint:Min
    value="0"
    validation="Error"/>
<constraint:PreferredRange
    min="5"
    max="10"
    validation="Warning"/>
```

### Extensibility

Because Validation is a normal Block hierarchy, libraries may define their own validation semantics:

```text
com.machineblocks.bml.validation.ManufacturingWarning
com.enterprise.validation.ComplianceError
com.ui.validation.EditorHint
com.production.validation.RuntimeOnly
```

The BlockML validator only interprets the Validation types it understands. Constraints referencing unknown Validation blocks are not enforced by the core validator — they remain metadata for tools that do understand them.

---

## Generic Binding

`org.blockml.bml.core.Constraint` and its sub-types declare `<genericTypes>`. Unlike StructType generics, constraint type arguments are **never authored** — the compiler binds `T` from the enclosing property's type context at validate time:

```text
Scalar property (Integer)       → Min/Max: T = Integer
Collection property (String[])  → MinItems/MaxItems: T = Text[]
                                → MinLength/MaxLength: T = Text (element type)
```

Binding rules per constraint FQN are defined in each constraint Block's `<documentation>`.

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

Suggestions are purely metadata — they do not affect type validation or compilation. The author can always enter any value regardless of suggestions.

Properties typed with an EnumType **must not** carry `<suggestions>` — valid values come from `_values` (`BML_SUGGESTIONS_ON_ENUM`).

---

## Compiler Diagnostics

| Code | When |
|---|---|
| `BML_CONSTRAINT_UNKNOWN` | constraint Block type not in TypeRegistry or not a Constraint sub-type |
| `BML_CONSTRAINT_TYPE_MISMATCH` | constraint generic T incompatible with property or element type |
| `BML_CONSTRAINT_VALUE_MISMATCH` | constraint instance property value incompatible with bound generic T |
| `BML_VALIDATION_UNKNOWN` | validation Block type not in TypeRegistry or not a Validation sub-type |
| `BML_CONSTRAINT_VIOLATION` | property value fails a constraint with `validation="Error"` |
| `BML_CONSTRAINT_WARNING` | property value fails a constraint with `validation="Warning"` |
| `BML_CONSTRAINT_INFORMATION` | property value fails a constraint with `validation="Information"` |
| `BML_SUGGESTION_TYPE_MISMATCH` | suggestion Block instance type incompatible with property type |

Constraints without a `validation` reference produce no value-enforcement diagnostics.

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
| SCAD customizer mapping | `05_scad_renderer.md` |
