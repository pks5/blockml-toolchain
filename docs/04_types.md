# MachineBlocks Compiler — MBOM Type System

version: 1.0.0

## Purpose of this Document

This document describes **parse and serialize behaviour** for MBOM types — how BML
attribute values become MBOM values, and how MBOM values become SCAD.

It is **not** the inventory of native parameters or type shapes.

### Single Source of Truth (MachineBlocks parameters & types)

| Concern | SSOT |
|---------|------|
| Native MBML / SCAD parameters (names, types, docs, defaults, `scad:value`) | `domains/machineblocks/mbom/blocks/com/machineblocks/bml/core/NativeBlock.bml` |
| Type shapes (structs, enums, closed kinds, units) | `domains/machineblocks/mbom/blocks/com/machineblocks/bml/type/*.bml` (+ `Library.bml` membership) |
| This document (`04_types.md`) | Parse / serialize behaviour and conventions only |
| `09_mbom_properties.yml` | Pointer stub only — no inventory; see NativeBlock |

Markdown, YAML, and scad-lib API docs **must follow or only link** NativeBlock + type BML.
When they diverge, **BML wins** — update the mirror, never NativeBlock to match prose/YAML.

For the MBOM object model see `03_mbom.md`.
For the SCAD render target see `05_scad_renderer.md`.
For the target Capability interpretation model see `08_managed_object.md`.
For BML type-system mechanics see `17_type_system_bml.md`.

**V1:** This document remains authoritative for **parse** and **SCAD serialize** behaviour
patterns. Values are stored on Properties; PrimitiveTypes are pure type definitions.

---

## Design Principle

```text
BOM preserves authored form (lossless BML ↔ BOM round-trip).
BML is the universal format (authoring and, in WOT, Capability messages) — see `00_system.md` · `02_mbml.md`.
Target output is renderer-specific serialization (lossy by design).

Do not normalize BOM values to a canonical internal shape at parse time.
Renderers interpret authored Property values using type metadata and field order.
```

See `01_bom_core.md` — Fundamental Architecture Principles.

**Type equivalence** (e.g. `[4,2,3]` and `{x:4,y:2,z:3}` both valid for `SizeXYZ`) is a **validation rule** — not a mandate to rewrite stored values. Each authored form is preserved in `LiteralValue.value`.

All MBOM types are defined in the **`com.machineblocks.bml.type`** namespace (singular `.type` segment — see `01_bom_core.md` — FQN Convention). XML prefix: **`mbt:`**.

### Naming convention — XY / XYZ / AB (not 3D / 2D)

Axis-keyed compound types are named by **which axes they cover**, not by spatial-dimension metaphors:

```text
World / brick axes (fixed):
  XY   — X and Y only     AxisXY · SizeXY · OffsetXY · RotationXY · FaceMapXY · …
  XYZ  — X, Y, and Z      AxisXYZ · SizeXYZ · OffsetXYZ · RotationXYZ · FaceMapXYZ · …

Face-local plane (abstract):
  AB   — in-plane A/B     AxisAB · SizeAB · OffsetAB · RadiusAB · HoleEdgePair · …
         Resolves to XY, XZ, or YZ depending on Face / context — not a fixed world pair.
```

Do **not** use `3D` / `2D` type-name suffixes (`Size3D`, `Axis2D`, …). Prefer `XY` / `XYZ` / `AB`
so names align with property keys and with the `Axis` / `Face` enums.

**Rule:** world / brick placement and Z-face features that are locked to brick XY use **XY/XYZ**.
Anything measured in the plane of a directed face uses **AB**. Do not interchange them.

```text
Examples:
  NativeBlock.align / alignChildren     Align | AxisXYZ(Align)     brick space
  Port.align                            Align | AxisAB(Align)      face-local
  NativeBlock.offset                    OffsetXYZ                  brick translation
  ScrewHole.offset / Port offsets       OffsetAB                   face-local
  NativeBlock.bevel                     Bevel (= CornerMap(OffsetXY))  Z-face / world XY
  holeXYGrid*                           AxisXY(…)                  per-axis scalars (not Size/Offset kinds)
```

**Semantic kinds** (`Size*`, `Offset*`, `Rotation*`, `Radius*`) add meaning on top of `Axis*`
structure. Use a kind when the value is truly a size, offset, etc. Use bare `AxisXY` / `AxisXYZ`
when the map is only “one scalar per axis” (e.g. Technic hole grid parameters).

Closed kinds (`Bevel`, `BaseRoundingMap`, `PlaneRoundingMap`, `HoleEdgeMap`, …) package nested
type expressions for NativeBlock properties without changing SCAD shape.

See `AxisAB.bml` / `Port.bml` / `Bevel.bml` / `Align.bml` documentation.

---

## Type Resolution in BML

Type names on **specialized reference sites** (Property `type`, Capability `inputType` / `outputType`) resolve via the context-bound implicit namespace `org.blockml.bml.type.*` — see `02_mbml.md` — § Context-Bound Implicit Namespace:

```text
Text     → org.blockml.bml.type.Text
Boolean  → org.blockml.bml.type.Boolean
Integer  → org.blockml.bml.type.Integer
Float    → org.blockml.bml.type.Float
Decimal  → org.blockml.bml.type.Decimal
```

`org.blockml.bml.type.Number` is the abstract numeric branch — use `Integer`, `Decimal`, or `Float` for numeric properties.

Collections use multiplicity on the type reference — not `Array<T>`. See `17_type_system_bml.md` — Type Expressions.

Generic applications in `type="..."` attributes use **round parentheses** — not angle brackets — e.g. `type="type:TypeReference(core:Block)"` instead of `TypeReference<core.Block>`. See `17_type_system_bml.md` — Generics — BML attribute syntax.

```text
Integer[]   → org.blockml.bml.type.Integer with multiplicity 0..n
```

**With namespace prefix → resolved via `xmlns` declaration:**

```xml
xmlns:type="com.machineblocks.bml.type"

type="type:SizeXYZ"          → com.machineblocks.bml.type.SizeXYZ
type="type:Color"           → com.machineblocks.bml.type.Color
type="type:BaseCutout"  → com.machineblocks.bml.type.BaseCutout
type='"auto" | Float'      → union type expression (replaces type:AutoOr_Float)
```

Legacy `type:AutoOr_Float` → `com.machineblocks.bml.type.AutoOr<Float>` is **deprecated** — use `"auto" | Float`. See `17_type_system_bml.md` — Type Expressions.

There is no implicit fallback to the baseType's namespace. If a type cannot be resolved the compiler emits `BML_UNKNOWN_TYPE`.

**Enum types** are defined as BML `EnumType` files — see `17_type_system_bml.md`. During migration, domain XSD enums remain accepted with `BML_LEGACY_TYPE_SOURCE` warning. `<suggestions>` on an enum property is an error (`BML_SUGGESTIONS_ON_ENUM`).

On a property typed with an EnumType, enum values are written by **member id**:
- **short id** — `Standard` (omits `com.machineblocks.bml.type.BaseCutout::` because the property type is known)
- **qualified id** — `com.machineblocks.bml.type.BaseCutout::Standard`

BOM stores **id + typeFqn** only. Optional catalog properties on the enum member (for example MachineBlocks `scad:value="standard"` for SCAD via `MBEnum`) live on the type definition and are looked up by tools — they are not a second authoring form for the property value.

**Anonymous Object inputType for Capability:** `{ a: Float, b: Float }` is shorthand for an **anonymous struct type** — conceptually an inline class with private typed fields (`a`, `b`). Stored in BOM as `AnonymousStructType` (see `12_bom_object_model.md` — Type Descriptors). Field order defines positional parameter order — same **Ordered Struct Fields** rule as named StructTypes (see `17_type_system_bml.md`). Both positional and named call syntax are valid:

```text
inputType: { a: Float, b: Float }      → #math.max(a, b)  or  #math.max(a=x, b=y)
inputType: { x: Float, n: Integer }    → #math.round_n(x, n)
inputType: Float                       → #math.floor(x)   (single primitive — no struct wrapper)
```

`Tuple<T1, T2>` is not used — the anonymous struct pattern covers this role with the added benefit of named parameters.

---

## Status

Type and parameter definitions express maturity via **status Block references** — not strings or boolean flags. See `02_mbml.md` — § Status and `01_bom_core.md` — § Status.

**Implicit default:** `status:Stable` when omitted — at document root and inherited by children unless a deviation is declared. Declare `<status>` or `bml:status` **only when deviating** from the inherited status.

Core status blocks:

```text
status:Stable       — defined, MBML parsing complete, SCAD mapping complete
Draft        — defined; MBML parsing or SCAD mapping incomplete or untested
status:Stub         — placeholder; validates OK; renderer may stub/log or abort (`01_bom_core.md`)
status:Deprecated   — retained for compatibility; do not use in new work
```

Definition elements carry `<status>Draft</status>` only when deviating from inherited status. Prose annotations in this document use inline block references where the effective status differs from Stable:

```text
Status: Draft — known gap; explicit note describes what is missing.
```

Domain libraries may define additional status blocks (e.g. domain-specific WIP markers). At `<status>` and `bml:status` reference sites, unqualified names resolve to `org.blockml.bml.status.*`.

---

# 1. Primitive Types

```text
org.blockml.bml.type.Boolean
org.blockml.bml.type.Integer
org.blockml.bml.type.Float
org.blockml.bml.type.Decimal
org.blockml.bml.type.Text
```

Numeric branch: `org.blockml.bml.type.Number` (abstract) — `Integer`, `Float`, and `Decimal` extend `Number`.

MBML / BML serialization:

```text
Boolean:  true | True | TRUE | false | False | FALSE
          (preferred: lowercase true / false; BOM stores canonical lowercase)
Integer:  "4"
Float:    "0.5"
Decimal:  "0.5"
String:   "west"
```

Boolean literals are **case-insensitive** at authoring time. Empty boolean elements and attribute shorthand without an explicit value are not permitted.

**`Boolean.True` / `Boolean.False`** — public Sub-Blocks of `org.blockml.bml.type.Boolean` that shortcut Constant notation for singleton boolean domains:

```text
Boolean.True   ≡  Constant(Boolean){value: true}
Boolean.False  ≡  Constant(Boolean){value: false}
```

These are **types** (usable in type expressions, e.g. `Boolean.False | T`), **not** boolean property values. Parser/serializer **MUST** preserve them as type references (B16) — never collapse to literal `true`/`false`. Boolean **values** (`true`/`True`/…) normalize to lowercase (B15). See `21_constant_value_type.md` — Boolean.True / Boolean.False shortcuts · `13` B15/B16.

---

# 2. MachineBlocks type inventory → BML (SSOT)

Do **not** maintain enum/struct/value catalogs in this Markdown file.

| Concern | SSOT path |
|---------|-----------|
| Native parameters | `…/core/NativeBlock.bml` |
| MB type shapes | `…/type/*.bml` (e.g. `Direction.bml`, `SizeXYZ.bml`, `Align.bml`, `WallGap.bml`, …) |
| Framework primitives | `packages/core/blocks/org/blockml/bml/type/*.bml` |

This document keeps only **parse / serialize / convention** commentary. For values,
defaults, docs, and `scad:value`, open the corresponding `.bml` file.

XY / XYZ / AB naming and Align brick-vs-face rules: § Naming convention above ·
`AxisAB.bml` / `Port.bml`.

---

# 3. Type Expressions (Unions and Legacy Wrappers)

BlockML has four ValueType kinds: **Primitive**, **Enum**, **Struct**, **Constant**. The forms below are **type expressions** — not separate ValueTypes. Write unions directly in `type="..."` attributes.

## Union syntax (replaces wrapper types)

Canonical singleton alternatives use **Constant** — see `21_constant_value_type.md`:

```text
AutoOr<T>      →  Constant(Text){value: "auto"} | T
FalseOr<T>     →  Boolean.False | T     (≡ Constant(Boolean){value: false} | T)
NoneOr<T>      →  Constant(Text){value: "none"} | T
BooleanOr<T>   →  Boolean | T
```

Legacy literal union syntax (`"auto" | T`) remains parseable; normalization to Constant is recommended.

Union match is **left to right, first hit wins**. Overlapping alternatives are resolved by author order (narrower / sentinels on the left). Unreachable later alternatives → `BML_UNREACHABLE_UNION_ALTERNATIVE`. See `17_type_system_bml.md` — Unions · Match order.

### AutoOr — migrate to `Constant(Text){value: "auto"} | T`

```text
Was:  type="type:AutoOr_Float"   value="auto" | value="1.5"
Now:  type='Constant(Text){value: "auto"} | Float'   value="auto" | value="1.5"

MBOM:  "auto"  or  T
SCAD:  "auto"  or  serialized T
```

### FalseOr — migrate to `Boolean.False | T`

```text
Preferred:   Boolean.False | T
Equivalent:  Constant(Boolean){value: false} | T
```

`Boolean.False` is a Sub-Block of `Boolean` — a Constant shortcut. See `21_constant_value_type.md` — Boolean.True / Boolean.False shortcuts.

### NoneOr — migrate to `Constant(Text){value: "none"} | T`

```text
Was:  type="type:NoneOr_…"   value="none"
Now:  type='Constant(Text){value: "none"} | T'

MBOM:  "none"  or  T
SCAD:  "none"  or  serialized T
```

### BooleanOr — migrate to `Boolean | T`

```text
Boolean | T
```

When `Boolean | T` is itself a **generic type argument**, write the union inside the parentheses:

```text
Was:  type="type:SelectiveGrid(BooleanOr(HoleType))"
Now:  type="type:SelectiveGrid(Boolean | type:HoleType)[]"
```

```xml
<holeX type="Boolean">
  <value>false</value>
</holeX>
<holeXAreas type="type:SelectiveGrid(Boolean | type:HoleType)[]">
  <value>[]</value>
</holeXAreas>
```

See `17_type_system_bml.md` — Type Expressions · Generics — BML attribute syntax.

During migration, legacy `com.machineblocks.bml.type.AutoOr_*` XSD/BML names may still resolve with `BML_LEGACY_TYPE_SOURCE` warning. New authoring uses union syntax only.

---

# 4. Map Type

A Map type represents a set of key-value pairs where keys are strings and values are typed. In BML, Maps use **JSON Object syntax**. The SCAD BlockProcessor translates to SCAD's array-of-arrays format.

```text
BML (JSON Object):         { 'z+': -0.5 }
SCAD (array-of-arrays):    [["z+", -0.5]]

BML:   { 'z+': -0.5, 'x+': 1.0 }
SCAD:  [["z+", -0.5], ["x+", 1.0]]
```

Illustrative Map-typed natives (authoritative types/defaults: NativeBlock + type BML):

```text
sizeMod · baseAdjustment · baseSideAdj · baseCrop
```

BML examples:

```xml
sizeMod="${ {'z+': -0.5} }"
baseAdjustment="${ {'y': 0.11} }"
baseCrop="${ {'xy': -0.5} }"
baseCrop="${ {'x': -0.5, 'y-': 0.2} }"
```

Map values are always wrapped in `${ }` because they are object literals in the extended JSON expression syntax. Pure literal maps outside `${ }` are not supported for Map-type properties.

---

# 5. Expression Type

```text
org.blockml.bml.type.Expression

An expression is a typed value wrapped in ${ }.
Canonical BOM stores ExpressionValue { raw } only — lossless roundtrip text.
The parseExpression() utility builds ExpressionNode trees later (Phase B+);
AST and resultTypeFqn are never written into the Urmodell.
See `10_expression_language.md` — Expression AST · `15_dev_setup.md` — V1 Implementation Strategy.

BML:   size="${ [size.x, size.y, size.z - 1] }"
BOM:   ExpressionValue { raw: "[size.x, size.y, size.z - 1]", … }
Utility: ParsedExpression { raw, ast: ArrayLiteral(...), resultTypeFqn?: "…" }
SCAD:  renderer serializes the AST or a statically resolved value
```

---

# 6. MBOM→SCAD Serialization Rules

The serialization rules follow NativeBlock type metadata and `scad:value`. `09_mbom_properties.yml` is a pointer stub (no inventory). Serialization follows NativeBlock / type BML. The following describes the general strategy.

## General Strategy

```text
1. Read BOM member value in authored form
2. Consult type metadata (field order, serialize Capability, NativeBlock `scad:value`)
3. Translate to target representation at render time
4. Choose shortest valid SCAD representation (expression text per value)
5. Add to SettingsBundle: scadName → SCAD expression
6. SettingsEmitter emits bundle:
     V1 (pseudo-map):  ["paramName", value]  pairs in an array
     Future (object):  object(paramName = value, …)
```

**Default StructType → SCAD array order:** when a StructType value is emitted as a SCAD array, element order is the type's **property declaration order** — the same ordinal used for BML positional array literals and FunctionMapping. Do not invent a separate SCAD index convention.

```text
FaceMapXY properties:  xNeg, xPos, yNeg, yPos
MBOM:  { xNeg: 1, xPos: 1, yNeg: 0, yPos: 0 }
SCAD:  [1, 1, 0, 0]          ← declaration order; no per-example remapping
```

**Exceptions** (must be defined on the type, property, or Annotation facet — never implied):

- Compact / shortened forms (e.g. `PerSide4` scalar or 2-element when faces are paired)
- Enum / catalog literals via `scad:value`
- Custom serialize Capability on the type / property (or Annotation facet) — never a parallel YAML catalog

Canonical rule: `17_type_system_bml.md` — Declaration Order. See `05_scad_renderer.md` — Settings Format for the pseudo-map vs. OpenSCAD `object()` roadmap.

## Serialization Examples

### SizeXYZ

```text
MBOM: { x:4, y:2, z:3 }
SettingsBundle: size → [4, 2, 3]
V1 SCAD: ["size", [4, 2, 3]]
Future:  object(size = [4, 2, 3])
```

### AxisXYZ — holeXYZDiameter

```text
MBOM: { x:"auto", y:"auto", z:"auto" }  →  SCAD: ["holeXYZDiameter", "auto"]
MBOM: { x:3, y:3, z:4 }                →  SCAD: ["holeXYZDiameter", [3, 4]]
MBOM: { x:3, y:3.2, z:4 }              →  SCAD: ["holeXYZDiameter", [3, 3.2, 4]]
```

### PerSide4 — recessWallThickness

```text
MBOM: { "x-":0.333, "x+":0.333, "y-":0.333, "y+":0.333 }  →  SCAD: ["recessWallThickness", 0.333]
MBOM: { "x-":0.5, "x+":0.5, "y-":0.25, "y+":0.25 }        →  SCAD: ["recessWallThickness", [0.5, 0.25]]
MBOM: { "x-":0.5, "x+":0.4, "y-":0.25, "y+":0.2 }         →  SCAD: ["recessWallThickness", [0.5, 0.4, 0.25, 0.2]]
```

### FaceVector6 — sizeMod

```text
MBOM: { "x-":0, "x+":0.5, "y-":0, "y+":0, "z-":0, "z+":0 }
SCAD: ["sizeMod", [0, 0.5, 0, 0, 0, 0]]
```

### FaceMap — baseAdjustment

```text
MBOM: { "x-": -0.1, "x+": -0.1, "z+": 0.05 }
SCAD: ["baseAdjustment", [["x-", -0.1], ["x+", -0.1], ["z+", 0.05]]]

Namespace-qualified (composite forwarding):
MBOM: { "pbx.x+": 0.01, "pty.z+": 0.1 }
SCAD: ["baseAdjustment", [["pbx.x+", 0.01], ["pty.z+", 0.1]]]
```

### SelectiveGrid — studs

```text
MBOM:
studs: true
studAreas: [
  { start:{x:0,y:0}, end:{x:1,y:1}, value: false },
  { start:{x:2,y:0}, end:{x:3,y:1}, value: "hollow" }
]

SCAD:
["studs", true]
["studAreas", [[[0,0],[1,1], false], [[2,0],[3,1], "hollow"]]]
```

### WallGapList — recessWallGaps

```text
MBOM: [{ face:"x+", position:0, length:"full" }, { face:"y-", position:2, length:3 }]
SCAD: ["recessWallGaps", [["x+"], ["y-", 2, 3]]]
```

### Direction

```text
MBOM: Direction.West
SCAD: ["direction", "west"]
```

### Color

```text
MBOM: Color { hex: "#EAC645" }
SCAD: ["baseColor", "#EAC645"]
```
