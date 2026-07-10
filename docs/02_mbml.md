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
Namespaces          xmlns:bricks="com.machineblocks.bricks"
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

Library packages use `<block baseType="org.blockml.core.BlockLibrary">` — see § Library Format.

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

**Language vs. implementation:** Reserved public language namespaces (`org.blockml.core`, `org.blockml.type`, `org.blockml.status`, `org.blockml.service`, `org.blockml.capability`, `org.blockml.language`) are for BML-defined grammar only. Internal BOM and toolchain types use separate namespaces (`org.blockml.bom`, `org.blockml.parser`, `org.blockml.compiler`, …). See `00_bom_core.md` — Reserved Language Namespaces.

```xml
xmlns:core="com.machineblocks.core"
xmlns:bricks="com.machineblocks.bricks"
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

**General rule:** XML prefixes have no semantic meaning. During parsing, every prefix is resolved via the document's `xmlns:` declarations. The BOM stores **canonical namespace identifiers only** (FQN or URI) — never XML aliases. This applies to Block type references, member `namespace` attributes, `type:` shorthand, and all other namespaced BML syntax. See § Member Namespace Attribute.

### Type Namespace Shorthand

Property `type` attributes and unqualified composition tags use **namespace-prefixed names** for domain types. **Unqualified** PascalCase names are resolved in a fixed order within the current BML document — see § Unqualified Block Resolution below.

**Domain types** require the `type:` namespace prefix (declared via `xmlns:type="com.machineblocks.type"`):

```text
type="type:Size3D"   →  com.machineblocks.type.Size3D
type="type:Color"    →  com.machineblocks.type.Color
```

There is no implicit fallback to the domain namespace. Explicit FQNs are always supported.

### Unqualified Block Resolution

Unqualified PascalCase identifiers — on composition element names, `type="..."` attributes, and related member declarations — resolve in this **fixed order** within the current BML document:

```text
1. Own Block name       — matches root <name> of the enclosing BlockDefinition
2. SubBlocks            — subBlocks[] of innermost enclosing Block, walk up parent chain,
                          then Sub-Blocks inherited via baseType chain
3. Generic parameters   — genericTypes[] of the root BlockDefinition (e.g. type="T")
4. Core primitives      — whitelist only (→ org.blockml.type.*):
                          String · Float · Integer · Decimal · Boolean
```

After steps 1–4 fail in document scope:

```text
5. xmlns prefix         — bricks:Standard, type:Size3D, …
6. TypeRegistry         — global FQN lookup
```

**Naming mutual exclusion:** A `genericType` name must differ from the root Block `<name>` and from every Sub-Block `<name>` in the same document (`BML_GENERIC_BLOCK_NAME_COLLISION`, `BML_GENERIC_SUBBLOCK_NAME_COLLISION`). Sub-Blocks and generic parameters therefore never compete for the same identifier — steps 2 and 3 are disjoint in practice.

**Own Block name (step 1):** When an unqualified reference matches the root Block's `<name>`, it resolves to that Block's declared `<type>` FQN — a self-type reference within the same definition. For inheritance-aware self-reference at validate time, `_self` remains available (see § Members — `_self`).

**Core primitives (step 4):** Only the five whitelist names above resolve without prefix. Abstract branches such as `org.blockml.type.Number` or `org.blockml.core.PrimitiveType` are **not** in the whitelist — use `Integer`, `Float`, or `Decimal` for numeric properties.

```text
type="Integer"   →  org.blockml.type.Integer
type="Float"     →  org.blockml.type.Float
type="Decimal"   →  org.blockml.type.Decimal
type="String"    →  org.blockml.type.String
type="Boolean"   →  org.blockml.type.Boolean
type="Number"    →  ✗  not whitelisted — use Integer, Float, or Decimal
```

### Status Namespace Shorthand

Status references use the `status:` namespace prefix (declared via `xmlns:status="org.blockml.status"`):

```text
status:Stable       →  org.blockml.status.Stable
status:Draft        →  org.blockml.status.Draft
status:Stub         →  org.blockml.status.Stub
status:Deprecated   →  org.blockml.status.Deprecated
```

There is **no implicit resolution** of bare status names. `Draft` alone is invalid — always use `status:Draft` or the full FQN `org.blockml.status.Draft`. Domain libraries may define additional status blocks under their own namespace.

**Property and Capability types** must resolve to a **ValueType** — a Block whose `baseType` chain includes `org.blockml.core.ValueType`. Non-ValueType FQNs (e.g. `com.foo.Wall`) are invalid as property or Capability input/output types → `BML_INVALID_PROPERTY_TYPE`.

**Member namespace:** `org.blockml.core.Block` declares **no members**. Every sub-type chooses its own Properties, Aggregations, Associations, and Capabilities — including names like `id` or `version` if a domain needs them. On composition instances, **instance identity** uses `bml:id` and **external reference version** uses `bml:version` — not bare attributes (see Composition section).

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
<baseType>          — FQN of the parent type. Mandatory — no default. Omitted only on org.blockml.core.Block.
<version>           — semantic version of this Block definition
<status>            — optional; Block reference. Omitted = inherit from parent (document root defaults to status:Stable)
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
<documentation>BOM Core primitive ValueType for floating-point numbers. Unqualified name Float resolves to org.blockml.type.Float.</documentation>
```

`<idea>` is required on every Block definition (root blocks and Sub-Blocks). Omitted on root blocks → `BML_MISSING_IDEA` (warning in V1, error in a later release). The idea is primary input for editors, LLMs, and documentation navigation — it answers *what is this?* before *how does it work?*

WOT alignment: the Idea is the stable semantic constant; documentation describes how a World interprets and uses it. See `WOT_Reference_v26.md` — The Idea.

### `<documentation>`

`<documentation>` follows `<idea>`, still before `<name>`. It describes the Block definition itself — not individual members (those carry their own `<documentation>`). Omitted on root blocks → `BML_MISSING_DOCUMENTATION` (warning in V1, error in a later release).

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
<references>  — cross-references (container of <reference> entries)
```

Applies to all definition elements that carry documentation:

```text
<block>  <property>  <aggregation>  <association>  <capability>  <constraint>  <suggestion>
```

and to any future definition element with `<documentation>`.

On root `<block>` definitions, optional documentation extensions follow `<documentation>` and precede `<name>`. On members and Sub-Blocks, they appear alongside `<documentation>` among definition metadata children (before `<value>`, `<composition>`, or other content containers).

Goal: keep API documentation, version history, examples, and related-type links at the definition site — a single source of truth inside BML files.

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

Container for cross-references to related Blocks or definition elements. Each `<reference>` requires a `type` attribute — the FQN of the referenced Block or Definition. Optional text body explains why or how the referenced element relates:

```xml
<references>

    <reference type="com.machineblocks.core.CompositeBlock">
        Base type when this Block owns child instances in composition.
    </reference>

    <reference type="org.blockml.core.ValueType" />

    <reference type="org.blockml.definition.PropertyDefinition">
        See PropertyDefinition for member documentation shape.
    </reference>

</references>
```

The `type` attribute accepts any Block FQN or Definition FQN (`org.blockml.definition.*`, `org.blockml.core.Definition` sub-types). Omitted `type` → `BML_REFERENCE_MISSING_TYPE` (error). Unknown FQN at validate time → `BML_UNKNOWN_TYPE` (error).

Maps to BOM `DocumentationReference { type, context? }`. Meta-model: `org.blockml.definition.ReferenceDefinition` on `org.blockml.core.Definition.references` — see `16_framework_base_types.md` — Definition Branch.

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

Non-definition elements (`<documentation>`, `<since>`, `<changelog>`, `<examples>`, `<references>`, `<implementation>`, Block instances, …) may carry `bml:status="status:Draft"` when deviating from inherited status — same rules as `<documentation>`.

### `<status>` — maturity marker

Status expresses the maturity or lifecycle of a definition. Status is a **Block reference**, not a string or boolean — following Everything-is-a-Block.

**Implicit default:** When no status is declared, the effective status is **`status:Stable`** (`org.blockml.status.Stable`). At the document root this applies directly; on child elements the effective status is inherited from the parent — which is Stable unless an ancestor declared a deviation.

#### Inheritance and defaults

Status is **inherited downward** through the element tree. Authors declare status **only when it deviates** from the effective status of the parent element.

```text
Document root (no parent)     →  effective status: status:Stable
Child element (no declaration) →  inherits parent effective status
Child with <status> or bml:status →  sets local effective status for its subtree
```

Examples:

```text
<block> (omit status)                    → Stable; all children inherit Stable
  <property> (omit status)               → Stable (inherited)
  <property><status>status:Draft</status> → Draft; <documentation> inside inherits Draft
  <idea bml:status="status:Stub">        → Stub (deviates from block's Stable)
  <bricks:Wall bml:status="status:Deprecated"> → Deprecated instance under Stable block
```

On a **Draft** property, nested `<documentation>`, `<since>`, `<changelog>`, `<examples>`, `<references>`, `<constraints>`, and composition children inherit **Draft** — no attribute needed. To mark a child as **Stable** inside a Draft property, set `bml:status="status:Stable"` explicitly.

Core library defines:

```text
org.blockml.core.Status          — abstract base
org.blockml.status.Stable        — implicit default at document root
org.blockml.status.Draft
org.blockml.status.Stub
org.blockml.status.Deprecated
```

Domain libraries may define additional status blocks.

#### Definition elements: `<status>` child

Only elements that **define** something may carry a `<status>` child — and **only when deviating** from the inherited status:

```text
<block>  <property>  <aggregation>  <association>  <capability>  <constraint>  <suggestion>
```

```xml
<property name="width" type="Float">
    <status>status:Draft</status>
    <documentation>Target width in grid units — mapping incomplete.</documentation>
    <value>4</value>
</property>
```

#### Non-definition elements: `bml:status` attribute

Elements that are **not** definitions do not carry a `<status>` child. Use `bml:status` **only when deviating** from the inherited status:

```xml
<!-- Block is Stable (default); idea deviates to Stub -->
<idea bml:status="status:Stub">
  Reserved for future multi-material support.
</idea>

<!-- Stable block; deprecated composition instance -->
<bricks:StandardBrick
    bml:status="status:Deprecated"
    bml:id="legacy"
    size="[2, 4, 3]" />

<!-- Draft property; implementation inherits Draft — omit bml:status -->
<capability name="formatValue" …>
  <implementation type="lang:TypeScript"><![CDATA[…]]></implementation>
</capability>

<!-- Draft property; one child doc reviewed early — explicit deviation -->
<documentation bml:status="status:Stable">
  Reviewed description text (property itself remains Draft).
</documentation>
```

#### No implicit namespace resolution

Status values are always explicit when declared:

```xml
<!-- correct -->
<status>status:Draft</status>

<!-- invalid — no bare-name resolution -->
<status>Draft</status>
```

The sole existing shorthand exception remains Core primitives (`Integer` → `org.blockml.type.Integer`).

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
                              — self-closing <abstract /> is equivalent to true (preferred at root)
<final>                       — true | false (default false). Final types cannot be used as baseType.
                              — self-closing <final /> is equivalent to true (preferred at root)
<visibility>                  — Sub-Blocks only: private | protected | public; must match <name>
<subTypes>          — override: permitted Sub-Block baseTypes (omit to inherit — see Framework Base Types)
<languages>         — Language references for <implementation type="...">
<properties>    — Property declarations. Omit if no custom properties or default overrides needed.
<aggregations>  — Aggregation declarations. Omit when inherited aggregations from baseType suffice.
<associations>  — Association declarations.
<capabilities>  — Capability declarations.
<contracts>     — Contract references (reusable partial definitions). Root block only.
<subBlocks>     — Sub-Block definitions (see Sub-Blocks section).
<composition>   — internal structure inside the default aggregation. Omit for Leaf Blocks.
                — equivalent to <{defaultAggregation}><composition>…</composition></{defaultAggregation}>
```

Framework base types (`org.blockml.core.Block`, `com.machineblocks.core.Block`, …) are **BML files** in `@blockml/core` and `@machineblocks/mbom` — not code or YAML. See `16_framework_base_types.md`.

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
org.blockml.core.Block        — sole type that omits <baseType> (inheritance root); effective subTypes []
```

### Contracts

Blocks may declare `<contracts>` at root level to compose one or more **contract Blocks** — reusable partial definitions whose member fragments are merged into the effective Block definition:

```xml
<contracts>
  <contract type="com.foo.IIdentifiable" />
  <contract type="com.foo.IPlaceable" />
</contracts>
```

```text
type    — FQN of a contract Block whose partial definition is merged (required)
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
  <baseType>org.blockml.core.Block</baseType>
  <version>1.0.0</version>
  <abstract />
  <properties>
    <id type="String" />
  </properties>
</block>
```

**Example — contract supplies type, Block completes the member:**

```xml
<block xmlns="http://blockml.org/schema/block" …>
  <name>MyEntity</name>
  <type>com.foo.MyEntity</type>
  <baseType>org.blockml.core.Entity</baseType>
  <version>1.0.0</version>
  <contracts>
    <contract type="com.foo.IIdentifiable" />
    <contract type="com.foo.IPlaceable" />
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
  http://blockml.org/schema/data     ← data: attributes (uninterpreted metadata)
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

All Members — Properties, Aggregations, Associations, and Capabilities — share a single member namespace per Block. Logical uniqueness is determined by **`(namespace, name)`** — not by name alone. Members without an explicit `namespace` attribute belong to the **default namespace** (empty string). A validation error is raised for duplicates within the same resolved namespace.

The `namespace` attribute uses the **same XML namespace mechanism** as element prefixes — see § Member Namespace Attribute. The parser stores the resolved identifier, never the XML alias.

### Conventions

**Member declaration order:** within `<properties>`, `<aggregations>`, and `<associations>`, child elements are mapped to `members[]` in **XML document order**. The parser must not reorder. Order is significant for StructType field indices, array literals (`size="[4,2,3]"`), and Capability positional parameter mapping. See `17_type_system_bml.md` — Ordered Struct Fields · `12_bom_object_model.md` — Member Declaration Order.

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

**Composition placement** — a Composition fills an Aggregation. It may appear:

```text
1. Nested inside <aggregation> on a Block definition (preferred when multiple aggregations exist)
2. As a top-level <composition> element — sugar when exactly one effective default aggregation exists
3. On Block instances — opening a specific aggregation inline (see § Composition)
```

For CompositeBlocks the default aggregation is typically inherited `_parts`. Sets and Libraries have multiple aggregations — each must be opened explicitly via `<{aggregationName}><composition>…</composition></{aggregationName}>` on the definition, or directly by member name on instances.

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
        bml:id="bottom"
        bml:version="1.0.0"
        size="${ [size[0], size[1], size[2] - 1] }"
        recess="true"
        tongue="true"
        recessWallGaps="x+" />

    <bricks:StandardBrick
        bml:id="top"
        bml:version="1.0.0"
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
       xmlns:bricks="com.machineblocks.bricks"
       xmlns:status="org.blockml.status">

  <idea>Parametric enclosure wall.</idea>
  <documentation>Wall block with native and custom properties.</documentation>

  <name>Wall</name>
  <type>com.martianmicro.anyclosure.Wall</type>
  <baseType>com.machineblocks.core.Block</baseType>
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
      <status>status:Draft</status>
      <documentation>Thickness of the wall in grid units.</documentation>
      <value>1</value>
    </wallThickness>
  </properties>

  <composition>
    <bricks:StandardBrick
        bml:id="bottom"
        size="${ [size[0], size[1], size[2] - 1] }"
        recess="true"
        tongue="true"
        recessWallGaps="x+" />

    <bricks:StandardBrick
        bml:id="top"
        size="${ [size[0], size[1], 1] }"
        offset="${ [0, 0, size[2] - 1] }"
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
    <print type="org.blockml.capability.Outbound"/>
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

**Primitive properties — scalar only:** Properties typed with `org.blockml.core.PrimitiveType` (Integer, Float, String, Boolean, Decimal) carry **inline scalar values** on Block instances — attributes or child elements with literal text. They do not use nested primitive Block instances (`<Integer value="5"/>`) as property values. Boxed primitive Block instances appear in `<suggestions>`, composition children, and other non-property contexts. See `17_type_system_bml.md` — § PrimitiveType — Scalar role vs instance role.

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

Visibility is determined primarily by **naming convention**:

| Name       | Visibility |
| ---------- | ---------- |
| `__member` | private    |
| `_member`  | protected  |
| `member`   | public     |

**private** — visible only within the declaring Block. Not visible in child Blocks. Does not collide with same-named members in child Blocks.

**protected** — visible within the declaring Block and in all child Blocks. Not package-wide.

**public** — publicly visible.

### Optional `visibility` Attribute

Members may optionally declare an explicit visibility that must match the naming convention:

```xml
<__token visibility="private"/>
<_size   visibility="protected"/>
<label   visibility="public"/>
```

A mismatch between `name` and `visibility` is a validation error (`BML_VISIBILITY_MISMATCH`).

The same rules apply to **Sub-Blocks** — see § Sub-Blocks — Sub-Block Visibility. Sub-Blocks may declare optional root-level `<visibility>`; root Blocks must not.

### Common Member Attributes

All member kinds support these optional attributes:

```text
readOnly="true|false"   — informational only (renderers, editors, generators). No BlockML semantics.
final="true|false"      — when true, child Blocks cannot override this member. Validator-enforced.
namespace="prefix"      — XML namespace prefix (declared via xmlns:prefix in the same document)
```

### Member Namespace Attribute

The `namespace` attribute on a member uses the **same namespace mechanism as XML**. The author writes an XML prefix declared in the current document — not a raw URI or dotted name.

```xml
<block
    xmlns="http://blockml.org/schema/block"
    xmlns:ui="com.foo.ui">

  <properties>
    <width  namespace="ui" type="Integer">
      <value>100</value>
    </width>
    <height namespace="ui" type="Integer">
      <value>200</value>
    </height>
  </properties>
</block>
```

Here `ui` is a local alias only. The parser resolves it immediately via the document's XML namespace table:

```text
Authored:   namespace="ui"  name="width"
            xmlns:ui="com.foo.ui"

Stored:     namespace = "com.foo.ui"
            name      = "width"
```

The alias `ui` does not exist in the BOM after parsing.

**Equivalence across prefixes:** these two documents are semantically identical:

```xml
xmlns:ui="com.foo.ui"
<width namespace="ui" type="Integer"/>
```

```xml
xmlns:design="com.foo.ui"
<width namespace="design" type="Integer"/>
```

Both store `namespace = "com.foo.ui"`, `name = "width"`. Different documents may use different prefixes without changing member meaning.

**Scope:** the prefix must be declared in the **same document** where it is used. Each Block definition may declare its own `xmlns:` aliases. Importing or referencing blocks does not require matching prefix names.

**Overrides:** member override matching uses the **resolved namespace identifier**, not the XML prefix. A child Block may use a different alias for the same namespace:

```xml
<!-- Parent -->
xmlns:ui="com.foo.ui"
<width namespace="ui" type="Integer">
  <value>100</value>
</width>

<!-- Child -->
xmlns:design="com.foo.ui"
<width namespace="design">
  <value>42</value>
</width>
```

Both resolve to key `(com.foo.ui, width)` — the override merges correctly.

**`bml` prefix:** using `xmlns:bml` for member namespaces is permitted but **not recommended** — the `bml:` prefix is reserved for language directives (`bml:id`, `bml:each`, …). Prefer domain-specific prefixes (e.g. `ui`, `physics`, `style`).

Undeclared prefix → `BML_UNKNOWN_NAMESPACE_PREFIX`.

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

The effective definition is the **merge** of both declarations. Override matching uses the resolved `(namespace, name)` key — see § Member Namespace Attribute.

```text
Same member kind required     — property overrides property, aggregation overrides aggregation, …
Only specified attrs replaced — unspecified attrs inherited from parent
Private members               — cannot be overridden
final="true" on parent        — prevents override in child Blocks → BML_FINAL_MEMBER_OVERRIDE
```

The parser stores override declarations in `members[]`; `resolveEffectiveMembers()` merges along the `baseType` chain.

### Properties

Properties are typed parameters of the Block. Three kinds exist:

**System properties** are defined on `org.blockml.core.Block` — notably `id` (instance identity). System-relevant: dedicated compiler/validator/renderer handling. Not custom properties. See `00_bom_core.md` — System Properties.

**Domain native properties** are defined in `com.machineblocks.core.Block` and its base types. They have dedicated SCAD getters (`mb_param_size()`, etc.) and are listed in `09_mbom_properties.yml`.

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

Unqualified type names (no namespace prefix) resolve to `org.blockml.type.*` — the BOM Core primitives:

```text
Float    → org.blockml.type.Float
Integer  → org.blockml.type.Integer
String   → org.blockml.type.String
Boolean  → org.blockml.type.Boolean
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
xmlns:type="com.machineblocks.type"

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
<text type="String">
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
  <value>com.machineblocks.type.BaseCutoutType::STANDARD</value>
</baseCutoutType>
<!-- No <suggestions> allowed → BML_SUGGESTIONS_ON_ENUM -->
```

When the property `type` is an EnumType, `value` and instance attribute values may use `{EnumTypeFQN}::{valueId}` or the short form `{valueId}` only. See `17_type_system_bml.md` — EnumType.

**Suggestions** are hints for free-text properties — the author can enter any value. The editor renders them as a **Combobox**. Each suggestion is a Block instance of the property type (not a special element):

```xml
<!-- Free-text with suggestions — Combobox, not validated -->
<textFont type="String">
  <value>RBNo3.1 Black</value>
  <suggestions>
    <String value="Creato Display"/>
    <String value="RBNo3.1 Black"/>
  </suggestions>
</textFont>
```

**Constraints** are validation rules — each entry is a Block instance extending `org.blockml.core.Constraint`. The compiler binds the constraint generic to the property type automatically:

```xml
<textSize type="Integer">
  <value>9</value>
  <constraints>
    <constraint:Min value="1"/>
    <constraint:Max value="72"/>
  </constraints>
</textSize>
```

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

See `18_constraints_and_suggestions.md` for the full constraint hierarchy, generic binding rules, and collection constraints.

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
  <_steps type="com.machineblocks.core.Step[]" />
</aggregations>

<!-- Fill inherited _parts on the Block definition -->
<aggregations>
  <_parts type="com.machineblocks.core.Block[]">
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

When overriding an inherited aggregation, `type` is required only for **new** declarations. When filling an inherited aggregation, only `<composition>` needs to be specified.

```text
type         — child type (required on new declarations; inherited on overrides)
default      — boolean; marks the default aggregation for bare <composition>
readOnly     — informational only
final        — prevents override in child Blocks
namespace    — XML namespace prefix (resolved at parse time — see § Member Namespace Attribute)
visibility   — optional; must match naming convention
```

**Context interpretation** — whether composition children are full Block instances or **type references** is determined by the aggregation's role and the enclosing Block type — not by an aggregation attribute. The parser stores Block instances as authored; the orchestrator and render targets apply the appropriate semantics from context. Examples: `_dependencies` / `_blocks` on `org.blockml.core.BlockLibrary` (empty instances — element name resolves to FQN); `<languages>` on Block definitions (Language references for `<implementation type="…">`). See also `00_bom_core.md` — Aggregations.

Member visibility follows the naming convention in § Member Visibility. Protected aggregations (`_name`) are visible in child Blocks; private aggregations (`__name`) are not.

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

**`_self`** — refers to the current effective Block type, resolved after inheritance:

```xml
<association type="_self" />
<association type="_self[]" />
```

**Service Aggregations** bind named service beans into the Block. Once declared, the bean is accessible in Expressions via `@beanName`. The `scope` attribute controls visibility to child Blocks:

```xml
<aggregations>
  <!-- local: only accessible in this Block (default) -->
  <_fmt type="org.blockml.service.Formatter"
        beanName="fmt"
        scope="local" />

  <!-- context: passed down to all child Blocks in Compositions, overridable -->
  <_data type="org.blockml.service.JSONModel"
         beanName="data"
         scope="context" />
</aggregations>
```

`scope="context"` beans are resolved by walking up the Composition hierarchy — a child Block sees the nearest `@data` with `scope="context"` in any ancestor.

### Associations

Associations describe loose references without ownership. Defined for future use.

```xml
<associations>
  <targetDevice type="com.electronics.core.Component" />
</associations>
```

### Capabilities

Capabilities describe how a Block communicates. Like Properties, they are declared with a name and a type (FQN). Their value in a Composition is the address or binding — set as an attribute on the child Block instance, just like a Property value.

> **Capability package TBD** — placeholder `org.blockml.capability.*`. Candidate: `bom.foundation`.

```xml
<capabilities>

  <!-- Inbound: receives data/messages asynchronously -->
  <resize type="org.blockml.capability.Inbound"
          inputType="com.myDomain.ResizePayload">
    <documentation>Resize the block to the given dimensions.</documentation>
  </resize>

  <!-- Outbound: sends/emits data/messages asynchronously -->
  <resized type="org.blockml.capability.Outbound"
           outputType="com.myDomain.ResizedPayload">
  </resized>

  <!-- Transformation: synchronously callable; inputType → outputType -->
  <computeArea type="org.blockml.capability.Transformation"
               inputType="{ width: Integer, height: Integer }"
               outputType="Integer">
    <documentation>Returns width * height.</documentation>
  </computeArea>

</capabilities>
```

**Type descriptor forms:**

```text
org.blockml.type.Integer            — primitive
com.myDomain.MyClass             — Object (named fields)
{ values: Integer[0..n] }        — collection field (multiplicity on reference)
{ items: com.myDomain.MyClass[] } — collection of domain objects
```

Unqualified type names resolve against the domain's default type namespace (determined by the Block's `baseType`).

**Validation:** `Inbound` requires `inputType` (no `outputType`). `Outbound` requires `outputType` (no `inputType`). `Transformation` requires both. Async reply via `replyTo` is a runtime/message pattern — not modeled on the Capability.

**Protected and private Capabilities** — follow § Member Visibility. Private Capabilities (`__name`) cannot be bound from outside the declaring Block. Protected Capabilities (`_name`) are accessible in child Blocks.

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
Block definition — single default aggregation:
  <composition>…</composition>
  → sugar for <{defaultAggregation}><composition>…</composition></{defaultAggregation}>

Block definition — multiple aggregations:
  <aggregations>
    <_presets>
      <composition>…</composition>
    </_presets>
    <_parts>
      <composition>…</composition>
    </_parts>
  </aggregations>

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
  → valid when Wall has exactly one effective default aggregation
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

**Rules:**

```text
Single default aggregation  → bare <composition> permitted (on definitions only)
Multiple aggregations       → each must be opened explicitly by member name
Ambiguous bare <composition> → validation error when no unique default aggregation exists
```

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
<composition bml:with="totalHeight = ${ size[2] }">
  <SomeBlock ... />
  <OtherBlock size="${ [1, 1, totalHeight - 1] }" ... />
</composition>
```

Variables from `bml:with` are visible to the element and all descendants. There is no separate registry mechanism.

---

## Data Attributes (`data:`)

The `data:` namespace allows arbitrary metadata to be attached to Block definitions and Composition instances. Authoring syntax is inspired by **SAP UI5** — in UI5 views, `data:myVal` on a Control sets a customData key/value pair. BlockML uses the same **authoring pattern**, but there is **no `_customData` aggregation** on `org.blockml.core.Block`. Values land in the BOM as **uninterpreted expressions** in `dataAttributes[]`. A target renderer (e.g. UI5) may map them into runtime object aggregations — that is render concern.

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
    bml:id="strip"
    size="[2, 4, 3]"
    data:role="base-strip"
    data:group="calibration-row-0" />
```

### BOM Representation

`data:*` attributes and `data:*` child elements are stored as `dataAttributes[]` — **uninterpreted**, not evaluated at parse or validate time:

```text
data:role="structural"           →  DataAttribute { key: "role",  value: LiteralValue("structural") }
data:count="${ sampleCount }"    →  DataAttribute { key: "count", value: ExpressionValue(...) }
<data:tags>wall enclosure</data:tags>  →  DataAttribute { key: "tags", value: LiteralValue(...) }
```

No type validation against Block members. Renderers may interpret — e.g. UI5 target → runtime `customData`.

---

## BML Directives

BML Directives are special attributes and elements in the `bml:` namespace. **Flow-control** directives control structure and flow within a Composition. **Serialization** directives (`bml:xml`) declare how Definition blocks map to canonical BML XML — see `19_definition_blocks_and_bml_xml.md`.

Flow-control directives follow the **Thymeleaf model** — attributes on the element they apply to. Whether a directive is pre-processed at compile time or translated into target-specific constructs is the BlockProcessor's decision.

`data:*` is not part of this mechanism — see Data Attributes section above. Not a `bml:` directive; not a Block aggregation.

### Directive Placement

| Attribute / namespace | Allowed on | Notes |
|---|---|---|
| `bml:id` | Block instances | Composition instance identity — literal or `${ expr }` |
| `bml:version` | Block instances | External block reference version (required when type is from another file) |
| `bml:with` | `<composition>`, `<bml:container>`, Block instances | Local variable scope |
| `bml:each` | `<bml:container>`, Block instances | Loop |
| `bml:if`, `bml:unless` | `<bml:container>`, Block instances | Conditional |
| `<bml:xml>…</bml:xml>` | `org.blockml.core.Block`, Definition blocks | XML root element for this type — `19_definition_blocks_and_bml_xml.md` |
| `bml:xml="attribute\|element\|text\|cdata"` | Members on Definition blocks | Member serialization shape — `19_definition_blocks_and_bml_xml.md` |
| `data:*` | Block definitions and Block instances only | Not a `bml:` directive. Uninterpreted `dataAttributes[]` in BOM — renderer may consume. |

Bare `id=` or `version=` on composition instances are **member values** — same as any other attribute. Use `bml:id` / `bml:version` for composition meta.

### `bml:xml` — XML Serialization (Definition blocks)

Declares how a block type or member renders to canonical BML XML. Allowed only on `org.blockml.core.Block` and blocks whose `baseType` chain includes `org.blockml.core.Definition`.

```xml
<!-- Root element name for block documents -->
<bml:xml>block</bml:xml>

<!-- Root element from instance type FQN -->
<bml:xml>${ type }</bml:xml>

<!-- Member element from instance name -->
<bml:xml>${ name }</bml:xml>

<!-- Member value placement on Definition properties -->
<documentation type="String" bml:xml="element">…</documentation>
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
    bml:with="halfSize = ${ size[0] / 2 }"
    size="${ [halfSize, size[1], size[2]] }" />

<!-- Override own property within scope -->
<bml:container bml:with="numberOfSamples = ${ numberOfSamples + 1 }">
  <Base numberOfSamples="${ numberOfSamples }" />
</bml:container>

<!-- Multiple variables — comma-separated -->
<bml:container bml:with="w = ${ size[0] }, h = ${ size[2] - 1 }">
  <core:NativeBlock size="${ [w, size[1], h] }" />
</bml:container>

<!-- Share values between sibling instances (replaces former registry pattern) -->
<composition bml:with="totalHeight = ${ size[2] }">
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

### `data:` — Data Attribute Restriction

`data:*` attributes are only allowed on Block definitions and Block instances (elements extending `org.blockml.core.Block`). They are **not** the Thymeleaf directive model and **not** `bml:` directives. They must not appear on `<aggregation>`, `<capability>`, or other non-Block elements. Values are stored uninterpreted in `dataAttributes[]`.

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
  <block>
    <name>_Utils</name>
    <visibility>protected</visibility>
    <baseType>org.blockml.core.Entity</baseType>
    <version>1.0.0</version>
    <capabilities>...</capabilities>
  </block>
</subBlocks>
```

### Sub-Block Visibility

Sub-Blocks follow the **same naming convention as members** (§ Member Visibility). Visibility controls where a Sub-Block type may be referenced in compositions and member types:

| `<name>`     | Visibility  | Reference scope                                      |
| ------------ | ----------- | ---------------------------------------------------- |
| `__SubBlock` | private     | declaring Block only                                 |
| `_SubBlock`  | protected   | declaring Block and child Block instances            |
| `SubBlock`   | public      | anywhere (subject to cross-file qualified-name rules)|

**private** — referenceable only in the **declaring root Block's** own composition and members. Not in nested Sub-Block compositions. Not from external files.

**protected** — referenceable in the declaring Block and in **child Block instances** (composition descendants). Not from unrelated external Blocks.

**public** — referenceable from anywhere, including other files — using qualified names or FQN as required by § Sub-Block reference scope.

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
  <_Utils ... />                      ✓  protected — child Block
  <__Helper ... />                    ✗  BML_SUBBLOCK_NOT_IN_SCOPE — private

OtherFile.bml:
  <cal:Calibrator.Base ... />         ✓  public Sub-Block, qualified ref
  <cal:Calibrator._Utils ... />       ✗  BML_SUBBLOCK_NOT_IN_SCOPE — protected
  <cal:Calibrator.__Helper ... />     ✗  BML_SUBBLOCK_NOT_IN_SCOPE — private
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

When a composition child element has **no namespace prefix** (PascalCase tag name only), the parser resolves `typeFqn` using § Unqualified Block Resolution — same order as unqualified `type="..."` on member declarations.

```text
1. Own Block name
2. SubBlocks (innermost → parent chain → baseType-inherited)
3. Generic parameters
4. Core primitives (String · Float · Integer · Decimal · Boolean)
5. xmlns prefix
6. TypeRegistry
```

Stage [5] stores the **resolved FQN** on the BOM node (e.g. `com.machineblocks.calibration.Calibrator.Base`). Authors may write the short name in BML when the type is in scope per the order above.

**Same document — aggregation example (`BlockLibrary.bml`):**

```xml
<aggregations>
  <_dependencies type="core:BlockLibrary[]" />
  <_blocks type="core:Block[]" />
</aggregations>
```

**Same document — composition example:**

```xml
<!-- Inside Calibrator's composition: -->
<Base bml:id="base_stud" offset="[0, 0, 0]" ... />
<StudDiameter bml:id="samples_stud" ... />
```

**Library reference aggregations:** `_dependencies` and `_blocks` on `org.blockml.core.BlockLibrary` hold empty Block instances as type references — the element name (with xmlns prefix) resolves to the referenced type FQN. **`bml:version` is forbidden** on these children. No separate reference Sub-Blocks (`Dependency`, `BlockRef`) are needed.

```xml
<!-- com/machineblocks/bricks/Library.bml -->
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

**Inherited framework Sub-Blocks:** A block with `baseType="org.blockml.core.BlockLibrary"` (e.g. `Library`) still resolves `Schema` by short name — it is a Sub-Block of `org.blockml.core.BlockLibrary`, inherited via the baseType chain.

### Sub-Block reference scope

Unqualified Sub-Block references (PascalCase tag without prefix, or unqualified `type="SubBlockName"`) are permitted **only within the same BML file** where the Sub-Block is defined. The parser resolves them against `subBlocks[]` in that document — not against external files.

```text
Same file (Calibrator.bml defines Sub-Block Base):
  <Base bml:id="base_stud" ... />          ✓
  type="Base" on a member in same file     ✓

Other file (Set.bml composes Calibrator internals):
  <Base ... />                               ✗  BML_SUBBLOCK_UNQUALIFIED_REFERENCE
  <cal:Calibrator.Base ... />                ✓  parent Block namespace + qualified name
  <cal:Calibrator.Base.Strip ... />          ✓  nested Sub-Block
  xmlns + full FQN on element                ✓  com.machineblocks.calibration.Calibrator.Base
```

**Rule:** From outside the defining file — including child Block instances in other documents — Sub-Blocks must be referenced with the **parent Block's namespace prefix** and a **qualified name** (`RootBlock.SubBlock`), or with the full FQN. A bare Sub-Block short name is never resolved across files.

Accepted qualified forms:

```text
Calibrator.Base                              — RootBlock.SubBlock (same package context)
com.machineblocks.calibration.Calibrator.Base — full FQN
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
xmlns:cal="com.machineblocks.calibration"
...
<cal:Calibrator.Base ... />
```

### utility Sub-Blocks

A Sub-Block with `baseType="org.blockml.core.Entity"` binds target-language function implementations to Transformation Capabilities via `<implementation type="...">` — using **`org.blockml.language.*`** FQNs, not a `language` attribute.

Two implementation types are supported in V1:

**`type="org.blockml.language.OpenSCAD"`** — OpenSCAD function(s) written directly in the BML. Each Capability has exactly one main function (whose name matches the Capability name) and zero or more helper functions. The compiler automatically prefixes all function names with the block FQN — so names are written short and clean in the BML:

```xml
<block>
  <name>Utils</name>
  <baseType>org.blockml.core.Entity</baseType>
  <version>1.0.0</version>

  <capabilities>
    <formatValue
                type="org.blockml.capability.Transformation"
                inputType="org.blockml.type.Float"
                outputType="org.blockml.type.String">
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
    </formatValue>
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
    <numberOfSamples type="Integer" >
      <value>5</value>
    </numberOfSamples>
    <font            type="String"  >
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
    <!-- FQN: com.machineblocks.calibration.Calibrator.Base -->
    <block name="Base">
      <properties>
        <label           type="String"  >
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
        <font            type="String"  >
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
    <!-- FQN: com.machineblocks.calibration.Calibrator.StudDiameter -->
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

A MachineBlocks Set is a Block whose `baseType` is `com.machineblocks.core.Set`. It uses the standard `<block>` document type — there is no separate root element for Sets.

A Set uses three conventional Aggregations — `_presets` and `_parts` inherited from the base type chain, `_steps` declared on Set:

```text
_presets    — block palette (configurations referenced by basePresets on _parts entries)
_parts      — placed block instances (direction, offset, basePresets; id becomes SCAD instance id)
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

`com.machineblocks.core.Step` is a **framework Block** (`Step.bml`) — it extends `org.blockml.core.Block`. Used as composition children on Sets:

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

The SCAD Renderer detects `baseType = com.machineblocks.core.Set` and generates four view submodules:

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

A preset block (e.g. `com.machineblocks.bricks.StandardPresets`) is a normal `<block>` with `baseType="com.machineblocks.core.Block"` whose composition fills `_presets` with Block instances of the target type.

### Structure

```xml
<!--
  FQN: com.machineblocks.bricks.StandardPresets
-->
<block
  xmlns:bml="http://blockml.org/schema/bml"
  xmlns="http://blockml.org/schema/block"
  xmlns:type="com.machineblocks.type"
  xmlns:bricks="com.machineblocks.bricks"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="
    http://blockml.org/schema/block
        https://blockml.org/schemas/core/block.xsd
  ">

  <idea>Named size and color shortcuts for the Standard brick.</idea>
  <documentation>Standard brick presets for MachineBlocks Standard block.</documentation>

  <name>StandardPresets</name>
  <type>com.machineblocks.bricks.StandardPresets</type>
  <baseType>com.machineblocks.core.Block</baseType>
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
  com.machineblocks.bricks.StandardPresets::brick-2x4
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
    basePresets="com.machineblocks.bricks.StandardPresets::brick-2x4" />

<!-- Preset + inline override -->
<bricks:Standard bml:version="3.0.0"
    basePresets="com.machineblocks.bricks.StandardPresets::brick-2x4"
    baseColor="#303D4E" />
```

Merge order: `configProfile < basePresets chain < inline property`

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
2. basePresets — applied left-to-right, later entries override earlier
3. Block definition values (property `value` on the Block type)
```

Cycles in `basePresets` → `BML_PRESET_CYCLE`.

### SCAD Output

The render target may produce a `.json` file in OpenSCAD Customizer format when compiling a preset block:

```text
BML:   blocks/com/machineblocks/bricks/presets/StandardPresets.bml
JSON:  scad/com/machineblocks/bricks/Standard.json
```

The Customizer JSON uses the preset **name** as the key — the human-readable label shown in the OpenSCAD UI.

---

## Config Profiles

Config profiles are MachineBlocks preset blocks (`baseType="com.machineblocks.core.Block"`) that define project-wide hardware or rendering defaults. Each preset instance in `_presets` carries a project ConfigBlock instance (or inherits via `basePresets`).

```text
src/config/prusa_pla.bml   — printer + filament profile
src/config/scale_2x.bml    — scale profile
```

Only one config profile is active at a time (set via `bom activate-config`). Merge priority:

```text
configProfile < basePresets chain < inline property
```

---

## Library Format (`org.blockml.core.BlockLibrary`)

A Library groups related Blocks, optional XSD schemas, and dependencies into a publishable unit. Block and ValueType definitions are exported via `_blocks`. **Library membership is defined exclusively by `Library.bml`** — not by directory layout. If absent, all BML source files in a directory are treated as public.

**Name (required):** `<name>Library</name>`. Filename is always `Library.bml`. FQN = `{package}.Library` (e.g. `com.machineblocks.bricks.Library`, `org.blockml.Library`, `org.blockml.compiler.Library`).

### Nested libraries

Multiple libraries may coexist at different package levels. Example: `org.blockml/Library.bml` and `org.blockml/compiler/Library.bml` are **separate** libraries — the inner one is not automatically part of the outer catalog.

```text
Typical pattern:
  inner Library  →  _dependencies includes outer Library
  outer Library  →  must NOT list inner-library blocks in _blocks

Violation: outer _blocks references a Block exported by org.blockml.compiler.Library
           → BML_LIBRARY_NESTING_VIOLATION
```

Physical directories and overlapping package prefixes do not define membership. A `.bml` file is a library member **only** if listed in that library's `_blocks`.

### Structure

```xml
<!--
  FQN: com.machineblocks.bricks.Library
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
    <description type="String"
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
        <Schema ref="bricks.xsd" />
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

**`_dependencies` and `_blocks`** use Block instances as type references — the element name resolves to the Block FQN. **`bml:version` is forbidden** — effective version is resolved from library context.

**`ref` paths** on `Schema` are relative to the **library package root** (directory containing `Library.bml`).

**`_blocks`** lists exported Block and ValueType definitions (composable Blocks, StructType, EnumType, presets, …). **`_schemas`** is optional legacy XSD during migration; omit when all types are in BML.

**Directory structure (illustrative — membership comes from `_blocks`, not paths):**

```text
org/blockml/
  Library.bml              ← org.blockml.Library
  core/Block.bml           ← member iff in org.blockml.Library _blocks
  compiler/
    Library.bml            ← org.blockml.compiler.Library (separate unit)
    Parser.bml             ← member iff in org.blockml.compiler.Library _blocks only

com/machineblocks/bricks/
  Library.bml              ← com.machineblocks.bricks.Library
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
data:* attributes    → no equivalent to UI5-style namespaced attributes; would need explicit dataAttributes array
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
    { "name": "baseColor",      "type": "Color",        "value": "#EAC645" },
    { "name": "highlightColor", "type": "Color",        "value": "#55AB68" },
    { "name": "assembly",       "type": "AssemblyMode", "value": "Merged"  }
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

There is no separate mapping rule for MachineBlocks Sets. The `<block>` mapping rule handles them identically to any other Block. The SCAD Renderer detects `baseType = com.machineblocks.core.Set` and switches to STEPS-based output.

### Default Resolution

```text
baseType missing              → BML_MISSING_BASE_TYPE (no default)
<aggregations> missing        → no parser action; inherited members resolved at validate (e.g. _presets, _parts from MachineBlocks base types)
bare <composition> on definition or instance
  + single default aggregation in effective members → fills that aggregation (typically _parts for MB Blocks)
  + multiple aggregations, no unique default        → BML_AMBIGUOUS_COMPOSITION (validation error)
<aggregation> without type on new declaration       → BML_MISSING_AGGREGATION_TYPE
partial member override       → merge with parent member at validate; private/final violations → errors
visibility mismatch           → BML_VISIBILITY_MISMATCH
BML_UNKNOWN_NAMESPACE_PREFIX  → member namespace attribute references undeclared xmlns: prefix
final member override         → BML_FINAL_MEMBER_OVERRIDE
type="Foo" (unqualified)      → § Unqualified Block Resolution (own name · SubBlocks · generics · primitives whitelist)
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
