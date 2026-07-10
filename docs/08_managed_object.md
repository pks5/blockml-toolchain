# BOM Compiler — ManagedObject & Accessor Model

version: 0.2.0-draft

status: **Draft · TBD** — prepared in V1, **not fully implemented** in V1. Syntax, override process, and renderer dispatch remain open. See [V1 Scope](#v1-scope).

## Purpose of this Document

This document specifies the **target** ManagedObject and **Accessor Capability** model — how Block instances expose storage (private members) through materialized Capabilities in the BOM, and how ValueTypes roundtrip values back to BML.

It is the design source for `@blockml/core` validation (`resolveEffectiveMembers`) and, post-V1, for runtime/render dispatch. The SAPUI5 ManagedObject pattern remains the **delegation inspiration**; the **public API shape** is expressed as Capabilities, not TypeScript methods.

For the formal BOM transport types see `12_bom_object_model.md`.
For Capability semantics see `00_bom_core.md` — Capabilities.
For ValueType-as-Block see `17_type_system_bml.md`.

---

## V1 Scope

| Area | V1 |
|---|---|
| BOM schema fields for synthetic accessors | **Prepare** — `synthetic`, `accessorFor` on `CapabilityDefinition` (optional, may be unused) |
| `resolveEffectiveMembers()` materialization | **Prepare** — may emit synthetic accessors; consumers may ignore |
| Union variant discriminator on values | **Prepare** — `LiteralValue` / typed value may carry resolved variant `typeFqn` |
| Renderer / PropertyResolver | **Unchanged** — continues `memberValues` (authored form) + `04_types.md` rules; accessor dispatch **disabled** or **stub no-op** |
| ValueType `serialize` / `__construct` | **Not implemented** as BOM Capabilities — behaviour exists as **loose rules** in `04_types.md`; Integer pattern is reference. **Target:** explicit Capabilities in BOM, executed by renderer — not parser |
| Entity `serialize` | **Out of scope** — not planned for V1 |
| Expression roundtrip (`ExpressionValue`) | **TBD** — deferred; fields unchanged |
| Override syntax in BML | **TBD** — not in V1 |
| Runtime ManagedObject classes | **Optional** — not required for V1 compile/render |

V1 goal: **the BOM and validator can represent the model** without requiring targets or renderers to call accessor Capabilities yet.

---

## Design Overview

> **Accessors are BOM metadata for the renderer — not a runtime invocation API.** The renderer reads member values in authored form plus accessor Capability definitions (`getSize`, `setSize`, `__construct`, `serialize`) and implements the translation in the target system. It does **not** call getters to obtain resolved values. See `00_bom_core.md` — Fundamental Architecture Principles.

Every authored **member** (Property, Aggregation, Association) is **private storage**. Visibility applies to the **generated accessors**, not to the storage field. In the default case the author notices nothing: `getColor` / `setColor` map 1:1 to internal `color`.

**Authored Capabilities** (`Inbound`, `Outbound`, `Transformation`) are already Capabilities — they receive **no** synthetic getter/setter.

Accessors are **implicit**, **materialized in the effective member set** at validation time, and **overridable** later by replacing the default implementation (syntax TBD).

### Capability Kind Mapping

```text
Accessor role          Capability type              Notes
─────────────────────────────────────────────────────────────────────
getter                 Outbound                     read storage
setter                 Inbound                      write storage (0..1)
add / insert / …       Inbound or Transformation    0..n aggregations/associations — TBD per op
remove / destroy / …   Transformation or Inbound    0..n / 0..1 — TBD per op
__construct            Transformation               outputType = _self
serialize              Outbound                     ValueTypes only — BML roundtrip
```

### Block Kind Matrix

```text
Block kind (effective baseType chain)     get/set accessors    __construct    serialize
──────────────────────────────────────────────────────────────────────────────────────────
Entity / composable Block                 yes (per member)     yes            no (v1+)
ValueType (Primitive / Struct / Enum)     yes (internal)       yes            yes
Union type expression                     via variant winner   first-match    via stored variant
Authored Capability                       —                    —              —
ExpressionValue on instance               —                    TBD            TBD
```

**PrimitiveType is the reference pattern** for all ValueTypes — see [Canonical ValueType Pattern](#canonical-valuetype-pattern-primitives-as-reference). V1 implements it as **loose parser rules** (`04_types.md`); the target model materializes the same behaviour as synthetic Capabilities on every ValueType Block.

**`serialize` purpose:** describes how a ValueType's internal `_self` maps to BML external form — used by BML export, editor roundtrip, and **by renderers** when translating to target syntax (e.g. SCAD `[5,5,6]`). The Capability definition lives in BOM; the renderer implements it for the target — the parser does not execute it.

**Entity `__construct` purpose:** describes how to build a fully initialized Block instance (defaults, preset merge, composition attributes). Default merge order target: `inline > preset > config > default` — see `14_compiler_runtime.md` — Property resolution. This is **renderer-time** behaviour; the BOM stores the Capability definition and unmerged member values.

---

## Members Are Private Storage

Storage members are always **private** regardless of how the author names them in BML today. The validator maps authored visibility to **accessor** visibility:

```text
Authored member name     Storage (always private)    Accessor visibility (default)
──────────────────────────────────────────────────────────────────────────────────
size                     __size (internal)           public  → getSize, setSize
_size                    __size                      protected
__token                  __token                     private
```

Exact storage naming (`__` prefix normalization) is **TBD**. V1 may keep authored names in BOM storage and apply this rule only when synthetic accessors are materialized.

---

## Synthetic Accessors in the BOM

Synthetic accessors are **part of the effective member set**, not optional runtime-only metadata. They are produced by `resolveEffectiveMembers()` (or an equivalent validate-stage pass) and may be stored in an extended view — not necessarily re-serialized into authored BML.

### Draft: `CapabilityDefinition` extension

```typescript
interface CapabilityDefinition {
  kind: "capability"
  name: string
  typeFqn: string   // Inbound | Outbound | Transformation
  inputType?: TypeDescriptor
  outputType?: TypeDescriptor
  implementation?: ImplementationBlock

  /** Draft — V1 optional */
  synthetic?: true
  accessorFor?: {
    memberName: string
    memberKind: "property" | "aggregation" | "association"
    role:
      | "getter" | "setter"
      | "add" | "insert" | "remove" | "removeAll" | "indexOf" | "destroy"  // aggregation ops — TBD
      | "construct" | "serialize"
  }
  /** Default 1:1 implementation; absent in V1 */
  defaultImplementation?: "builtin"
}
```

An **authored** Capability with the same `(namespace, name)` as a synthetic accessor **replaces** the default (override). Override syntax in BML is **TBD** — candidates: explicit `<capabilities>` child, or a dedicated `<accessorOverride>` element.

### Draft: `EffectiveMemberSet`

```typescript
interface EffectiveMemberSet {
  members: MemberDefinition[]
  declaredOn: Record<string, string>
  /** Draft — synthetic accessors merged into members[] or exposed separately — TBD */
  syntheticAccessors?: CapabilityDefinition[]
}
```

Whether synthetic entries live in `members[]` or a parallel list is **TBD**. V1 preparatory rule: if present, validator and tooling **must not treat them as authored** (diagnostics, IDE completion).

---

## Naming Convention

Derived from member name (UI5-style). Leading `_` on aggregation names stripped for method/accessor names.

### Properties and Associations (0..1)

```text
get{NamePascalCase}()              — Outbound
set{NamePascalCase}(value|id)       — Inbound
```

### Aggregations (0..n)

```text
get{NamePascalCase}()
add{NameSingularPascalCase}(value)
insert{NameSingularPascalCase}(value, index)
remove{NameSingularPascalCase}(value)
removeAll{NamePascalCase}()
indexOf{NameSingularPascalCase}(value)
destroy{NamePascalCase}()
```

Capability kind per aggregation operation is **TBD** (see matrix above).

### Block-level (ValueType and Entity)

```text
__construct(input?)    — Transformation, outputType = _self
serialize()            — Outbound (ValueType only; Entity: not in V1)
```

---

## ValueType `__construct` and `serialize`

ValueTypes are Blocks (`baseType` chain includes `org.blockml.core.ValueType`). Serialization is **on the type**, not on each property of a composable Block.

```text
Wall.getSize()  →  Size3D instance (internal object)
Size3D.serialize(instance)  →  BML/external form (e.g. "[1, 8, 9]")
```

Default implementations may delegate to rules in `04_types.md` until Capability implementations exist in BML. **Every ValueType Block must be able to reproduce the same pattern as primitives** — primitives are not a special case, they are the **simplest worked example**.

---

## Canonical ValueType Pattern (Primitives as Reference)

Primitive types (`org.blockml.type.Integer`, `String`, …) **already exhibit the target behaviour today** — implemented as **loose parser/validator rules** in V1, not yet as materialized synthetic Capabilities in the BOM. All other ValueTypes (StructType, EnumType, …) should **produce the same shape** when the accessor model is activated.

### Integer — reference example

**Internal representation** (private storage — always an object, never a bare literal at runtime):

```typescript
// Runtime / managed instance of org.blockml.type.Integer
{ value: 5 }          // single private field `value` (name TBD — may match BML property name)
```

**External / authored form** (what appears in BML attributes, what `serialize` emits):

```text
5                     // bare integer literal in BML
```

**Synthetic block-level Capabilities (target — Draft):**

```text
__construct(value: Integer)  →  _self     Transformation
  Input:   external form (BML literal / native int)
  Output:  _self — internal instance { value: 5 }

serialize()  →  Integer                   Outbound
  Input:   _self (implicit — current instance)
  Output:  external form (bare literal 5 for BML roundtrip)
```

Sketch (TypeScript — illustration only):

```typescript
// Integer.__construct — Transformation, outputType = _self
__construct(external: number): IntegerInstance {
  return { value: external }   // delegate to setProperty("value", external)
}

// Integer.serialize — Outbound
serialize(): number {
  return this.getProperty("value")
}
```

**V1 today:** parser maps `size="5"` → `LiteralValue { value: 5, typeFqn: "…Integer" }` without an explicit instance object. The **logical** model is still construct-in / serialize-out; activation means making that explicit.

### Generalizing to other ValueTypes

| ValueType | Internal (`_self`) | `__construct` input (external) | `serialize` output (external) |
|---|---|---|---|
| **Integer** | `{ value: 5 }` | `5` | `5` |
| **String** | `{ value: "hello" }` | `"hello"` | `"hello"` |
| **Size3D** (StructType) | `{ x: 1, y: 8, z: 9 }` (private fields) | `[1, 8, 9]` or `{ x:1, y:8, z:9 }` | `[1, 8, 9]` (BML form — TBD canonical) |
| **EnumType** | `{ value: "standard" }` | `standard` or qualified id | `standard` |

Rules:

```text
Internal     Always an object with private storage fields — never expose bare literals as _self
__construct  External/authored form  →  _self  (Transformation, outputType = _self)
serialize    _self  →  external/authored form  (Outbound; outputType = external shape)
get/set      Per internal field where needed (StructType fields); optional for single-field primitives
```

StructType and EnumType Blocks **materialize the same Capability pair** as Integer. The only difference is the shape of internal storage and the external literal grammar (see `04_types.md`, Ordered Struct Fields).

### Union types

For union type expressions (e.g. `"auto" | Float`):

```text
__construct(input):
  Test union members in declaration order
  First matching member type wins
  Store resolved variant typeFqn on the value (discriminator)

serialize(value):
  Use the variant typeFqn stored at construct time — no re-probe
```

Draft value shape:

```typescript
interface LiteralValue {
  kind: "literal"
  value: unknown
  typeFqn: string              // declared member type (may be union expression)
  resolvedTypeFqn?: string     // Draft — concrete variant after construct
}
```

---

## Expression Values (TBD)

`ExpressionValue` (`raw`, `ast`, `resultTypeFqn`) is unchanged in V1.

Post-V1 (open):

- Whether expressions participate in BML roundtrip via accessor Capabilities
- Whether `serialize` emits canonical `${ }` from AST or preserves `raw`

Render targets and export tools in V1 **must not assume** expression serialization through this model.

---

## Override Pattern

Two-level design (UI5-inspired): an override replaces the **accessor Capability implementation**, not the storage API.

```typescript
// Target pattern (runtime sketch — not V1 requirement)
setSize(value: Size3D): this {
  const clamped = clamp(value)
  return this.setProperty("size", clamped)  // delegate to generic — NOT super.setSize()
}
```

BML equivalent: authored implementation on synthetic `setSize` Inbound Capability that delegates to generic `setProperty("size", …)` — exact syntax **TBD**.

Calling `super.setSize()` or chaining to the synthetic default incorrectly is a **design anti-pattern** (recursive override).

---

## Renderer and Runtime Integration

### V1 (current)

```text
PropertyResolver / ScadBlockProcessor:
  Read memberValues in authored form and definition defaults
  Consult type metadata (04_types.md, 09_mbom_properties.yml, accessor Capabilities when available)
  Apply target serialization at render time
  Ignore synthetic accessors OR use stub that reads memberValues directly (legacy path)
```

No behavioral change required in V1 render targets. Optional `AccessorInvoker` interface may exist as a **no-op stub** for future wiring.

### Post-V1 (target)

```text
resolveProperty(name, …):
  read memberValues[name] in authored form
  consult get{Name} Capability definition for target translation metadata
  (does NOT invoke getter to obtain a different value — reads storage + applies metadata)

export value to BML:
  consult ValueType.serialize Capability definition
  emit authored external form matching original syntax where possible

instantiate Block:
  consult Entity.__construct Capability definition
  apply merge rules (inline > preset > config > default) at render time
```

Render targets remain Block-agnostic; they use Capability **definitions** as translation metadata — not by invoking a runtime getter API.

---

## UI5 ManagedObject Inspiration

SAPUI5's `ManagedObject` provides declarative metadata, generated getters/setters, and generic protected backbone methods. BOM adopts the **delegation pattern**; public surface is **Capabilities in BOM**, not Control renderers.

```text
UI5                          BOM (target)
─────────────────────────────────────────────────────────
Control metadata             Block metadata
Properties                   Properties (private storage)
Aggregations                 Aggregations (private storage)
Associations                 Associations (private storage)
Events                       Authored Capabilities
Generated get/set            Synthetic accessor Capabilities
Renderer on Control          Renderer in Target only (unchanged)
```

---

## Generic Protected Methods (Implementation Sketch)

When a runtime ManagedObject exists, storage operations delegate through protected generics — accessor Capabilities call these, not each other:

```typescript
protected setProperty(name: string, value: unknown): this
protected getProperty(name: string): unknown
protected setAggregation(name: string, value: ManagedObject | null): this
protected getAggregation(name: string): ManagedObject | null
protected addAggregation(name: string, value: ManagedObject): this
// … see previous revisions for full aggregation/association set
```

Code generation vs runtime registration (UI5-style prototype attachment) remains an implementation choice — **Option B** acceptable for dynamic blocks; **Option A** for known MBOM types. Both produce the same accessor Capability surface.

---

## Address Type

`org.blockml.type.Address` is the value type for **authored** Capability bindings (not for synthetic accessors). Parsed at parse time:

```typescript
interface Address {
  raw: string
  scheme: string | null
  path: string
  isAbsolute: boolean
  isRelative: boolean
  isExpression: boolean
}
```

BML roundtrip for Address literals may use `serialize` on the Address ValueType when implemented — or literal `raw` in V1.

---

## No Renderer Reference on Block

Blocks do not reference render targets. The same Block model is rendered by multiple targets without Block changes. Accessor Capabilities describe **data access and BML roundtrip** — not SCAD/Unity/React emission.

---

## Related Documents

| Topic | Document |
|---|---|
| BOM interfaces | `12_bom_object_model.md` — Synthetic Accessors (Draft) |
| Property merge (V1) | `14_compiler_runtime.md` — Property resolution |
| Parse/serialize rules (V1 SCAD) | `04_types.md` |
| ValueType definitions | `17_type_system_bml.md` — ValueType lifecycle (Draft) |
| Member visibility (authoring) | `02_mbml.md` — Member Visibility |
| Capability types | `00_bom_core.md` — Capabilities |

---

## Open Items (TBD)

```text
[ ] Override syntax in BML
[ ] Storage name normalization (__ prefix)
[ ] synthetic accessors in members[] vs parallel list
[ ] Capability kind for each 0..n aggregation operation
[ ] Entity __construct inputType shape
[ ] Expression serialize/construct
[ ] Implicit getSize in expression PropertyReference
[ ] Canonical external form per StructType/EnumType (BML literal grammar)
[ ] Internal field name for single-field primitives (`value` vs type-specific)
[ ] AccessorInvoker API in @blockml/core
```
