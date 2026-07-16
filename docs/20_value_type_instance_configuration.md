# ValueType Instance Configuration

version: 0.1.0

## Purpose of this Document

This document specifies how a Property configures its referenced **ValueType** through an owned type instance, and how that configuration is authored inline in `type` expressions.

For instance configuration syntax see `20_value_type_instance_configuration.md`. For Constant singleton types see `21_constant_value_type.md`. For positional mapping rules see `18_function_mapping.md`.

---

## Motivation

Many commonly used constraints are not independent validation rules. They configure the behavior of the referenced ValueType itself.

```xml
<!-- Before: type configuration expressed as constraints -->
<name type="Text">
  <constraints>
    <constraint:MaxLength value="100"/>
  </constraints>
</name>
<price type="Decimal">
  <constraints>
    <constraint:Precision value="10"/>
    <constraint:Scale value="2"/>
  </constraints>
</price>
```

These describe how `Text` or `Decimal` behaves — not an additional business rule.

---

## Design

A Property internally owns an **instance** of its referenced ValueType. Configuration is applied to that instance — not via a separate `typeOptions` attribute.

The inline syntax is a compact representation of configuring the ValueType Block:

```xml
<name type="Text{maxLength: 100}"/>
<price type="Decimal{precision: 10, scale: 2}"/>
```

Semantically equivalent to configuring the ValueType instance directly:

```xml
<Text maxLength="100"/>
<Decimal precision="10" scale="2"/>
```

ValueTypes expose their configuration through their own Properties. Frequently used constraint-like settings move into the type expression; the constraint system remains for general semantic validation.

---

## Syntax

Two orthogonal mechanisms may appear on a named type reference:

| Syntax | Purpose | Example |
|---|---|---|
| `(...)` | Generic type arguments | `Box(Integer)` · `TypeReference(core:Block)` |
| `{...}` | ValueType instance configuration | `Text{maxLength: 100}` · `Decimal{10, 2}` |

Both may coexist when a generic ValueType also accepts instance configuration:

```text
com.foo.Box(Integer){minItems: 1}
```

Multiplicity brackets apply after configuration:

```text
Text{maxLength: 50}[0..n]
Decimal{precision: 10, scale: 2}
Integer{min: 0, max: 100}[1..5]
```

### Named configuration

Named arguments use **JSON-like `key: value` object syntax** (same separator as expression object literals and anonymous struct types). They map to effective Properties of the referenced ValueType by name:

```text
Decimal{precision: 10, scale: 2}

  →  precision = 10
     scale = 2
```

Configuration values may be nested object / array literals when the Property type is a StructType (or other compound ValueType):

```text
Constant(type:SizeXY){value: {x: 1, y: 2}}
SomeType{origin: {x: 0, y: 0}, size: {x: 4, y: 2}}
```

Do **not** use `key=value` in `{…}` instance configuration. Expression-language named call arguments still use `=` (`@bean.f(a = 1)`); that is parameter binding, not type-instance configuration.
### Positional configuration

Positional arguments map by **effective Property declaration order** on the ValueType — the same principle as FunctionMapping:

```text
Decimal{10, 2}

  →  first property  = 10   (precision)
     second property = 2    (scale)
```

Positional and named configuration must not be mixed in one `{...}` block (`BML_MIXED_TYPE_CONFIGURATION`).

Unknown configuration property → `BML_UNKNOWN_TYPE_CONFIGURATION`. Value type mismatch → `BML_TYPE_CONFIGURATION_VIOLATION`.

---

## Semantic Model

At validate time the compiler:

1. Parses the `type` attribute into a `TypeExpression` (see `12_bom_object_model.md`).
2. Resolves the named reference to a ValueType FQN.
3. Materializes a **configured ValueType instance** on the Property by applying `{...}` values to the ValueType's effective Properties.
4. Uses that instance for type checking, validation, editor hints, and renderer interpretation.

The Property's payload values are checked against the **configured** type — not the bare ValueType defaults.

Configured instances are **not** separate XML elements in canonical BML. The inline `{...}` form is the authored surface syntax; the BOM stores structured configuration on the `NamedTypeReference`.

---

## Relation to Generics

Generics and ValueType configuration solve different problems:

```text
Reference(Block)              — binds generic type parameters
Decimal{precision: 10, scale: 2} — configures the instantiated ValueType
```

Round parentheses bind generics. Curly braces configure the instance. The mechanisms are orthogonal.

---

## Relation to Multiplicity

BlockML has no separate `List` ValueType. Collection bounds belong on the type reference multiplicity — not on a `List{...}` wrapper:

```text
Prefer:   Text[1..10]
Not:      List{minItems: 1, maxItems: 10}
```

`MinItems` / `MaxItems` constraints on collection properties remain valid but are redundant when multiplicity is already expressed on the `type` attribute.

---

## What Belongs Where

### ValueType instance configuration

Settings that define how the referenced type behaves:

```text
Text{maxLength: 100}
Text{minLength: 3}
Decimal{precision: 10, scale: 2}
Integer{min: 0, max: 100}
Text[1..10]                    — collection bounds via multiplicity
```

### Constraints (semantic validation)

Rules that remain independent extension points:

```text
uniqueness
regular expressions (Pattern)
cross-property validation
dependency rules
business rules
custom validators
renderer-independent semantic validation
```

When the same threshold could be expressed either way (for example `constraint:MaxLength` vs `Text{maxLength: 100}`), prefer the inline ValueType configuration for type-specific behavior. Constraints remain appropriate when the rule is contextual, composable, or not intrinsic to the ValueType definition.

---

## Framework ValueTypes

Core primitive ValueTypes declare optional configuration Properties:

| ValueType | Configuration Properties | Positional order |
|---|---|---|
| `org.blockml.bml.type.Text` | `minLength`, `maxLength` | `minLength`, `maxLength` |
| `org.blockml.bml.type.Decimal` | `precision`, `scale` | `precision`, `scale` |
| `org.blockml.bml.type.Integer` | `min`, `max` | `min`, `max` |

Sub-types inherit configuration Properties from their baseType chain. A configured instance applies values only to Properties declared on the effective ValueType definition.

---

## BOM Representation

`NamedTypeReference` gains an optional `instanceConfiguration`:

```typescript
interface InstanceConfiguration {
  /** Named configuration — property name → literal or expression */
  named?: Record<string, LiteralValue | ExpressionValue>
  /** Positional configuration — mapped by ValueType property order */
  positional?: (LiteralValue | ExpressionValue)[]
}

interface NamedTypeReference {
  kind: "named"
  fqn: string
  typeArguments?: TypeExpression[]
  instanceConfiguration?: InstanceConfiguration
  multiplicity?: Multiplicity
}
```

### BML surface syntax → `TypeExpression`

```text
Text{maxLength: 100}                         → NamedTypeReference { fqn: Text, instanceConfiguration: { named: { maxLength: 100 } } }
Decimal{precision: 10, scale: 2}              → NamedTypeReference { fqn: Decimal, instanceConfiguration: { named: { precision: 10, scale: 2 } } }
Decimal{10, 2}                              → NamedTypeReference { fqn: Decimal, instanceConfiguration: { positional: [10, 2] } }
Text{maxLength: 50}[0..n]                    → NamedTypeReference { fqn: Text, instanceConfiguration: { … }, multiplicity: { min: 0, max: "*" } }
Box(Integer){minItems: 1}                    → generic application + instance configuration on resolved type
```

---

## Compiler Diagnostics

| Code | Condition |
|---|---|
| `BML_MIXED_TYPE_CONFIGURATION` | Positional and named arguments mixed in one `{...}` block |
| `BML_UNKNOWN_TYPE_CONFIGURATION` | Named key or positional index does not map to a ValueType Property |
| `BML_TYPE_CONFIGURATION_VIOLATION` | Configuration value incompatible with the target Property type |
| `BML_DUPLICATE_TYPE_CONFIGURATION` | Same property configured twice (named + positional overlap) |

Constraint equivalents (`constraint:MaxLength`, etc.) remain supported for migration. The validator may emit `BML_PREFER_TYPE_CONFIGURATION` when a constraint duplicates an available ValueType configuration Property.

---

## Benefits

- No separate `typeOptions` attribute.
- Consistent with BlockML's "Everything is a Block" philosophy.
- ValueTypes expose configuration through their own Properties.
- Frequently used constraints become concise and readable.
- Constraints focus on semantic validation instead of basic type configuration.
- Inline syntax uses JSON-like named fields: `<Decimal precision="10" scale="2"/>` → `Decimal{precision: 10, scale: 2}` (nested values use the same `:` separator).

---

## Constant ValueType

**Constant** is a **ConstantType** — a dedicated ValueType branch for singleton value domains. It reuses instance configuration for singleton union alternatives — no separate literal-type mechanism:

```text
Boolean | Constant(Text){value: "auto"}
```

The external value is `"auto"` — not `{ value: "auto" }`. Generic `(...)` binds `T`; `{value: …}` configures the single allowed value on the internal ValueType instance. Future union literal shorthand (`Boolean | "auto"`) desugars to the same form.

See `21_constant_value_type.md`.
