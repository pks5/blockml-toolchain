# FunctionMapping — Capability Call Argument Mapping

version: 0.1.0

## Purpose of this Document

This document defines **FunctionMapping** — how Capability call syntax in expressions maps to a Capability’s `inputType`. It is the implementation contract for validators and renderers that interpret `@bean.*`, `#built-in`, and `#this` calls.

For expression surface syntax and AST see `10_expression_language.md`.
For `TypeExpression` / anonymous structs see `12_bom_object_model.md` · `17_type_system_bml.md`.
For BOM Core capability overview see `01_bom_core.md` — Object Input as Function Signature.
BML meta: `org.blockml.bml.mapping.FunctionMapping` (`node_modules/@blockml/core/blocks/org/blockml/bml/mapping/FunctionMapping.bml`).

> **Numbering note:** Earlier drafts linked this topic as `18_function_mapping.md`. Document `18` is `18_constraints_and_suggestions.md`. This file (`22_function_mapping.md`) is the Markdown SSOT for FunctionMapping.

---

## Design Decisions

| Topic | Decision |
|---|---|
| **What FunctionMapping is** | Rules that turn call arguments into a value matching `inputType` |
| **When it runs** | **Stage 2 (Validator)** and **Stage 3 (Renderer)** — not Stage 1 (Parser) |
| **Canonical BOM** | Parser stores call text in `ExpressionValue.raw` only; AST via `parseExpression()` (Phase B+) |
| **Default mapping** | Always available for Object / StructType `inputType` — no explicit mapping declaration required |
| **Positional order** | **Field declaration order** in `inputType` (anonymous struct keys or StructType properties) |
| **StructType index access** | FunctionMapping positional params ≠ `size[0]` on StructType members (named access only) |
| **Mixed args** | Positional and named arguments in one call → error (`BML_MIXED_FUNCTION_ARGUMENTS`) |

---

## Pipeline Placement

```text
Stage 1 — Parser
  Stores ExpressionValue { raw } (and embedded raw spans). No FunctionMapping.

Phase B — parseExpression()
  Builds call AST nodes (BuiltinCall, BeanSyncCall, …) with argument list.

Stage 2 — Validator
  Applies FunctionMapping to check arity, names, types → diagnostics.

Stage 3 — Renderer
  Applies FunctionMapping (or cached pragmatic result) to emit target calls.
```

Hosts may abort on FunctionMapping diagnostics before serialize/compile — orchestrator policy. See `06_compiler.md` · `15_dev_setup.md`.

---

## inputType Shapes

```text
Primitive (Float, Integer, Text, Boolean, …)
  → single positional or named argument

Anonymous struct  { a: Float, b: Float }
  → fixed arity = number of fields
  → names = field keys in declaration order

Named StructType  com.foo.Point
  → same as anonymous: properties in declaration order

Collection field  { values: T[0..n] }
  → one positional argument: a sequence literal [a, b, …]
  → not fixed-arity multi-arg positional
```

Capabilities have **no separate parameter list** — only `inputType` / `outputType`. Messaging transport ignores struct shape; FunctionMapping matters when the Capability is invoked as a **function** (built-ins, utility Sub-Blocks, expression calls).

---

## Canonical Call Form

All accepted call forms normalize to the same logical input value:

```text
inputType: { a: Float, b: Float }

Positional:   #math.max(size.x, labelSize)
Named:        #math.max(a=size.x, b=labelSize)
Object:       #math.max({a: size.x, b: labelSize})

Canonical:    { a: <expr1>, b: <expr2> }
```

```text
inputType: Float

Positional:   #math.floor(x)
Named:        #math.floor(x=val)     — name may be conventional / implementation-defined for primitives
```

```text
inputType: { values: Text[0..n] }

Positional:   #strings.concat(["a", "b"])
```

---

## Default FunctionMapping Rules

### Object / StructType inputType

1. **Positional-only call**  
   Argument *i* maps to field *i* in **declaration order**.  
   Too few required fields → `BML_MISSING_FUNCTION_PARAMETER`.  
   Too many → `BML_TOO_MANY_FUNCTION_PARAMETERS`.

2. **Named-only call** (`name=expr` or object literal keys)  
   Each name must be a declared field → else `BML_UNKNOWN_FUNCTION_PARAMETER`.  
   Duplicate names → `BML_DUPLICATE_FUNCTION_PARAMETER`.  
   Missing required field → `BML_MISSING_FUNCTION_PARAMETER`.

3. **Object literal** `({ a: …, b: … })`  
   Treated as named form (keys = field names).

4. **Mixed positional + named**  
   → `BML_MIXED_FUNCTION_ARGUMENTS`.

5. **Type check**  
   After mapping, each field value must satisfy the field’s type → else `BML_EXPR_TYPE_MISMATCH` / `BML_EXPR_PAYLOAD_MISMATCH`.

### Primitive inputType

- One argument required (unless type allows empty/optional — rare for V1 built-ins).
- Extra arguments → `BML_TOO_MANY_FUNCTION_PARAMETERS`.

### Collection-field inputType `{ values: T[0..n] }`

- Exactly one positional argument: a sequence matching `T[0..n]`.
- Do not expand to `func(a, b)` for fixed keys — that shape is `{ a: T, b: T }`.

---

## Declaration Order

Positional mapping uses the same order contract as StructType array literals and SCAD default array serialization:

```text
<inputType authored as>
  { a: Float, b: Float }     → index 0 = a, index 1 = b
  StructType properties      → XML / BML declaration order of <properties> children
```

Member access in expressions remains **by name** (`point.x`). Numeric index on StructType values is invalid — see `17_type_system_bml.md` — Struct Property Access.

Anonymous structs in Capability signatures should follow the same declaration-order contract. Validators may suggest promoting repeated anonymous structs to named StructTypes.

Instance configuration positional `{…}` on ValueTypes reuses the same declaration-order principle — see `20_value_type_instance_configuration.md`. That is **not** Capability FunctionMapping, but shares the order rule.

---

## Custom FunctionMapping (optional)

V1 built-ins and typical utility Sub-Blocks use the **default** rules above. A future explicit FunctionMapping declaration on a Capability/implementation may:

- reorder or rename parameters for a target language,
- mark parameters optional,
- reject object-literal form,

If an implementation **requires** a non-default mapping and none is declared → `BML_MISSING_FUNCTION_MAPPING`.  
If call form maps ambiguously under a custom mapping → `BML_AMBIGUOUS_FUNCTION_MAPPING`.

Until custom mappings ship, treat these codes as reserved.

---

## Diagnostics

```text
BML_EXPR_PAYLOAD_MISMATCH         — call does not match inputType after FunctionMapping
BML_UNKNOWN_FUNCTION_PARAMETER    — named arg not a field of inputType
BML_DUPLICATE_FUNCTION_PARAMETER  — duplicate named parameter
BML_MISSING_FUNCTION_PARAMETER    — required field missing
BML_TOO_MANY_FUNCTION_PARAMETERS  — excess positional arguments
BML_MIXED_FUNCTION_ARGUMENTS      — positional and named mixed (default mapping)
BML_MISSING_FUNCTION_MAPPING      — custom mapping required but absent (reserved)
BML_AMBIGUOUS_FUNCTION_MAPPING    — ambiguous custom mapping (reserved)
```

Source locations should point at the call site (or embedded `<$ $>` span). See `10_expression_language.md` — Error Cases.

---

## V1 Scope

**In scope**

- Default FunctionMapping for `#math`, `#strings`, `#lists`, `#numbers` (V1 built-in subset)
- Validation of call arity/names/types after `parseExpression()`
- Same rules for anonymous struct and named StructType `inputType`

**Deferred**

- `@bean` execution and custom FunctionMapping declarations
- Capability linking argument checks beyond type compatibility of linked caps
- Target-specific remapping tables beyond SCAD emit of already-mapped values

---

## Related Documents

| Topic | Document |
|---|---|
| Call syntax / AST | `10_expression_language.md` |
| Type expressions | `17_type_system_bml.md` · `12_bom_object_model.md` |
| Instance config positional order | `20_value_type_instance_configuration.md` |
| Constraints (unrelated — doc 18) | `18_constraints_and_suggestions.md` |
