# Function Mapping — Capability Calls and Function Signatures

version: 0.1.0

## Purpose of this Document

This document specifies how function-parameter syntax maps to Capability `inputType` / `outputType` values, and how Capability types map to target-language function signatures. It replaces the former **Ordered Struct Fields** rule that treated struct property declaration order as general index semantics.

For StructType definition see `17_type_system_bml.md` — StructType.
For expression syntax see `10_expression_language.md`.
For BOM representation see `12_bom_object_model.md`.
For framework BML types see `packages/core/blocks/org/blockml/bml/core/Mapping.bml` and `org/blockml/bml/mapping/FunctionMapping.bml`.

---

## Core Decision

The former special rule allowing StructType members to be addressed via numeric indices is **fully removed**.

```text
No longer valid:   size[0]   size[1]   size[2]
Valid access only: size.x    size.y    size.z
```

Property declaration order on a StructType does **not** create general index semantics. A StructType is exclusively a typed object with named properties.

For cases where an ordered external parameter representation must map onto a BlockML type, an explicit **Mapping** mechanism is used.

---

## Mapping as a Standalone Concept

| Block | FQN | Role |
|---|---|---|
| **Mapping** | `org.blockml.bml.core.Mapping` | Abstract base — describes value transfer between representations |
| **FunctionMapping** | `org.blockml.bml.mapping.FunctionMapping` | Concrete mapping between function parameters and Capability types |

Mapping is **not** a property of StructType. It belongs at the site where a function-like representation is used.

---

## Application Sites

FunctionMapping applies in two places with opposite directions:

| Site | Direction |
|---|---|
| **Expression capability calls** | Function syntax → FunctionMapping → Capability `inputType` |
| **Capability implementation** | Capability `inputType` → FunctionMapping → target-language function parameters |

Return values follow the same pattern in reverse:

```text
Target return value → FunctionMapping → Capability outputType
```

A mapping implementation may be bidirectional when both directions are supported.

---

## Component Responsibilities

| Component | Responsibility |
|---|---|
| **Parser** | Store authored syntax only (`#tool.capa(5, 7)`, `{ a: "x" }`, `[5, 7]`). No mapping. Canonical BOM unchanged. |
| **Expression parser** | Build AST preserving positional args, named args, object literals, array literals |
| **Validator** | Resolve capability → determine `inputType` → select FunctionMapping → verify call maps unambiguously → validate result against `inputType` |
| **Renderer** | Choose: emit authored form, evaluate FunctionMapping, produce canonical intermediate form, or interpret mapping for target system |

---

## Canonical Call Form

The canonical form of a capability call passes a value matching `inputType` directly, using JSON-like syntax:

```text
Primitive       → primitive literal
StructType      → object literal
Collection      → array literal
```

All other call forms are syntactic helpers translated by FunctionMapping into this canonical form.

### Primitive inputType

Exactly one parameter:

```text
inputType="Integer"    #tool.capa(5)
inputType="Text"       #tool.capa("test")
```

Not valid: `#tool.capa(5, 7)` — a primitive is not an implicit struct.

### Single StructType

Canonical form:

```text
inputType="type:MyStructType"
#tool.capa({ a: "x", c: "y" })
```

Helper forms (default FunctionMapping):

**Named parameters** — mapped by property name; order irrelevant:

```text
#tool.capa(a = "x", c = "y")
  a → MyStructType.a
  c → MyStructType.c
```

**Positional parameters** — mapped by property declaration order (mapping config only):

```text
#tool.capa("x", "y")
  parameter 0 → first property
  parameter 1 → second property
```

Important: `myStruct[0]` remains invalid. `#tool.capa("x", "y")` may be valid depending on FunctionMapping.

### StructType Collection

Each outer function parameter is one struct instance:

```text
inputType="type:MyStructType[]"

Helper:    #tool.capa({ a: "b", c: "d" }, { a: "x", c: "y" })
Canonical: #tool.capa([{ a: "b", c: "d" }, { a: "x", c: "y" }])
```

Not valid — a single struct spread across multiple outer named parameters:

```text
#tool.capa(a = "b", c = "d", a = "x", c = "y")
```

### Primitive Collection

Each positional parameter is one collection element:

```text
inputType="Integer[]"

Helper:    #tool.capa(5, 7, 9)
Canonical: #tool.capa([5, 7, 9])
```

Fixed and bounded multiplicities (`Integer[3]`, `MyStructType[1..4]`) follow the same rules. FunctionMapping produces the canonical collection; the type validator then checks multiplicity.

```text
inputType="Integer[3]"
#tool.capa(1, 2, 3)    → valid
#tool.capa([1, 2, 3])  → valid
#tool.capa(1, 2)       → multiplicity error
```

---

## Capability Implementation Mapping

A Capability declares semantic BlockML types via `inputType` and `outputType`. The concrete `<implementation>` must additionally specify how these types map to the target-language function signature.

Examples of implementation-specific decisions (not derivable from StructType):

```text
BlockML StructType  → multiple TypeScript parameters
BlockML StructType  → single TypeScript object parameter
BlockML Collection  → variadic function parameters
```

When default FunctionMapping rules are insufficient, the implementation must declare an explicit `FunctionMapping` child. Missing mapping when required: `BML_MISSING_FUNCTION_MAPPING`.

Built-in services (`org.blockml.bml.service.Math`, etc.) use the default FunctionMapping unless overridden.

---

## Validation Rules

| Condition | Error code |
|---|---|
| Named parameter not a StructType property | `BML_UNKNOWN_FUNCTION_PARAMETER` |
| Duplicate named parameter | `BML_DUPLICATE_FUNCTION_PARAMETER` |
| Required property missing (no default) | `BML_MISSING_FUNCTION_PARAMETER` |
| Too many positional parameters | `BML_TOO_MANY_FUNCTION_PARAMETERS` |
| Mixed positional and named (default mapping) | `BML_MIXED_FUNCTION_ARGUMENTS` |
| Implementation needs mapping but none declared | `BML_MISSING_FUNCTION_MAPPING` |
| Call form maps ambiguously to inputType | `BML_AMBIGUOUS_FUNCTION_MAPPING` |

`BML_EXPR_PAYLOAD_MISMATCH` remains the umbrella expression error when call shape does not match `inputType` after mapping.

---

## Central Architecture Rule

```text
StructType          → named data structure (property access by name only)
FunctionMapping     → translation between function-parameter list and that structure
Struct access       → size.x, size.y (never size[0])
Positional calls    → optional FunctionMapping helper syntax
JSON-like payload   → canonical call form
Function signatures → must declare mapping explicitly when non-default
```

Property declaration order is used **only** by explicit Mapping configuration (positional function parameters, positional array literal authoring, compatibility constraints) — never as general runtime or expression index semantics.
