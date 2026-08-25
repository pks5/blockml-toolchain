# BOM Compiler — Capabilities and Renderer Interpretation

version: 0.7.1

status: **Supersedes** prior ManagedObject / synthetic accessor drafts (v0.2.0-draft).

## Purpose of this Document

This document specifies how BlockML **Capabilities** express behaviour intent and how **Renderers** interpret that semantics for target systems.

For the formal BOM transport types see `12_bom_object_model.md`.
For Capability BML syntax see `02_mbml.md` — Capabilities.
For type/value separation see `17_type_system_bml.md`.
For validation stages see `01_bom_core.md` — Validation pipeline.

---

## Core principle

BlockML describes **semantics only**. The **Urmodell** (Canonical BOM) is an immutable semantic representation (SSOT), produced by the parser or (V3) by `BomBuilder.seal()`. The Validator performs static semantic validation on a **Pragmatic Model** fork and may partially resolve inheritance and merges there. Structural authoring (`addProperty`, build from scratch) is **BomBuilder (V3)** — not the pragmatic path. The Renderer interprets semantics — reading the Urmodell, reusing the default pragmatic model, or forking the Urmodell again (including multiple times) for its own partial merges — and decides how they manifest in the target technology.

The Urmodell never contains implementation concepts such as constructors, getters, setters, runtime values, or executable behaviour.

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

When a primitive value must exist as an Entity inside composition or aggregation, use a concrete `*Entity` type (for example `org.blockml.bml.type.IntegerEntity`) — not by adding a `value` member to the PrimitiveType.

---

## Visibility

Visibility (`private`, `protected`, `public`) is a **BlockML access rule**. It controls which BlockML definitions may reference, read, or set a member or Sub-Block. It does **not** restrict what a renderer may see or use.

The renderer receives the **full Canonical BOM** — all public, protected, and private definitions and values. It decides independently whether to map visibility to target-system access modifiers, namespaces, generated APIs, or to ignore visibility entirely.

The Validator checks BlockML access violations before rendering. Expressions may store the intended access type for renderer interpretation:

```text
PropertyAccessExpression
    member = width
    access = PRIVATE
```

```text
BML_PRIVATE_MEMBER_ACCESS              — private member used outside declaring Block
BML_PROTECTED_MEMBER_ACCESS              — protected member outside allowed context
BML_DUPLICATE_MEMBER_VISIBILITY_VARIANT  — members differ only by visibility prefix
BML_VISIBILITY_NARROWING                 — override reduces visibility (e.g. public → protected)
```

How a Property access becomes direct field access, a getter call, reflection, or target-specific lookup is purely renderer behaviour — not governed by BlockML visibility rules.

Full rules: `02_mbml.md` — § Member Visibility.

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
| Validation pipeline | `01_bom_core.md` — Validation pipeline |
| Capabilities BML syntax | `02_mbml.md` — Capabilities |
| Type/value separation | `17_type_system_bml.md` |
| Expression language | `10_expression_language.md` |
| BOM object model | `12_bom_object_model.md` |
