# BOM Compiler — BML

version: 2.1.0

## Purpose of this Document

This document defines the BML (Block Markup Language) format — the universal declarative authoring language for BOM Blocks, Composite Blocks, and Presets.

For the abstract object model see `00_bom_core.md`. For the formal BOM data structures (implementation contract) see `12_bom_object_model.md`. For the MBOM object model (MachineBlocks domain) see `03_mbom.md`. For value type BML definitions see `17_type_system_bml.md`. For property constraints and suggestions see `18_constraints_and_suggestions.md`. For MBOM type parse/serialize rules see `04_types.md`. For native MBOM property SCAD mapping see `09_mbom_properties.yml`.

---

## Overview

BML is the human- and editor-friendly authoring format for BOM. It describes semantic BOM objects — Blocks, Composite Blocks, and Presets — without any knowledge of render target syntax or parameters.

BML is parsed and validated by `@blockml/parser`, which produces a BOM document as output. The BOM is then compiled to the selected render target by `@blockml/compiler`.

### File Extensions

```text
Extension:      .bml    — all BML source files
Content-type:   bml     — MIME / tooling identifier
```

**`.bml` is the sole file extension.** Blocks, presets, config profiles, and library descriptors all use `.bml`.

The compiler discovers source files via `bmlExtensions` in `bom.config.json` (default: `[".bml"]`).

The root XML element determines the document type — not the filename suffix. (JSON `type` field: deferred TBD.)

---

## Serialization Formats

**XML is the canonical BML format.** It is the format of choice for all Block definitions, Composite Blocks, Sub-Blocks, and anything involving BML Directives or Functions. XML is not a legacy choice — it is the right tool for this kind of structured, namespace-aware, hierarchical information.

Specific XML capabilities that make it irreplaceable for BML:

```text
Namespaces          xmlns:bricks="com.machineblocks.bml.bricks"
                    → Block types used directly as element names: <bricks:StandardBrick />
                    → No need for explicit type="..." attributes

Attribute namespaces bml:each, bml:if, bml:container
                    → Clean separation of directives from Block properties
                    → No equivalent mechanism in JSON

Mixed content       <bml:container> with heterogeneous children
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
<block>   — Block Definition (composable types, ValueTypes, language blocks, preset collections, …)
```

Property presets are **not** a BlockML core feature. MachineBlocks models presets as Block instances in `_presets` with `basePresets` associations — see § Presets (MachineBlocks) and `03_mbom.md`.

Library packages use `<block baseType="org.blockml.bml.core.BlockLibrary">` — see § Library Format.

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

**Mandatory BML namespace:** All Block FQNs and xmlns bindings must live under `<domain>.bml.*` (e.g. `org.blockml.bml.core.*`, `com.machineblocks.bml.core.*`). See `00_bom_core.md` — Mandatory BML namespace · `BML_OUTSIDE_BML_NAMESPACE`.

```xml
xmlns:core="com.machineblocks.bml.core"
xmlns:bricks="com.machineblocks.bml.bricks"
xmlns:ac="com.martianmicro.anyclosure"
```

A type reference using a prefix:

```xml
<ac:Wall bml:id="wall" size="[1, 8, 9]" />
```

is resolved by the Namespace Resolver to the FQN:

```text
com.martianmicro.anyclosure.Wall
```

The BOM always uses the full FQN. Namespace prefixes are a BML authoring convenience only.

**General rule:** XML prefixes have no semantic meaning. During parsing, every prefix is resolved via the document's `xmlns:` declarations. The BOM stores **canonical namespace identifiers only** (FQN or URI) — never XML aliases. This applies to Block type references, member element QNames, `type:` shorthand, and all other namespaced BML syntax. See § Member Namespace (Element QName).

### Context-Bound Implicit Namespace

Unqualified block references are supported **only at specialized, semantically unambiguous reference sites**. Each such site defines exactly one implicit namespace. The name is expanded directly:

```text
<Name>  →  <implicitNamespace>.<Name>
```

There is **no multi-stage search**, no global TypeRegistry fallback, and no document-scope heuristics. If the expanded FQN does not exist or the referenced Block does not satisfy the expected base type for that site, the compiler emits an error.

| Reference site | Implicit namespace | Expected base type |
|---|---|---|
| Property `type` | `org.blockml.bml.type.*` | ValueType |
| Capability `inputType` | `org.blockml.bml.type.*` | ValueType |
| Capability `outputType` | `org.blockml.bml.type.*` | ValueType |
| `<implementation language="…">` | `org.blockml.bml.language.*` | Language |
| `<status>` element content · `bml:status` attribute | `org.blockml.bml.status.*` | Status |
| Capability `type` | `org.blockml.bml.capability.*` | Capability branch |
| Constraint `validation` attribute | `org.blockml.bml.validation.*` | Validation |

**Examples:**

```text
<width type="Integer" />                    →  org.blockml.bml.type.Integer
<implementation language="TypeScript">      →  org.blockml.bml.language.TypeScript
<status>Draft</status>                        →  org.blockml.bml.status.Draft
<resize type="Transformation" …>             →  org.blockml.bml.capability.Transformation
<constraint:Min validation="Error" …/>       →  org.blockml.bml.validation.Error
```

**General block references have no implicit namespace.** These require a full FQN or an explicit `xmlns:` prefix:

```text
<baseType>Block</baseType>                    ✗  Block could come from many libraries
<aggregation type="Wall" />                   ✗  no implicit namespace
<association type="Foo" />                    ✗  no implicit namespace
<Base bml:id="base" …/>                       ✗  composition tags require prefix or FQN
```

```xml
<!-- correct -->
<baseType>core:Block</baseType>
<aggregation type="core:Block[]" />
<core:Step bml:id="step1" … />

<!-- domain types on Property.type — prefix required -->
xmlns:type="com.machineblocks.bml.type"
type="type:Size3D"   →  com.machineblocks.bml.type.Size3D
type="type:Color"    →  com.machineblocks.bml.type.Color
```

Explicit FQNs and `xmlns:` prefixes remain valid **everywhere** — including at specialized reference sites (`status:Draft`, `lang:TypeScript`, `validation:Error` are equivalent to bare names at those sites).

**Generic parameters** (e.g. `type="T"` on a property) are not block references — they refer to `genericTypes[]` entries in the enclosing Block definition.

**Naming mutual exclusion:** A generic parameter name must differ from the root Block `<name>` and from every Sub-Block `<name>` in the same document (`BML_GENERIC_BLOCK_NAME_COLLISION`, `BML_GENERIC_SUBBLOCK_NAME_COLLISION`).

For inheritance-aware self-reference at validate time, `bml:Self` remains available (see § Members — `bml:Self`).

**Property and Capability types** must resolve to a **ValueType** — a Block whose `baseType` chain includes `org.blockml.bml.core.ValueType`. Non-ValueType FQNs (e.g. `com.foo.Wall`) are invalid as property or Capability input/output types → `BML_INVALID_PROPERTY_TYPE`.

**Member namespace:** `org.blockml.bml.core.Block` declares **no members**. Every sub-type chooses its own Properties, Aggregations, Associations, and Capabilities — including names like `id` or `version` if a domain needs them. On composition instances, **instance identity** uses `bml:id` and **external reference version** uses `bml:version` — not bare attributes (see Composition section).

**Aggregation and association types** may reference any Block FQN — not limited to ValueTypes.

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

Composition children (`<ac:Wall bml:id="wall" …/>`, `<core:Step …/>`) are **Block Instances** — semantically **Objects**: they reference a class (`typeFqn`) and carry instance state (`bml:id`, member values). See `00_bom_core.md` — Block and Block Instance.

### Required Fields

```text
<idea>              — short semantic description: what this Block represents in meaning (first child element).
<documentation>     — human-readable technical description of the Block (second child element).
<name>              — short class name (PascalCase). See naming convention below.
<type>              — FQN (e.g. com.martianmicro.anyclosure.Wall)
<baseType>          — FQN of the parent type. Mandatory — no default. Omitted only on org.blockml.bml.core.Block.
<version>           — semantic version of this Block definition
<status>            — optional; Block reference. Omitted = inherit from parent (document root defaults to Stable)
```

Definition elements (`<property>`, `<aggregation>`, …) carry `<status>` only when deviating from the inherited status — see § `<status>`.

### `<idea>` — semantic meaning

`<idea>` is placed **directly under the root `<block>` element**, as the **first child**, before `<documentation>` and `<name>`. It states how to **interpret** the Block — what it means in the domain, not how it is implemented.

```text
<idea>       — meaning     what this Block semantically represents (one short sentence)
<documentation> — detail     technical description, behaviour, constraints, examples
```

Examples:

```xml
<idea>Lego compatible standard building block.</idea>
<documentation>Parametric MachineBlocks brick with size, studs, holes, and style properties.</documentation>
```

```xml
<idea>Primitive BlockML property type capable of holding a float number.</idea>
<documentation>BOM Core primitive ValueType for floating-point numbers. Unqualified name Float
  resolves via the type namespace.</documentation>
<references>
  <see file="17_type_system_bml.md">
    PrimitiveType — float number payload rules.
  </see>
</references>
```

`<idea>` is required on every Block definition (root blocks and Sub-Blocks). Omitted on root blocks → `BML_MISSING_IDEA` (warning in V1, error in a later release). The idea is primary input for editors, LLMs, and documentation navigation — it answers *what is this?* before *how does it work?*

WOT alignment: the Idea is the stable semantic constant; documentation describes how a World interprets and uses it. See `WOT_Reference_v26.md` — The Idea.

### `<documentation>`

`<documentation>` follows `<idea>`, still before `<name>`. It describes the Block definition itself — not individual members (those carry their own `<documentation>`). Omitted on root blocks → `BML_MISSING_DOCUMENTATION` (warning in V1, error in a later release).

**Cross-references:** Do **not** name Block or Definition FQNs, markdown files, or external URLs in `<documentation>` prose. Link all related types and documentation sources exclusively via `<references>` (see below).

```xml
<block ...>
  <idea>Parametric wall segment for AnyClosure enclosures.</idea>
  <documentation>Wall block with thickness, height, and opening properties for enclosure design.</documentation>
  <name>Wall</name>
  ...
</block>
```

### Documentation extensions

Wherever `<documentation>` is permitted, these **optional** siblings are also allowed:

```text
<since>       — version from which the element is available
<changelog>   — version history (container of <change> entries)
<examples>    — usage examples (container of <example> entries)
<references>  — cross-references (container of <see> entries)
```

Applies to all definition elements that carry documentation:

```text
<block>  <property>  <aggregation>  <association>  <capability>  <constraint>  <suggestion>
```

and to any future definition element with `<documentation>`.

On root `<block>` definitions, optional documentation extensions follow `<documentation>` and precede `<name>`. On members and Sub-Blocks, they appear alongside `<documentation>` among definition metadata children (before `<value>`, `<composition>`, or other content containers).

Goal: keep API documentation, version history, examples, and related-type links at the definition site — a single source of truth inside BML files.

**Authoring split:** `<documentation>` carries technical prose only; `<references>` carries all cross-links — Blocks, Definition elements, repository markdown files (`file`), and external URLs (`url`) — each with an explicit relationship note.

#### `<since>`

Declares the version from which the element is available:

```xml
<since>1.0.3</since>
```

Value is a semantic version string (same rules as `<version>` on Block definitions). Omitted when the element has been available since the Block's initial release.

#### `<changelog>`

Container for version history. Each entry is a `<change>` with a required `version` attribute and text body:

```xml
<changelog>

    <change version="1.1.0">
        Added support for edgeRadius.
    </change>

    <change version="1.3.2">
        Changed stud generation behaviour.
    </change>

    <change version="2.0.0">
        Deprecated property xyz.
    </change>

</changelog>
```

Entries must be ordered chronologically by version — **oldest first**. Out-of-order entries → `BML_CHANGELOG_VERSION_ORDER` (warning V1).

#### `<examples>`

Container for usage examples. Each `<example>` requires a `title` attribute; body content is **CDATA only**:

```xml
<examples>

    <example title="Basic Brick"><![CDATA[
<core:Brick size="[2,4,3]" />
    ]]></example>

    <example title="Brick with Holes"><![CDATA[
<core:Brick
    size="[2,4,3]"
    holes="true" />
    ]]></example>

</examples>
```

A future optional `language` attribute (e.g. `OpenSCAD`, `TypeScript`) may distinguish example dialects. Omitted → BML source (MBML/BML).

#### `<references>`

Container for cross-references to related Blocks, definition elements, repository documentation files, or external URLs. Each `<see>` requires **exactly one** target attribute — `block`, `file`, or `url`. The text body explains why or how the referenced element relates to the **current** definition.

**Target attributes (exactly one required):**

```text
block="core:ValueType"   — Block or Definition reference via xmlns prefix (e.g. core:Block, def:PropertyDefinition)
file="02_mbml.md"                    — repository documentation file
url="https://blockml.org/schemas/…"  — external URL
```

**Authoring rules:**

- Include only targets with a **direct relationship** to the current definition.
- Every `<see>` **must** include a text body describing the relationship.
- Do **not** repeat cross-links in `<documentation>`; use `<references>` instead.
- `block` values use **namespace prefixes** from the document's `xmlns:` declarations — same rules as `type`, `baseType`, and composition references (e.g. `core:Block`, `def:PropertyDefinition`, `bcore:Entity`).

```xml
<references>

    <see block="core:CompositeBlock">
        Composable sub-type — owns child instances via default _parts aggregation.
    </see>

    <see block="core:ValueType">
        Branch sub-type — payload types for properties and capabilities.
    </see>

    <see block="def:PropertyDefinition">
        Meta-model member shape for property declarations on Block definitions.
    </see>

    <see file="02_mbml.md">
        Block Definition — idea, documentation, and documentation extensions.
    </see>

    <see url="https://blockml.org/schemas/core/block.xsd">
        XML schema for block definition documents.
    </see>

</references>
```

`block` accepts any Block or Definition reference via xmlns prefix. Resolved to FQN at parse time — same rules as `type` and `baseType`. Unknown FQN at validate time → `BML_UNKNOWN_TYPE` (error). Omitted target attribute → `BML_REFERENCE_MISSING_TARGET` (error). More than one target attribute → `BML_REFERENCE_AMBIGUOUS_TARGET` (error).

Maps to BOM `DocumentationReference { block?, file?, url?, context }`. Meta-model: `org.blockml.bml.definition.ReferenceDefinition` on `org.blockml.bml.core.Definition.references` — see `16_framework_base_types.md` — Definition Branch.

Example with documentation extensions on a member:

```xml
<wallThickness type="Integer">
    <documentation>Thickness of the wall in grid units.</documentation>
    <since>1.2.0</since>
    <changelog>
        <change version="1.2.0">Initial property.</change>
        <change version="2.0.0">Default changed from 2 to 1.</change>
    </changelog>
    <examples>
        <example title="Thin wall"><![CDATA[
<wallThickness>1</wallThickness>
        ]]></example>
    </examples>
    <value>1</value>
</wallThickness>
```

Non-definition elements (`<documentation>`, `<since>`, `<changelog>`, `<examples>`, `<references>`, `<implementation>`, Block instances, …) may carry `bml:status="Draft"` when deviating from inherited status — same rules as `<documentation>`.

### `<status>` — maturity marker

Status expresses the maturity or lifecycle of a definition. Status is a **Block reference**, not a string or boolean — following Everything-is-a-Block.

**Implicit default:** When no status is declared, the effective status is **`Stable`** (`org.blockml.bml.status.Stable`). At the document root this applies directly; on child elements the effective status is inherited from the parent — which is Stable unless an ancestor declared a deviation.

#### Inheritance and defaults

Status is **inherited downward** through the element tree. Authors declare status **only when it deviates** from the effective status of the parent element.

```text
Document root (no parent)     →  effective status: Stable
Child element (no declaration) →  inherits parent effective status
Child with <status> or bml:status →  sets local effective status for its subtree
```

Examples:

```text
<block> (omit status)                    → Stable; all children inherit Stable
  <property> (omit status)               → Stable (inherited)
  <property><status>Draft</status> → Draft; <documentation> inside inherits Draft
  <idea bml:status="Stub">        → Stub (deviates from block's Stable)
  <bricks:Wall bml:status="Deprecated"> → Deprecated instance under Stable block
```

On a **Draft** property, nested `<documentation>`, `<since>`, `<changelog>`, `<examples>`, `<references>`, `<constraints>`, and composition children inherit **Draft** — no attribute needed. To mark a child as **Stable** inside a Draft property, set `bml:status="Stable"` explicitly.

Core library defines:

```text
org.blockml.bml.core.Status          — abstract base
org.blockml.bml.status.Stable        — implicit default at document root
org.blockml.bml.status.Draft
org.blockml.bml.status.Stub
org.blockml.bml.status.Deprecated
```

Domain libraries may define additional status blocks.

#### Definition elements: `<status>` child

Only elements that **define** something may carry a `<status>` child — and **only when deviating** from the inherited status:

```text
<block>  <property>  <aggregation>  <association>  <capability>  <constraint>  <suggestion>
```

```xml
<property name="width" type="Float">
    <status>Draft</status>
    <documentation>Target width in grid units — mapping incomplete.</documentation>
    <value>4</value>
</property>
```

#### Non-definition elements: `bml:status` attribute

Elements that are **not** definitions do not carry a `<status>` child. Use `bml:status` **only when deviating** from the inherited status:

```xml
<!-- Block is Stable (default); idea deviates to Stub -->
<idea bml:status="Stub">
  Reserved for future multi-material support.
</idea>

<!-- Stable block; deprecated composition instance -->
<bricks:StandardBrick
    bml:status="Deprecated"
    bml:id="legacy"
    size="[2, 4, 3]" />

<!-- Draft property; implementation inherits Draft — omit bml:status -->
<capability name="formatValue" …>
  <implementation language="TypeScript"><![CDATA[…]]></implementation>
</capability>

<!-- Draft property; one child doc reviewed early — explicit deviation -->
<documentation bml:status="Stable">
  Reviewed description text (property itself remains Draft).
</documentation>
```

#### Implicit namespace at status reference sites

At `<status>` and `bml:status` reference sites, unqualified names resolve to `org.blockml.bml.status.*`:

```xml
<!-- correct — bare name at specialized reference site -->
<status>Draft</status>
<bml:status="Deprecated" … />

<!-- also valid — explicit prefix or FQN -->
<status>Draft</status>
<status>org.blockml.bml.status.Draft</status>

<!-- invalid — bare name outside a specialized reference site -->
<type>Draft</type>
```

### Block Name Convention

`<name>` is a class name — PascalCase, letters and digits only:

```text
Format:  [A-Z][a-zA-Z0-9]*
Valid:   Wall, StandardBrick, Calibrator, NfcPlayer
Invalid: my-wall, wall_v2, 2Wall, My Wall
Error:   BML_INVALID_BLOCK_NAME
```

PascalCase ensures composition instance tags with `xmlns:` prefixes are unambiguous — no Property or member name starts with an uppercase letter.

### Optional Fields

```text
<abstract>                    — true | false (default false). Abstract types are not instantiable.
                              — self-closing <abstract /> is equivalent to true (preferred at root)
<final>                       — true | false (default false). Final types cannot be used as baseType.
                              — self-closing <final /> is equivalent to true (preferred at root)
<visibility>                  — Sub-Blocks only: private | protected | public; must match <name>
<subTypes>          — override: permitted Sub-Block baseTypes (omit to inherit — see Framework Base Types)
<languages>         — Language references for <implementation language="...">
<properties>    — Property declarations. Omit if no custom properties or default overrides needed.
<aggregations>  — Aggregation declarations. Omit when inherited aggregations from baseType suffice.
<associations>  — Association declarations.
<capabilities>  — Capability declarations.
<contracts>     — Contract references (reusable partial definitions). Root block only.
<subBlocks>     — Sub-Block definitions (see Sub-Blocks section).
<aggregations>  — Aggregation declarations and definition-level compositions. Omit when inherited aggregations from baseType suffice.
                — <composition> must be nested inside an aggregation member element (never standalone).
```

Framework base types (`org.blockml.bml.core.Block`, `com.machineblocks.bml.core.Block`, …) are **BML files** in `@blockml/core` and `@machineblocks/mbom` — not code or YAML. See `16_framework_base_types.md`.

### Type Modifiers

```xml
<abstract />
<final />

<subTypes>
  <core:Block />
  <bcore:Entity />
</subTypes>

<languages>
  <lang:OpenSCAD />
  <lang:TypeScript />
</languages>
```

```text
Omitted <subTypes>            — inherit effective subTypes from baseType chain
Explicit <subTypes>…          — override (enable or restrict Sub-Blocks)
Explicit empty <subTypes/>    — override: forbid Sub-Blocks even when parent allowed them
Omitted other modifiers       — inherit from baseType where applicable (validator walks chain)
org.blockml.bml.core.Block        — sole type that omits <baseType> (inheritance root); effective subTypes []
```

**Container pattern:** BlockML uses a consistent syntax for typed collections on Block definitions. The container element defines context; each child is the actual definition or Block reference — no redundant wrapper elements when context is already unambiguous:

```text
<languages>    →  <lang:OpenSCAD/>           Language reference (composition element — prefix required)
<subTypes>     →  <core:Block/>              direct Block reference
<contracts>    →  <ac:Wall/>                 direct contract Block reference
<genericTypes> →  <T baseType="…"/>          element name = generic parameter name
```

See `16_framework_base_types.md` for per-container rules.

### Contracts

Blocks may declare `<contracts>` at root level to compose one or more **contract Blocks** — reusable partial definitions whose member fragments are merged into the effective Block definition:

```xml
<contracts>
  <com.foo:IIdentifiable />
  <com.foo:IPlaceable />
</contracts>
```

```text
Child element — direct Block reference (element name = FQN via xmlns prefix)
```

**Semantics:**

```text
Role            — reusable partial Block definition (replaces interfaces, traits, mixins)
Scope           — Properties, Aggregations, Associations, Capabilities, Constraints,
                  Suggestions, documentation, examples, references, optional Capability defaults
Ignored         — subBlocks and compositions on the contract Block
Partial members — contracts may declare incomplete members; the Block completes them
Merge order     — baseType chain → contracts (in declaration order) → Block
Conflict rule   — later contract wins; Block overrides all contracts
Override rule   — only explicitly specified attributes replace inherited/merged values
final           — final members from any layer cannot be overridden
Sub-Blocks      — contracts not allowed on nested Sub-Blocks (root only)
Validation      — merge resolution at stage [8] via resolveEffectiveMembers()
```

**Example — contract Block (partial definition):**

```xml
<block xmlns="http://blockml.org/schema/block" …>
  <name>IIdentifiable</name>
  <type>com.foo.IIdentifiable</type>
  <baseType>org.blockml.bml.core.Block</baseType>
  <version>1.0.0</version>
  <abstract />
  <properties>
    <id type="Text" />
  </properties>
</block>
```

**Example — contract supplies type, Block completes the member:**

```xml
<block xmlns="http://blockml.org/schema/block" …>
  <name>MyEntity</name>
  <type>com.foo.MyEntity</type>
  <baseType>org.blockml.bml.core.Entity</baseType>
  <version>1.0.0</version>
  <contracts>
    <com.foo:IIdentifiable />
    <com.foo:IPlaceable />
  </contracts>
  <properties>
    <id>
      <documentation>Unique identifier</documentation>
      <constraints>…</constraints>
    </id>
    <offset type="type:Vector3D">
      <value>[0, 0, 0]</value>
    </offset>
    <direction type="type:Direction">
      <value>north</value>
    </direction>
  </properties>
</block>
```

Effective members: `id.type` from `IIdentifiable`; `id.documentation` and `id.constraints` from `MyEntity`; `offset` and `direction` from `IPlaceable`, with Block-supplied defaults where declared.

### Namespace Declarations

Every BML document declares namespaces and a `xsi:schemaLocation` for IDE validation and autocomplete. The pattern follows the same convention as Spring and Maven XSD declarations:

```xml
<block
  xmlns="http://blockml.org/schema/block"
  xmlns:bml="http://blockml.org/schema/bml"
  xmlns:core="com.machineblocks.bml.core"
  xmlns:type="com.machineblocks.bml.type"
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
  http://blockml.org/schema/service  ← org.blockml.bml.service.*

MachineBlocks (Domain-Namespaces):
  http://machineblocks.com/schema/core        ← MB Core, NativeBlock, Set
  http://machineblocks.com/schema/bricks      ← com.machineblocks.bml.bricks.*
  http://machineblocks.com/schema/calibration ← com.machineblocks.bml.calibration.*

FQN-Referenz-Namespaces:
  xmlns:core="com.machineblocks.bml.core"         ← <core:NativeBlock />
  xmlns:type="com.machineblocks.bml.type"         ← type="type:Size3D"
  xmlns:bricks="com.machineblocks.bml.bricks"     ← <bricks:Standard />
  xmlns:cal="com.machineblocks.bml.calibration"   ← <cal:Calibrator />
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
xmlns:type  — required when using domain-specific types (e.g. type:Size3D)
xmlns:*     — domain namespaces for Block type references and member element prefixes
```

### Member Namespace

All Members — Properties, Aggregations, Associations, and Capabilities — share a single member namespace per Block. Logical uniqueness is determined by **`(namespace, name)`** — not by name alone. Unprefixed member elements belong to the **default namespace** (empty string). A validation error is raised for duplicates within the same resolved namespace.

The member namespace is supplied exclusively by the **XML element QName** — see § Member Namespace (Element QName). The parser resolves any prefix via the document's `xmlns:` table and stores the canonical identifier in the BOM; the prefix itself is never stored.

### Conventions

**Member declaration order:** within `<properties>`, `<aggregations>`, and `<associations>`, child elements are mapped to `members[]` in **XML document order**. The parser must not reorder. Order is significant for StructType array literal authoring, FunctionMapping positional parameters, and compatibility. See `17_type_system_bml.md` — Declaration Order · `18_function_mapping.md` · `12_bom_object_model.md` — Member Declaration Order.

**`<aggregations>`** — Domain base types declare inherited aggregations in BML (e.g. `_presets` on `Block.bml`, `_parts` on `CompositeBlock.bml`). The parser stores **declared** members only; inherited members resolve at validate via `baseType` chain. Omit `<aggregations>` on user blocks when the inherited set suffices.

`_presets` on `com.machineblocks.bml.core.Block` and `_parts` on `com.machineblocks.bml.core.CompositeBlock` (declared in framework BML):

```text
_presets (Block):
  name:    _presets
  type:    com.machineblocks.bml.core.Block[]

_parts (CompositeBlock):
  name:    _parts
  type:    com.machineblocks.bml.core.Block[]
  default: true
```

**Composition placement** — a Composition always fills an Aggregation and must be nested inside the aggregation member element:

```text
1. Inside <aggregations> on a Block definition — preferred when declaring or filling multiple aggregations
2. As a top-level aggregation member element on a Block definition — when filling one inherited aggregation (type omitted)
3. On Block instances — opening a specific aggregation inline (see § Composition); no <composition> wrapper
```

For CompositeBlocks the default aggregation is typically inherited `_parts`. Sets and Libraries have multiple aggregations — each composition must be nested in its aggregation member element.

### Minimal Block Example

```xml
<block xmlns="http://blockml.org/schema/block"
       xmlns:bricks="com.machineblocks.bml.bricks">

  <name>Wall</name>
  <type>com.martianmicro.anyclosure.Wall</type>
  <baseType>com.machineblocks.bml.core.CompositeBlock</baseType>
  <version>1.0.0</version>

  <aggregations>
    <_parts>
      <composition>
    <bricks:StandardBrick
        bml:id="bottom"
        bml:version="1.0.0"
        size="${ [size.x, size.y, size.z - 1] }"
        recess="true"
        tongue="true"
        recessWallGaps="x+" />

    <bricks:StandardBrick
        bml:id="top"
        bml:version="1.0.0"
        size="${ [size.x, size.y, 1] }"
        offset="${ [0, 0, size.z - 1] }"
        recessWallGaps="x+"
        baseCutoutType="groove" />
      </composition>
    </_parts>
  </aggregations>

</block>
```

### Full Block Example

```xml
<block xmlns="http://blockml.org/schema/block"
       xmlns:bricks="com.machineblocks.bml.bricks"
       xmlns:status="org.blockml.bml.status">

  <idea>Parametric enclosure wall.</idea>
  <documentation>Wall block with native and custom properties.</documentation>

  <name>Wall</name>
  <type>com.martianmicro.anyclosure.Wall</type>
  <baseType>com.machineblocks.bml.core.Block</baseType>
  <version>1.0.0</version>

  <properties>
    <!-- Native properties — inherit Stable from block (no status needed) -->
    <size type="Size3D">
      <value>[1, 8, 8]</value>
    </size>
    <baseColor type="Color">
      <value>#303D4E</value>
    </baseColor>
    <assembly type="AssemblyMode">
      <value>Merged</value>
    </assembly>

    <!-- Custom property — deviates to Draft -->
    <wallThickness type="Integer">
      <status>Draft</status>
      <documentation>Thickness of the wall in grid units.</documentation>
      <value>1</value>
    </wallThickness>
  </properties>

  <composition>
    <bricks:StandardBrick
        bml:id="bottom"
        size="${ [size.x, size.y, size.z - 1] }"
        recess="true"
        tongue="true"
        recessWallGaps="x+" />

    <bricks:StandardBrick
        bml:id="top"
        size="${ [size.x, size.y, 1] }"
        offset="${ [0, 0, size.z - 1] }"
        recessWallGaps="x+"
        baseCutoutType="groove" />
  </composition>

</block>
```

---

## Members

BlockML distinguishes two levels with **different syntax**:

```text
Block definition   — describes the full member including metadata
Block instance     — sets member values only
```

### Member Element Names

The member name is the **XML element name**. The `name="..."` attribute is removed entirely. The surrounding container determines the member kind:

```xml
<properties>
    <size type="Size3D"/>
</properties>

<aggregations>
    <items type="com.foo.Wall[]"/>
</aggregations>

<associations>
    <parent type="com.foo.Block"/>
</associations>

<capabilities>
    <print type="org.blockml.bml.capability.Outbound"/>
</capabilities>
```

### Definition Content Containers

Block definitions describe the entire member — not just its value. Each member has an explicit content area:

**Properties** use `<value>`:

```xml
<properties>
    <size type="Size3D">
        <documentation>Final outer dimensions.</documentation>
        <value>${[width, height, depth]}</value>
    </size>
</properties>
```

**Aggregations** use `<composition>`:

```xml
<aggregations>
    <items type="com.foo.Wall[]">
        <documentation>Child parts.</documentation>
        <composition>
            <ac:Wall/>
        </composition>
    </items>
</aggregations>
```

`value` and `composition` are counterparts: Property → `value`, Aggregation → `composition`.

### Block Instances

Inside a Block instance, members are **set** — not defined. No `<value>` wrapper.

Properties may be written as **attributes** (short form) or **elements** (long form):

```xml
<!-- Short form -->
<ac:Wall color="#ff0000"/>

<!-- Long form -->
<ac:Wall>
    <color bml:if="${useRed}">#ff0000</color>
</ac:Wall>
```

When both forms exist, the **long form replaces the short form entirely**.

**Primitive properties:** Properties typed with `org.blockml.bml.type.PrimitiveType` (Integer, Decimal, Float, Text, Boolean) store values directly on the Property — inline literals on Block instances. PrimitiveTypes never carry values themselves. Use a concrete `*Entity` type (for example `org.blockml.bml.type.IntegerEntity`) when a primitive must appear as an Entity in composition. Required values are declared via `org.blockml.bml.constraint.ValuePresent`. See `17_type_system_bml.md` — § PrimitiveType · PrimitiveEntity · Properties are always Optional.

Aggregations are filled directly by member name:

```xml
<ac:Wall>
    <items>
        <ac:Corner/>
    </items>
</ac:Wall>
```

A Block instance is itself the container for its members.

---

All member kinds — Property, Aggregation, Association, Capability — share the same visibility rules, optional attributes, and override semantics.

### Member Visibility

#### Core principle

Member and Sub-Block visibility controls **BlockML access only** — which BlockML definitions may reference, read, or set a member or Sub-Block. It does **not** prescribe how a renderer must manifest visibility in the target system.

A renderer always has access to the **entire Canonical BOM** — public, protected, and private definitions and values. Visibility restricts BlockML authoring access, not the renderer's technical access to the BOM. The renderer may map visibility directly, via namespaces or modules, only for generated APIs, ignore it entirely, or interpret it in any target-specific way.

This supersedes the prior view that visibility primarily governed generated accessors.

#### Naming convention

Visibility is determined primarily by **naming convention**:

| Name       | Visibility |
| ---------- | ---------- |
| `myVar`    | public     |
| `_myVar`   | protected  |
| `__myVar`  | private    |

The prefix is part of BlockML visibility, **not** the logical member identity. For collision checking, the **normalized logical name** strips visibility prefixes:

```text
myVar   → myVar
_myVar  → myVar
__myVar → myVar
```

Members that differ only by visibility prefix **must not coexist** in the same Block:

```xml
<!-- invalid -->
<properties>
  <myVar type="Integer" />
  <_myVar type="Integer" />
</properties>

<!-- invalid -->
<properties>
  <_myVar type="Integer" />
  <__myVar type="Integer" />
</properties>
```

Multiple members with the same normalized name → `BML_DUPLICATE_MEMBER_VISIBILITY_VARIANT`. A logical member exists exactly once with exactly one visibility.

#### Public members

A public member may be read and set from any BlockML definition, subject to type and structural rules.

```xml
<ac:Wall myVar="5" />
```

#### Private members

A private member may be used **only within the Block definition that declares it** — in expressions, capabilities, compositions, and on instances of the declaring type within that same definition.

```xml
<block>
  <name>Wall</name>
  <type>ac:Wall</type>
  <properties>
    <__myVar type="Integer" />
  </properties>
  <composition>
    <ac:Wall __myVar="5" />
  </composition>
</block>
```

This is valid because `Wall` accesses its own private member within its definition — including when a Block creates instances of its own type (recursive structures, enum values, etc.).

**Private members of Sub-Block instances** — the owning composite Block does **not** gain access to private members of contained instances:

```xml
<!-- invalid -->
<block>
  <name>Wall</name>
  <type>ac:Wall</type>
  <composition>
    <ac:MySubBlock __myVar="5" />
  </composition>
</block>
```

Composition ownership does **not** lift private encapsulation. Private members of `MySubBlock` are usable only inside `MySubBlock`'s own definition.

#### Protected members

A protected member may be used when **at least one** of the following holds:

1. within the declaring Block,
2. within any Block that inherits directly or indirectly from the declaring Block,
3. by the **direct composition owner** of the instance (to configure protected members on composition children),
4. by Blocks that inherit directly or indirectly from the **instance type**.

```xml
<!-- own type -->
<block>
  <name>Wall</name>
  <type>ac:Wall</type>
  <properties>
    <_myVar type="Integer" />
  </properties>
  <composition>
    <ac:Wall _myVar="5" />
  </composition>
</block>

<!-- derived Block -->
<block>
  <name>SpecialWall</name>
  <type>ac:SpecialWall</type>
  <baseType>ac:Wall</baseType>
  <composition>
    <ac:SpecialWall _myVar="5" />
  </composition>
</block>

<!-- composition owner configures child -->
<block>
  <name>Wall</name>
  <type>ac:Wall</type>
  <composition>
    <ac:SubBlock _myVar="5" />
  </composition>
</block>
```

Valid when `_myVar` is a protected member of `SubBlock`. Only the **immediate** composition owner receives this access — not the entire outer composition hierarchy.

```xml
<!-- derived Sub-Block inherits protected member -->
<block>
  <name>SpecialSubBlock</name>
  <type>ac:SpecialSubBlock</type>
  <baseType>ac:SubBlock</baseType>
  <composition>
    <ac:SpecialSubBlock _myVar="5" />
  </composition>
</block>
```

#### Formal access rule

Given:

```text
D = Block that declares the member
C = Block whose definition contains the access
I = type of the instance on which the member is read or set
O = immediate composition owner of that instance
```

Then:

| Visibility | Access allowed when |
| ---------- | ------------------- |
| **public** | always |
| **private** | `C = D` (concrete instance type is irrelevant when access is from the declaring Block's definition) |
| **protected** | `C = D` **or** `C` inherits from `D` **or** `C = O` **or** `C` inherits from `I` |

Only the immediate composition owner grants protected configuration access on children.

#### Optional `visibility` attribute

Members may optionally declare an explicit visibility that must match the naming convention:

```xml
<__token visibility="private"/>
<_size   visibility="protected"/>
<label   visibility="public"/>
```

A mismatch between `name` and `visibility` → `BML_VISIBILITY_MISMATCH`.

The same rules apply to **Sub-Blocks** — see § Sub-Blocks — Sub-Block Visibility. Sub-Blocks may declare optional root-level `<visibility>`; root Blocks must not.

#### Validator diagnostics

The validator checks every member access against lexical and type context. The parser stores the authored form losslessly; access validation does **not** alter the Canonical BOM.

```text
BML_PRIVATE_MEMBER_ACCESS              — private member used outside declaring Block
BML_PROTECTED_MEMBER_ACCESS              — protected member outside allowed inheritance/composition context
BML_DUPLICATE_MEMBER_VISIBILITY_VARIANT  — members differ only by visibility prefix
BML_VISIBILITY_MISMATCH                  — explicit visibility does not match naming convention
```

### Common Member Attributes

All member kinds support these optional attributes:

```text
readOnly="true|false"   — when true, the member cannot be written on Block instances. Validator-enforced.
                          Default: false. See § readOnly Members below.
final="true|false"      — when true, child Blocks cannot override this member. Validator-enforced.
```

### readOnly Members

`readOnly` controls whether a member's value or composition may be **changed on Block instances**. It applies to all member kinds — Properties, Aggregations, Associations, and Capabilities.

```text
Block definition   — may declare and set readOnly members via <value>, <composition>, or partial override
Child Block definition — may override an inherited readOnly member (value/composition only)
Block instance     — must not set a member whose effective definition has readOnly=true
Expressions        — may read readOnly members (subject to normal visibility access rules)
```

A `readOnly` member remains **publicly readable** when visibility is public (or when access is permitted by protected/private rules). `readOnly` restricts **instance authoring** only — not expression reads and not renderer access to the Canonical BOM.

**Definition authoring (allowed):**

```xml
<properties>
  <myReadOnlyProperty type="Boolean" readOnly="true">
    <value>true</value>
  </myReadOnlyProperty>
</properties>
```

**Child Block override (allowed):**

```xml
<properties>
  <myReadOnlyProperty>
    <value>false</value>
  </myReadOnlyProperty>
</properties>
```

**Block instance (error):**

```xml
<ac:Wall myReadOnlyProperty="true"/>
```

→ `BML_READONLY_MEMBER_WRITE` at validate (stage [8]).

The check runs after `resolveEffectiveMembers()` on every `BlockInstance` — composition children, preset instances, constraint instances, and any other instance node. For each authored `memberValues` entry and each aggregation/association child element on the instance, the validator resolves the effective member; when `readOnly=true`, it emits `BML_READONLY_MEMBER_WRITE`.

`readOnly` is independent of `final`: a child Block may override the **value** of a `readOnly` member in its definition, but cannot override a `final` member at all. A member may be both `readOnly` and `final`.

### Member Namespace (Element QName)

Properties, Aggregations, Associations, and Capabilities receive their namespace **exclusively via the XML element QName**. There is no `namespace` attribute on member elements.

```xml
<block
    xmlns="http://blockml.org/schema/block"
    xmlns:ui5="com.sap.ui5">

  <properties>
    <ui5:width type="Integer">
      <value>100</value>
    </ui5:width>
    <ui5:height type="Integer">
      <value>200</value>
    </ui5:height>
  </properties>

  <aggregations>
    <html:children type="ui:Control[]"/>
  </aggregations>

  <associations>
    <aria:labelledBy type="ui:Control[]"/>
  </associations>

  <capabilities>
    <dom:click type="cap:Inbound"/>
  </capabilities>
</block>
```

The parser resolves the element prefix via the document's `xmlns:` table:

```text
Authored:   <ui5:width …/>   xmlns:ui5="com.sap.ui5"

Stored:     namespace = "com.sap.ui5"
            name      = "width"
```

The prefix `ui5` does not exist in the BOM after parsing. XML prefixes are document aliases only — only the resolved namespace is semantically relevant.

**Default namespace:** unprefixed member elements (for example `<width type="Integer"/>`) belong to the default member namespace (empty string). The parser treats absence of a prefix as `namespace = ""` — independent of the document default `xmlns`.

**Equivalence across prefixes:** these two documents are semantically identical:

```xml
xmlns:ui5="com.sap.ui5"
<ui5:width type="Integer"/>
```

```xml
xmlns:sap="com.sap.ui5"
<sap:width type="Integer"/>
```

Both store `namespace = "com.sap.ui5"`, `name = "width"`. Different documents may use different prefixes without changing member meaning. Using both in the same document for the same member → duplicate-member error.

**Member identity:** `(resolvedNamespace, localName)` — for example `width` (default namespace) ≠ `ui5:width` (when `ui5` resolves to a non-empty namespace), and `ui5:width` ≠ `abc:width` when the prefixes resolve to different namespaces.

**Scope:** the prefix must be declared in the **same document** where it is used. Each Block definition may declare its own `xmlns:` aliases.

**Overrides:** member override matching uses the **resolved namespace identifier**, not the XML prefix. A child Block may use a different alias for the same namespace:

```xml
<!-- Parent -->
xmlns:ui5="com.sap.ui5"
<ui5:width type="Integer">
  <value>100</value>
</ui5:width>

<!-- Child -->
xmlns:design="com.sap.ui5"
<design:width>
  <value>42</value>
</design:width>
```

Both resolve to key `(com.sap.ui5, width)` — the override merges correctly.

**`bml` prefix:** using `xmlns:bml` for member namespaces is permitted but **not recommended** — the `bml:` prefix is reserved for language directives (`bml:id`, `bml:each`, …). Prefer domain-specific prefixes (e.g. `ui5`, `html`, `aria`).

Undeclared prefix on a member element → `BML_UNKNOWN_NAMESPACE_PREFIX`.
A legacy `namespace="…"` attribute on a member element → parse error.

### Partial Member Overrides

Child Blocks may override inherited members. Only the **member name** and **changed attributes** need to be specified — all other attributes are inherited from the parent definition.

Parent:

```xml
<size
    type="type:Size3D">
  <value>[1,1,1]</value>
  <documentation>Default size</documentation>
</size>
```

Child:

```xml
<size>
  <value>[2,2,2]</value>
</size>
```

The effective definition is the **merge** of both declarations. Override matching uses the resolved `(namespace, name)` key — see § Member Namespace (Element QName).

```text
Same member kind required     — property overrides property, aggregation overrides aggregation, …
Only specified attrs replaced — unspecified attrs inherited from parent
Private members               — cannot be overridden
final="true" on parent        — prevents override in child Blocks → BML_FINAL_MEMBER_OVERRIDE
```

The parser stores override declarations in `members[]`; `resolveEffectiveMembers()` merges along the `baseType` chain.

### Properties

Properties are typed parameters of the Block. Three kinds exist:

**System properties** are defined on `org.blockml.bml.core.Block` — notably `id` (instance identity). System-relevant: dedicated compiler/validator/renderer handling. Not custom properties. See `00_bom_core.md` — System Properties.

**Domain native properties** are defined in `com.machineblocks.bml.core.Block` and its base types. They have dedicated SCAD getters (`mb_param_size()`, etc.) and are listed in `09_mbom_properties.yml`.

**Custom properties** are defined inline in the Block definition. They generate generic SCAD getters (`mb_param(config, settings, "wallThickness", 1)`).

Native and custom properties use the same element syntax — the member name is the element tag. The compiler determines native vs. custom by checking `09_mbom_properties.yml`. Native properties only need to be declared when their value differs from the inherited value. System properties like `id` are set as XML attributes on composition instances — not declared in `<properties>`.

### Property Value (`<value>`)

Block definitions store property values in a `<value>` child element — not as a `value="..."` attribute:

```xml
<size type="type:Size3D">
  <value>[1, 1, 3]</value>
</size>
```

BlockML describes no runtime. A Property has a **defined value**, not a default state. The `<value>` element may contain a literal or an Expression. See § Computed Values below.

On **Block instances**, property values use the short form (attribute) or long form (child element) — see § Block Instances above. No `<value>` wrapper on instances.

### Type Resolution

On Property `type`, Capability `inputType`, and Capability `outputType` reference sites, unqualified names resolve to `org.blockml.bml.type.*` — see § Context-Bound Implicit Namespace. Domain types require the `type:` prefix or a full FQN:

```text
type="Integer"   → org.blockml.bml.type.Integer   (Property.type site)
type="Float"     → org.blockml.bml.type.Float
type="type:Size3D" → com.machineblocks.bml.type.Size3D   (domain — prefix required)
```

There is no `Null` primitive — see `17_type_system_bml.md` — EMPTY.

Collections and unions are type expressions — not ValueTypes:

```text
Integer[]              → multiplicity 0..n on Integer
"auto" | Float         → union (replaces AutoOr<Float>)
com.foo.Box<Integer>   → generic application (Box is StructType with <genericTypes>)
```

In `type="..."` attributes write `com.foo.Box(Integer)` — see `17_type_system_bml.md` — Generics — BML attribute syntax.

See `17_type_system_bml.md` — Type Expressions.

Domain-specific types require an explicit namespace prefix declared via `xmlns`:

```xml
xmlns:type="com.machineblocks.bml.type"

<size type="type:Size3D">
  <value>[1, 1, 3]</value>
</size>
<baseColor type="type:Color">
  <value>#EAC645</value>
</baseColor>
<cutout type="type:BaseCutoutType">
  <value>standard</value>
</cutout>

<!-- Primitives — no prefix needed -->
<text type="Text">
  <value></value>
</text>
<pillars type="Boolean">
  <value>true</value>
</pillars>
<textSize type="Integer">
  <value>9</value>
</textSize>
```

There is no implicit fallback to the baseType's namespace. If a type cannot be resolved, the compiler emits `BML_UNKNOWN_TYPE`.

### Enum Types vs. Suggestions

**Enum types** are formally defined EnumType blocks with a fixed set of values in `_values`. The editor renders them as a **SelectBox**. The compiler validates values against the enum definition. `<suggestions>` on an enum property is an error:

```xml
<!-- Enum type — SelectBox, validated -->
<baseCutoutType type="type:BaseCutoutType">
  <value>standard</value>
</baseCutoutType>
<!-- value literal (matches enum instance value="standard" / id STANDARD) -->

<baseCutoutType type="type:BaseCutoutType">
  <value>STANDARD</value>
</baseCutoutType>
<!-- short id form — FQN:: prefix omitted because property type is BaseCutoutType -->

<!-- equivalent qualified id reference -->
<baseCutoutType type="type:BaseCutoutType">
  <value>com.machineblocks.bml.type.BaseCutoutType::STANDARD</value>
</baseCutoutType>
<!-- No <suggestions> allowed → BML_SUGGESTIONS_ON_ENUM -->
```

When the property `type` is an EnumType, `value` and instance attribute values may use `{EnumTypeFQN}::{valueId}` or the short form `{valueId}` only. See `17_type_system_bml.md` — EnumType.

**Suggestions** are hints for free-text properties — the author can enter any value. The editor renders them as a **Combobox**. Each suggestion is a Block instance of the property type (not a special element):

```xml
<!-- Free-text with suggestions — Combobox, not validated -->
<textFont type="Text">
  <value>RBNo3.1 Black</value>
  <suggestions>
    <TextEntity value="Creato Display"/>
    <TextEntity value="RBNo3.1 Black"/>
  </suggestions>
</textFont>
```

**Constraints** describe semantic restrictions on a property — each entry is a Block instance extending `org.blockml.bml.core.Constraint`. The compiler binds the constraint generic to the property type automatically. Whether BlockML enforces a constraint depends on its optional `validation` property referencing `org.blockml.bml.core.Validation`:

```xml
<textSize type="Integer">
  <value>9</value>
  <constraints>
    <constraint:Min value="1" validation="Error"/>
    <constraint:Max value="72" validation="Error"/>
  </constraints>
</textSize>
```

Constraints without `validation` are metadata only — the BlockML validator ignores them. See `18_constraints_and_suggestions.md` for the full constraint and validation hierarchy, generic binding rules, and collection constraints.

For struct properties, suggestions are typed Block instances:

```xml
<size type="type:Size3D">
  <value>[1, 1, 3]</value>
  <suggestions>
    <type:Size3D x="1" y="1" z="3"/>
    <type:Size3D x="2" y="4" z="3"/>
  </suggestions>
</size>
```

**Computed values:** `value` may be an Expression referencing other Properties of the same Block. Cycle detection applies — see `10_expression_language.md`.

```xml
<numberOfSamples type="Integer">
  <value>5</value>
</numberOfSamples>
<labelSize type="Integer">
  <value>5</value>
</labelSize>
<size type="type:Size3D">
  <value>${ [#math.max(2 * numberOfSamples + 1, labelSize), 12, 2] }</value>
</size>
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

Aggregations describe ownership relationships. An Aggregation defines that a Block can contain zero or more child objects of a given type. **Composition is part of Aggregation** — an aggregation member may contain a nested `<composition>` that fills it directly.

For MachineBlocks Blocks, `_presets` and `_parts` are inherited from the base type chain — they do not need to be redeclared. Declare `<aggregations>` when adding aggregations beyond the inherited set, when overriding inherited aggregations, or when filling an aggregation on the Block definition:

```xml
<!-- Set: _steps beyond inherited _presets and _parts -->
<aggregations>
  <_steps type="com.machineblocks.bml.core.Step[]" />
</aggregations>

<!-- Fill inherited _parts on the Block definition -->
<aggregations>
  <_parts type="com.machineblocks.bml.core.Block[]">
    <composition>
      <bricks:Standard bml:id="base" size="[2, 4, 3]" />
    </composition>
  </_parts>
</aggregations>

<!-- Override inherited aggregation — type inherited, only composition specified -->
<aggregations>
  <_parts>
    <composition>
      <bricks:Standard bml:id="base" />
    </composition>
  </_parts>
</aggregations>
```

When overriding an inherited aggregation, `type` is required only on **new** declarations. Sub-Blocks and derived Blocks filling an inherited aggregation specify only the aggregation member element and nested `<composition>` — no `type` attribute.

```text
type         — child type (required on new declarations; omitted when filling inherited aggregations)
default      — boolean; marks the primary aggregation (tooling / render targets)
readOnly     — when true, instance authoring is forbidden (validator-enforced)
final        — prevents override in child Blocks
visibility   — optional; must match naming convention
```

**Context interpretation** — whether composition children are full Block instances or **type references** is determined by the aggregation's role and the enclosing Block type — not by an aggregation attribute. The parser stores Block instances as authored; the orchestrator and render targets apply the appropriate semantics from context. Examples: `bootstrap` / `_dependencies` / `_subLibraries` / `_blocks` on `org.blockml.bml.core.BlockLibrary` (empty instances — element name resolves to FQN); `<languages>` on Block definitions (Language references for `<implementation language="…">`). See also `00_bom_core.md` — Aggregations.

Member visibility follows § Member Visibility. Protected aggregations (`_name`) are accessible in derived Blocks and by the direct composition owner; private aggregations (`__name`) are confined to the declaring Block.

`bml:exportIds` on `<composition>` controls static ID export — see § `bml:exportIds` below.

**Type notation** — multiplicity is part of the type reference, not a separate attribute. BlockML has no `Array` type — see `17_type_system_bml.md` — Collections and Multiplicity.

```text
Integer         →  exactly 1
Integer[]       →  0..n   (shorthand for Integer[0..n])
Integer[0..n]   →  0..n
Integer[3]      →  exactly 3
Integer[1..5]   →  1..5
Integer[1..]    →  1..n

Block           →  0..1   (association/aggregation — optional single)
Block[]         →  0..n
Block[1..1]     →  exactly 1 required
```

**`bml:Self`** — refers to the current effective Block type, resolved after inheritance:

```xml
<association type="bml:Self" />
<association type="bml:Self[]" />
```

**`#this`** — refers to the current Block instance in expression context. Unqualified member references are shorthand for `#this` (`width` ≡ `#this.width`).

**Definition paths** — every definition element is addressable via its canonical structural path within the Block FQN. The path matches the BML document structure and encodes the definition kind:

```text
com.foo.Bar.properties.width        →  PropertyDefinition for width
com.foo.Bar.aggregations.children   →  AggregationDefinition for children
com.foo.Bar.capabilities.render     →  CapabilityDefinition for render
com.foo.Bar.name                    →  Block metadata
com.foo.Bar.documentation           →  Block documentation
```

No special definition-reference constructs are required — the path itself carries all type information. See `00_bom_core.md` — § Canonical definition paths.

**Service beans** register named service instances in a Composition. Once registered via `bml:bean`, the bean is accessible in Expressions via `@beanName`. The `bml:scope` attribute controls visibility to child Blocks:

```xml
<aggregations>
  <_fmt type="org.blockml.bml.service.Formatter">
    <composition>
      <org.blockml.bml.service.Formatter
          bml:bean="fmt"
          bml:scope="local" />
    </composition>
  </_fmt>
  <_data type="org.blockml.bml.service.JSONModel">
    <composition>
      <org.blockml.bml.service.JSONModel
          bml:bean="data"
          bml:scope="context" />
    </composition>
  </_data>
</aggregations>
```

Multiple instances of the same type with different bean names are possible:

```xml
<Utils bml:bean="math" bml:scope="context" />
<Utils bml:bean="format" bml:scope="context" />
```

`bml:scope="context"` beans are resolved by walking up the Composition hierarchy — a child Block sees the nearest `@data` with `bml:scope="context"` in any ancestor.

### Associations

Associations describe loose references without ownership. Defined for future use.

```xml
<associations>
  <targetDevice type="com.electronics.core.Component" />
</associations>
```

### Capabilities

Capabilities describe how a Block communicates. Like Properties, they are declared with a name and a type (FQN). Their value in a Composition is the address or binding — set as an attribute on the child Block instance, just like a Property value.

> **Capability package TBD** — placeholder `org.blockml.bml.capability.*`. Candidate: `bom.foundation`.

```xml
<capabilities>

  <!-- Inbound: receives data/messages asynchronously -->
  <resize type="org.blockml.bml.capability.Inbound"
          inputType="com.myDomain.ResizePayload">
    <documentation>Resize the block to the given dimensions.</documentation>
  </resize>

  <!-- Outbound: sends/emits data/messages asynchronously -->
  <resized type="org.blockml.bml.capability.Outbound"
           outputType="com.myDomain.ResizedPayload">
  </resized>

  <!-- Transformation: synchronously callable; inputType → outputType -->
  <computeArea type="org.blockml.bml.capability.Transformation"
               inputType="{ width: Integer, height: Integer }"
               outputType="Integer">
    <documentation>Returns width * height.</documentation>
  </computeArea>

</capabilities>
```

**Type descriptor forms:**

```text
org.blockml.bml.type.Integer            — primitive
com.myDomain.MyClass             — Object (named fields)
{ values: Integer[0..n] }        — collection field (multiplicity on reference)
{ items: com.myDomain.MyClass[] } — collection of domain objects
```

On Capability `type`, unqualified names resolve to `org.blockml.bml.capability.*`. On `inputType` / `outputType`, unqualified names resolve to `org.blockml.bml.type.*` — see § Context-Bound Implicit Namespace. General block references (aggregation type, association type, `baseType`) have no implicit namespace.

**Validation:** `Inbound` requires `inputType` (no `outputType`). `Outbound` requires `outputType` (no `inputType`). `Transformation` requires both. Async reply via `replyTo` is a runtime/message pattern — not modeled on the Capability.

**Protected and private Capabilities** — follow § Member Visibility. Private Capabilities (`__name`) cannot be bound from outside the declaring Block. Protected Capabilities (`_name`) follow the formal access rule in § Member Visibility — including derived Blocks and the direct composition owner.

---

## Composition

A Composition fills an Aggregation with concrete child Block instances. On **Block definitions**, `<composition>` is nested inside the aggregation member. On **Block instances**, aggregations are filled directly by member name — no `<composition>` wrapper.

The `composition aggregation="…"` attribute is **removed**.

### Unified Container Concept

BlockML has one container concept with two forms:

```text
Container
├── composition      — initial fill of an aggregation inside a Block definition only
└── bml:container    — general container everywhere else (Block instances)
```

Both support the same directives: `bml:if`, `bml:each`, `bml:with`, `bml:exportIds`, and future container directives.

```xml
<!-- Definition: composition inside aggregation member -->
<aggregations>
  <items>
    <composition>
      <ac:Wall/>
    </composition>
  </items>
</aggregations>

<!-- Instance: bml:container inside aggregation member -->
<items>
  <bml:container bml:if="${enabled}" bml:each="${parts}">
    <ac:Wall/>
  </bml:container>
</items>
```

### Placement Rules

```text
Block definition — inherited default aggregation (_parts on CompositeBlock):
  <aggregations>
    <_parts>
      <composition>…</composition>
    </_parts>
  </aggregations>
  → type omitted on _parts when inherited

Block definition — Sub-Block filling inherited _parts:
  <_parts>
    <composition>…</composition>
  </_parts>
  → top-level aggregation member on the Sub-Block; type omitted

Block definition — multiple aggregations:
  <aggregations>
    <_presets type="…">
      <composition>…</composition>
    </_presets>
    <_parts>
      <composition>…</composition>
    </_parts>
  </aggregations>
  → type required only on new declarations; inherited members omit type

Block instance — multiple aggregations:
  <house:Room bml:id="kitchen">
    <_walls>
      <walls:Wall bml:id="left"/>
    </_walls>
    <_furniture>
      <furniture:Table bml:id="table"/>
    </_furniture>
  </house:Room>

Block instance — recursive inner structure:
  <walls:Wall bml:id="left">
    <_parts>
      <bricks:Standard/>
      <bricks:Standard/>
    </_parts>
  </walls:Wall>
  → Block instances open aggregations directly — no <composition> wrapper
```

**Rules:**

```text
<composition> must always be nested inside an aggregation member element — never standalone
New aggregation declaration     → type required
Inherited aggregation override  → type omitted
Standalone <composition>        → BML_STANDALONE_COMPOSITION (validation error)
```

### `bml:exportIds`

Static instance ID visibility is controlled by `bml:exportIds`. Permitted on:

```text
<composition>     — inside aggregation definitions
<bml:container>    — inside Block instances
Block instances   — on the instance element itself
```

```xml
<composition bml:exportIds="true">
  <ac:Wall bml:id="wall">
    <items>
      <ac:Corner bml:id="corner"/>
    </items>
  </ac:Wall>
</composition>
```

All static IDs within the container are exported. The value is inherited recursively by child instances and may be overridden at deeper levels.

### Recursive Composition

Every Block instance may contain aggregation members directly. This makes the language fully recursive — complex object structures can be described wherever Block instances appear.

```xml
<_parts>
  <walls:Wall bml:id="left">
    <_parts>
      <bricks:Standard/>
      <bricks:Standard/>
    </_parts>
  </walls:Wall>
</_parts>
```

Child elements inside `<composition>` are Block instances. Each instance:

```text
Tag name        — class name (with namespace prefix)
bml:id          — composition instance identity (part ID). Required when referenced or on bml:each (literal or Expression).
                  Omitted on anonymous static children → auto-ID after directive expansion.
bml:version     — optional on external block references; exact-version assert when present.
                  Omitted → resolve effective version from TypeRegistry context.
                  Forbidden inside Library files → BML_VERSION_NOT_ALLOWED_IN_LIBRARY.
                  Same-document Sub-Block references omit bml:version.
bml:bean        — optional; registers this instance as a named service bean (accessible via @bean in Expressions)
bml:scope       — optional; "local" | "context" (service instances only; default: "local")
renderGroup     — optional, fallback = resolved bml:id
namespace       — optional, fallback = resolved bml:id
(attributes)    — any Member value of the referenced Block type (camelCase) — property namespace is free
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
size="${ [size.x, size.y, size.z - 1] }"

<!-- Expression: object with property reference and model binding -->
config="${ {mode: baseCutoutType, label: @myModel:/config/label} }"

<!-- Expression: built-in service call -->
size="${ [size.x, size.y, #math.max(size.z - 1, 0)] }"

<!-- Expression: bean call, named parameters (Object payload) -->
label="${ @myFormatter.format(value = size.x, unit = 'mm') }"

<!-- Expression: bean call, object literal (equivalent) -->
label="${ @myFormatter.format({value: size.x, unit: 'mm'}) }"

<!-- Expression: model binding (absolute) -->
label="${ @myModel:/config/label }"

<!-- Expression: model binding (relative — requires binding context on parent aggregation) -->
label="${ @myModel:label }"

<!-- Expression: ternary -->
baseCutoutType="${ size.z > 2 ? 'groove' : 'standard' }"
```

Capability values:

```xml
<!-- Absolute URI → Outbound routing -->
<ac:MyBlock onResized="stud://enclosure/blocks/resized" />

<!-- Relative path → context-resolved (TBD) -->
<ac:MyBlock onResized="/blocks/resized" />

<!-- Capability linking: Outbound → Inbound, or Transformation → Transformation -->
<ac:MyBlock onResized="${ @myService.resizeHandler }" />

<!-- Dynamic address: Transformation Capability returns the address String -->
<ac:MyBlock onResized="${ @myService.getAddress() }" />
```

See `00_bom_core.md` — Expression System for the full specification.

### Sharing Values Between Siblings

Sibling child Blocks within the same Composition share computed values via **`bml:with`** on a common ancestor — typically `<composition>` or a wrapping `<bml:container>`:

```xml
<composition bml:with="totalHeight = ${ size.z }">
  <SomeBlock ... />
  <OtherBlock size="${ [1, 1, totalHeight - 1] }" ... />
</composition>
```

Variables from `bml:with` are visible to the element and all descendants. There is no separate registry mechanism.

---

## BML Directives

BML Directives are special attributes and elements in the `bml:` namespace. **Flow-control** directives control structure and flow within a Composition. **Serialization** directives (`bml:xml`) declare how Definition blocks map to canonical BML XML — see `19_definition_blocks_and_bml_xml.md`.

Flow-control directives follow the **Thymeleaf model** — attributes on the element they apply to. Whether a directive is pre-processed at compile time or translated into target-specific constructs is the BlockProcessor's decision.

### Directive Placement

| Attribute / namespace | Allowed on | Notes |
|---|---|---|
| `bml:id` | Block instances | Composition instance identity — literal or `${ expr }` |
| `bml:version` | Block instances | External block reference version (required when type is from another file) |
| `bml:bean` | Block instances | Service bean name — accessible via `@bean` in Expressions |
| `bml:scope` | Block instances | Bean visibility: `"local"` (default) or `"context"` |
| `bml:with` | `<composition>`, `<bml:container>`, Block instances | Local variable scope |
| `bml:each` | `<bml:container>`, Block instances | Loop |
| `bml:if`, `bml:unless` | `<bml:container>`, Block instances | Conditional |
| `<bml:xml>…</bml:xml>` | `org.blockml.bml.core.Block`, Definition blocks | XML root element for this type — `19_definition_blocks_and_bml_xml.md` |
| `bml:xml="attribute\|element\|text\|cdata"` | Members on Definition blocks | Member serialization shape — `19_definition_blocks_and_bml_xml.md` |

Bare `id=` or `version=` on composition instances are **member values** — same as any other attribute. Use `bml:id` / `bml:version` / `bml:bean` / `bml:scope` for composition meta.

### `bml:xml` — XML Serialization (Definition blocks)

Declares how a block type or member renders to canonical BML XML. Allowed only on `org.blockml.bml.core.Block` and blocks whose `baseType` chain includes `org.blockml.bml.core.Definition`.

```xml
<!-- Root element name for block documents -->
<bml:xml>block</bml:xml>

<!-- Root element from instance effective type -->
<bml:xml>${ bml:Self }</bml:xml>

<!-- Member element from instance name -->
<bml:xml>${ #this.name }</bml:xml>

<!-- Member value placement on Definition properties -->
<documentation type="Text" bml:xml="element">…</documentation>
```

Full specification: `19_definition_blocks_and_bml_xml.md`. Implementation status: **WIP**.

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

### `bml:container` — Virtual Container

Produces no Block output itself — groups child Blocks for shared directives:

```xml
<!-- Loop over a group of Blocks -->
<bml:container bml:each="i, stat : ${ numberOfSamples }">
    <Calibrator.Base
        offset="${ [0, i * -3, 0] }"
        label="${ rows[i].label }"
        valueStart="${ rows[i].valueStart }"
        valueStep="${ rows[i].valueStep }" />
    <Calibrator.StudDiameter
        offset="${ [0, i * -3, 0] }"
        valueStart="${ rows[i].valueStart }"
        valueStep="${ rows[i].valueStep }" />
</bml:container>

<!-- Conditional group -->
<bml:container bml:if="${ showCorners }">
    <ac:Corner offset="[0, 0, 0]"  direction="West" />
    <ac:Corner offset="[12, 0, 0]" direction="East" />
</bml:container>
```

### Dynamic Instance ID

Use `bml:id` for dynamic IDs in loops:

```xml
<bricks:StandardBrick
    bml:each="i : ${ numberOfSamples }"
    bml:id="${ 'sample_' + i }"
    offset="${ [2 * i, 0, 0] }" />
```

### `bml:with` — Local Variable Scope

Defines local variables within the scope of an element and its children. Variables can reference Properties and other expressions. Own Properties can be overridden within the local scope:

```xml
<!-- Simple local variable -->
<bricks:Standard
    bml:with="halfSize = ${ size.x / 2 }"
    size="${ [halfSize, size.y, size.z] }" />

<!-- Override own property within scope -->
<bml:container bml:with="numberOfSamples = ${ numberOfSamples + 1 }">
  <Base numberOfSamples="${ numberOfSamples }" />
</bml:container>

<!-- Multiple variables — comma-separated -->
<bml:container bml:with="w = ${ size.x }, h = ${ size.z - 1 }">
  <core:NativeBlock size="${ [w, size.y, h] }" />
</bml:container>

<!-- Share values between sibling instances (replaces former registry pattern) -->
<composition bml:with="totalHeight = ${ size.z }">
  <SomeBlock ... />
  <OtherBlock size="${ [1, 1, totalHeight - 1] }" ... />
</composition>
```

**Allowed on:**
```text
<composition>     — scope for all direct children
<bml:container>       — scope for container's children
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
    <baseType>com.machineblocks.bml.core.Block</baseType>
    <version>1.0.0</version>
    <properties>...</properties>
    <composition>...</composition>
  </block>
  <block>
    <name>_Utils</name>
    <visibility>protected</visibility>
    <baseType>org.blockml.bml.core.Entity</baseType>
    <version>1.0.0</version>
    <capabilities>...</capabilities>
  </block>
</subBlocks>
```

### Sub-Block Visibility

Sub-Blocks follow the **same naming convention and access model as members** (§ Member Visibility). Visibility controls BlockML reference scope only — not target-system visibility. A renderer may manifest private Sub-Blocks as helper classes, local modules, nested functions, separate public artifacts, or fully inlined structures.

| `<name>`     | Visibility  | BlockML reference scope |
| ------------ | ----------- | ----------------------- |
| `SubBlock`   | public      | inside and outside the enclosing Block definition |
| `_SubBlock`  | protected   | inside the enclosing Block definition and its derived Blocks |
| `__SubBlock` | private     | only inside the immediately declaring Block definition |

The normalized-name rule applies: Sub-Blocks differing only by visibility prefix must not coexist → `BML_DUPLICATE_MEMBER_VISIBILITY_VARIANT`.

### Optional `<visibility>` on Sub-Blocks

Sub-Blocks may declare an explicit root-level `<visibility>` element. It **must match** the naming convention:

```xml
<block>
  <name>__Helper</name>
  <visibility>private</visibility>
  ...
</block>

<block>
  <name>_Strip</name>
  <visibility>protected</visibility>
  ...
</block>

<block>
  <name>Base</name>
  <visibility>public</visibility>
  ...
</block>
```

When `<visibility>` is omitted, the parser **derives** visibility from `<name>` (same rules as members). A mismatch → `BML_VISIBILITY_MISMATCH`.

**Root Blocks must not declare `<visibility>`** — only Sub-Blocks inside `<subBlocks>`. On a root Block → `BML_VISIBILITY_ON_ROOT_BLOCK`.

```text
Calibrator.bml — root Block:
  <visibility>public</visibility>     ✗  BML_VISIBILITY_ON_ROOT_BLOCK

Calibrator.bml — Sub-Block _Utils:
  <visibility>protected</visibility>  ✓  matches _Utils

Calibrator.bml — composition in same file:
  <Base ... />                        ✓  public Sub-Block
  <_Utils ... />                      ✓  protected — same Block
  <__Helper ... />                    ✓  private — same Block only

Calibrator.Base composition (nested Sub-Block):
  <_Utils ... />                      ✓  protected — derived Sub-Block
  <__Helper ... />                    ✗  BML_PRIVATE_SUBBLOCK_ACCESS — private

OtherFile.bml:
  <cal:Calibrator.Base ... />         ✓  public Sub-Block, qualified ref
  <cal:Calibrator._Utils ... />       ✗  BML_PROTECTED_SUBBLOCK_ACCESS — protected
  <cal:Calibrator.__Helper ... />     ✗  BML_PRIVATE_SUBBLOCK_ACCESS — private
```

Sub-Block access diagnostics:

```text
BML_PRIVATE_SUBBLOCK_ACCESS    — private Sub-Block referenced outside declaring Block
BML_PROTECTED_SUBBLOCK_ACCESS  — protected Sub-Block outside allowed inheritance context
```

### FQN Auto-Resolution

```text
Parent FQN:  com.machineblocks.bml.calibration.Calibrator
Sub-Block:   <name>Base</name>
→ FQN:       com.machineblocks.bml.calibration.Calibrator.Base

Sub-Block:   <name>StudDiameter</name>
→ FQN:       com.machineblocks.bml.calibration.Calibrator.StudDiameter
```

`<type>` is never declared on Sub-Blocks — it is always derived. Sub-Blocks can be nested recursively:

```text
com.machineblocks.bml.calibration.Calibrator.Base.Strip
```

### Composition Block References

Composition child elements are **general block references** — they have **no implicit namespace**. Every composition instance tag requires an `xmlns:` prefix or a full FQN:

```xml
<!-- correct -->
<core:Step bml:id="step1" … />
<cal:Calibrator.Base bml:id="base_stud" … />
<cal:Calibrator.StudDiameter bml:id="samples_stud" … />

<!-- invalid — bare PascalCase tag without prefix -->
<Base bml:id="base_stud" … />
<StudDiameter bml:id="samples_stud" … />
```

The parser resolves the element QName via the document's `xmlns:` declarations and stores the **resolved FQN** on the BOM node.

**Aggregation type example (`BlockLibrary.bml`):**

```xml
<aggregations>
  <bootstrap type="core:Bootstrap" />
  <_dependencies type="core:BlockLibrary[]" />
  <_subLibraries type="core:BlockLibrary[]" />
  <_schemas type="btype:FilePathEntity[]" />
  <_blocks type="core:Block[]" />
</aggregations>
```

**Library reference aggregations:** `bootstrap`, `_dependencies`, `_subLibraries`, and `_blocks` on `org.blockml.bml.core.BlockLibrary` hold empty Block instances as type references — the element name (with xmlns prefix) resolves to the referenced type FQN. **`bml:version` is forbidden** on these children. No separate reference Sub-Blocks (`Dependency`, `BlockRef`) are needed. **`bootstrap`** typically references a `README` block (`org.blockml.bml.core.Bootstrap`). **`_schemas`** holds `FilePathEntity` composition children.

```xml
<!-- com/machineblocks/bml/bricks/Library.bml -->
<aggregations>
  <_dependencies>
    <composition>
      <blockml:Library />
    </composition>
  </_dependencies>
  <_blocks>
    <composition>
      <type:Size3d />
      <bricks:Standard />
    </composition>
  </_blocks>
</aggregations>
```

### Sub-Block reference scope

Sub-Blocks must always be referenced with an **`xmlns:` prefix** and a **qualified name** (`RootBlock.SubBlock`), or with the full FQN. Bare Sub-Block short names are never resolved — not even within the same BML file.

```text
Same file (Calibrator.bml defines Sub-Block Base):
  <cal:Calibrator.Base bml:id="base_stud" … />     ✓
  <Base bml:id="base_stud" … />                    ✗  BML_UNQUALIFIED_BLOCK_REFERENCE

Other file (Set.bml composes Calibrator internals):
  <cal:Calibrator.Base … />                        ✓  parent Block namespace + qualified name
  <cal:Calibrator.Base.Strip … />                  ✓  nested Sub-Block
  <Base … />                                       ✗  BML_UNQUALIFIED_BLOCK_REFERENCE
  xmlns + full FQN on element                      ✓  com.machineblocks.bml.calibration.Calibrator.Base
```

**Rule:** Sub-Blocks are always referenced with the **parent Block's namespace prefix** and a **qualified name** (`RootBlock.SubBlock`), or with the full FQN.

Accepted qualified forms:

```text
Calibrator.Base                              — RootBlock.SubBlock (same package context)
com.machineblocks.bml.calibration.Calibrator.Base — full FQN
cal:Calibrator.Base                          — xmlns prefix of parent Block + qualified name
```

### Sub-Block naming vs parent Block name

A Sub-Block should **not** share the same `<name>` as the root Block that contains it (e.g. root `Calibrator` with Sub-Block `Calibrator`). If it does, the Sub-Block FQN becomes `…Calibrator.Calibrator` and a bare short tag is ambiguous with the root type.

```text
Root:      <name>Calibrator</name>
Sub-Block: <name>Calibrator</name>   → FQN …Calibrator.Calibrator  (discouraged)

Reference in same file:
  <Calibrator />                         ✗  ambiguous — BML_SUBBLOCK_QUALIFIED_REFERENCE_REQUIRED
  <Calibrator.Calibrator />              ✓
  <cal:Calibrator.Calibrator />          ✓  (from any file with xmlns:cal)
```

When the Sub-Block name differs from the root Block name, the short name remains valid **inside the same file only** (see reference scope above).

When referencing a Sub-Block from **outside** the parent Block, use the full FQN:

```xml
xmlns:cal="com.machineblocks.bml.calibration"
...
<cal:Calibrator.Base ... />
```

### utility Sub-Blocks

A Sub-Block with `baseType="org.blockml.bml.core.Entity"` binds target-language function implementations to Transformation Capabilities via `<implementation language="...">` — using **`org.blockml.bml.language.*`** FQNs.

Two implementation languages are supported in V1:

**`language="org.blockml.bml.language.OpenSCAD"`** — OpenSCAD function(s) written directly in the BML. Each Capability has exactly one main function (whose name matches the Capability name) and zero or more helper functions. The compiler automatically prefixes all function names with the block FQN — so names are written short and clean in the BML:

```xml
<block>
  <name>Utils</name>
  <baseType>org.blockml.bml.core.Entity</baseType>
  <version>1.0.0</version>

  <capabilities>
    <formatValue
                type="org.blockml.bml.capability.Transformation"
                inputType="org.blockml.bml.type.Float"
                outputType="org.blockml.bml.type.Text">
      <documentation>Removes leading zero: 0.1 → ".1", -0.2 → "-.2"</documentation>
      <implementation language="org.blockml.bml.language.OpenSCAD"><![CDATA[
// Main function — name must match capability name
function formatValue(x) =
    replaceZeroDot(str(<$ #math.round_n(x, 1) $>));

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
    </formatValue>
  </capabilities>
</block>
```

**`language="org.blockml.bml.language.TypeScript"`** — TypeScript arrow function. In V1, compile-time execution only: when all call arguments are literals, the compiler executes the function in Node.js and emits the result as a literal. Runtime transpilation to OpenSCAD is deferred.

The `<implementation>` element is a child of `<capability>`. One `<implementation>` per Capability. The **`language`** attribute is required and must be an `org.blockml.bml.language.*` FQN. Capability references inside the CDATA body use **BML Embedded Expression** syntax (`<$ … $>`) — see `10_expression_language.md`.

### Visibility

Sub-Blocks are full BOM objects with their own FQN and can be referenced from outside the parent Block via full FQN. External use is possible but uncommon — the naming convention makes their belonging clear.

### Calibrator Example

```xml
<block xmlns="http://blockml.org/schema/block">

  <name>Calibrator</name>
  <type>com.machineblocks.bml.calibration.Calibrator</type>
  <baseType>com.machineblocks.bml.core.Block</baseType>
  <version>1.0.0</version>

  <properties>
    <numberOfSamples type="Integer" >
      <value>5</value>
    </numberOfSamples>
    <font            type="Text"  >
      <value>Liberation Sans</value>
    </font>
    <fontSize        type="Float"   >
      <value>3</value>
    </fontSize>
    <labelSize       type="Integer" >
      <value>5</value>
    </labelSize>
    <valueStart      type="Float"   >
      <value>0.0</value>
    </valueStart>
    <valueStep       type="Float"   >
      <value>0.1</value>
    </valueStep>
  </properties>

  <subBlocks>

    <!-- Sub-Block: Calibrator.Base -->
    <!-- FQN: com.machineblocks.bml.calibration.Calibrator.Base -->
    <block name="Base">
      <properties>
        <label           type="Text"  >
      <value></value>
    </label>
        <numberOfSamples type="Integer" >
      <value>5</value>
    </numberOfSamples>
        <valueStart      type="Float"   >
      <value>0</value>
    </valueStart>
        <valueStep       type="Float"   >
      <value>0.1</value>
    </valueStep>
        <font            type="Text"  >
      <value>Liberation Sans</value>
    </font>
        <fontSize        type="Float"   >
      <value>3</value>
    </fontSize>
        <labelSize       type="Integer" >
      <value>5</value>
    </labelSize>
      </properties>
      <composition>
        <!-- Base strip -->
        <bricks:StandardBrick
            bml:id="strip"
            size="${ [2 * numberOfSamples + 1, 1, 1] }"
            baseCutoutType="none"
            studs="false" />

        <!-- Label block -->
        <bricks:StandardBrick
            bml:id="label"
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
            bml:id="${ 'val_' + stat.index }"
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
    <!-- FQN: com.machineblocks.bml.calibration.Calibrator.StudDiameter -->
    <block name="StudDiameter">
      <properties>
        <numberOfSamples type="Integer" >
      <value>5</value>
    </numberOfSamples>
        <valueStart      type="Float"   >
      <value>0</value>
    </valueStart>
        <valueStep       type="Float"   >
      <value>0.1</value>
    </valueStep>
      </properties>
      <composition>
        <bricks:StandardBrick
            bml:each="i : ${ numberOfSamples }"
            bml:id="${ 's_' + i }"
            size="[1, 1, 1]"
            offset="${ [2 * (i - #math.floor(0.5 * numberOfSamples)), 0, 0] }"
            studDiameterAdjustment="${ valueStart + i * valueStep }"
            baseCutoutType="none" />
      </composition>
    </block>

  </subBlocks>

  <composition>
    <!-- Four calibration rows via bml:container loop -->
    <bml:container bml:each="row, stat : ${ rows }">
      <Base
          bml:id="${ 'base_' + stat.index }"
          offset="${ [0, stat.index * -3, 0] }"
          label="${ row.label }"
          valueStart="${ row.valueStart }"
          valueStep="${ row.valueStep }"
          numberOfSamples="${ numberOfSamples }"
          font="${ font }"
          fontSize="${ fontSize }"
          labelSize="${ labelSize }" />
      <StudDiameter
          bml:id="${ 'samples_' + stat.index }"
          offset="${ [0, stat.index * -3, 0] }"
          numberOfSamples="${ numberOfSamples }"
          valueStart="${ row.valueStart }"
          valueStep="${ row.valueStep }" />
    </bml:container>
  </composition>

</block>
```

### Visibility

Sub-Blocks have their own FQN and can be referenced from outside the parent Block via full FQN. External use is possible but uncommon — the naming convention makes their belonging clear.

---

## MachineBlocks Set Definition

A MachineBlocks Set is a Block whose `baseType` is `com.machineblocks.bml.core.Set`. It uses the standard `<block>` document type — there is no separate root element for Sets.

A Set uses three conventional Aggregations — `_presets` and `_parts` inherited from the base type chain, `_steps` declared on Set:

```text
_presets    — block palette (configurations referenced by basePresets on _parts entries)
_parts      — placed block instances (direction, offset, basePresets; id becomes SCAD instance id)
_steps      — assembly order (optional; defaults to document order of _parts)
```

### Structure

```xml
<block xmlns="http://blockml.org/schema/block"
       xmlns:core="com.machineblocks.bml.core"
       xmlns:ac="com.martianmicro.anyclosure">

  <name>DefaultEnclosure</name>
  <type>com.martianmicro.anyclosure.DefaultEnclosure</type>
  <baseType>com.machineblocks.bml.core.Set</baseType>
  <version>1.0.0</version>

  <properties>
    <baseColor      type="Color"        >
      <value>#EAC645</value>
    </baseColor>
    <highlightColor type="Color"        >
      <value>#55AB68</value>
    </highlightColor>
    <assembly       type="AssemblyMode"  >
      <value>Merged</value>
    </assembly>
  </properties>

  <!-- Block palette: inherited _presets -->
  <aggregations>
    <_presets>
      <composition>
        <ac:Floor  bml:id="floor"  size="[16, 16, 1]" />
        <ac:Corner bml:id="corner" size="[4, 4, 9]"   />
        <ac:Wall   bml:id="wall"   size="[1, 8, 9]"   />
        <ac:Lid    bml:id="lid"    size="[16, 16, 1]" />
      </composition>
    </_presets>

    <!-- Placed instances: inherited _parts -->
    <_parts>
      <composition>
        <ac:Floor bml:id="00001" basePresets="floor"  direction="West"  offset="[0, 0, 0]"   />
        <ac:Corner bml:id="00002" basePresets="corner" direction="West"  offset="[0, 0, 1]"   />
        <ac:Wall bml:id="00003" basePresets="wall"   direction="West"  offset="[0, 4, 1]"   />
        <ac:Corner bml:id="00004" basePresets="corner" direction="North" offset="[0, 12, 1]"  />
        <ac:Wall bml:id="00005" basePresets="wall"   direction="North" offset="[4, 15, 1]"  />
        <ac:Corner bml:id="00006" basePresets="corner" direction="East"  offset="[12, 12, 1]" />
        <ac:Wall bml:id="00007" basePresets="wall"   direction="East"  offset="[15, 4, 1]"  />
        <ac:Corner bml:id="00008" basePresets="corner" direction="South" offset="[12, 0, 1]"  />
        <ac:Wall bml:id="00009" basePresets="wall"   direction="South" offset="[4, 0, 1]"   />
        <ac:Lid bml:id="0000A" basePresets="lid"    direction="West"  offset="[0, 0, 10]"  />
      </composition>
    </_parts>

    <!-- _steps omitted → assembly order = document order of _parts -->
    <_steps>
      <composition>
        <core:Step part="00001" />
        <core:Step part="00002" />
        <core:Step part="00003" />
      </composition>
    </_steps>
  </aggregations>

</block>
```

### Step

`com.machineblocks.bml.core.Step` is a **framework Block** (`Step.bml`) — it extends `org.blockml.bml.core.Block`. Used as composition children on Sets:

```text
aggregation _presets + <composition>  →  block palette (Floor, Wall, …)
aggregation _parts + <composition>    →  placed block instances
aggregation _steps + <composition>      →  core:Step instances (optional)
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
<aggregations>
  <_presets>
    <composition>
      <ac:Wall bml:id="wall" size="[1, 8, 9]" baseColor="#303D4E" />
    </composition>
  </_presets>

  <_parts>
    <composition>
      <ac:Wall bml:id="00003" basePresets="wall" direction="West"  offset="[0, 4, 1]"  />
      <ac:Wall bml:id="00005" basePresets="wall" direction="North" offset="[4, 15, 1]" />
      <ac:Wall bml:id="00007" basePresets="wall" direction="East"  offset="[15, 4, 1]" />
      <ac:Wall bml:id="00009" basePresets="wall" direction="South" offset="[4, 0, 1]"  />
    </composition>
  </_parts>
</aggregations>
```

### Block Configuration Modes

Three modes, combinable:

```text
Option 1 — Inline:
  All properties defined directly on the instance in _parts.

Option 2 — Preset reference:
  Instance references preset id(s) via basePresets.
  Compiler merges preset chain into effective properties.

Option 3 — Preset + inline override:
  basePresets as base. Inline properties override individual values.
  Merge order: configProfile < basePresets chain < inline property
```

### SCAD Set Output

The SCAD Renderer detects `baseType = com.machineblocks.bml.core.Set` and generates four view submodules:

```text
total     — all instances assembled at their positions
print     — all instances laid out for 3D printing
step      — step-by-step assembly instruction
instance  — single instance in isolation
```

---

## Presets (MachineBlocks)

Presets are **not** a BlockML core feature. MachineBlocks models them as ordinary Block instances in the `_presets` aggregation, referenced via the `basePresets` association on any MachineBlocks Block.

Preset merge is compiler logic (`resolveBasePresets`, block merge helpers). Customizer JSON output is render-target logic (machineblocks-v3-scad).

A preset block (e.g. `com.machineblocks.bml.bricks.StandardPresets`) is a normal `<block>` with `baseType="com.machineblocks.bml.core.Block"` whose composition fills `_presets` with Block instances of the target type.

### Structure

```xml
<!--
  FQN: com.machineblocks.bml.bricks.StandardPresets
-->
<block
  xmlns:bml="http://blockml.org/schema/bml"
  xmlns="http://blockml.org/schema/block"
  xmlns:type="com.machineblocks.bml.type"
  xmlns:bricks="com.machineblocks.bml.bricks"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="
    http://blockml.org/schema/block
        https://blockml.org/schemas/core/block.xsd
  ">

  <idea>Named size and color shortcuts for the Standard brick.</idea>
  <documentation>Standard brick presets for MachineBlocks Standard block.</documentation>

  <name>StandardPresets</name>
  <type>com.machineblocks.bml.bricks.StandardPresets</type>
  <baseType>com.machineblocks.bml.core.Block</baseType>
  <version>3.0.0</version>

  <aggregations>
    <_presets>
      <composition bml:exportIds="true">

        <bricks:Standard bml:id="brick-1x1" name="Brick 1x1" bml:version="3.0.0" size="[1, 1, 3]" />

        <bricks:Standard bml:id="color-red" name="Red" bml:version="3.0.0" baseColor="#D65745" />

        <!-- Composite preset — basePresets merges preset chain -->
        <bricks:Standard bml:id="brick-1x1-red"
                         name="Brick 1x1 Red"
                         bml:version="3.0.0"
                         basePresets="brick-1x1 color-red" />

        <!-- Composite with own override -->
        <bricks:Standard bml:id="brick-1x1-red-text"
                         name="Brick 1x1 Red MB"
                         bml:version="3.0.0"
                         basePresets="brick-1x1-red"
                         text="MB"
                         textColor="#EDF0F1" />

        <!-- Cross-file basePresets reference -->
        <bricks:Standard bml:id="brick-2x4-special"
                         name="Brick 2x4 Special"
                         bml:version="3.0.0"
                         basePresets="com.myproject.presets.MyPresets::my-base brick-2x4"
                         textColor="#EDF0F1" />

      </composition>
    </_presets>
  </aggregations>

</block>
```

**`bml:id`** — stable kebab-case identifier. Used for references via `basePresets` and thumbnail filenames. Must be unique within the enclosing Block's `_presets`. Never changes once published.

**`name`** — human-readable display name. Used in the SCAD Customizer JSON and editor UI. May be renamed without breaking references.

**`basePresets`** — space-separated preset ids on any MachineBlocks Block instance. Local ids resolve within the enclosing Block's `_presets`; cross-file entries use `{BlockFQN}::{id}`. Applied left-to-right; later entries override earlier. Own instance properties override all base presets.

Qualified `{BlockFQN}::{id}` references require the target composition to declare `bml:exportIds="true"` and the target instance to have a **literal static `bml:id`** — see `00_bom_core.md` — Qualified Block Instance References.

Presets can reference other presets — preset instances in `_presets` may themselves carry `basePresets`, forming an inheritance chain.

### Preset Reference Syntax

```text
{BlockFQN}::{preset-id}

Example:
  com.machineblocks.bml.bricks.StandardPresets::brick-2x4
```

Requirements for qualified references:

```text
1. Target `<{aggregationName}><composition bml:exportIds="true">`
2. Target instance: literal bml:id (no ${ … }, not bml:each-only)
3. Reference: literal attribute value (not ${ … })
```

Diagnostics: `BML_UNEXPORTED_INSTANCE_REF` · `BML_NON_STATIC_INSTANCE_REF`

### Preset in Compositions

```xml
<!-- Preset only -->
<bricks:Standard bml:version="3.0.0"
    basePresets="com.machineblocks.bml.bricks.StandardPresets::brick-2x4" />

<!-- Preset + inline override -->
<bricks:Standard bml:version="3.0.0"
    basePresets="com.machineblocks.bml.bricks.StandardPresets::brick-2x4"
    baseColor="#303D4E" />
```

Merge order: `configProfile < basePresets chain < inline property`

### Multiple Preset Blocks for the Same Block Type

Different authors or packages can contribute preset blocks for the same Block type:

```text
com.machineblocks.bml.bricks.StandardPresets   ← from @machineblocks/bricks library
com.myproject.presets.MyBrickPresets       ← own additions
```

Both are referenced by their own FQN — no conflict, no registry ambiguity.

**Resolution order** when merging (highest priority first):

```text
1. Own instance properties
2. basePresets — applied left-to-right, later entries override earlier
3. Block definition values (property `value` on the Block type)
```

Cycles in `basePresets` → `BML_PRESET_CYCLE`.

### SCAD Output

The render target may produce a `.json` file in OpenSCAD Customizer format when compiling a preset block:

```text
BML:   blocks/com/machineblocks/bml/bricks/presets/StandardPresets.bml
JSON:  scad/com/machineblocks/bml/bricks/Standard.json
```

The Customizer JSON uses the preset **name** as the key — the human-readable label shown in the OpenSCAD UI.

---

## Config Profiles

Config profiles are MachineBlocks preset blocks (`baseType="com.machineblocks.bml.core.Block"`) that define project-wide hardware or rendering defaults. Each preset instance in `_presets` carries a project ConfigBlock instance (or inherits via `basePresets`).

```text
src/config/prusa_pla.bml   — printer + filament profile
src/config/scale_2x.bml    — scale profile
```

Only one config profile is active at a time (set via `bom activate-config`). Merge priority:

```text
configProfile < basePresets chain < inline property
```

---

## Library Format (`org.blockml.bml.core.BlockLibrary`)

A Library groups related Blocks, optional XSD schemas, and dependencies into a publishable unit. Block and ValueType definitions are exported via `_blocks`. **Library membership is defined exclusively by `Library.bml`** — not by directory layout. If absent, all BML source files in a directory are treated as public.

**Name (required):** `<name>Library</name>`. Filename is always `Library.bml`. FQN = `{package}.Library` (e.g. `com.machineblocks.bml.bricks.Library`, `org.blockml.bml.Library`, `org.blockml.bml.compiler.Library`).

### Nested libraries

Multiple libraries may coexist at different package levels. Example: `org.blockml/Library.bml` and `org.blockml/compiler/Library.bml` are **separate** libraries — the inner one is not automatically part of the outer catalog.

```text
Typical pattern:
  inner Library  →  _dependencies includes outer Library
  outer Library  →  _subLibraries lists inner Library; must NOT list inner-library blocks in _blocks

Violation: outer _blocks references a Block exported by org.blockml.bml.compiler.Library
           → BML_LIBRARY_NESTING_VIOLATION
```

Physical directories and overlapping package prefixes do not define membership. A `.bml` file is a library member **only** if listed in that library's `_blocks`.

### Structure

```xml
<!--
  FQN: com.machineblocks.bml.bricks.Library
  Filename: Library.bml
-->
<block xmlns="http://blockml.org/schema/block"
       ...>

  <idea>Published catalog of MachineBlocks standard brick definitions.</idea>
  <documentation>MachineBlocks standard brick library.</documentation>

  <name>Library</name>
  <type>bricks:Library</type>
  <baseType>bcore:BlockLibrary</baseType>
  <version>3.0.0</version>

  <properties>
    <description type="Text"
              >
      <value>Standard brick types for MachineBlocks</value>
    </description>
  </properties>

  <aggregations>
    <_dependencies>
      <composition>
        <blockml:Library />
      </composition>
    </_dependencies>

    <!-- Optional legacy XSD -->
    <_schemas>
      <composition>
        <btype:FilePathEntity value="bricks.xsd" />
      </composition>
    </_schemas>

    <_blocks>
      <composition>
        <type:Size3d />
        <type:Direction />
        <bricks:Standard />
        <bricks:Plate />
        <bricks:Tile />
        <bricks:StandardPresets />
      </composition>
    </_blocks>
  </aggregations>

</block>
```

**`bootstrap`, `_dependencies`, `_subLibraries`, and `_blocks`** use Block instances as type references — the element name resolves to the Block FQN. **`bml:version` is forbidden** — effective version is resolved from library context.

**`bootstrap`** points to the library entry point — typically a `README` block with a `readFirst` documentation list (see `doc:BootstrapModel`). Example on `org.blockml.bml.Library`:

```xml
<bootstrap>
  <composition>
    <blockml:README />
  </composition>
</bootstrap>
```

**`value` paths** on `_schemas` `FilePathEntity` entries are relative to the **library package root** (directory containing `Library.bml`).

**`_blocks`** lists exported Block and ValueType definitions (composable Blocks, StructType, EnumType, presets, …). **`_schemas`** holds optional legacy XSD paths as `FilePathEntity` instances during migration; omit when all types are in BML.

**Directory structure (illustrative — membership comes from `_blocks`, not paths):**

```text
org/blockml/bml/
  Library.bml              ← org.blockml.bml.Library
  core/Block.bml           ← member iff in org.blockml.bml.Library _blocks
  compiler/
    Library.bml            ← org.blockml.bml.compiler.Library (separate unit)
    Parser.bml             ← member iff in org.blockml.bml.compiler.Library _blocks only

com/machineblocks/bml/bricks/
  Library.bml              ← com.machineblocks.bml.bricks.Library
  bricks.xsd               ← optional legacy XSD
  types/
    Size3D.bml · Direction.bml · …
  blocks/
    Standard.bml
    Plate.bml
    Tile.bml
  presets/
    StandardPresets.bml
    PlatePresets.bml
```

Without a Library block: all `.bml` source files in the directory are public.

Legacy `library.xml` is **replaced** by the Library block — not supported in V1.

---

## JSON Format (Deferred — TBD)

> **Not in V1.** The V1 compiler parser accepts XML only. This section sketches a possible future subset — specification and implementation are **TBD**.

JSON as a BML authoring format faces fundamental constraints from BlockML's namespace model:

```text
Namespaces          → no element-name types (bricks:StandardBrick); explicit type fields only
bml:* directives    → no attribute-namespace mechanism
Member QNames       → no prefixed element names; explicit namespace fields would be needed
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
    { "name": "size",          "type": "Size3D",  "value": [1, 8, 8] },
    { "name": "baseColor",     "type": "Color",   "value": "#303D4E" },
    { "name": "wallThickness", "type": "Integer", "value": 1,
      "documentation": "Thickness of the wall in grid units." }
  ],
  "compositions": [
    {
      "children": [
        {
          "type": "com.machineblocks.bml.bricks.StandardBrick",
          "id": "bottom",
          "size": "${ [size.x, size.y, size.z - 1] }",
          "recess": true,
          "tongue": true,
          "recessWallGaps": "x+"
        },
        {
          "type": "com.machineblocks.bml.bricks.StandardBrick",
          "id": "top",
          "size": "${ [size.x, size.y, 1] }",
          "offset": "${ [0, 0, size.z - 1] }",
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
  "baseType": "com.machineblocks.bml.core.Set",
  "version": "1.0.0",
  "properties": [
    { "name": "baseColor",      "type": "Color",        "value": "#EAC645" },
    { "name": "highlightColor", "type": "Color",        "value": "#55AB68" },
    { "name": "assembly",       "type": "AssemblyMode", "value": "Merged"  }
  ],
  "aggregations": [
    { "name": "_steps", "type": "com.machineblocks.bml.core.Step[]" }
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
        { "type": "com.martianmicro.anyclosure.Floor",  "id": "00001", "basePresets": "floor",  "direction": "West",  "offset": [0, 0, 0]   },
        { "type": "com.martianmicro.anyclosure.Corner", "id": "00002", "basePresets": "corner", "direction": "West",  "offset": [0, 0, 1]   },
        { "type": "com.martianmicro.anyclosure.Wall",   "id": "00003", "basePresets": "wall",   "direction": "West",  "offset": [0, 4, 1]   }
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

There is no separate mapping rule for MachineBlocks Sets. The `<block>` mapping rule handles them identically to any other Block. The SCAD Renderer detects `baseType = com.machineblocks.bml.core.Set` and switches to STEPS-based output.

### Default Resolution

```text
baseType missing              → BML_MISSING_BASE_TYPE (no default)
<aggregations> missing        → no parser action; inherited members resolved at validate (e.g. _presets, _parts from MachineBlocks base types)
standalone <composition>      → BML_STANDALONE_COMPOSITION (validation error)
<aggregation> without type on new declaration       → BML_MISSING_AGGREGATION_TYPE
<aggregation> with type when filling inherited member → type ignored or BML_REDUNDANT_AGGREGATION_TYPE (implementation choice)
partial member override       → merge with parent member at validate; private/final violations → errors
visibility mismatch           → BML_VISIBILITY_MISMATCH
private member access         → BML_PRIVATE_MEMBER_ACCESS
protected member access       → BML_PROTECTED_MEMBER_ACCESS
visibility prefix collision   → BML_DUPLICATE_MEMBER_VISIBILITY_VARIANT
private Sub-Block reference   → BML_PRIVATE_SUBBLOCK_ACCESS
protected Sub-Block reference → BML_PROTECTED_SUBBLOCK_ACCESS
BML_UNKNOWN_NAMESPACE_PREFIX  → member element prefix references undeclared xmlns: prefix
final member override         → BML_FINAL_MEMBER_OVERRIDE
readOnly member on instance   → BML_READONLY_MEMBER_WRITE
type="Foo" (unqualified at general site)  →  BML_UNKNOWN_TYPE (no implicit namespace)
type="Integer" (Property.type)          →  org.blockml.bml.type.Integer
bml:version omitted on external instance → resolve effective version from TypeRegistry context
bml:version present on external instance  → exact-version assert → BML_UNKNOWN_VERSION if no match
bml:version inside Library file           → BML_VERSION_NOT_ALLOWED_IN_LIBRARY (error)
Block definition without effective version → BML_MISSING_VERSION (error)
same-document Sub-Block instance          → bml:version not required
bml:id missing on referenced instance     → BML_MISSING_ID
bml:id missing on bml:each element        → BML_MISSING_ID
basePresets / Step.part unresolvable     → BML_UNRESOLVABLE_INSTANCE_REF
qualified FQN::id without bml:exportIds="true"     → BML_UNEXPORTED_INSTANCE_REF
qualified FQN::id with Expression id/ref    → BML_NON_STATIC_INSTANCE_REF
anonymous static child without bml:id     → auto-ID after directive expansion (not stored in BOM)
_steps missing or empty       → assembly order = document order of _parts
```
