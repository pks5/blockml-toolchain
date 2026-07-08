# BOM Compiler — BML

version: 2.0.0

## Purpose of this Document

This document defines the BML (Block Markup Language) format — the universal declarative authoring language for BOM Blocks, Composite Blocks, and Presets.

For the abstract object model see `00_bom_core.md`. For the formal BOM data structures (implementation contract) see `12_bom_object_model.md`. For the MBOM object model (MachineBlocks domain) see `03_mbom.md`. For value type BML definitions see `17_type_system_bml.md`. For MBOM type parse/serialize rules see `04_types.md`. For native MBOM property SCAD mapping see `09_mbom_properties.yml`.

---

## Overview

BML is the human- and editor-friendly authoring format for BOM. It describes semantic BOM objects — Blocks, Composite Blocks, and Presets — without any knowledge of render target syntax or parameters.

BML is parsed and validated by `@blockml/parser`, which produces a BOM document as output. The BOM is then compiled to the selected render target by `@blockml/compiler`.

### File Extensions

```text
Standard extension:     .bml          — all BML source files (default)
Content-type:           bml           — MIME / tooling identifier (unchanged)
Domain extensions:      optional      — domains may register additional suffixes
MachineBlocks (legacy): .mbml         — still used in scad-lib and existing MB projects
```

**`.bml` is the canonical file extension.** Blocks, presets, config profiles, and library descriptors all use `.bml` unless a domain specifies otherwise.

Domains may register their own extensions when a single `.bml` suffix is too generic for tooling (e.g. IDE file associations per domain). **MachineBlocks** still uses `.mbml` for historical library content — the compiler accepts both `.bml` and `.mbml` when the MachineBlocks target is active.

New projects outside the MachineBlocks library should use **`.bml` only**.

The compiler discovers source files via `bmlExtensions` in `bom.config.json` (default: `[".bml"]`; MachineBlocks: `[".bml", ".mbml"]`).

The root XML element determines the document type — not the filename suffix. (JSON `type` field: deferred TBD.)

---

## Serialization Formats

**XML is the canonical BML format.** It is the format of choice for all Block definitions, Composite Blocks, Sub-Blocks, and anything involving BML Directives or Functions. XML is not a legacy choice — it is the right tool for this kind of structured, namespace-aware, hierarchical information.

Specific XML capabilities that make it irreplaceable for BML:

```text
Namespaces          xmlns:bricks="com.machineblocks.bricks"
                    → Block types used directly as element names: <bricks:StandardBrick />
                    → No need for explicit type="..." attributes

Attribute namespaces bml:each, bml:if, bml:block
                    → Clean separation of directives from Block properties
                    → No equivalent mechanism in JSON

Mixed content       <bml:block> with heterogeneous children
                    → Natural in XML, awkward in JSON arrays

CDATA               <![CDATA[ ... ]]> for inline Function bodies
                    → No JSON equivalent

Comments            <!-- Row 0 — studDiameterAdjustment -->
                    → JSON has no comments

Schema validation   XSD with full namespace awareness
                    → JSON Schema cannot match this expressiveness
```

**JSON BML authoring is deferred (TBD — not V1).** JSON may eventually cover a very restricted subset; intensive namespace usage makes full parity unlikely. See § JSON Format (Deferred) below.

The document type is determined by the root element (XML). JSON `type` field mapping is not implemented in V1.

---

## Document Types

BML defines one core document root:

```text
<block>   — Block Definition (composable types, type blocks, language blocks, preset collections, …)
```

Property presets are **not** a BlockML core feature. MachineBlocks models presets as Block instances in `_presets` with `appliedPresets` associations — see § Presets (MachineBlocks) and `03_mbom.md`.

Library packages use `<block baseType="org.blockml.core.Library">` — see § Library Format.

Extension document types (defined in domain packages, not in core):

```text
<device>   — Electronic device (electronics + software) — separate package
<sign>     — Dynamic sign (draft)
<game>     — Board game (draft)
```

Extension types register their own BML→BOM mapping rule with the parser. The core defines the registration mechanism, not the extension types themselves.

---

## Namespaces

BML uses XML namespaces to resolve Block type references. Namespace prefixes map to FQN package prefixes.

```xml
xmlns:core="com.machineblocks.core"
xmlns:bricks="com.machineblocks.bricks"
xmlns:ac="com.martianmicro.anyclosure"
```

A type reference using a prefix:

```xml
<ac:Wall id="wall" size="[1, 8, 9]" />
```

is resolved by the Namespace Resolver to the FQN:

```text
com.martianmicro.anyclosure.Wall
```

The BOM always uses the full FQN. Namespace prefixes are a BML authoring convenience only.

### Type Namespace Shorthand

Property `type` attributes accept unqualified names for BOM Core primitives and namespace-prefixed names for domain types.

**Unqualified names** resolve to `org.blockml.type.*`:

```text
type="Integer"   →  org.blockml.type.Integer
type="String"    →  org.blockml.type.String
type="Boolean"   →  org.blockml.type.Boolean
type="Float"     →  org.blockml.type.Float
```

**Domain types** require the `type:` namespace prefix (declared via `xmlns:type="com.machineblocks.type"`):

```text
type="type:Size3D"   →  com.machineblocks.type.Size3D
type="type:Color"    →  com.machineblocks.type.Color
```

There is no implicit fallback to the domain namespace. Explicit FQNs are always supported.

**Property and Capability types** must resolve to a **TypeBlock** — a Block whose `baseType` chain includes `org.blockml.core.TypeBlock`. Non-TypeBlock FQNs (e.g. `com.foo.Wall`) are invalid as property or Capability payload/return types → `BML_INVALID_PROPERTY_TYPE`.

**Reserved names:** `<property name="id">` is forbidden — `id` is a meta property on every Block instance, not a declarable property → `BML_RESERVED_PROPERTY_NAME`.

**Aggregation and association types** may reference any Block FQN — not limited to TypeBlocks.

---

## Schema Validation

Each document type has its own schema:

```text
XML:   XSD schema  (http://blockml.org/<type>.xsd)
JSON:  JSON Schema
```

Extension document types bring their own schema. The schema location and management details are to be defined.

---

## Block Definition (`<block>`)

A Block definition describes a reusable Block type — semantically a **Class**: declarative shape, members, and optional composition template. It declares Members (Properties, Aggregations, Associations, Capabilities) and an optional Composition (internal structure).

Composition children (`<ac:Wall id="wall" …/>`, `<core:Step …/>`) are **Block Instances** — semantically **Objects**: they reference a class (`typeFqn`) and carry instance state (`id`, property values). See `00_bom_core.md` — Block and Block Instance.

### Required Fields

```text
<documentation>     — human-readable description of what this Block is (first child element).
<name>              — short class name (PascalCase). See naming convention below.
<type>              — FQN (e.g. com.martianmicro.anyclosure.Wall)
<baseType>          — FQN of the parent type. Mandatory — no default. Omitted only on org.blockml.core.Block.
<version>           — semantic version of this Block definition
```

`<documentation>` is placed **directly under the root `<block>` element**, before `<name>`. It describes the Block definition itself — not individual members (those carry their own `<documentation>`). Omitted on root blocks → `BML_MISSING_DOCUMENTATION` (warning in V1, error in a later release).

```xml
<block ...>
  <documentation>Parametric wall segment for AnyClosure enclosures.</documentation>
  <name>Wall</name>
  ...
</block>
```

### Block Name Convention

`<name>` is a class name — PascalCase, letters and digits only:

```text
Format:  [A-Z][a-zA-Z0-9]*
Valid:   Wall, StandardBrick, Calibrator, NfcPlayer
Invalid: my-wall, wall_v2, 2Wall, My Wall
Error:   BML_INVALID_BLOCK_NAME
```

PascalCase ensures Sub-Block short-name references (`<Base />`) are unambiguous — no Property or member name starts with an uppercase letter.

### Optional Fields

```text
<abstract>                    — true | false (default false). Abstract types are not instantiable.
<final>                       — true | false (default false). Final types cannot be used as baseType.
<subTypes>          — override: permitted Sub-Block baseTypes (omit to inherit — see Framework Base Types)
<implTypes>         — org.blockml.language.* FQNs for <implementation type="...">
<properties>    — Property declarations. Omit if no custom properties or default overrides needed.
<aggregations>  — Aggregation declarations. Omit when inherited aggregations from baseType suffice.
<associations>  — Association declarations.
<capabilities>  — Capability declarations.
<contracts>     — Contract declarations (interface implementation). Root block only.
<subBlocks>     — Sub-Block definitions (see Sub-Blocks section).
<composition>   — internal structure. Omit for Leaf Blocks.
```

Framework base types (`org.blockml.core.Block`, `com.machineblocks.core.Block`, …) are **BML files** in `@blockml/core` and `@machineblocks/mbom` — not code or YAML. See `16_framework_base_types.md`.

### Type Modifiers

```xml
<abstract>true</abstract>
<final>true</final>

<subTypes>
  <subType type="com.machineblocks.core.Block" />
  <subType type="org.blockml.service.FunctionBlock" />
</subTypes>

<implTypes>
  <implType type="org.blockml.language.OpenSCAD" />
  <implType type="org.blockml.language.TypeScript" />
</implTypes>
```

```text
Omitted <subTypes>            — inherit effective subTypes from baseType chain
Explicit <subTypes>…          — override (enable or restrict Sub-Blocks)
Explicit empty <subTypes/>    — override: forbid Sub-Blocks even when parent allowed them
Omitted other modifiers       — inherit from baseType where applicable (validator walks chain)
org.blockml.core.Block        — sole type that omits <baseType> (inheritance root); effective subTypes []
```

### Contracts

Blocks may declare `<contracts>` at root level to signal that they implement the member surface of one or more abstract Block types (interfaces):

```xml
<contracts>
  <contract type="com.foo.IPlaceable" />
  <contract type="com.foo.IColored" />
</contracts>
```

```text
type    — FQN of an abstract Block whose members this Block implements (required)
```

**Semantics:**

```text
Scope           — Properties, Aggregations, Associations, Capabilities of the contract type
Ignored         — subBlocks and compositions on the contract Block
Contract target — must be abstract (abstract=true)
Orthogonal to   — baseType inheritance (extends one base, implements zero or more contracts)
Validation      — effective members of this Block must include all contract members
                  with compatible types (stage [8])
Multiple        — all declared contracts must be satisfied
Sub-Blocks      — contracts not allowed on nested Sub-Blocks (root only)
```

**Example — interface Block:**

```xml
<block xmlns="http://blockml.org/schema/block" …>
  <name>IPlaceable</name>
  <type>com.foo.IPlaceable</type>
  <baseType>org.blockml.core.Block</baseType>
  <version>1.0.0</version>
  <abstract>true</abstract>
  <properties>
    <property name="offset"    type="type:Vector3D" />
    <property name="direction" type="type:Direction" />
  </properties>
</block>
```

**Example — implementing Block:**

```xml
<block xmlns="http://blockml.org/schema/block" …>
  <name>Wall</name>
  <type>com.foo.Wall</type>
  <baseType>com.machineblocks.core.CompositeBlock</baseType>
  <version>1.0.0</version>
  <contracts>
    <contract type="com.foo.IPlaceable" />
  </contracts>
  <properties>
    <property name="offset"    type="type:Vector3D" defaultValue="[0, 0, 0]" />
    <property name="direction" type="type:Direction" defaultValue="north" />
    <property name="size"      type="type:Size3D"    defaultValue="[1, 8, 9]" />
  </properties>
</block>
```

### Namespace Declarations

Every BML document declares namespaces and a `xsi:schemaLocation` for IDE validation and autocomplete. The pattern follows the same convention as Spring and Maven XSD declarations:

```xml
<block
  xmlns="http://blockml.org/schema/block"
  xmlns:bml="http://blockml.org/schema/bml"
  xmlns:data="http://blockml.org/schema/data"
  xmlns:core="com.machineblocks.core"
  xmlns:type="com.machineblocks.type"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="
    http://blockml.org/schema/block
        https://blockml.org/schemas/core/block.xsd
    http://machineblocks.com/schema/core
        https://machineblocks.com/schemas/core/core.xsd
    http://machineblocks.com/schema/bricks
        https://machineblocks.com/schemas/bricks/bricks.xsd
  ">
```

**Namespace URL Konventionen:**

```text
BlockML Core (Sprach-Namespaces):
  http://blockml.org/schema/block    ← Dokument-Root (default xmlns)
  http://blockml.org/schema/bml      ← bml: Direktiven
  http://blockml.org/schema/data     ← data: Custom Data
  http://blockml.org/schema/service  ← org.blockml.service.*

MachineBlocks (Domain-Namespaces):
  http://machineblocks.com/schema/core        ← MB Core, NativeBlock, Set
  http://machineblocks.com/schema/bricks      ← com.machineblocks.bricks.*
  http://machineblocks.com/schema/calibration ← com.machineblocks.calibration.*

FQN-Referenz-Namespaces:
  xmlns:core="com.machineblocks.core"         ← <core:NativeBlock />
  xmlns:type="com.machineblocks.type"         ← type="type:Size3D"
  xmlns:bricks="com.machineblocks.bricks"     ← <bricks:Standard />
  xmlns:cal="com.machineblocks.calibration"   ← <cal:Calibrator />
```

**catalog.xml für lokale XSD-Auflösung:**

IDEs nutzen eine Catalog-Datei im Projekt-Root für offline XSD-Auflösung statt Remote-Download:

```xml
<!-- catalog.xml -->
<catalog xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog">
  <uri name="http://blockml.org/schema/block"
       uri="./node_modules/@blockml/core/schemas/core/block.xsd" />
  <uri name="http://machineblocks.com/schema/core"
       uri="./node_modules/@machineblocks/mbom/schemas/machineblocks/core.xsd" />
  <uri name="http://machineblocks.com/schema/bricks"
       uri="./node_modules/@machineblocks/mbom/schemas/machineblocks/bricks.xsd" />
</catalog>
```

XSD-Dateien werden als Teil der npm-Packages ausgeliefert.

```text
xmlns:bml   — required when using bml:* directives
xmlns:data  — required when using data:* attributes
xmlns:type  — required when using domain-specific types (e.g. type:Size3D)
xmlns:*     — domain namespaces for Block type references
```

### Member Namespace

All Members — Properties, Aggregations, Associations, and Capabilities — share a single namespace per Block. Names must be unique across all member types. A parse-time error is raised for duplicates.

### Conventions

**Member declaration order:** within `<properties>`, `<aggregations>`, and `<associations>`, child elements are mapped to `members[]` in **XML document order**. The parser must not reorder. Order is significant for render targets and for StructType array literals (`size="[4,2,3]"`). See `12_bom_object_model.md` — Member Declaration Order.

**`<aggregations>`** — Domain base types declare inherited aggregations in BML (e.g. `_presets` on `Block.bml`, `_parts` on `CompositeBlock.bml`). The parser stores **declared** members only; inherited members resolve at validate via `baseType` chain. Omit `<aggregations>` on user blocks when the inherited set suffices.

`_presets` on `com.machineblocks.core.Block` and `_parts` on `com.machineblocks.core.CompositeBlock` (declared in framework BML):

```text
_presets (Block):
  name:    _presets
  type:    com.machineblocks.core.Block[]

_parts (CompositeBlock):
  name:    _parts
  type:    com.machineblocks.core.Block[]
  default: true
```

**`<composition>`** — when no `aggregation` attribute is specified and the effective members include a single default aggregation, the Composition fills that aggregation. For CompositeBlocks this is typically inherited `_parts`. Sets require explicit `aggregation=` for `_presets`, `_parts`, and `_steps`. If multiple aggregations exist and none is marked `default="true"`, the `aggregation` attribute is required — the compiler reports an error if it is missing.

### Minimal Block Example

```xml
<block xmlns="http://blockml.org/schema/block"
       xmlns:bricks="com.machineblocks.bricks">

  <name>Wall</name>
  <type>com.martianmicro.anyclosure.Wall</type>
  <baseType>com.machineblocks.core.Block</baseType>
  <version>1.0.0</version>

  <composition>
    <bricks:StandardBrick
        id="bottom"
        version="1.0.0"
        size="${ [size[0], size[1], size[2] - 1] }"
        recess="true"
        tongue="true"
        recessWallGaps="x+" />

    <bricks:StandardBrick
        id="top"
        version="1.0.0"
        size="${ [size[0], size[1], 1] }"
        offset="${ [0, 0, size[2] - 1] }"
        recessWallGaps="x+"
        baseCutoutType="groove" />
  </composition>

</block>
```

### Full Block Example

```xml
<block xmlns="http://blockml.org/schema/block"
       xmlns:bricks="com.machineblocks.bricks">

  <name>Wall</name>
  <type>com.martianmicro.anyclosure.Wall</type>
  <baseType>com.machineblocks.core.Block</baseType>
  <version>1.0.0</version>

  <properties>
    <!-- Native properties with non-default values -->
    <property name="size"      type="Size3D"       defaultValue="[1, 8, 8]" />
    <property name="baseColor" type="Color"        defaultValue="#303D4E" />
    <property name="assembly"  type="AssemblyMode" defaultValue="Merged" />

    <!-- Custom properties -->
    <property name="wallThickness" type="Integer" defaultValue="1">
      <documentation>Thickness of the wall in grid units.</documentation>
    </property>
  </properties>

  <composition>
    <bricks:StandardBrick
        id="bottom"
        size="${ [size[0], size[1], size[2] - 1] }"
        recess="true"
        tongue="true"
        recessWallGaps="x+" />

    <bricks:StandardBrick
        id="top"
        size="${ [size[0], size[1], 1] }"
        offset="${ [0, 0, size[2] - 1] }"
        recessWallGaps="x+"
        baseCutoutType="groove" />
  </composition>

</block>
```

---

## Members

### Properties

Properties are typed parameters of the Block. Three kinds exist:

**System properties** are defined on `org.blockml.core.Block` — notably `id` (instance identity). System-relevant: dedicated compiler/validator/renderer handling. Not custom properties. See `00_bom_core.md` — System Properties.

**Domain native properties** are defined in `com.machineblocks.core.Block` and its base types. They have dedicated SCAD getters (`mb_param_size()`, etc.) and are listed in `09_mbom_properties.yml`.

**Custom properties** are defined inline in the Block definition. They generate generic SCAD getters (`mb_param(config, settings, "wallThickness", 1)`).

Native and custom properties use the same `<property>` element. The compiler determines native vs. custom by checking `09_mbom_properties.yml`. Native properties only need to be declared when their default value differs from the core default. System properties like `id` are set as XML attributes on composition instances — not declared in `<properties>`.

### Type Resolution

Unqualified type names (no namespace prefix) resolve to `org.blockml.type.*` — the BOM Core primitives:

```text
Float    → org.blockml.type.Float
Integer  → org.blockml.type.Integer
String   → org.blockml.type.String
Boolean  → org.blockml.type.Boolean
Array<T> → org.blockml.type.Array<T>
```

Domain-specific types require an explicit namespace prefix declared via `xmlns`:

```xml
xmlns:type="com.machineblocks.type"

<property name="size"      type="type:Size3D"         defaultValue="[1, 1, 3]" />
<property name="baseColor" type="type:Color"           defaultValue="#EAC645" />
<property name="cutout"    type="type:BaseCutoutType"  defaultValue="standard" />

<!-- Primitives — no prefix needed -->
<property name="text"      type="String"  defaultValue="" />
<property name="pillars"   type="Boolean" defaultValue="true" />
<property name="textSize"  type="Integer" defaultValue="9" />
```

There is no implicit fallback to the baseType's namespace. If a type cannot be resolved, the compiler emits `BML_UNKNOWN_TYPE`.

### Enum Types vs. Suggestions

**Enum types** are formally defined EnumType blocks with a fixed set of values in `_values`. The editor renders them as a **SelectBox**. The compiler validates values against the enum definition. `<suggestions>` on an enum property is an error:

```xml
<!-- Enum type — SelectBox, validated -->
<property name="baseCutoutType" type="type:BaseCutoutType" defaultValue="standard" />
<!-- value literal (matches enum instance value="standard" / id STANDARD) -->

<property name="baseCutoutType" type="type:BaseCutoutType" defaultValue="STANDARD" />
<!-- short id form — FQN:: prefix omitted because property type is BaseCutoutType -->

<!-- equivalent qualified id reference -->
<property name="baseCutoutType" type="type:BaseCutoutType"
          defaultValue="com.machineblocks.type.BaseCutoutType::STANDARD" />
<!-- No <suggestions> allowed → BML_SUGGESTIONS_ON_ENUM -->
```

When the property `type` is an EnumType, `defaultValue` and instance attribute values may use `{EnumTypeFQN}::{valueId}` or the short form `{valueId}` only. See `17_type_system_bml.md` — EnumType.

**Suggestions** are hints for free-text properties — the author can enter any value. The editor renders them as a **Combobox**. No compiler validation of suggested values:

```xml
<!-- Free-text with suggestions — Combobox, not validated -->
<property name="textFont" type="String" defaultValue="RBNo3.1 Black">
  <suggestions>
    <suggestion value="Creato Display"  label="Creato Display" />
    <suggestion value="RBNo3.1 Black"   label="RBNo3.1 Black" />
  </suggestions>
</property>
```

**Computed default values:** `defaultValue` may be an Expression referencing other Properties of the same Block. Cycle detection applies — see `10_expression_language.md`.

```xml
<property name="numberOfSamples" type="Integer" defaultValue="5" />
<property name="labelSize"       type="Integer" defaultValue="5" />
<property name="size"            type="type:Size3D"
          defaultValue="${ [#math.max(2 * numberOfSamples + 1, labelSize), 12, 2] }" />
```

**Map-type and Object-type properties — JSON Object syntax is mandatory:**

Whenever a value is semantically a structured object — a set of named attributes — it **must** be written as a JSON Object in BML. Using arrays `[...]` as a substitute for objects is not permitted, even if the target language (e.g. SCAD) uses arrays internally.

```xml
<!-- CORRECT: Object with named keys -->
sizeMod="${ {'z+': -0.5} }"
baseAdjustment="${ {'y': 0.11} }"
baseCrop="${ {'xy': -0.5} }"
connectors="${ [{ face: 'x-', axis: 'z', type: 'female' }] }"

<!-- WRONG: Array as object substitute — not allowed in BML -->
sizeMod="${ [['z+', -0.5]] }"                      <!-- ✗ -->
connectors="${ [['x-', 'z', 'female']] }"           <!-- ✗ -->
```

The SCAD BlockProcessor translates JSON Objects to SCAD's internal array format. This translation is the Processor's responsibility — the BML author never writes SCAD-style arrays for structured data.

**The rule:** if the value has named attributes (face, axis, type, key, value...) it is an Object and must use `{ }` syntax. Only truly homogeneous sequences without named structure use array `[ ]` syntax.

### Aggregations

Aggregations describe ownership relationships. An Aggregation defines that a Block can contain zero or more child objects of a given type.

For MachineBlocks Blocks, `_presets` and `_parts` are inherited from the base type chain — they do not need to be redeclared. Declare `<aggregations>` only when adding aggregations beyond the inherited set:

```xml
<!-- Set: _steps beyond inherited _presets and _parts -->
<aggregations>
  <aggregation name="_steps" type="com.machineblocks.core.Step[]" />
</aggregations>
```

```text
name    — member name (unique within the Block's member namespace)
type    — child type: unqualified Sub-Block name (same file), FQN, prefixed type, _self, or type with occurrence brackets
default — boolean; marks the default aggregation for bare <composition>
```

**Member visibility** is determined by naming convention: names starting with `_` are hidden (internal); all other names are public.

**Type notation** — cardinality is part of the type, not a separate attribute:

```text
Block         →  0..1
Block[]       →  0..n
Block[1..1]   →  1..1
Block[1..]    →  1..n
Block[3]      →  0..3
Block[1..3]   →  1..3
```

**`_self`** — refers to the current effective Block type, resolved after inheritance:

```xml
<association name="parent"   type="_self" />
<association name="children" type="_self[]" />
```

**ServiceBlock Aggregations** bind named service beans into the Block. Once declared, the bean is accessible in Expressions via `@beanName`. The `scope` attribute controls visibility to child Blocks:

```xml
<aggregations>
  <!-- local: only accessible in this Block (default) -->
  <aggregation name="_fmt"
               type="org.blockml.service.Formatter"
               beanName="fmt"
               scope="local" />

  <!-- context: passed down to all child Blocks in Compositions, overridable -->
  <aggregation name="_data"
               type="org.blockml.service.JSONModel"
               beanName="data"
               scope="context" />
</aggregations>
```

`scope="context"` beans are resolved by walking up the Composition hierarchy — a child Block sees the nearest `@data` with `scope="context"` in any ancestor.

### Associations

Associations describe loose references without ownership. Defined for future use.

```xml
<associations>
  <association name="targetDevice"
               type="com.electronics.core.Component" />
</associations>
```

### Capabilities

Capabilities describe how a Block communicates. Like Properties, they are declared with a name and a class (FQN). Their value in a Composition is the address or binding — set as an attribute on the child Block instance, just like a Property value.

> **Capability package TBD** — placeholder `org.blockml.capability.*`. Candidate: `bom.foundation`.

```xml
<capabilities>

  <!-- AsyncInbound: receives a message asynchronously -->
  <capability name="resize"
              type="org.blockml.capability.AsyncInbound"
              payloadType="com.myDomain.ResizePayload">
    <documentation>Resize the block to the given dimensions.</documentation>
  </capability>

  <!-- AsyncInbound with optional returnType (for replyTo) -->
  <capability name="query"
              type="org.blockml.capability.AsyncInbound"
              payloadType="com.myDomain.QueryPayload"
              returnType="com.myDomain.QueryResult">
    <documentation>Query and receive an async reply.</documentation>
  </capability>

  <!-- AsyncOutbound: sends a message asynchronously -->
  <capability name="resized"
              type="org.blockml.capability.AsyncOutbound"
              payloadType="com.myDomain.ResizedPayload">
  </capability>

  <!-- Sync: callable within Expressions only, returnType required -->
  <capability name="computeArea"
              type="org.blockml.capability.Sync"
              payloadType="Array&lt;Integer&gt;"
              returnType="Integer">
    <documentation>Returns width * height.</documentation>
  </capability>

</capabilities>
```

**Payload type forms:**

```text
org.blockml.type.Integer            — primitive
com.myDomain.MyClass             — Object (named fields)
Array&lt;Integer&gt;             — Array of primitives  (XML-escaped: Array<Integer>)
Array&lt;com.myDomain.MyClass&gt; — Array of objects
```

Unqualified type names resolve against the domain's default type namespace (determined by the Block's `baseType`).

**`AsyncInbound`** and **`AsyncOutbound`**: `returnType` is optional (for async reply via `replyTo`).
**`Sync`**: `returnType` is required. No address — only callable within Expressions.

**Hidden Capabilities** — names starting with `_` are internal: cannot be bound from outside the Block's Composition. Accessible within the Block's own Expressions and internal Compositions only.

---

## Composition

A Composition fills an Aggregation with concrete child Block instances. It is the internal structure of a Composite Block.

```text
aggregation   — name of the Aggregation to fill (optional if only one exists)
export        — optional; export="true" exposes children with static id for {EnclosingBlockFQN}::{id} references
```

Child elements inside `<composition>` are Block instances. Each instance:

```text
Tag name      — class name (with namespace prefix)
id            — **meta property** on every Block instance. Part ID for composition identity (parentId::partId). Not declarable as `<property name="id">`.
                Required when referenced (appliedPresets targets, Step.part, …) or on bml:each elements (literal or Expression).
                Omitted on anonymous static children → auto-ID after directive expansion. Not a custom property.
renderGroup   — optional, fallback = id
namespace     — optional, fallback = id
version       — **required** on external block references (types from another file);
                omitted only on same-document Sub-Block references. Missing → BML_MISSING_VERSION.
                See `12_bom_object_model.md`.
(attributes)  — any Member value of the referenced Block type (camelCase)
```

Member values on child instances may be literals or Expressions.

### Expressions in Compositions

> **V1 scope:** `@bean` calls, Model bindings (`@model:`), and Capability linking are fully specified below but **not implemented in V1**. The V1 compiler supports property references, `#built-in` calls, and `bml:` directives (including `bml:with` for local scope).

Property values:

```xml
<!-- Array literal (pure) -->
size="[1, 8, 9]"

<!-- Object literal (pure) -->
config="{mode: 'groove', depth: 2}"

<!-- Expression: property reference -->
size="${ [size[0], size[1], size[2] - 1] }"

<!-- Expression: object with property reference and model binding -->
config="${ {mode: baseCutoutType, label: @myModel:/config/label} }"

<!-- Expression: built-in service call -->
size="${ [size[0], size[1], #math.max(size[2] - 1, 0)] }"

<!-- Expression: bean call, named parameters (Object payload) -->
label="${ @myFormatter.format(value = size[0], unit = 'mm') }"

<!-- Expression: bean call, object literal (equivalent) -->
label="${ @myFormatter.format({value: size[0], unit: 'mm'}) }"

<!-- Expression: model binding (absolute) -->
label="${ @myModel:/config/label }"

<!-- Expression: model binding (relative — requires binding context on parent aggregation) -->
label="${ @myModel:label }"

<!-- Expression: ternary -->
baseCutoutType="${ size[2] > 2 ? 'groove' : 'standard' }"
```

Capability values:

```xml
<!-- Absolute URI → AsyncOutbound routing -->
<ac:MyBlock onResized="stud://enclosure/blocks/resized" />

<!-- Relative path → context-resolved (TBD) -->
<ac:MyBlock onResized="/blocks/resized" />

<!-- Capability linking: AsyncOutbound → AsyncInbound, or Sync → Sync -->
<ac:MyBlock onResized="${ @myService.resizeHandler }" />

<!-- Dynamic address: Sync Capability returns the address String -->
<ac:MyBlock onResized="${ @myService.getAddress() }" />
```

See `00_bom_core.md` — Expression System for the full specification.

### Sharing Values Between Siblings

Sibling child Blocks within the same Composition share computed values via **`bml:with`** on a common ancestor — typically `<composition>` or a wrapping `<bml:block>`:

```xml
<composition bml:with="totalHeight = ${ size[2] }">
  <SomeBlock ... />
  <OtherBlock size="${ [1, 1, totalHeight - 1] }" ... />
</composition>
```

Variables from `bml:with` are visible to the element and all descendants. There is no separate registry mechanism.

---

## Custom Data (`data:`)

The `data:` namespace allows arbitrary key-value metadata to be attached to Block definitions and Composition instances. The pattern is borrowed from **SAP UI5 customData** — in UI5 views, `data:myVal` on a Control or Element sets a customData key/value pair on that element. BlockML applies the same idea to Blocks via the `_customData` aggregation on `org.blockml.core.Block`.

Custom data has no effect on compilation or rendering — it is purely for tooling, editors, documentation, and CI systems.

### Namespace Declaration

```xml
<block xmlns="http://blockml.org/schema/block"
       xmlns:bml="http://blockml.org/schema/bml"
       xmlns:data="http://blockml.org/schema/data"
       xmlns:bricks="com.machineblocks.bricks">
```

### Usage

On a Block definition:

```xml
<block xmlns="http://blockml.org/schema/block"
       xmlns:data="http://blockml.org/schema/data">
  <name>Wall</name>
  <type>com.martianmicro.anyclosure.Wall</type>
  <baseType>com.machineblocks.core.Block</baseType>
  <version>1.0.0</version>
  <data:category>structural</data:category>
  <data:tags>enclosure wall</data:tags>
  <data:author>Jan Knoeller</data:author>
  ...
</block>
```

On a Composition instance:

```xml
<bricks:StandardBrick
    id="strip"
    size="[2, 4, 3]"
    data:role="base-strip"
    data:group="calibration-row-0" />
```

### BOM Representation

`data:*` attributes are UI5-style syntactic sugar for the implicit `_customData` Aggregation on every Block. The parser expands them automatically:

```text
data:role="structural"  →  CustomData { key: "role", value: "structural" }
data:tags="wall enclosure" →  CustomData { key: "tags", value: "wall enclosure" }
```

All values are strings. No type validation. No schema. No rendering effect.

---

## BML Directives

BML Directives are special attributes in the `bml:` namespace that control structure and flow within a Composition. They follow the **Thymeleaf model** — attributes on the element they apply to. Whether a directive is pre-processed at compile time or translated into target-specific constructs is the BlockProcessor's decision.

`data:*` is not part of this mechanism — it follows the **UI5 customData model** (see Custom Data section above).

### Directive Placement

| Attribute / namespace | Allowed on | Notes |
|---|---|---|
| `data:*` | Block definitions and Block instances only | Not a `bml:` directive. UI5-style `_customData` shorthand for `org.blockml.core.Block._customData`. |
| `bml:with` | `<composition>`, `<bml:block>`, Block instances | Local variable scope |
| `bml:each` | `<bml:block>`, Block instances | Loop |
| `bml:if`, `bml:unless` | `<bml:block>`, Block instances | Conditional |
| `id` | Block instances | **System property** — not a directive, not a custom property. `id="${ expr }"` for dynamic IDs |

There is no `bml:id` directive.

### `bml:each` — Loop

```xml
<!-- Numeric loop: i runs from 0 to numberOfSamples-1 -->
<bricks:StandardBrick
    bml:each="i : ${ numberOfSamples }"
    offset="${ [2 * i, 0, 0] }"
    studDiameterAdjustment="${ valueStart + i * valueStep }" />

<!-- Numeric loop with stat variable -->
<bricks:StandardBrick
    bml:each="i, stat : ${ numberOfSamples }"
    offset="${ [2 * stat.index, 0, 0] }"
    baseCutoutType="${ stat.last ? 'groove' : 'none' }" />

<!-- Collection loop from model -->
<bricks:StandardBrick
    bml:each="item, stat : ${ @myModel:/items }"
    size="${ item.size }"
    offset="${ [stat.index * 2, 0, 0] }" />
```

**Stat variables:**

```text
stat.index   — 0-based position
stat.count   — 1-based position
stat.size    — total count
stat.first   — boolean
stat.last    — boolean
stat.even    — boolean (0-based)
stat.odd     — boolean (0-based)
```

For numeric loops, `i` equals `stat.index`. `stat.size` equals the numeric value. The stat variable is optional.

### `bml:if` and `bml:unless` — Conditional

```xml
<!-- Include only when condition is true -->
<bricks:StandardBrick
    bml:if="${ numberOfSamples > 3 }"
    size="[2, 2, 1]" />

<!-- Include only when condition is false -->
<bricks:StandardBrick
    bml:unless="${ compact }"
    size="[4, 4, 1]" />
```

### `bml:block` — Virtual Container

Produces no Block output itself — groups child Blocks for shared directives:

```xml
<!-- Loop over a group of Blocks -->
<bml:block bml:each="i, stat : ${ numberOfSamples }">
    <Calibrator.Base
        offset="${ [0, i * -3, 0] }"
        label="${ rows[i].label }"
        valueStart="${ rows[i].valueStart }"
        valueStep="${ rows[i].valueStep }" />
    <Calibrator.StudDiameter
        offset="${ [0, i * -3, 0] }"
        valueStart="${ rows[i].valueStart }"
        valueStep="${ rows[i].valueStep }" />
</bml:block>

<!-- Conditional group -->
<bml:block bml:if="${ showCorners }">
    <ac:Corner offset="[0, 0, 0]"  direction="West" />
    <ac:Corner offset="[12, 0, 0]" direction="East" />
</bml:block>
```

### Dynamic Instance ID

Use the `id` meta property for dynamic IDs in loops — not a directive:

```xml
<bricks:StandardBrick
    bml:each="i : ${ numberOfSamples }"
    id="${ 'sample_' + i }"
    offset="${ [2 * i, 0, 0] }" />
```

### `bml:with` — Local Variable Scope

Defines local variables within the scope of an element and its children. Variables can reference Properties and other expressions. Own Properties can be overridden within the local scope:

```xml
<!-- Simple local variable -->
<bricks:Standard
    bml:with="halfSize = ${ size[0] / 2 }"
    size="${ [halfSize, size[1], size[2]] }" />

<!-- Override own property within scope -->
<bml:block bml:with="numberOfSamples = ${ numberOfSamples + 1 }">
  <Base numberOfSamples="${ numberOfSamples }" />
</bml:block>

<!-- Multiple variables — comma-separated -->
<bml:block bml:with="w = ${ size[0] }, h = ${ size[2] - 1 }">
  <core:NativeBlock size="${ [w, size[1], h] }" />
</bml:block>

<!-- Share values between sibling instances (replaces former registry pattern) -->
<composition bml:with="totalHeight = ${ size[2] }">
  <SomeBlock ... />
  <OtherBlock size="${ [1, 1, totalHeight - 1] }" ... />
</composition>
```

**Allowed on:**
```text
<composition>     — scope for all direct children
<bml:block>       — scope for block's children
Block instances   — scope for that instance only (properties on the element)
```

**Scope rules:**
```text
- Variables visible only within the element and its descendants
- Shadows outer variables of the same name
- Can reference Properties of the current Block
- Can override Properties within the local scope
- Evaluated left-to-right — later variables can reference earlier ones
```

### `data:` — Custom Metadata Restriction

`data:*` attributes are only allowed on Block definitions and Block instances (elements extending `org.blockml.core.Block`). They follow the **UI5 customData pattern** — not the Thymeleaf directive model and not `bml:` directives. They must not appear on `<aggregation>`, `<capability>`, or other non-Block elements.

---

## Sub-Blocks

Sub-Blocks are Block definitions nested inside a parent Block. They are analogous to static inner classes in Java — they belong to the parent Block conceptually and share its FQN prefix. Sub-Blocks are declared in a `<subBlocks>` section within the parent `<block>` document.

### Format

Sub-Blocks use the same format as the parent Block — all fields as child elements. The only difference: `<type>` is omitted. The FQN is resolved automatically from the parent Block's FQN + the Sub-Block's `<name>`.

`<baseType>` is required on Sub-Blocks, just like on the parent Block.

```xml
<subBlocks>
  <block>
    <name>Base</name>
    <baseType>com.machineblocks.core.Block</baseType>
    <version>1.0.0</version>
    <properties>...</properties>
    <composition>...</composition>
  </block>
</subBlocks>
```

### FQN Auto-Resolution

```text
Parent FQN:  com.machineblocks.calibration.Calibrator
Sub-Block:   <name>Base</name>
→ FQN:       com.machineblocks.calibration.Calibrator.Base

Sub-Block:   <name>StudDiameter</name>
→ FQN:       com.machineblocks.calibration.Calibrator.StudDiameter
```

`<type>` is never declared on Sub-Blocks — it is always derived. Sub-Blocks can be nested recursively:

```text
com.machineblocks.calibration.Calibrator.Base.Strip
```

### Short-Name Reference in Compositions

When a composition child element has **no namespace prefix** (PascalCase tag name only), the parser resolves `typeFqn` in this order:

The **same resolution order** applies to `type="..."` on `<property>`, `<aggregation>`, `<capability>`, and related member declarations when the value is an unqualified PascalCase name (e.g. `type="Dependency"` on an aggregation when `Dependency` is a Sub-Block in the same file).

```text
1. subBlocks[] of the innermost containing BlockDefinition (same BML document)
2. Walk up the parent chain — parent Sub-Block → … → root Block subBlocks[]
3. Inherited subBlocks from the baseType chain (framework bases — see below)
4. xmlns prefix → package FQN (bricks:Standard, type:Size3D)
5. TypeRegistry global lookup
```

Stage [5] stores the **resolved FQN** on the BOM node (e.g. `org.blockml.core.Library.Dependency`). Authors may write the short name in BML.

**Same document — aggregation example (`Library.bml`):**

```xml
<aggregations>
  <aggregation name="_dependencies" type="Dependency[]" />
</aggregations>
<subBlocks>
  <block><name>Dependency</name>...</block>
</subBlocks>
```

**Same document — composition example:**

```xml
<!-- Inside Calibrator's composition: -->
<Base id="base_stud" offset="[0, 0, 0]" ... />
<StudDiameter id="samples_stud" ... />
```

**Inherited framework Sub-Blocks:** A block with `baseType="org.blockml.core.Library"` (e.g. `BricksLibrary`) automatically resolves `Dependency`, `TypeRef`, `BlockRef`, … without prefix — they are Sub-Blocks of `org.blockml.core.Library`, inherited via the baseType chain. Authors do not redeclare them in each library file.

```xml
<!-- BricksLibrary.mbml — no xmlns needed for entry types -->
<composition aggregation="_dependencies">
  <Dependency ref="com.machineblocks.core.CoreLibrary" version="3.0.0" />
</composition>
```

When referencing a Sub-Block from **outside** the parent Block, use the full FQN:

```xml
xmlns:cal="com.machineblocks.calibration"
...
<cal:Calibrator.Base ... />
```

### FunctionBlock Sub-Blocks

A Sub-Block with `baseType="org.blockml.service.FunctionBlock"` binds target-language function implementations to Sync Capabilities via `<implementation type="...">` — using **`org.blockml.language.*`** FQNs, not a `language` attribute.

Two implementation types are supported in V1:

**`type="org.blockml.language.OpenSCAD"`** — OpenSCAD function(s) written directly in the BML. Each Capability has exactly one main function (whose name matches the Capability name) and zero or more helper functions. The compiler automatically prefixes all function names with the block FQN — so names are written short and clean in the BML:

```xml
<block>
  <name>Utils</name>
  <baseType>org.blockml.service.FunctionBlock</baseType>
  <version>1.0.0</version>

  <capabilities>
    <capability name="formatValue"
                type="org.blockml.capability.Sync"
                payloadType="org.blockml.type.Float"
                returnType="org.blockml.type.String">
      <documentation>Removes leading zero: 0.1 → ".1", -0.2 → "-.2"</documentation>
      <implementation type="org.blockml.language.OpenSCAD"><![CDATA[
// Main function — name must match capability name
function formatValue(x) =
    replaceZeroDot(str(bom__com__bom__service__Math__round_n(x, 1)));

// Helper functions — any names, also prefixed by compiler
function replaceZeroDot(s, i = 0) =
    (i >= len(s) - 1) ? s :
    (s[i] == "0" && s[i + 1] == ".")
        ? str(strPrefix(s, i), ".", replaceZeroDot(strSuffix(s, i + 2), 0))
        : replaceZeroDot(s, i + 1);

function strPrefix(s, k, i = 0) =
    (i >= k) ? "" : str(s[i], strPrefix(s, k, i + 1));

function strSuffix(s, k, i = 0) =
    (k + i >= len(s)) ? "" : str(s[k + i], strSuffix(s, k, i + 1));
      ]]></implementation>
    </capability>
  </capabilities>
</block>
```

**`type="org.blockml.language.TypeScript"`** — TypeScript arrow function. In V1, compile-time execution only: when all call arguments are literals, the compiler executes the function in Node.js and emits the result as a literal. Runtime transpilation to OpenSCAD is deferred.

The `<implementation>` element is a child of `<capability>`. One `<implementation>` per Capability. The **`type`** attribute is required and must be an `org.blockml.language.*` FQN.

### Visibility

Sub-Blocks are full BOM objects with their own FQN and can be referenced from outside the parent Block via full FQN. External use is possible but uncommon — the naming convention makes their belonging clear.

### Calibrator Example

```xml
<block xmlns="http://blockml.org/schema/block">

  <name>Calibrator</name>
  <type>com.machineblocks.calibration.Calibrator</type>
  <baseType>com.machineblocks.core.Block</baseType>
  <version>1.0.0</version>

  <properties>
    <property name="numberOfSamples" type="Integer" defaultValue="5" />
    <property name="font"            type="String"  defaultValue="Liberation Sans" />
    <property name="fontSize"        type="Float"   defaultValue="3" />
    <property name="labelSize"       type="Integer" defaultValue="5" />
    <property name="valueStart"      type="Float"   defaultValue="0.0" />
    <property name="valueStep"       type="Float"   defaultValue="0.1" />
  </properties>

  <subBlocks>

    <!-- Sub-Block: Calibrator.Base -->
    <!-- FQN: com.machineblocks.calibration.Calibrator.Base -->
    <block name="Base">
      <properties>
        <property name="label"           type="String"  defaultValue="" />
        <property name="numberOfSamples" type="Integer" defaultValue="5" />
        <property name="valueStart"      type="Float"   defaultValue="0" />
        <property name="valueStep"       type="Float"   defaultValue="0.1" />
        <property name="font"            type="String"  defaultValue="Liberation Sans" />
        <property name="fontSize"        type="Float"   defaultValue="3" />
        <property name="labelSize"       type="Integer" defaultValue="5" />
      </properties>
      <composition>
        <!-- Base strip -->
        <bricks:StandardBrick
            id="strip"
            size="${ [2 * numberOfSamples + 1, 1, 1] }"
            baseCutoutType="none"
            studs="false" />

        <!-- Label block -->
        <bricks:StandardBrick
            id="label"
            size="${ [labelSize, 1, 1] }"
            offset="${ [0, 1, 0] }"
            text="${ label }"
            textFont="${ font }"
            textSize="${ fontSize }"
            baseCutoutType="none"
            studs="false" />

        <!-- Value label blocks -->
        <bricks:StandardBrick
            bml:each="i, stat : ${ numberOfSamples }"
            id="${ 'val_' + stat.index }"
            size="[1, 1, 1]"
            offset="${ [2 * (i - #math.floor(0.5 * numberOfSamples)), -1, 0] }"
            text="${ #numbers.formatDecimal(valueStart + i * valueStep, 0, '.', 1) }"
            textFont="${ font }"
            textSize="${ fontSize }"
            baseCutoutType="none"
            studs="false" />
      </composition>
    </block>

    <!-- Sub-Block: Calibrator.StudDiameter -->
    <!-- FQN: com.machineblocks.calibration.Calibrator.StudDiameter -->
    <block name="StudDiameter">
      <properties>
        <property name="numberOfSamples" type="Integer" defaultValue="5" />
        <property name="valueStart"      type="Float"   defaultValue="0" />
        <property name="valueStep"       type="Float"   defaultValue="0.1" />
      </properties>
      <composition>
        <bricks:StandardBrick
            bml:each="i : ${ numberOfSamples }"
            id="${ 's_' + i }"
            size="[1, 1, 1]"
            offset="${ [2 * (i - #math.floor(0.5 * numberOfSamples)), 0, 0] }"
            studDiameterAdjustment="${ valueStart + i * valueStep }"
            baseCutoutType="none" />
      </composition>
    </block>

  </subBlocks>

  <composition>
    <!-- Four calibration rows via bml:block loop -->
    <bml:block bml:each="row, stat : ${ rows }">
      <Base
          id="${ 'base_' + stat.index }"
          offset="${ [0, stat.index * -3, 0] }"
          label="${ row.label }"
          valueStart="${ row.valueStart }"
          valueStep="${ row.valueStep }"
          numberOfSamples="${ numberOfSamples }"
          font="${ font }"
          fontSize="${ fontSize }"
          labelSize="${ labelSize }" />
      <StudDiameter
          id="${ 'samples_' + stat.index }"
          offset="${ [0, stat.index * -3, 0] }"
          numberOfSamples="${ numberOfSamples }"
          valueStart="${ row.valueStart }"
          valueStep="${ row.valueStep }" />
    </bml:block>
  </composition>

</block>
```

### Visibility

Sub-Blocks have their own FQN and can be referenced from outside the parent Block via full FQN. External use is possible but uncommon — the naming convention makes their belonging clear.

---

## MachineBlocks Set Definition

A MachineBlocks Set is a Block whose `baseType` is `com.machineblocks.core.Set`. It uses the standard `<block>` document type — there is no separate root element for Sets.

A Set uses three conventional Aggregations — `_presets` and `_parts` inherited from the base type chain, `_steps` declared on Set:

```text
_presets    — block palette (configurations referenced by appliedPresets on _parts entries)
_parts      — placed block instances (direction, offset, appliedPresets; id becomes SCAD instance id)
_steps      — assembly order (optional; defaults to document order of _parts)
```

### Structure

```xml
<block xmlns="http://blockml.org/schema/block"
       xmlns:core="com.machineblocks.core"
       xmlns:ac="com.martianmicro.anyclosure">

  <name>DefaultEnclosure</name>
  <type>com.martianmicro.anyclosure.DefaultEnclosure</type>
  <baseType>com.machineblocks.core.Set</baseType>
  <version>1.0.0</version>

  <properties>
    <property name="baseColor"      type="Color"        defaultValue="#EAC645" />
    <property name="highlightColor" type="Color"        defaultValue="#55AB68" />
    <property name="assembly"       type="AssemblyMode" defaultValue="Merged"  />
  </properties>

  <!-- Block palette: inherited _presets -->
  <composition aggregation="_presets">
    <ac:Floor  id="floor"  size="[16, 16, 1]" />
    <ac:Corner id="corner" size="[4, 4, 9]"   />
    <ac:Wall   id="wall"   size="[1, 8, 9]"   />
    <ac:Lid    id="lid"    size="[16, 16, 1]" />
  </composition>

  <!-- Placed instances: inherited _parts -->
  <composition aggregation="_parts">
    <ac:Floor id="00001" appliedPresets="floor"  direction="West"  offset="[0, 0, 0]"   />
    <ac:Corner id="00002" appliedPresets="corner" direction="West"  offset="[0, 0, 1]"   />
    <ac:Wall id="00003" appliedPresets="wall"   direction="West"  offset="[0, 4, 1]"   />
    <ac:Corner id="00004" appliedPresets="corner" direction="North" offset="[0, 12, 1]"  />
    <ac:Wall id="00005" appliedPresets="wall"   direction="North" offset="[4, 15, 1]"  />
    <ac:Corner id="00006" appliedPresets="corner" direction="East"  offset="[12, 12, 1]" />
    <ac:Wall id="00007" appliedPresets="wall"   direction="East"  offset="[15, 4, 1]"  />
    <ac:Corner id="00008" appliedPresets="corner" direction="South" offset="[12, 0, 1]"  />
    <ac:Wall id="00009" appliedPresets="wall"   direction="South" offset="[4, 0, 1]"   />
    <ac:Lid id="0000A" appliedPresets="lid"    direction="West"  offset="[0, 0, 10]"  />
  </composition>

  <!-- _steps omitted → assembly order = document order of _parts -->

  <composition aggregation="_steps">
    <core:Step part="00001" />
    <core:Step part="00002" />
    <core:Step part="00003" />
  </composition>

</block>
```

### Step

`com.machineblocks.core.Step` is a **framework Block** (`Step.bml`) — it extends `org.blockml.core.Block`. Used as composition children on Sets:

```text
composition aggregation="_presets"  →  block palette (Floor, Wall, …)
composition aggregation="_parts"  →  placed block instances
composition aggregation="_steps"  →  core:Step instances (optional)
```

`Step` members:

```text
part           — association: references explicit id of a placed instance in _parts
description    — optional human-readable step label
```

When `_steps` is omitted, assembly order equals the document order of `_parts` entries.

### Block Reuse

Because `_presets` and `_parts` are separated, one Block configuration can be referenced by multiple placed instances without duplication:

```xml
<composition aggregation="_presets">
  <ac:Wall id="wall" size="[1, 8, 9]" baseColor="#303D4E" />
</composition>

<composition aggregation="_parts">
  <ac:Wall id="00003" appliedPresets="wall" direction="West"  offset="[0, 4, 1]"  />
  <ac:Wall id="00005" appliedPresets="wall" direction="North" offset="[4, 15, 1]" />
  <ac:Wall id="00007" appliedPresets="wall" direction="East"  offset="[15, 4, 1]" />
  <ac:Wall id="00009" appliedPresets="wall" direction="South" offset="[4, 0, 1]"  />
</composition>
```

### Block Configuration Modes

Three modes, combinable:

```text
Option 1 — Inline:
  All properties defined directly on the instance in _parts.

Option 2 — Preset reference:
  Instance references preset id(s) via appliedPresets.
  Compiler merges preset chain into effective properties.

Option 3 — Preset + inline override:
  appliedPresets as base. Inline properties override individual values.
  Merge order: configProfile < appliedPresets chain < inline property
```

### SCAD Set Output

The SCAD Renderer detects `baseType = com.machineblocks.core.Set` and generates four view submodules:

```text
total     — all instances assembled at their positions
print     — all instances laid out for 3D printing
step      — step-by-step assembly instruction
instance  — single instance in isolation
```

---

## Presets (MachineBlocks)

Presets are **not** a BlockML core feature. MachineBlocks models them as ordinary Block instances in the `_presets` aggregation, referenced via the `appliedPresets` association on any MachineBlocks Block.

Preset merge is compiler logic (`resolveAppliedPresets`, block merge helpers). Customizer JSON output is render-target logic (machineblocks-v3-scad).

A preset block (e.g. `com.machineblocks.bricks.StandardPresets`) is a normal `<block>` with `baseType="com.machineblocks.core.Block"` whose composition fills `_presets` with Block instances of the target type.

### Structure

```xml
<!--
  FQN: com.machineblocks.bricks.StandardPresets
-->
<block
  xmlns="http://blockml.org/schema/block"
  xmlns:type="com.machineblocks.type"
  xmlns:bricks="com.machineblocks.bricks"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="
    http://blockml.org/schema/block
        https://blockml.org/schemas/core/block.xsd
  ">

  <documentation>Standard brick presets for MachineBlocks Standard block.</documentation>

  <name>StandardPresets</name>
  <type>com.machineblocks.bricks.StandardPresets</type>
  <baseType>com.machineblocks.core.Block</baseType>
  <version>3.0.0</version>

  <composition aggregation="_presets" export="true">

    <bricks:Standard id="brick-1x1" name="Brick 1x1" version="3.0.0" size="[1, 1, 3]" />

    <bricks:Standard id="color-red" name="Red" version="3.0.0" baseColor="#D65745" />

    <!-- Composite preset — appliedPresets merges preset chain -->
    <bricks:Standard id="brick-1x1-red"
                     name="Brick 1x1 Red"
                     version="3.0.0"
                     appliedPresets="brick-1x1 color-red" />

    <!-- Composite with own override -->
    <bricks:Standard id="brick-1x1-red-text"
                     name="Brick 1x1 Red MB"
                     version="3.0.0"
                     appliedPresets="brick-1x1-red"
                     text="MB"
                     textColor="#EDF0F1" />

    <!-- Cross-file appliedPresets reference -->
    <bricks:Standard id="brick-2x4-special"
                     name="Brick 2x4 Special"
                     version="3.0.0"
                     appliedPresets="com.myproject.presets.MyPresets::my-base brick-2x4"
                     textColor="#EDF0F1" />

  </composition>

</block>
```

**`id`** — stable kebab-case identifier. Used for references via `appliedPresets` and thumbnail filenames. Must be unique within the enclosing Block's `_presets`. Never changes once published.

**`name`** — human-readable display name. Used in the SCAD Customizer JSON and editor UI. May be renamed without breaking references.

**`appliedPresets`** — space-separated preset ids on any MachineBlocks Block instance. Local ids resolve within the enclosing Block's `_presets`; cross-file entries use `{BlockFQN}::{id}`. Applied left-to-right; later entries override earlier. Own instance properties override all applied presets.

Qualified `{BlockFQN}::{id}` references require the target composition to declare `export="true"` and the target instance to have a **literal static `id`** — see `00_bom_core.md` — Qualified Block Instance References.

Presets can reference other presets — preset instances in `_presets` may themselves carry `appliedPresets`, forming an inheritance chain.

### Preset Reference Syntax

```text
{BlockFQN}::{preset-id}

Example:
  com.machineblocks.bricks.StandardPresets::brick-2x4
```

Requirements for qualified references:

```text
1. Target <composition … export="true">
2. Target instance: literal id (no ${ … }, not bml:each-only)
3. Reference: literal attribute value (not ${ … })
```

Diagnostics: `BML_UNEXPORTED_INSTANCE_REF` · `BML_NON_STATIC_INSTANCE_REF`

### Preset in Compositions

```xml
<!-- Preset only -->
<bricks:Standard version="3.0.0"
    appliedPresets="com.machineblocks.bricks.StandardPresets::brick-2x4" />

<!-- Preset + inline override -->
<bricks:Standard version="3.0.0"
    appliedPresets="com.machineblocks.bricks.StandardPresets::brick-2x4"
    baseColor="#303D4E" />
```

Merge order: `configProfile < appliedPresets chain < inline property`

### Multiple Preset Blocks for the Same Block Type

Different authors or packages can contribute preset blocks for the same Block type:

```text
com.machineblocks.bricks.StandardPresets   ← from @machineblocks/bricks library
com.myproject.presets.MyBrickPresets       ← own additions
```

Both are referenced by their own FQN — no conflict, no registry ambiguity.

**Resolution order** when merging (highest priority first):

```text
1. Own instance properties
2. appliedPresets — applied left-to-right, later entries override earlier
3. Block defaultValues
```

Cycles in `appliedPresets` → `BML_PRESET_CYCLE`.

### SCAD Output

The render target may produce a `.json` file in OpenSCAD Customizer format when compiling a preset block:

```text
BML:   src/com/machineblocks/bricks/presets/StandardPresets.mbml
JSON:  scad/com/machineblocks/bricks/Standard.json
```

The Customizer JSON uses the preset **name** as the key — the human-readable label shown in the OpenSCAD UI.

---

## Config Profiles

Config profiles are MachineBlocks preset blocks (`baseType="com.machineblocks.core.Block"`) that define project-wide hardware or rendering defaults. Each preset instance in `_presets` carries a project ConfigBlock instance (or inherits via `appliedPresets`).

```text
src/config/prusa_pla.bml   — printer + filament profile
src/config/scale_2x.bml    — scale profile
```

Only one config profile is active at a time (set via `bom activate-config`). Merge priority:

```text
configProfile < appliedPresets chain < inline property
```

---

## Library Format (`org.blockml.core.Library`)

A Library groups related Blocks, optional XSD schemas, and dependencies into a publishable unit. Preset blocks are exported as ordinary Block definitions via `_blocks`. Each package directory should contain one Library block at package root. If absent, all BML source files in the directory are treated as public.

**Name (soft convention):** `{Segment}Library` in PascalCase — e.g. `<name>BricksLibrary</name>` for package `com.machineblocks.bricks`. Filename matches block name (`BricksLibrary.mbml`). Not enforced by the compiler.

### Structure

```xml
<!--
  FQN: com.machineblocks.bricks
  Filename: BricksLibrary.mbml
-->
<block xmlns="http://blockml.org/schema/block"
       ...>

  <documentation>MachineBlocks standard brick library.</documentation>

  <name>BricksLibrary</name>
  <type>com.machineblocks.bricks.BricksLibrary</type>
  <baseType>org.blockml.core.Library</baseType>
  <version>3.0.0</version>

  <properties>
    <property name="description" type="String"
              defaultValue="Standard brick types for MachineBlocks" />
  </properties>

  <composition aggregation="_dependencies">
    <Dependency ref="com.machineblocks.core.CoreLibrary" version="3.0.0" />
  </composition>

  <!-- Optional legacy XSD -->
  <composition aggregation="_schemas">
    <Schema ref="bricks.xsd" />
  </composition>

  <composition aggregation="_types">
    <TypeRef ref="types/Size3D.bml" />
    <TypeRef ref="types/Direction.bml" />
  </composition>

  <composition aggregation="_blocks">
    <BlockRef ref="blocks/Standard.mbml" />
    <BlockRef ref="blocks/Plate.mbml" />
    <BlockRef ref="blocks/Tile.mbml" />
    <BlockRef ref="presets/StandardPresets.mbml" />
  </composition>

</block>
```

**`ref` paths** on `TypeRef`, `BlockRef`, and `Schema` are relative to the **library package root** (directory containing the Library block file).

**`_types`** lists exported TypeBlock definitions (StructType, EnumType, …). **`_schemas`** is optional legacy XSD during migration; omit when all types are in BML. A future compiler tool may generate XSD from `_types` instead of requiring authored `.xsd` files.

**Directory structure:**

```text
com.machineblocks.bricks/
  BricksLibrary.mbml       ← Library block (FQN = com.machineblocks.bricks.BricksLibrary)
  bricks.xsd               ← optional legacy XSD
  types/
    Size3D.bml · Direction.bml · …
  blocks/
    Standard.mbml
    Plate.mbml
    Tile.mbml
  presets/
    StandardPresets.mbml
    PlatePresets.mbml
```

Without a Library block: all BML source files in the directory are public (`.bml` by default; `.mbml` in MachineBlocks library trees).

Legacy `library.xml` is **replaced** by the Library block — not supported in V1.

---

## JSON Format (Deferred — TBD)

> **Not in V1.** The V1 compiler parser accepts XML only. This section sketches a possible future subset — specification and implementation are **TBD**.

JSON as a BML authoring format faces fundamental constraints from BlockML's namespace model:

```text
Namespaces          → no element-name types (bricks:StandardBrick); explicit type fields only
bml:* directives    → no attribute-namespace mechanism
data:* _customData   → no equivalent to UI5-style namespaced attributes
Sub-Blocks          → awkward nesting; FQN derivation unclear
Functions (CDATA)   → no inline SCAD/TS bodies
```

A future JSON subset might cover flat preset blocks or simple leaf `<block>` definitions without composition directives — if a mapping can be specified without compromising the BOM model. **No commitment until the mapping is formally defined.**

The examples below are **illustrative drafts only** — not valid V1 input.

### Block Definition (JSON) — Simple Blocks Only

```json
{
  "type": "block",
  "name": "Wall",
  "type": "com.martianmicro.anyclosure.Wall",
  "version": "1.0.0",
  "properties": [
    { "name": "size",          "type": "Size3D",  "defaultValue": [1, 8, 8] },
    { "name": "baseColor",     "type": "Color",   "defaultValue": "#303D4E" },
    { "name": "wallThickness", "type": "Integer", "defaultValue": 1,
      "documentation": "Thickness of the wall in grid units." }
  ],
  "compositions": [
    {
      "children": [
        {
          "type": "com.machineblocks.bricks.StandardBrick",
          "id": "bottom",
          "size": "${ [size[0], size[1], size[2] - 1] }",
          "recess": true,
          "tongue": true,
          "recessWallGaps": "x+"
        },
        {
          "type": "com.machineblocks.bricks.StandardBrick",
          "id": "top",
          "size": "${ [size[0], size[1], 1] }",
          "offset": "${ [0, 0, size[2] - 1] }",
          "baseCutoutType": "groove",
          "recessWallGaps": "x+"
        }
      ]
    }
  ]
}
```

### MachineBlocks Set Definition (JSON)

```json
{
  "type": "block",
  "name": "DefaultEnclosure",
  "type": "com.martianmicro.anyclosure.DefaultEnclosure",
  "baseType": "com.machineblocks.core.Set",
  "version": "1.0.0",
  "properties": [
    { "name": "baseColor",      "type": "Color",        "defaultValue": "#EAC645" },
    { "name": "highlightColor", "type": "Color",        "defaultValue": "#55AB68" },
    { "name": "assembly",       "type": "AssemblyMode", "defaultValue": "Merged"  }
  ],
  "aggregations": [
    { "name": "_steps", "type": "com.machineblocks.core.Step[]" }
  ],
  "compositions": [
    {
      "aggregation": "_presets",
      "children": [
        { "type": "com.martianmicro.anyclosure.Floor",  "id": "floor",  "version": "1.0.0", "size": [16, 16, 1] },
        { "type": "com.martianmicro.anyclosure.Corner", "id": "corner", "version": "1.0.0", "size": [4, 4, 9]   },
        { "type": "com.martianmicro.anyclosure.Wall",   "id": "wall",   "version": "1.0.0", "size": [1, 8, 9]   },
        { "type": "com.martianmicro.anyclosure.Lid",    "id": "lid",    "version": "1.0.0", "size": [16, 16, 1] }
      ]
    },
    {
      "aggregation": "_parts",
      "children": [
        { "type": "com.martianmicro.anyclosure.Floor",  "id": "00001", "appliedPresets": "floor",  "direction": "West",  "offset": [0, 0, 0]   },
        { "type": "com.martianmicro.anyclosure.Corner", "id": "00002", "appliedPresets": "corner", "direction": "West",  "offset": [0, 0, 1]   },
        { "type": "com.martianmicro.anyclosure.Wall",   "id": "00003", "appliedPresets": "wall",   "direction": "West",  "offset": [0, 4, 1]   }
      ]
    }
  ]
}
```

---

## BML→BOM Mapping

The BML→BOM mapping is defined once per root type and applies uniformly to all documents of that type. It is configurable and extensible for new root types.

```text
<block>   → Block mapping rule (all block types)
<device>    → Device mapping rule (external package)
```

Mapping rules are not hardcoded in the parser — they are registered per root type. The algorithmic rules are specified in `13_bml_to_bom_mapping.md`.

There is no separate mapping rule for MachineBlocks Sets. The `<block>` mapping rule handles them identically to any other Block. The SCAD Renderer detects `baseType = com.machineblocks.core.Set` and switches to STEPS-based output.

### Default Resolution

```text
baseType missing              → BML_MISSING_BASE_TYPE (no default)
<aggregations> missing        → no parser action; inherited members resolved at validate (e.g. _presets, _parts from MachineBlocks base types)
<composition> without aggregation attribute
  + single default aggregation in effective members → fills that aggregation (typically _parts for MB Blocks)
  + multiple aggregations, no default               → compiler error: aggregation attribute required
type="Foo" (unqualified)      → resolved against org.blockml.type.* (primitives only)
version missing on external instance → BML_MISSING_VERSION (error, no fallback)
unknown version on external instance → BML_UNKNOWN_VERSION (error)
same-document Sub-Block instance     → version not required
id missing on referenced instance    → BML_MISSING_ID
id missing on bml:each element       → BML_MISSING_ID
appliedPresets / Step.part unresolvable     → BML_UNRESOLVABLE_INSTANCE_REF
qualified FQN::id without export="true"     → BML_UNEXPORTED_INSTANCE_REF
qualified FQN::id with Expression id/ref    → BML_NON_STATIC_INSTANCE_REF
anonymous static child without id    → auto-ID after directive expansion (not stored in BOM)
_steps missing or empty       → assembly order = document order of _parts
```
