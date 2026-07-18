# Constant ValueType — Singleton Domains

version: 0.1.0

## Purpose of this Document

This document defines **ConstantType** / **`Constant(T){value: …}`** — singleton value domains used mainly as **union alternatives** (sentinels such as `"auto"`, `false`, `"none"`).

For the four ValueType kinds and unions see `17_type_system_bml.md`.
For `{…}` instance configuration syntax see `20_value_type_instance_configuration.md`.
For MBOM parse/serialize companions see `04_types.md`.
BML SSOT: `org.blockml.bml.type.Constant` / `ConstantType` under `packages/core/blocks/org/blockml/bml/type/`.

---

## Design Decisions

| Topic | Decision |
|---|---|
| **Kind** | `ConstantType` is a **fourth ValueType branch** under `org.blockml.bml.core.ValueType` — sibling of Primitive, Struct, Enum |
| **Generic form** | `Constant(T){value: …}` — `(...)` binds `T`; `{value: …}` configures the singleton |
| **External value** | Authored/runtime value is the **inner literal** (`"auto"`), not `{ value: "auto" }` |
| **Shortcuts** | `Boolean.True` / `Boolean.False` ≡ `Constant(Boolean){value: true/false}` |
| **Parser (Phase A)** | Map type attributes to `TypeExpression` including Constant applications |
| **AST / evaluation** | N/A for the type itself; property values matching a Constant alternative are ordinary literals |

---

## Type Hierarchy

```text
org.blockml.bml.core.ValueType
  └── org.blockml.bml.type.ConstantType     — abstract branch (singleton domains)
        └── org.blockml.bml.type.Constant   — Constant(T){value: …}
```

```text
ConstantType  — singleton value domain; not a StructType; not a PrimitiveType
Constant      — generic configured application of ConstantType
```

A PrimitiveType defines an open value domain; a StructType defines external value **shape**; a ConstantType defines a **singleton** domain validated against underlying `T` and the configured `value`.

---

## Surface Syntax

```text
Constant(Text){value: "auto"}
Constant(Boolean){value: false}
Constant(Integer){value: 5}
Constant(SizeXY){value: {x: 1, y: 2}}    — nested StructType via instance config
```

Rules:

- Generic argument `T` must satisfy `ValueType` (via `satisfiesTypeBound`).
- Configuration **must** include `value` of type `T`.
- Named and positional configuration must not be mixed in one `{…}` — see `20_value_type_instance_configuration.md`.
- Positional mapping of configuration fields follows declaration order (same principle as FunctionMapping for structs) — see `22_function_mapping.md` · `20_…`.

### In union type expressions

```text
Boolean | Constant(Text){value: "auto"}
Float | Constant(Text){value: "auto"}
Constant(Boolean){value: false} | Connector[]
Boolean.False | SizeXYZ
```

**Match order:** left to right, first hit wins — see `17_type_system_bml.md` — Unions.

### Future literal shorthand

```text
Boolean | "auto"    ≡    Boolean | Constant(Text){value: "auto"}
```

Until enabled, author the explicit Constant form. Legacy literal unions (`"auto" | Float`) remain parseable; normalization to Constant at map time is recommended.

---

## External Value vs Internal Configuration

```text
Type expression:   Constant(Text){value: "auto"}
Property value:    "auto"                         ← external
NOT:               { value: "auto" }              ← that would be a struct-shaped value
```

The `{value: …}` block configures the **type** (which singleton is allowed). At value sites, authors write the singleton payload directly.

---

## Boolean.True / Boolean.False Shortcuts

Public Sub-Blocks of `org.blockml.bml.type.Boolean`:

```text
Boolean.True   ≡  Constant(Boolean){value: true}
Boolean.False  ≡  Constant(Boolean){value: false}
```

**Use in type expressions only** (e.g. `Boolean.False | T`), not as ordinary property values (`true` / `false` literals remain the value syntax).

Prefer shortcuts over spelling out `Constant(Boolean){value: …}` when the singleton is boolean.

---

## Obsolete Wrappers → Constant Unions

```text
Obsolete          Write instead
AutoOr<T>         Constant(Text){value: "auto"} | T
FalseOr<T>        Boolean.False | T
NoneOr<T>         Constant(Text){value: "none"} | T
```

See `17_type_system_bml.md` — Obsolete wrapper types · `04_types.md` for MBOM migration.

---

## BOM / Parser Mapping

At Stage 1 map time, type attributes become `TypeExpression` nodes in `@blockml/core` (alias `TypeDescriptor`):

```text
Constant(Text){value: "auto"}
  → GenericApplication(Constant, [Text]) + instance configuration { value: "auto" }
  → or dedicated ConstantTypeExpression shape — implementation freedom in 12_bom_object_model.md
```

```text
Boolean.False
  → NamedTypeReference to Sub-Block org.blockml.bml.type.Boolean.False
  → semantically ≡ Constant(Boolean){value: false} for union matching
```

No expression AST is involved for the type expression itself. Property values that match a Constant alternative are stored as `LiteralValue` (authored form).

---

## Validation (Stage 2)

```text
✓  T is a ValueType bound
✓  value configuration present and type-compatible with T
✓  Union match: authored value equals configured singleton when that alternative wins
✓  Unreachable Constant alternatives → BML_UNREACHABLE_UNION_ALTERNATIVE (warning) when subsumed
```

---

## Related Documents

| Topic | Document |
|---|---|
| Four kinds, unions, generics | `17_type_system_bml.md` |
| `{…}` configuration syntax | `20_value_type_instance_configuration.md` |
| MBOM boolean / AutoOr migration | `04_types.md` |
| FunctionMapping (calls, not Constant) | `22_function_mapping.md` |
| TypeExpression BOM shapes | `12_bom_object_model.md` |
