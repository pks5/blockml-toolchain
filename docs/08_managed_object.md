# BOM Compiler — Capabilities and Renderer Interpretation

version: 0.3.0

status: **Supersedes** prior ManagedObject / synthetic accessor drafts (v0.2.0-draft).

## Purpose of this Document

This document specifies how BlockML **Capabilities** express behaviour intent and how **Renderers** interpret that semantics for target systems.

For the formal BOM transport types see `12_bom_object_model.md`.
For Capability BML syntax see `02_mbml.md` — Capabilities.
For type/value separation see `17_type_system_bml.md`.
For validation stages see `00_bom_core.md` — Validation pipeline.

---

## Core principle

BlockML describes **semantics only**. The Canonical BOM is an immutable semantic representation. The Validator performs static semantic validation and creates a partially resolved working model. The Renderer interprets semantics and decides how they manifest in the target technology.

The BOM never contains implementation concepts such as constructors, getters, setters, runtime values, or executable behaviour.

---

## No special accessor types

BlockML has **no special concepts** for constructor, getter, or setter. All behaviour is expressed as ordinary **Capabilities**:

```text
init()
destroy()
render()
calculate()
getValue()
setValue()
```

All Capabilities have **no predefined meaning** inside the BOM. The Renderer decides how to interpret each one:

```text
init()     → Java constructor · UI5 onInit() · React useEffect()
getValue() → direct field access · generated getter · reflection
setValue() → direct field assignment · generated setter
render()   → SCAD module · JSX component
```

No capability receives special treatment inside the BOM. Synthetic getter/setter materialization is **not** part of the Canonical BOM or Validator output.

---

## Values live in Properties

A `ValueType` never stores data. All concrete values are stored exclusively in **Properties**:

```text
Property
    type = Decimal
    value = 5.3
```

When a primitive value must exist as an Entity inside composition or aggregation, use a concrete `*Entity` type (for example `org.blockml.type.IntegerEntity`) — not by adding a `value` member to the PrimitiveType.

---

## Visibility

Visibility (`private`, `protected`, `public`) is validated before rendering. Expressions store the intended access type:

```text
PropertyAccessExpression
    member = width
    access = PRIVATE
```

The Validator checks visibility violations. Private members cannot be referenced outside the owning Block.

The Renderer receives access information and decides whether a Property access becomes direct field access, a getter call, a generated accessor, reflection, or target-specific lookup. This is purely renderer behaviour.

---

## Expression intent

Expressions describe **what should happen**, not the computed result. The Validator never executes expressions. It only checks:

```text
referenced member exists
visibility
type compatibility
valid capability
valid access
```

Evaluation belongs exclusively to the Renderer.

---

## V1 scope

| Area | V1 |
|---|---|
| Authored Capabilities in BML | Yes — Inbound / Outbound / Transformation |
| Synthetic getter/setter generation | **No** — not part of Canonical BOM |
| `__construct` / `serialize` as special lifecycle types | **Removed** — use ordinary Capabilities if needed |
| Renderer Capability dispatch | Target-defined — may ignore Capabilities entirely |
| Property values | Authored form in Canonical BOM — resolved in Renderer working model |

V1 renderers continue reading authored Property values and Capability definitions from the immutable BOM. Interpretation is entirely target-defined.

---

## Related Documents

| Topic | Document |
|---|---|
| Validation pipeline | `00_bom_core.md` — Validation pipeline |
| Capabilities BML syntax | `02_mbml.md` — Capabilities |
| Type/value separation | `17_type_system_bml.md` |
| Expression language | `10_expression_language.md` |
| BOM object model | `12_bom_object_model.md` |
