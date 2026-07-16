# Constant ValueType

version: 0.2.0

## Purpose of this Document

This document specifies **Constant** — a generic ValueType for singleton (constant) values in type expressions, built on ValueType instance configuration without a dedicated literal-type mechanism.

Constant is a **ConstantType** — a dedicated ValueType branch with its own validation semantics. It is neither a StructType nor a PrimitiveType.

For instance configuration syntax see `20_value_type_instance_configuration.md`. For unions and generics see `17_type_system_bml.md`. For the BOM model see `12_bom_object_model.md`.

---

## Motivation

Union alternatives often include a fixed sentinel alongside an ordinary ValueType:

```text
"auto" | Float          — auto sentinel or float
false | Size3D          — false or struct
Boolean | StudType      — boolean or enum
```

Instead of treating literal values as a separate language feature, BlockML models each singleton alternative as a **configured ValueType instance** — the same mechanism as `Text{maxLength=100}` or `Decimal{precision=10, scale=2}`.

---

## ValueType Hierarchy

```text
ValueType
├── PrimitiveType
├── StructType
├── EnumType
└── ConstantType
      └── Constant
```

### Why not StructType?

A StructType defines the **shape of the external value**. For example:

```text
StructType
└── property value : Text
```

would mean the external value is:

```json
{ "value": "auto" }
```

This is not the desired behavior. The external value of `Constant(Text){value="auto"}` is simply `"auto"`. The configured `value` Property belongs to the internal ValueType instance on the Property definition — not to the property's external representation.

### Why not PrimitiveType?

A PrimitiveType defines a **value domain**:

```text
Text     → all text values
Integer  → all integer values
Boolean  → true | false
```

Constant defines a **singleton value domain**:

```text
Constant(Text){value="auto"}   → accepts exactly "auto"
Constant(Integer){value=5}     → accepts exactly 5
```

Its defining characteristic is the validation rule, not serialization shape.

---

## Definition

**FQN:** `org.blockml.bml.type.Constant`  
**Branch:** `org.blockml.bml.type.ConstantType`

Constant is the standard **ConstantType** implementation:

```text
Constant<T extends ValueType>
```

with a single Property:

```text
value : T
```

The generic type parameter **T is mandatory** at every reference site. Constant is not abstract — it is instantiated through generic application and instance configuration on the type reference.

---

## Syntax

Constant combines generic application `(...)` with instance configuration `{...}`:

```text
Constant(Text){value="auto"}
Constant(Integer){value=5}
Constant(Decimal){value=5.5}
Constant(Boolean){value=true}
```

In union type attributes:

```xml
<mode type="Boolean | Constant(Text){value=&quot;auto&quot;}"/>
```

Semantically:

```text
Boolean
  or
Constant ValueType configured with the single allowed value "auto"
```

Positional configuration is supported when `value` is the sole Property:

```text
Constant(Text){"auto"}    →  value = "auto"
Constant(Integer){5}      →  value = 5
```

---

## Validation

Validation proceeds in two steps:

1. Validate the supplied value against the generic ValueType **T**.
2. Compare the supplied value with the configured constant value.

| Expression | Supplied value | Result |
|---|---|---|
| `Constant(Text){value="auto"}` | `"auto"` | ✓ |
| `Constant(Text){value="auto"}` | `"manual"` | ✗ |
| `Constant(Text){value="auto"}` | `5` | ✗ |
| `Constant(Integer){value=5}` | `5` | ✓ |
| `Constant(Integer){value=5}` | `6` | ✗ |
| `Constant(Integer){value="auto"}` | — | ✗ — configured value does not match Integer |
| `Constant{value="auto"}` | — | ✗ — missing generic type argument |
| `Constant(Text)` | — | ✗ — missing required `value` configuration |
| `Constant(Text){value="auto", value="x"}` | — | ✗ — duplicate configuration |

The validator:

1. Resolves `Constant(T)` — `T` must satisfy `T extends ValueType`.
2. Requires `value` in instance configuration (`BML_MISSING_CONSTANT_VALUE`).
3. Validates the supplied value against the bound type `T`.
4. Compares the supplied value with the configured constant (`BML_CONSTANT_VALUE_MISMATCH`).

No type inference is required for Constant itself — `T` is always authored explicitly.

---

## External Representation

The external representation is always **identical to the representation of the underlying generic type T**.

| Type reference | External value | Not |
|---|---|---|
| `Constant(Text){value="auto"}` | `"auto"` | `{ "value": "auto" }` |
| `Constant(Integer){value=5}` | `5` | `{ "value": 5 }` |
| `Constant(Boolean){value=true}` | `true` | `{ "value": true }` |

The configured `value` Property exists only on the internal ValueType instance that belongs to the Property definition.

---

## Relation to Unions

Constant alternatives appear as ordinary union members:

```text
Boolean | Constant(Text){value="auto"}
Float | Constant(Text){value="auto"}
Integer | Text | Constant(Integer){value=0}
```

At validate time, union alternatives are tested **left to right**; the **first** alternative that accepts the authored value wins (not merely “at least one”). A value `"auto"` matches a leading Constant alternative; `true` matches Boolean when Boolean appears before Text. Overlapping alternatives are resolved by author order — see `17_type_system_bml.md` — Unions · Match order. Unreachable later alternatives → `BML_UNREACHABLE_UNION_ALTERNATIVE`.

### Canonical vs literal union syntax

**Canonical (V1):** every singleton alternative is an explicit Constant application:

```text
Boolean | Constant(Text){value="auto"}
```

**Literal shorthand (future):** JSON literals in union positions desugar to Constant:

```text
Boolean | "auto"

  ≡  Boolean | Constant(Text){value="auto"}
```

Desugaring table:

| Literal shorthand | Desugars to |
|---|---|
| `"auto"` | `Constant(Text){value="auto"}` |
| `5` | `Constant(Integer){value=5}` |
| `5.5` | `Constant(Decimal){value=5.5}` |
| `true` / `false` | `Constant(Boolean){value=true}` / `{value=false}` |

The BOM may store either the authored literal form or the normalized Constant form. Normalization is recommended at map time so downstream validation uses one representation.

Legacy union literal syntax (`"auto" | Float`) remains parseable; the validator may emit `BML_PREFER_CONSTANT_TYPE` when a literal alternative has an obvious Constant desugaring.

---

## Relation to Obsolete Wrapper Types

Legacy wrapper types map to union + Constant:

```text
Obsolete              Canonical replacement
AutoOr<T>             Constant(Text){value="auto"} | T     — when sentinel is "auto"
FalseOr<T>            Constant(Boolean){value=false} | T
NoneOr<T>             Constant(Text){value="none"} | T
BooleanOr<T>          Boolean | T
```

Sentinel string choice follows domain convention; Constant makes the allowed literal explicit and type-checked.

---

## BOM Representation

```text
Boolean | Constant(Text){value="auto"}

  →  UnionTypeExpression {
       alternatives: [
         NamedTypeReference { fqn: Boolean },
         NamedTypeReference {
           fqn: Constant,
           typeArguments: [ NamedTypeReference { fqn: Text } ],
           instanceConfiguration: { named: { value: "auto" } }
         }
       ]
     }
```

Property values for the Constant alternative use the external representation of T — `"auto"`, not a struct payload.

Future literal form:

```text
Boolean | "auto"

  →  (normalize to the same UnionTypeExpression as above)
```

---

## Compiler Diagnostics

| Code | Condition |
|---|---|
| `BML_MISSING_GENERIC_TYPE_ARGUMENT` | Constant reference without mandatory `(T)` |
| `BML_MISSING_CONSTANT_VALUE` | Constant(T) without required `{value=…}` |
| `BML_CONSTANT_VALUE_MISMATCH` | Supplied value does not equal configured constant, or incompatible with T |
| `BML_PREFER_CONSTANT_TYPE` | Union literal alternative should use Constant form (hint) |
| `BML_UNREACHABLE_UNION_ALTERNATIVE` | Later union alternative subsumed by an earlier one (warning) |

See also instance-configuration codes in `06_compiler.md` and `20_value_type_instance_configuration.md`.

---

## Rationale

Making Constant a dedicated **ConstantType** keeps the type system explicit and avoids hidden special cases in PrimitiveType or StructType.

It aligns with the "Everything is a Block" philosophy:

- Constant is a normal ValueType.
- It owns a normal Property (`value`).
- Its special behavior is defined by ConstantType semantics — not by compiler-specific exceptions.

---

## Benefits

- No dedicated literal-type mechanism — constants are ordinary configured ValueTypes.
- Validation is fully type-safe without inference on Constant.
- External representation follows the underlying generic type — no struct wrapper leakage.
- Future literal union syntax is syntactic sugar over the same semantic model.
- Fully aligned with "Everything is a Block" and ValueType instance configuration.
- Orthogonal to generics: `()` binds T; `{…}` configures the Constant instance.
