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

All MBOM types are defined in the `com.machineblocks.types` namespace.

---

## Documentation Status

Type definitions may carry one of the following status annotations:

**Stable** — defined, MBML parsing complete, SCAD mapping complete.

**Draft** — defined, MBML parsing or SCAD mapping incomplete or untested.

**WIP** — known gap; SCAD implementation and MBOM target are currently misaligned. An explicit note describes what is missing.

---

# 1. Primitive Types

```text
com.machineblocks.types.Boolean
com.machineblocks.types.Integer
com.machineblocks.types.Float
com.machineblocks.types.String
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
com.machineblocks.types.Direction

Values:  West | North | East | South

MBML:  direction="West"
MBOM:  Direction.West
SCAD:  "west"
```

## Face

```text
com.machineblocks.types.Face

Values:  x- | x+ | y- | y+ | z- | z+

MBML:  face="x+"
MBOM:  Face.XPlus
SCAD:  "x+"
```

## Axis

```text
com.machineblocks.types.Axis

Values:  X | Y | Z

MBML:  axis="x"
MBOM:  Axis.X
SCAD:  "x"
```

## AlignValue

```text
com.machineblocks.types.AlignValue

Values:  Start | Center | End

MBML:  align="Start"
MBOM:  AlignValue.Start
SCAD:  "start"
```

## StudType

```text
com.machineblocks.types.StudType

Values:  Solid | Hollow

MBML:  studType="Solid"
MBOM:  StudType.Solid
SCAD:  "solid"
```

## HoleType

```text
com.machineblocks.types.HoleType

Values:  Pin | Axle

MBML:  holeType="Pin"
MBOM:  HoleType.Pin
SCAD:  "pin"
```

## AssemblyMode

```text
com.machineblocks.types.AssemblyMode

Values:  Unassembled | Assembled | Merged

MBML:  assembly="Merged"
MBOM:  AssemblyMode.Merged
SCAD:  "merged"
```

## Color

```text
com.machineblocks.types.Color

Values:  "#RRGGBB" | "#RRGGBBAA" | [r, g, b] | [r, g, b, a]

MBML:  baseColor="#EAC645"
MBOM:  Color { hex: "#EAC645" }
SCAD:  "#EAC645"
```

## ColorOrInherit

```text
com.machineblocks.types.ColorOrInherit

Values:  Color | "inherit"
```

---

# 3. Unit Types

| Type                                  | Description                   |
|---------------------------------------|-------------------------------|
| `com.machineblocks.types.FloatMm`     | Length in millimeters         |
| `com.machineblocks.types.FloatMbu`    | Length in MachineBlocks units |
| `com.machineblocks.types.FloatGrid`   | Length in grid units          |
| `com.machineblocks.types.FloatPt`     | Text size unit                |
| `com.machineblocks.types.FloatDeg`    | Angle in degrees              |

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
com.machineblocks.types.AxisXY

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
com.machineblocks.types.AxisXYZ

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
com.machineblocks.types.PerSide4

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
com.machineblocks.types.FaceVector6

MBOM:  { "x-": T, "x+": T, "y-": T, "y+": T, "z-": T, "z+": T }

SCAD serialization:  always full 6-element array
  [x-, x+, y-, y+, z-, z+]
```

## FaceMap\<T\>

Sparse face map — only present faces are set.

```text
com.machineblocks.types.FaceMap

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
com.machineblocks.types.Size3D

MBOM:  { x: Integer, y: Integer, z: Integer }

MBML:  size="[4, 2, 3]"
SCAD:  ["size", [4, 2, 3]]
```

Integer grid dimensions. Defines the block's spatial contract.

## GridPosition3D

```text
com.machineblocks.types.GridPosition3D

MBOM:  { x: Integer, y: Integer, z: Integer }

MBML:  offset="[0, 4, 1]"
SCAD:  ["offset", [0, 4, 1]]
```

## SelectiveGrid\<T\>

```text
com.machineblocks.types.SelectiveGrid

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
com.machineblocks.types.WallGap

MBOM:  { face: Face, position: Integer, length: Integer | "full" }

MBML:  wallGap="x+"                   →  face x+, position 0, full length
       wallGap="[x+, 2, 3]"           →  face x+, position 2, length 3

SCAD:  ["x+"]                          →  position 0, full length
       ["x+", 2, 3]                    →  explicit position and length
```

## WallGapList

```text
com.machineblocks.types.WallGapList

List of WallGap entries.

MBML shorthand (single gap, full length):
  recessWallGaps="x+"  →  [["x+"]]

SCAD:
  [["x+"], ["y-", 2, 3]]
```

## Connector

```text
com.machineblocks.types.Connector

MBOM:  { face, axis, gender, align, paddingStart, paddingEnd }

Gender:  male | female

SCAD:
  ["face", "axis", "gender"]                            →  defaults for align/padding
  ["face", "axis", "gender", "align", start, end]       →  full form
```

## ScrewHole

```text
com.machineblocks.types.ScrewHole

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
com.machineblocks.types.RoundingRadius

MBOM canonical:  8 corners × 6 radii per corner
Corners:         sw-  nw-  ne-  se-  (lower Z)
                 sw+  nw+  ne+  se+  (upper Z)
Radii per corner: xy  xz  yx  yz  zx  zy
```

Three SCAD input modes are supported (Block-Axis, Block-Axis Map, Per-Corner Direct). See `docs/scad-reference/05_types_and_mapping.md` for the full specification.

---

# 9. Expression Type

```text
com.machineblocks.types.Expression

An expression is a typed SpEL expression wrapped in ${}.
It is parsed into an Expression AST node at MBML parse time.
It is not evaluated at parse time — evaluation happens at compile time
or render time depending on the expression root.

MBML:  size="${[size[0], size[1], size[2] - 1]}"
MBOM:  Expression { ast: ExpressionNode, resultType: Size3D }
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
