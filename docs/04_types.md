# MachineBlocks Compiler — MBOM Type System

version: 1.0.0

## Purpose of this Document

This document defines the MBOM type system — all types that can be assigned to MBOM properties, and the rules for how MBML values (XML attributes or JSON values) are parsed into MBOM, and how MBOM values are serialized to SCAD.

For native property definitions (names, types, defaults) see `09_mbom_properties.yml`.
For the MBOM object model see `03_mbom.md`.
For the SCAD render target see `docs/scad-reference/05_types_and_mapping.md`.

---

## Design Principle

```text
MBOM is canonical.
MBML is a serialization of MBOM (authoring format).
SCAD is a serialization of MBOM (render target).

Do not design MBOM types around SCAD arrays.
Design SCAD arrays as serializations of MBOM.
```

All MBOM types are defined in the **`com.machineblocks.type`** namespace (singular `.type` segment — see `00_bom_core.md` — FQN Convention).

---

## Type Resolution in BML

Type names in BML `<property type="...">` declarations are resolved as follows:

**No namespace prefix → `org.blockml.type.*` (BOM Core primitives):**

```text
Float    → org.blockml.type.Float
Integer  → org.blockml.type.Integer
String   → org.blockml.type.String
Boolean  → org.blockml.type.Boolean
Array<T> → org.blockml.type.Array<T>
```

**With namespace prefix → resolved via `xmlns` declaration:**

```xml
xmlns:type="com.machineblocks.type"

type="type:Size3D"          → com.machineblocks.type.Size3D
type="type:Color"           → com.machineblocks.type.Color
type="type:BaseCutoutType"  → com.machineblocks.type.BaseCutoutType
type="type:AutoOr_Float"    → com.machineblocks.type.AutoOr<Float>
```

There is no implicit fallback to the baseType's namespace. If a type cannot be resolved the compiler emits `BML_UNKNOWN_TYPE`.

**Enum types** are defined in the domain XSD (e.g. `bricks.xsd`). They appear as `type:BaseCutoutType` in BML. The XSD provides the valid values — the editor renders a SelectBox and the XML parser validates. `<suggestions>` on an enum property is an error (`BML_SUGGESTIONS_ON_ENUM`).

**Anonymous Object payloadType for FunctionBlock Capabilities:** a structured Object literal `{ a: Float, b: Float }` in a Capability `payloadType` serves as the function signature. Keys are the parameter names; key order defines positional order. Both positional and named call syntax are valid:

```text
payloadType: { a: Float, b: Float }      → #math.max(a, b)  or  #math.max(a=x, b=y)
payloadType: { x: Float, n: Integer }    → #math.round_n(x, n)
payloadType: Float                       → #math.floor(x)   (single primitive, no Object wrapper)
```

`Tuple<T1, T2>` is not used — the anonymous Object pattern covers this role with the added benefit of named parameters.

---

## Documentation Status

Type definitions may carry one of the following status annotations:

**Stable** — defined, MBML parsing complete, SCAD mapping complete.

**Draft** — defined, MBML parsing or SCAD mapping incomplete or untested.

**WIP** — known gap; SCAD implementation and MBOM target are currently misaligned. An explicit note describes what is missing.

---

# 1. Primitive Types

```text
com.machineblocks.type.Boolean
com.machineblocks.type.Integer
com.machineblocks.type.Float
com.machineblocks.type.String
```

MBML serialization:

```text
Boolean:  "true" | "false"
Integer:  "4"
Float:    "0.5"
String:   "west"
```

---

# 2. Atomic MB Types

## Direction

```text
com.machineblocks.type.Direction

Values:  West | North | East | South

MBML:  direction="West"
MBOM:  Direction.West
SCAD:  "west"
```

## Face

```text
com.machineblocks.type.Face

Values:  x- | x+ | y- | y+ | z- | z+

MBML:  face="x+"
MBOM:  Face.XPlus
SCAD:  "x+"
```

## Axis

```text
com.machineblocks.type.Axis

Values:  X | Y | Z

MBML:  axis="x"
MBOM:  Axis.X
SCAD:  "x"
```

## AlignValue

```text
com.machineblocks.type.AlignValue

Values:  Start | Center | End

MBML:  align="Start"
MBOM:  AlignValue.Start
SCAD:  "start"
```

## StudType

```text
com.machineblocks.type.StudType

Values:  Solid | Hollow

MBML:  studType="Solid"
MBOM:  StudType.Solid
SCAD:  "solid"
```

## HoleType

```text
com.machineblocks.type.HoleType

Values:  Pin | Axle

MBML:  holeType="Pin"
MBOM:  HoleType.Pin
SCAD:  "pin"
```

## AssemblyMode

```text
com.machineblocks.type.AssemblyMode

Values:  Unassembled | Assembled | Merged

MBML:  assembly="Merged"
MBOM:  AssemblyMode.Merged
SCAD:  "merged"
```

## Color

```text
com.machineblocks.type.Color

Values:  "#RRGGBB" | "#RRGGBBAA" | [r, g, b] | [r, g, b, a]

MBML:  baseColor="#EAC645"
MBOM:  Color { hex: "#EAC645" }
SCAD:  "#EAC645"
```

## ColorOrInherit

```text
com.machineblocks.type.ColorOrInherit

Values:  Color | "inherit"
```

---

# 3. Unit Types

| Type                                  | Description                   |
|---------------------------------------|-------------------------------|
| `com.machineblocks.type.FloatMm`     | Length in millimeters         |
| `com.machineblocks.type.FloatMbu`    | Length in MachineBlocks units |
| `com.machineblocks.type.FloatGrid`   | Length in grid units          |
| `com.machineblocks.type.FloatPt`     | Text size unit                |
| `com.machineblocks.type.FloatDeg`    | Angle in degrees              |

---

# 4. Generic Container Types

## AutoOr\<T\>

```text
"auto" | T

MBML:  value="auto"  or  value="1.5"
MBOM:  "auto"  or  T
SCAD:  "auto"  or  serialized T
```

## FalseOr\<T\>

```text
false | T
```

## NoneOr\<T\>

```text
"none" | T

MBML:  value="none"
SCAD:  "none"
```

## BooleanOr\<T\>

```text
Boolean | T
```

---

# 5. Axis Container Types

## AxisXY\<T\>

```text
com.machineblocks.type.AxisXY

MBOM:  { x: T, y: T }

MBML:
  Single value:  value="1.5"          →  x == y == 1.5
  Array:         value="[1.5, 2.0]"   →  x=1.5, y=2.0

SCAD serialization:
  x == y   →  scalar
  x != y   →  [x, y]
```

## AxisXYZ\<T\>

```text
com.machineblocks.type.AxisXYZ

MBOM:  { x: T, y: T, z: T }

MBML:
  Single value:  value="1.5"               →  x == y == z
  Two values:    value="[1.5, 2.0]"        →  x == y, z differs
  Three values:  value="[1.5, 1.5, 2.0]"  →  all specified

SCAD serialization:
  x == y == z   →  scalar
  x == y        →  [xy, z]
  all differ    →  [x, y, z]
```

---

# 6. Per-Face Types

## PerSide4\<T\>

Covers the four lateral faces: `x-`, `x+`, `y-`, `y+`

```text
com.machineblocks.type.PerSide4

MBOM:  { "x-": T, "x+": T, "y-": T, "y+": T }

MBML:
  Single:      value="0.333"                   →  all equal
  Two values:  value="[0.5, 0.25]"             →  x-==x+, y-==y+
  Four values: value="[0.5, 0.4, 0.25, 0.2]"  →  all differ

SCAD serialization:
  all equal          →  scalar
  x-==x+, y-==y+     →  [x, y]
  all differ         →  [x-, x+, y-, y+]
```

## FaceVector6\<T\>

Covers all six faces: `x-`, `x+`, `y-`, `y+`, `z-`, `z+`

```text
com.machineblocks.type.FaceVector6

MBOM:  { "x-": T, "x+": T, "y-": T, "y+": T, "z-": T, "z+": T }

SCAD serialization:  always full 6-element array
  [x-, x+, y-, y+, z-, z+]
```

## FaceMap\<T\>

Sparse face map — only present faces are set.

```text
com.machineblocks.type.FaceMap

MBOM:  { face: T, ... }  (partial)

SCAD serialization:
  [["x-", value], ["z+", value], ...]

Supports namespace-qualified keys for composite block forwarding:
  [["pbx.x+", value], ["pty.z+", value]]
```

---

# 7. Grid Types

## Size3D

```text
com.machineblocks.type.Size3D

MBOM:  { x: Integer, y: Integer, z: Integer }

MBML:  size="[4, 2, 3]"
SCAD:  ["size", [4, 2, 3]]
```

Integer grid dimensions. Defines the block's spatial contract.

## GridPosition3D

```text
com.machineblocks.type.GridPosition3D

MBOM:  { x: Integer, y: Integer, z: Integer }

MBML:  offset="[0, 4, 1]"
SCAD:  ["offset", [0, 4, 1]]
```

## SelectiveGrid\<T\>

```text
com.machineblocks.type.SelectiveGrid

MBOM:
{
  default: T,
  overrides: [
    { region: { from: {x, y}, to: {x, y} }, value: T }
  ]
}

SCAD serialization:
  With overrides:   [default, [[x0,y0,x1,y1], value], ...]
  Without overrides: default value only (scalar or boolean)
```

---

# 8. Compound Domain Types

## WallGap

```text
com.machineblocks.type.WallGap

MBOM:  { face: Face, position: Integer, length: Integer | "full" }

MBML:  wallGap="x+"                   →  face x+, position 0, full length
       wallGap="[x+, 2, 3]"           →  face x+, position 2, length 3

SCAD:  ["x+"]                          →  position 0, full length
       ["x+", 2, 3]                    →  explicit position and length
```

## WallGapList

```text
com.machineblocks.type.WallGapList

List of WallGap entries.

MBML shorthand (single gap, full length):
  recessWallGaps="x+"  →  [["x+"]]

SCAD:
  [["x+"], ["y-", 2, 3]]
```

## Connector

```text
com.machineblocks.type.Connector

MBOM:  { face, axis, gender, align, paddingStart, paddingEnd }

Gender:  male | female

SCAD:
  ["face", "axis", "gender"]                            →  defaults for align/padding
  ["face", "axis", "gender", "align", start, end]       →  full form
```

## ScrewHole

```text
com.machineblocks.type.ScrewHole

MBOM:  { face, position: {x,y}, diameter, depth, insetThickness, insetDepth }

SCAD:
  ["face", [x, y]]                                               →  defaults
  ["face", [x, y], diameter, depth, insetThickness, insetDepth]  →  full form
```

## RoundingRadius

> **Status: WIP**
> The MBOM canonical form is defined. The SCAD mapping is partially implemented.
> See `docs/scad-reference/05_types_and_mapping.md` for full details and current
> implementation status.

```text
com.machineblocks.type.RoundingRadius

MBOM canonical:  8 corners × 6 radii per corner
Corners:         sw-  nw-  ne-  se-  (lower Z)
                 sw+  nw+  ne+  se+  (upper Z)
Radii per corner: xy  xz  yx  yz  zx  zy
```

Three SCAD input modes are supported (Block-Axis, Block-Axis Map, Per-Corner Direct). See `docs/scad-reference/05_types_and_mapping.md` for the full specification.

---

# 9. Map Type

A Map type represents a set of key-value pairs where keys are strings and values are typed. In BML, Maps use **JSON Object syntax**. The SCAD BlockProcessor translates to SCAD's array-of-arrays format.

```text
BML (JSON Object):         { 'z+': -0.5 }
SCAD (array-of-arrays):    [["z+", -0.5]]

BML:   { 'z+': -0.5, 'x+': 1.0 }
SCAD:  [["z+", -0.5], ["x+", 1.0]]
```

Properties using Map type in MBOM:

```text
sizeMod          — Map<Face, Float>    per-face size modification
baseAdjustment   — Map<Axis, Float>    per-axis base adjustment
baseSideAdj      — Map<Face, Float>    per-face side adjustment
baseCrop         — Map<Face, Float>    per-face crop
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

# 10. Expression Type

```text
org.blockml.type.Expression

An expression is a typed value wrapped in ${ }.
It is parsed into an ExpressionValue { ast: ExpressionNode, ... } at compile stage [7].
It is not evaluated at parse time — renderers serialize the AST.
See `10_expression_language.md` — Expression AST.

BML:   size="${ [size[0], size[1], size[2] - 1] }"
BOM:   ExpressionValue { ast: ArrayLiteral(...), resultTypeFqn: "com.machineblocks.type.Size3D" }
SCAD:  serialized as the expression result or as a SCAD expression
       depending on whether it can be statically resolved
```

---

# 10. MBOM→SCAD Serialization Rules

The serialization rules are configurable and defined per property in `09_mbom_properties.yml`. The following describes the general strategy.

## General Strategy

```text
1. Read MBOM canonical value
2. Validate type
3. Normalize to renderer-neutral form
4. Choose shortest valid SCAD representation
5. Emit SCAD settings array entry: ["paramName", value]
```

## Serialization Examples

### Size3D

```text
MBOM: { x:4, y:2, z:3 }
SCAD: ["size", [4, 2, 3]]
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
{
  default: true,
  overrides: [
    { region: { from:{x:0,y:0}, to:{x:1,y:1} }, value: false },
    { region: { from:{x:2,y:0}, to:{x:3,y:1} }, value: "hollow" }
  ]
}
SCAD: ["studs", [true, [[0,0,1,1], false], [[2,0,3,1], "hollow"]]]
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
