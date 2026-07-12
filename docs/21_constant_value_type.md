# Constant ValueType

version: 0.1.0

## Purpose of this Document

This document specifies **Constant** — a generic ValueType for singleton (constant) values in type expressions, built on ValueType instance configuration without a dedicated literal-type mechanism.

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

## Definition

**FQN:** `org.blockml.type.Constant`

Constant is a generic **StructType**:

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

| Expression | Result |
|---|---|
| `Constant(Text){value="auto"}` | ✓ |
| `Constant(Integer){value=5}` | ✓ |
| `Constant(Integer){value="auto"}` | ✗ — value does not match Integer |
| `Constant{value="auto"}` | ✗ — missing generic type argument |
| `Constant(Text)` | ✗ — missing required `value` configuration |
| `Constant(Text){value="auto", value="x"}` | ✗ — duplicate configuration |

The validator:

1. Resolves `Constant(T)` — `T` must satisfy `T extends ValueType`.
2. Requires `value` in instance configuration (`BML_MISSING_CONSTANT_VALUE`).
3. Checks the configured value against the bound type `T` (`BML_CONSTANT_VALUE_MISMATCH`).

No type inference is required for Constant itself — `T` is always authored explicitly.

---

## Relation to Unions

Constant alternatives appear as ordinary union members:

```text
Boolean | Constant(Text){value="auto"}
Float | Constant(Text){value="auto"}
Integer | Text | Constant(Integer){value=0}
```

At validate time, a property value must satisfy **at least one** alternative. A value `"auto"` matches the Constant alternative; `true` matches Boolean.

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
| `BML_CONSTANT_VALUE_MISMATCH` | Configured value incompatible with bound type T |
| `BML_PREFER_CONSTANT_TYPE` | Union literal alternative should use Constant form (hint) |

See also instance-configuration codes in `06_compiler.md` and `20_value_type_instance_configuration.md`.

---

## Benefits

- No dedicated literal-type mechanism — constants are ordinary configured ValueTypes.
- Validation is fully type-safe without inference on Constant.
- Future literal union syntax is syntactic sugar over the same semantic model.
- Fully aligned with "Everything is a Block" and ValueType instance configuration.
- Orthogonal to generics: `()` binds T; `{…}` configures the Constant instance.
