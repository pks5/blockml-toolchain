# Framework Base Types — BML Definitions

version: 0.1.0

## Purpose of this Document

This document specifies how **framework base types** (`org.blockml.core.Block`, `com.machineblocks.core.Block`, `org.blockml.core.Entity`, …) are defined — as **BML files**, not code or YAML.

For BML block syntax see `02_mbml.md`.
For MBOM hierarchy see `03_mbom.md`.
For TypeRegistry bootstrap see `13_bml_to_bom_mapping.md`.
For SCAD property mapping (render-only) see `09_mbom_properties.yml`.
For value types and implementation languages as BML see `17_type_system_bml.md`.
For property constraints and suggestions see `18_constraints_and_suggestions.md`.
For V1/V2/V3 scope and BML-vs-Markdown decisions see `01_system.md` — BML Self-Description Roadmap.

---

## Design Decision

| Aspect | Decision |
|---|---|
| **Base type SSOT** | BML files in `@blockml/core`, `@machineblocks/mbom` |
| **Interpretation** | Renderers / validators only — no type semantics hardcoded outside BML + registry; **renderers free in output** — see `17_type_system_bml.md` — Renderer freedom |
| **Compiler internals** | Parser **must** know `<block>` as input concept; internal representation **free** — see `17_type_system_bml.md` |
| **09_mbom_properties.yml** | **Render mapping only** (serializer, scad_name, customizer) — not type SSOT |
| **User blocks** | Same mechanism — `<baseType>` → chain to framework BML |
| **Block idea** | Every `<block>` carries `<idea>` as first child — what this Block semantically represents |
| **Block documentation** | Every root `<block>` carries `<documentation>` as second child — technical description |
| **Everything is a Block** | Framework types, primitives, languages, services, Set meta blocks — one `<block>` element, one registry; see `17_type_system_bml.md` |
| **ValueType branch** | `org.blockml.core.ValueType` — abstract base for all value blocks used in Property `type` and Capability `inputType` / `outputType`; three kinds: PrimitiveType · EnumType · StructType |
| **Namespace separation** | Language FQNs (`org.blockml.core.*`, `type.*`, …) reserved for BML grammar; BOM/toolchain types in `org.blockml.bom.*`, `parser.*`, `compiler.*`, … — see `00_bom_core.md` |
| **Self-hosting bootstrap** | Compiler loads `@blockml/core` + domain framework BML **before** user content — TypeRegistry bootstrap in V1; full toolchain self-description is V3 — see `01_system.md` |

```text
BML (what the type IS)          →  TypeRegistry
09_mbom_properties.yml (how     →  ScadBlockProcessor maps property → SCAD
  SCAD serializes a property)
BlockProcessor (when/how        →  Render pipeline
  to render)
```

---

## Type Modifiers (BML)

Optional elements on any `<block>` definition (framework or user):

### `<abstract>`

```xml
<abstract />
```

Equivalent to `<abstract>true</abstract>`. Omit or use `<abstract>false</abstract>` for concrete types.

```text
true   — type exists for inheritance and validation; must not be used as
         composition instance typeFqn (except as baseType on definitions)
false  — default when omitted; concrete derivable type
```

Prefer the self-closing form for root flags set once and not overridable by children.

Framework types `org.blockml.core.Block`, `org.blockml.service.*` (abstract bases), `com.machineblocks.core.Block` are `abstract=true`.

Concrete blocks (`Wall`, `StandardBrick`, `Math`) omit `<abstract>` or set `false`.

### `<final>`

```xml
<final />
```

Equivalent to `<final>true</final>`. Omit or use `<final>false</final>` when the type may be extended.

```text
true   — no Block definition may use this type as baseType
         (BML_FINAL_BASE_TYPE)
false  — default when omitted
```

Prefer the self-closing form for root flags set once and not overridable by children.

`com.machineblocks.core.NativeBlock` is `final=true`.

### `<subTypes>`

```xml
<subTypes>
  <subType type="com.machineblocks.core.Block" />
  <subType type="org.blockml.core.Entity" />
</subTypes>
```

```text
Lists FQNs permitted as baseType on Sub-Blocks in <subBlocks>

Default (no declaration on this block):  [] — Sub-Blocks forbidden until explicitly enabled
Omitted <subTypes>:                      inherit effective subTypes from baseType chain
Explicit <subTypes>…</subTypes>:          override inherited list (enable or restrict Sub-Blocks)
Explicit empty <subTypes/>:              override — close Sub-Blocks even when parent allowed them

Declare <subTypes> only when overriding the inherited list. Do not emit an empty element
merely to restate the default — omit the element instead.

Sub-Block baseType not in effective subTypes → BML_INVALID_SUBBLOCK_TYPE
```

### `<implTypes>`

```xml
<implTypes>
  <implType type="org.blockml.language.OpenSCAD" />
  <implType type="org.blockml.language.TypeScript" />
</implTypes>
```

```text
Lists org.blockml.language.* FQNs permitted on <implementation type="...">
Omitted = inherit from baseType
Unknown type on capability → BML_IMPLEMENTATION_NOT_SUPPORTED
```

### `<genericTypes>`

```xml
<genericTypes>
  <genericType name="T" baseType="org.blockml.core.ValueType"/>
</genericTypes>
```

```text
Declares type parameters on this Block (root block only)
name      — parameter identifier used in type references (e.g. type="T")
baseType  — FQN constraint; concrete type arguments must inherit from this branch
Usage     — com.foo.Box<org.blockml.type.Integer> at reference sites
Validator — substitutes parameters at validate time; BML_GENERIC_CONSTRAINT_VIOLATION on mismatch
```

See `17_type_system_bml.md` — Generics · `12_bom_object_model.md` — GenericType.

---

## Root Type Exception

`org.blockml.core.Block` is the **sole inheritance root**. It **omits `<baseType>`** — the only definition allowed to do so.

All other definitions must declare `<baseType>`. Framework branches inherit via `org.blockml.core.ValueType`, `org.blockml.core.Language`, or domain bases — all ultimately extend `org.blockml.core.Block`. See `17_type_system_bml.md`.

---

## Bootstrap Order

The compiler **bootstraps from its own BML** — self-hosting at the TypeRegistry level. Framework packages are not special-cased in code; they are loaded first because later definitions depend on them.

```text
1. @blockml/core BML                    ← BlockML describes BlockML
     org/blockml/core/Block.bml
     org/blockml/core/ValueType.bml · PrimitiveType.bml · StructType.bml · EnumType.bml · …
     org/blockml/core/Constraint.bml
     org/blockml/constraint/Min.bml · Max.bml · MinLength.bml · MaxLength.bml · Pattern.bml · MinItems.bml · MaxItems.bml · …
     org/blockml/core/
     org/blockml/core/Language.bml · ProgrammingLanguage.bml
     org/blockml/type/Integer.bml · …
     org/blockml/language/TypeScript.bml · OpenSCAD.bml · English.bml · German.bml · PseudoCode.bml
     org/blockml/service/Math.bml · Strings.bml · …
     org/blockml/core/BlockLibrary.bml   ← includes Schema as subBlock; _dependencies / _blocks as Block references

2. @machineblocks/mbom BML              ← MBOM framework grammar
     com/machineblocks/core/Step.bml · Block.bml · CompositeBlock.bml · NativeBlock.bml · Set.bml
     …

3. Project srcDir + libraries
```

Each file is parsed and `registerBlockDefinition(doc)` — **identical path** to user-authored content. The only difference is load order.

### What is defined in BML vs code

| In BML (Ideas) | In compiler code (Manifestation) |
|---|---|
| `org.blockml.core.Block`, branches, primitives | XML/BOM parse algorithm |
| `com.machineblocks.core.Set`, `Step` | `baseType` chain resolution |
| `org.blockml.language.OpenSCAD` | branch-specific validation rules |
| `org.blockml.service.Math` capabilities | render/processor dispatch |
| User Walls, Sets, Bricks | SCAD emission, cache, CLI |

No framework FQN should exist only in TypeScript — if it is part of the grammar, it has a `.bml` file with `<documentation>`.

---

## Native Properties Migration

Native MB properties (`size`, `offset`, …) are declared on **concrete MachineBlocks block types** (e.g. `com.machineblocks.bricks.Standard`) — not on the abstract `com.machineblocks.core.Block` base.

`09_mbom_properties.yml` retains **SCAD render hints** keyed by property name:

```yaml
- name: size
  scad_name: size
  serializer: Size3D
  scad_customizer: …
```

Validator matches BML property declarations against YAML entries for SCAD target completeness. Missing YAML entry → warning at render time, not parse time.

Full property migration from YAML → BML proceeds incrementally; structure and modifiers land first.

---

## Package Layout

```text
packages/core/blocks/
  org/blockml/core/
    Block.bml · ValueType.bml · Constraint.bml · Language.bml · ProgrammingLanguage.bml · BlockLibrary.bml · …
  org/blockml/constraint/
    Min.bml · Max.bml · MinLength.bml · MaxLength.bml · Pattern.bml · MinItems.bml · MaxItems.bml · …
  org/blockml/service/
    Math.bml · Strings.bml · Numbers.bml · Lists.bml · Bools.bml

domains/machineblocks/mbom/blocks/
  com/machineblocks/core/
    Step.bml · Block.bml · CompositeBlock.bml · NativeBlock.bml · Set.bml
  com/machineblocks/bricks/
    BricksLibrary.bml · presets/StandardPresets.bml
```

---

## Related Documents

| Topic | Document |
|---|---|
| V1/V2/V3 scope · BML vs Markdown | `01_system.md` — BML Self-Description Roadmap |
| Block BML syntax | `02_mbml.md` |
| MBOM hierarchy | `03_mbom.md` |
| BlockDefinition BOM | `12_bom_object_model.md` |
| Bootstrap | `13_bml_to_bom_mapping.md` |
| SCAD property mapping | `09_mbom_properties.yml` |
| Value types · languages (BML) | `17_type_system_bml.md` |
| Constraints · suggestions | `18_constraints_and_suggestions.md` |
