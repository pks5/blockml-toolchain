# Constraints and Suggestions — Generalized Extension Points

version: 1.0.0

## Purpose of this Document

This document specifies how **constraints** and **suggestions** on Properties are modeled as Block instances — unified extension points built on the BlockML type system.

For property metadata see `00_bom_core.md`. For BML property syntax see `02_mbml.md`. For the BOM model see `12_bom_object_model.md`. For framework constraint types see `16_framework_base_types.md`. For generic type binding see `17_type_system_bml.md`. For compiler diagnostics see `06_compiler.md`.

---

## Motivation

The previous `constraints` and `suggestions` concepts are unified and built consistently on the BlockML type system. Instead of fixed XML elements with predefined attributes, both become extension points for Block instances.

This keeps the BlockML core small and fully extensible.

---

## Constraints

`<constraints>` is an optional container within a Property.

```xml
<property name="width" type="Float">
  <constraints>
    <constraint:Min value="0"/>
    <constraint:Max value="100"/>
  </constraints>
</property>
```

Each entry inside `<constraints>` is a **Block instance**. The referenced Block must inherit from:

```text
org.blockml.core.Constraint
```

### Constraint hierarchy

```text
org.blockml.core.Constraint
 ├── org.blockml.constraint.Min
 ├── org.blockml.constraint.Max
 ├── org.blockml.constraint.MinLength
 ├── org.blockml.constraint.MaxLength
 ├── org.blockml.constraint.Pattern
 ├── org.blockml.constraint.MinItems
 ├── org.blockml.constraint.MaxItems
 └── …
```

Each constraint defines its own properties. Example:

```xml
<constraint:Min value="0"/>
```

is an instance of `org.blockml.constraint.Min` with the property `value`.

### Generics

`Constraint` declares a generic parameter:

```text
Constraint<T>
```

or, on concrete constraints:

```text
Constraint<T extends PrimitiveType>   — Min, Max
Constraint<T extends String>          — Pattern
```

The generic is **not** specified at the usage site. The compiler binds it automatically to the property type.

Example:

```xml
<property name="width" type="Float">
  <constraints>
    <constraint:Min value="0"/>
  </constraints>
</property>
```

The compiler binds `T = Float` and checks:

* Is `Float` compatible with the constraint's generic bound?
* Is the constraint property value (`value="0"`) of type `Float`?

The same `Min` constraint works for `Integer`, `Float`, and other numeric types without re-specifying the type.

### Collections

The generic concept also handles collection property validation.

```xml
<property name="tags" type="String[]">
  <constraints>
    <constraint:MinItems value="1"/>
    <constraint:MaxItems value="10"/>
    <constraint:MinLength value="2"/>
  </constraints>
</property>
```

The compiler infers from each constraint's generic definition:

* `MinItems` / `MaxItems` operate on the collection (`String[]`).
* `MinLength` operates on the elements (`String`).

No additional syntax such as `<itemConstraints>` is required.

### Validation semantics

Constraints are **enforceable** — the semantic validator checks property values against declared constraints at compile time (`BML_CONSTRAINT_VIOLATION`). Editors may also use constraint metadata for input validation and range hints.

---

## Suggestions

Suggestions follow the same principle but use **no special base type**.

```xml
<property name="color" type="type:Color">
  <suggestions>
    <type:Color value="red"/>
    <type:Color value="green"/>
    <type:Color value="blue"/>
  </suggestions>
</property>
```

Each suggestion is a Block instance of the **same type as the property**. The compiler checks only that every suggestion instance matches the property type.

### Primitive suggestions

```xml
<property name="textFont" type="String" value="RBNo3.1 Black">
  <suggestions>
    <String value="Creato Display"/>
    <String value="RBNo3.1 Black"/>
  </suggestions>
</property>
```

Unqualified `String` resolves to `org.blockml.type.String` — same rules as property `type` attributes.

### Struct suggestions

```xml
<property name="size" type="type:Size3D">
  <suggestions>
    <type:Size3D x="1" y="1" z="1"/>
    <type:Size3D x="2" y="4" z="3"/>
  </suggestions>
</property>
```

### Validation semantics

Suggestions are **metadata only** — they do not affect type validation or compilation. The author can always enter any value. Editors display the property as a combobox; render targets (e.g. SCAD Customizer) may emit dropdown comments.

`<suggestions>` on an EnumType property remains an error (`BML_SUGGESTIONS_ON_ENUM`) — valid values come from `_values`.

---

## Result

Two unified extension points on a Property:

| Extension point | Instance type | Generic binding | Enforced |
|---|---|---|---|
| **Constraints** | `org.blockml.core.Constraint` sub-types | Compiler binds `T` to property/element type | Yes |
| **Suggestions** | Same type as the property | None | No (metadata) |

This pattern reduces special rules in the core and delegates interpretation to the participating Block types and type context.

---

## Related Documents

| Topic | Document |
|---|---|
| Property metadata | `00_bom_core.md` |
| BML property syntax | `02_mbml.md` |
| BOM PropertyDefinition | `12_bom_object_model.md` |
| BML→BOM mapping | `13_bml_to_bom_mapping.md` |
| Compiler diagnostics | `06_compiler.md` |
| SCAD Customizer rendering | `05_scad_renderer.md` |
| Framework bootstrap | `16_framework_base_types.md` |
| Generic type system | `17_type_system_bml.md` |
