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
| `<language>` element child | `org.blockml.bml.language.*` | NaturalLanguage |
| `language` attribute on `<documentation>` | `org.blockml.bml.language.*` | NaturalLanguage |
| `language` attribute on `<change>` | `org.blockml.bml.language.*` | NaturalLanguage |
| `language` attribute on `<see>` | `org.blockml.bml.language.*` | NaturalLanguage |
| `relation` attribute on `<see>` | `org.blockml.bml.relation.*` | Relation |
| `language` attribute on `<example>` | `org.blockml.bml.language.*` | Language |
| `<status>` element content · `bml:status` attribute | `org.blockml.bml.status.*` | Status |
| Capability `type` | `org.blockml.bml.capability.*` | Capability branch |
| Constraint `validation` attribute | `org.blockml.bml.validation.*` | Validation |
| `<definition>` element content | `org.blockml.bml.definition.*` | SubBlockDefinition on Sub-Blocks; RootBlockDefinition on root and embedded blocks |

**Examples:**

```text
<width type="Integer" />                    →  org.blockml.bml.type.Integer
<implementation language="TypeScript">      →  org.blockml.bml.language.TypeScript
<language><English /></language>              →  org.blockml.bml.language.English
<documentation language="German">…           →  org.blockml.bml.language.German
<change version="2.0.0" language="German">…   →  org.blockml.bml.language.German
<see block="core:Block" language="English">… →  org.blockml.bml.language.English
<see block="core:Block" relation="Extends">… →  org.blockml.bml.relation.Extends
<example language="OpenSCAD" …>              →  org.blockml.bml.language.OpenSCAD
<status>Draft</status>                        →  org.blockml.bml.status.Draft
<resize type="Transformation" …>             →  org.blockml.bml.capability.Transformation
<constraint:Min validation="Error" …/>       →  org.blockml.bml.validation.Error
<definition>RootBlockDefinition</definition>  →  org.blockml.bml.definition.RootBlockDefinition
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

Explicit FQNs and `xmlns:` prefixes remain valid **everywhere** — including at specialized reference sites (`status:Draft`, `lang:TypeScript`, `validation:Error`, `relation:Extends` are equivalent to bare names at those sites).

**Generic parameters** (e.g. `type="T"` on a property) are not block references — they refer to `genericTypes[]` entries in the enclosing Block definition.

**Naming mutual exclusion:** A generic parameter name must differ from the root Block `<name>` and from every Sub-Block `<name>` in the same document (`BML_GENERIC_BLOCK_NAME_COLLISION`, `BML_GENERIC_SUBBLOCK_NAME_COLLISION`).

For inheritance-aware self-reference at validate time, `bml:Self` remains available (see § Members — `bml:Self`).

**Property and Capability types** must resolve to a **ValueType** — a Block whose `baseType` chain includes `org.blockml.bml.core.ValueType`. Non-ValueType FQNs (e.g. `com.foo.Wall`) are invalid as property or Capability input/output types → `BML_INVALID_PROPERTY_TYPE`.

**Member namespace:** `org.blockml.bml.core.Block` declares **no members**. Every sub-type chooses its own Properties, Aggregations, Associations, and Capabilities — including names like `id` or `version` if a domain needs them. On composition instances, **instance identity** uses `bml:id` and **external reference version** uses `bml:version` — not bare attributes (see Composition section).

**Aggregation and association types** may reference any Block FQN — not limited to ValueTypes.

---

## Type References and Block Identity

Every type reference in BML — element names on composition instances, `type` and `baseType` on definitions, member `type` attributes — may be written in one of four forms. All forms normalize to a canonical FQN during type resolution:

```text
1. Fully qualified name (FQN)     com.foo.Bar
2. QName (xmlns prefix)           foo:Bar   with xmlns:foo="com.foo"
3. Unqualified fallback           Integer   at a context-bound reference site (see table above)
4. Sub-Block-relative name      MySubBlock or foo:Bar.MySubBlock
```

### Type references in attributes and element values

The same rules apply inside definition metadata:

```xml
<myProperty type="Integer" />
<myProperty type="org.blockml.bml.type.Integer" />
<myProperty type="type:Integer" />
```

All three denote `org.blockml.bml.type.Integer` when `type` maps to `org.blockml.bml.type` and Property `type` is a context-bound site.

General block references (`baseType`, aggregation `type`, composition tags outside specialized sites) require an explicit FQN or `xmlns:` prefix — no implicit fallback. Unresolvable reference → `BML_UNKNOWN_TYPE`. Ambiguous unqualified fallback → `BML_AMBIGUOUS_TYPE`. Undeclared QName prefix → `BML_UNKNOWN_NAMESPACE_PREFIX`.

### Sub-Block type references

Sub-Blocks are types declared inside a parent Block. They may be referenced unqualified, as FQN, or as QName:

```text
<MySubBlock … />                      →  com.foo.Bar.MySubBlock   (in com.foo.Bar context)
<com.foo.Bar.MySubBlock … />          →  com.foo.Bar.MySubBlock
<foo:Bar.MySubBlock … />              →  com.foo.Bar.MySubBlock   (xmlns:foo="com.foo")
```

The local part of a QName may include a relative Sub-Block path (`foo:Bar.MySubBlock`), not only the root Block name.

### Root Block identity

On the document root `<block>`:

```text
type        — required (BML_MISSING_BLOCK_TYPE)
name        — optional; when omitted, effectiveName = lastSegment(resolve(type))
            — when present, must equal lastSegment(resolve(type)) (BML_BLOCK_NAME_TYPE_MISMATCH)
definition  — optional; Definition meta-model type FQN (default org.blockml.bml.definition.RootBlockDefinition)
            — unqualified names resolve via implicit namespace org.blockml.bml.definition.*
            — must extend RootBlockDefinition (BML_DEFINITION_TYPE_MISMATCH otherwise)
```

```xml
<!-- valid — name derived from type -->
<block>
  <type>foo:MyBlock</type>
  …
</block>

<!-- valid — name matches resolved type -->
<block>
  <name>MyBlock</name>
  <type>com.foo:MyBlock</type>
  …
</block>

<!-- invalid -->
<block>
  <name>OtherBlock</name>
  <type>foo:MyBlock</type>
  …
</block>
```

Formal rule when `name` is explicit: `name == lastSegment(resolve(type))`.

**Design principle:** On root blocks, `type` is the canonical identity. `name` is an optional, redundant short form of the last type segment for readability.

### Sub-Block identity

Sub-Blocks use the opposite convention:

```text
name     — required (BML_MISSING_SUBBLOCK_NAME)
type     — normally omitted; derived as resolve(parent.type) + "." + name
         — when present, must equal that expected value (BML_SUBBLOCK_TYPE_MISMATCH)
definition — optional; default org.blockml.bml.definition.SubBlockDefinition
           — must extend SubBlockDefinition, not RootBlockDefinition (BML_DEFINITION_TYPE_MISMATCH)
subBlocks — allowed (arbitrary nesting depth)
embeddedBlocks — forbidden (BML_EMBEDDED_BLOCKS_ON_SUBBLOCK)
```

Preferred form (nested Sub-Blocks):

```xml
<block>
  <name>Vehicle</name>
  <type>com.foo.Vehicle</type>
  <subBlocks>
    <block>
      <name>Engine</name>
      <subBlocks>
        <block>
          <name>Cylinder</name>
          …
        </block>
      </subBlocks>
    </block>
  </subBlocks>
</block>
```

→ Sub-Block types `com.foo.Vehicle.Engine` and `com.foo.Vehicle.Engine.Cylinder`.

Explicit Sub-Block type is allowed when it matches:

```xml
<block>
  <name>MySubBlock</name>
  <type>foo:MyBlock.MySubBlock</type>
  …
</block>
```

Invalid when the explicit type's parent segment does not match the enclosing root Block, even if the last segment equals `name`:

```xml
<!-- invalid — type belongs to a different parent Block -->
<block>
  <name>MySubBlock</name>
  <type>foo:OtherBlock.MySubBlock</type>
</block>
```

The validator checks the full expected type `resolve(parent.type) + "." + name` from the immediate enclosing block, not the last segment alone — otherwise a same-named Sub-Block of another parent could be accepted.

Sub-Blocks may nest `<subBlocks>` to arbitrary depth. Sub-Blocks must not declare `<embeddedBlocks>`.

### Canonical derivation summary

```text
Root block:
  canonicalType  = resolve(type)
  effectiveName  = name ?? lastSegment(canonicalType)
  if name present: name == lastSegment(canonicalType)

Sub-Block:
  effectiveName  = name
  expectedType   = canonicalParentType + "." + name
  canonicalType  = type ? resolve(type) : expectedType
  canonicalType == expectedType
```

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
<summary>           — optional short prose expansion — typically three to five sentences between idea and documentation.
<keywords>          — optional search/discovery tags — core.Keyword Entity aggregation (StructuralDefinition).
<documentation>     — human-readable technical description of the Block (required on root blocks).
<not>               — optional block-level disambiguation — what this Block is not (blocks only, not members).
<aliases>           — optional alternative Block type names — core.Alias Entity aggregation (blocks only).
<name>              — short class name (PascalCase). Optional on root blocks — derived from the last
                      segment of resolve(type) when omitted. When present, must match that segment.
                      Required on Sub-Blocks. See naming convention below.
<type>              — canonical Block type identity (required on root block). FullyQualifiedName
                      property — element text is an FQN / xmlns QName (for example foo:MyBlock).
                      Declares identity for the Block being defined (the type need not exist yet).
                      Place early after name. Child-element TypeReference form is invalid.
<baseType>          — parent FullyQualifiedName / TypeExpression. Mandatory — no default. Element
                      text (for example core:Block or core:PrimitiveEntity(btype:Integer)).
                      Generic applications on the parent are authored and resolved here.
                      Omitted only on org.blockml.bml.core.Block. Place immediately after type.
<version>           — semantic version of this Block definition (root block only)
<status>            — optional; Block reference. Omitted = inherit from parent (document root defaults to Stable)
```

Definition elements (`<property>`, `<aggregation>`, …) carry `<status>` only when deviating from the inherited status — see § `<status>`.

### `<idea>` — semantic meaning

`<idea>` is placed **directly under the root `<block>` element**, as the **first child**, before optional `<summary>`, `<keywords>`, `<language>`, `<documentation>`, optional `<not>`, optional `<aliases>`, and `<name>`. It states how to **interpret** the Block — what it means in the domain, not how it is implemented.

```text
<idea>          — meaning     what this Block semantically represents (one short sentence)
<summary>       — scope       optional middle tier — three to five sentences of scope and boundaries
<keywords>      — discovery   optional search tags for RAG and colloquial lookup
<documentation> — detail      technical description, behaviour, constraints, examples
<not>           — negative    optional block-level disambiguation — what this Block is not
<aliases>       — names       optional alternative names for this Block type (blocks only)
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

### `<summary>` — short prose expansion

`<summary>` is an optional child on all **StructuralDefinition** elements — root blocks, Sub-Blocks, and members (`<property>`, `<aggregation>`, …). On Block definitions it follows `<idea>` and optional `<language>`, before `<documentation>`. It expands semantic meaning in **three to five sentences** — scope, boundaries, and orientation without full technical detail.

```text
idea      →  one sentence: what is this?
summary   →  short paragraph: scope and boundaries (LLM context bundles, quick human scan)
documentation → full technical prose
```

Omitted when `<idea>` and `<documentation>` suffice. Plain trimmed text body stored in BOM `summary` on the enclosing definition element. Addressable as `com.foo.Bar.summary` on blocks and `com.foo.Bar.properties.width.summary` on members.

Optional **`language`** attribute follows the same deviation pattern as `<documentation>` when a Summary struct is not required.

### `<keywords>` — search and discovery tags

`<keywords>` is an optional aggregation typed **`core:Keyword[]`** on all **StructuralDefinition** elements. Each child is a **Keyword branch Entity** — either a domain vocabulary block (extends `org.blockml.bml.core.Keyword`) or a free-text tag:

```xml
<!-- domain controlled vocabulary — FixedKeyword catalogue block -->
<keywords>
  <vocab:Inheritance />
  <vocab:Composition />
</keywords>

<!-- ad-hoc free text — org.blockml.bml.meta.FreeTextKeyword -->
<keywords>
  <meta:FreeTextKeyword term="inheritance" />
  <meta:FreeTextKeyword term="Vererbung" language="German" weight="2" />
</keywords>
```

**Shorthand** (syntactic sugar for **FreeTextKeyword only** — not for domain keyword blocks):

```xml
<keywords>inheritance, nesting, FQN derivation</keywords>
```

Parser expands each trimmed token to `{ typeFqn: org.blockml.bml.meta.FreeTextKeyword, term }`. Omitted when `idea`, `summary`, and `documentation` suffice. Stored in BOM `keywords[]` as `KeywordEntry`. Type-reference form: `FreeTextKeyword{term="inheritance"}`.

Requires `xmlns:meta="org.blockml.bml.meta"` for FreeTextKeyword children; domain keywords use their package prefix. Catalogue keywords extend **`org.blockml.bml.meta.FixedKeyword`** — protected members (`_term`, optional `_language`, `_weight`) are set on the keyword block definition; references are empty fixed blocks:

```xml
<!-- vocab/Inheritance.bml — catalogue keyword definition -->
<block ...>
  <idea>Search tag for inheritance and baseType chains.</idea>
  <documentation>Controlled vocabulary keyword for inheritance-related blocks.</documentation>
  <name>Inheritance</name>
  <type>vocab:Inheritance</type>
  <baseType>meta:FixedKeyword</baseType>
  <properties>
    <_term>inheritance</_term>
    <_weight>2</_weight>
  </properties>
</block>

<!-- usage on any StructuralDefinition -->
<keywords>
  <vocab:Inheritance />
</keywords>
```

### `<language>` — natural language for documentation prose

`<language>` is an optional child on Block definitions and Library descriptors. It declares the **natural language** for documentation prose and example titles on that definition and its members. Value is a **Block reference** to `org.blockml.bml.language.NaturalLanguage` — not a free string. Unqualified names inside `<language>` resolve via implicit namespace `org.blockml.bml.language.*` — no `xmlns:` prefix required.

**Inheritance chain:**

```text
org.blockml.bml.core.Block default     →  English (org.blockml.bml.language.English)
Library.language                     →  catalogue default for all exported blocks
Block.language                       →  per-definition override
<documentation language="…">         →  per-element override when prose deviates
<change language="…">                →  per-entry override for changelog text
<see language="…">                     →  per-entry override for relationship text
```

Authors declare `<language>` or a `language` attribute on `<documentation>`, `<change>`, or `<see>` **only when deviating** from the effective inherited language — same deviation pattern as `<status>`.

```xml
<block ...>
  <idea>Parametric wall segment for AnyClosure enclosures.</idea>
  <language>
    <German />
  </language>
  <documentation>Wall block with thickness, height, and opening properties.</documentation>
  <name>Wall</name>
  ...
</block>
```

Library descriptors set the catalogue default:

```xml
<name>Library</name>
<baseType>bcore:BlockLibrary</baseType>
<version>3.0.0</version>
<language>
  <English />
</language>
```

Core library defines:

```text
org.blockml.bml.language.NaturalLanguage   — abstract base; all locale blocks extend this branch
org.blockml.bml.language.English           — root default on org.blockml.bml.core.Block
org.blockml.bml.language.German · French · Spanish · Chinese · Japanese · Russian
```

Natural languages are distinct from **implementation languages** (`ProgrammingLanguage`, `MarkupLanguage`) used in `<implementation language="…">` and example CDATA bodies.

### `<documentation>`

`<documentation>` follows `<idea>`, optional `<summary>`, optional `<keywords>`, and optional `<language>`, still before optional `<not>`, optional `<aliases>`, and `<name>`. It describes the Block definition itself — not individual members (those carry their own `<documentation>`). Omitted on root blocks → `BML_MISSING_DOCUMENTATION` (warning in V1, error in a later release).

An optional **`language`** attribute on `<documentation>` references a `org.blockml.bml.language.NaturalLanguage` when the prose is written in a language other than the effective language of the enclosing definition element. Unqualified names resolve via implicit namespace `org.blockml.bml.language.*`. Omitted → inherit effective language from Block or Library.

**Cross-references:** Do **not** name Block or Definition FQNs, markdown files, or external URLs in `<documentation>` prose. Link all related types and documentation sources exclusively via `<references>` (see below).

```xml
<block ...>
  <idea>Parametric wall segment for AnyClosure enclosures.</idea>
  <documentation>Wall block with thickness, height, and opening properties for enclosure design.</documentation>
  <name>Wall</name>
  ...
</block>
```

```xml
<documentation language="German">
  Wandblock mit Dicken-, Höhen- und Öffnungseigenschaften.
</documentation>
```

### `<not>` — negative space (blocks only)

`<not>` is an optional child on **Block definitions only** — root blocks and Sub-Blocks, not on members. It states **what this Block is not** — explicit disambiguation from easily confused concepts (for example Sub-Block vs embedded Block, contract vs baseType). Place after `<documentation>` (and optional documentation extensions) or immediately after `<documentation>` before `<since>` / `<name>` when extensions are absent.

Plain trimmed text body stored in BOM `block.not`. Addressable as `com.foo.Bar.not`. Prefer `relation=ContrastsWith` on `<see>` when pointing at a specific confusing type; `<not>` states the negation inline on the current definition.

```xml
<not>Not a runtime Block instance — this is a type definition document.</not>
```

### `<aliases>` — alternative type names (blocks only)

`<aliases>` is an optional aggregation typed **`core:Alias[]`** on **Block definitions only**. Each child is an **Alias branch Entity** — domain catalogue block or free-text name:

```xml
<!-- domain catalogue alias — FixedAlias catalogue block -->
<aliases>
  <vocab:SubBlockAlias />
</aliases>

<!-- ad-hoc free text — org.blockml.bml.meta.FreeTextAlias -->
<aliases>
  <meta:FreeTextAlias name="Sub-Block" />
  <meta:FreeTextAlias name="Unterblock" language="German" legacy="true" />
</aliases>
```

**Shorthand** (syntactic sugar for **FreeTextAlias only**):

```xml
<aliases>Sub-Block, nested type, local type</aliases>
```

Stored in BOM `aliases[]` as `AliasEntry`. Member identity is fixed by `(namespace, name)`.

**Not** XML namespace prefix aliases. **Not** search tags — use `<keywords>`.

Catalogue aliases extend **`org.blockml.bml.meta.FixedAlias`** — protected members (`_name`, optional `_language`, `_legacy`) are set on the alias block definition; references are empty fixed blocks (same pattern as FixedKeyword above).

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

`<summary>` and `<keywords>` apply to the same StructuralDefinition elements. `<not>` and `<aliases>` are block-level only.

and to any future definition element with `<documentation>`.

On root `<block>` definitions, optional documentation extensions follow `<documentation>` and precede `<name>`. On members and Sub-Blocks, they appear alongside `<documentation>` among definition metadata children (before `<value>`, `<composition>`, or other content containers).

Goal: keep API documentation, version history, examples, and related-type links at the definition site — a single source of truth inside BML files.

**Authoring split:** `<documentation>` carries technical prose only; `<references>` carries all cross-links — Blocks, Definition elements, repository markdown files (`file`), and external URLs (`url`) — each with an explicit relationship note.

### Task guides and diagnostics

Task-oriented paths use the same `<references>` mechanism as learning paths — no separate task aggregation.

| Branch | FQN pattern | Role |
|---|---|---|
| `TaskGuide` | `org.blockml.bml.task.*` | Procedural how-to — accomplish one task |
| `Diagnostic` | `org.blockml.bml.diagnostic.*` | Documented validator code → fix navigation |

| Relation | Used on | Meaning |
|---|---|---|
| `TaskIndex` | README, Bootstrap | Catalog entry — this task is available |
| `TaskStep` | TaskGuide | Ordered procedure step (document order = step order) |
| `Prerequisite` | TaskGuide | Understand before starting the task |
| `Resolves` | Diagnostic | Links error code to fix TaskGuide |

**README pattern** — ReadFirst entries first (learning), then TaskIndex entries (tasks):

```xml
<see block="doc:Introduction" relation="ReadFirst">…</see>
…
<see block="task:AuthorNewBlock" relation="TaskIndex">
  Author a new Block definition from scratch.
</see>
```

**TaskGuide pattern** — prerequisites, then TaskStep entries in order:

```xml
<block …>
  <idea>Author a new Block definition document from scratch.</idea>
  <summary>…</summary>
  <keywords>author, new block, create type</keywords>
  <documentation>…</documentation>
  <references>
    <see block="doc:DefinitionModel" relation="Prerequisite">…</see>
    <see block="def:RootBlockDefinition" relation="TaskStep">Step 1 — …</see>
    <see file="02_mbml.md" relation="TaskStep">Step 2 — …</see>
  </references>
  <name>AuthorNewBlock</name>
  <type>task:AuthorNewBlock</type>
  <baseType>core:TaskGuide</baseType>
</block>
```

**Diagnostic pattern** — Resolves links to fix task:

```xml
<see block="task:DebugUnknownType" relation="Resolves">
  Step-by-step fix for unresolved type references.
</see>
```

Future tooling: `bom context export --mode learn` filters `ReadFirst`; `--mode task --task AuthorNewBlock` follows TaskStep chain; `--diagnostic BML_UNKNOWN_TYPE` loads Diagnostic → Resolves → TaskGuide.

See `doc:TaskGuideModel` · `16_framework_base_types.md` — Task guides.

#### `<since>`

Declares the version from which the element is available:

```xml
<since>1.0.3</since>
```

Value is a semantic version string (same rules as `<version>` on Block definitions). Omitted when the element has been available since the Block's initial release.

#### `<changelog>`

Container for version history. Each entry is a `<change>` with a required `version` attribute and text body. An optional `language` attribute overrides the effective natural language for the change description — unqualified names resolve via `org.blockml.bml.language.*`:

```xml
<changelog>

    <change version="1.1.0">
        Added support for edgeRadius.
    </change>

    <change version="1.3.2" language="German">
        Verhalten der Noppen-Generierung geändert.
    </change>

    <change version="2.0.0">
        Deprecated property xyz.
    </change>

</changelog>
```

Entries must be ordered chronologically by version — **oldest first**. Out-of-order entries → `BML_CHANGELOG_VERSION_ORDER` (warning V1).

#### `<examples>`

Container for usage examples. Each `<example>` requires a `title` attribute; body content is **CDATA only**. The **title** is always written in the effective natural language of the enclosing block definition. An optional `language` attribute on `<example>` references an **implementation** Language when the CDATA body is not BML/MBML source (OpenSCAD, TypeScript, …) — unqualified names resolve via `org.blockml.bml.language.*`; distinct from `NaturalLanguage` used for prose:

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

    <example title="OpenSCAD render"
        language="OpenSCAD"><![CDATA[
module brick(size) = cube(size);
brick([2, 4, 3]);
    ]]></example>

</examples>
```

Omitted `language` on `<example>` → BML/MBML source. Example titles never carry a language attribute — they inherit the block's natural language.

#### `<references>`

Container for cross-references to related Blocks, definition elements, repository documentation files, or external URLs. Each `<see>` requires **exactly one target kind** — `block`, `file`, `url`, `property`, `aggregation`, `association`, or `capability`. An optional **`relation`** attribute classifies **how** the target relates to the current definition — Block reference to `org.blockml.bml.relation.*` (default `SeeAlso` when omitted). The text body explains why or how the referenced element relates to the **current** definition. An optional `language` attribute overrides the effective natural language for the relationship text — unqualified names resolve via `org.blockml.bml.language.*`.

**Target attributes (exactly one kind required):**

```text
block="core:ValueType"              — Block or Definition type reference via xmlns prefix
file="02_mbml.md"                   — repository documentation file
url="https://blockml.org/schemas/…" — external URL
property="com.foo.Bar.properties.width"     — PropertyDefinition (canonical path)
aggregation="com.foo.Bar.aggregations.parts" — AggregationDefinition (canonical path)
association="com.foo.Bar.associations.basePresets" — AssociationDefinition (canonical path)
capability="com.foo.Bar.capabilities.render" — CapabilityDefinition (canonical path)
```

**Split member authoring** — `block=` qualifies a local member name (not stored as a separate type target):

```text
block="com.foo.Bar" property="width"           →  com.foo.Bar.properties.width
block="com.foo.Bar" capability="render"        →  com.foo.Bar.capabilities.render
block="core:Block" property="language"         →  org.blockml.bml.core.Block.properties.language
```

`block=` with a member attribute is **one** member target — not ambiguous with a standalone `block=` type reference.

**Relation attribute (optional):**

```text
relation="Extends"        — Block reference via org.blockml.bml.relation.* (unqualified name permitted)
                          — omitted → org.blockml.bml.relation.SeeAlso
```

Standard relation blocks: `SeeAlso` (default), `ReadFirst`, `Extends`, `Requires`, `ContrastsWith`, `AuthoringGuide`, `Defines`, `DeepDive`, `TaskIndex`, `TaskStep`, `Prerequisite`, `Resolves`. Domain libraries may define additional relation blocks extending `org.blockml.bml.core.Relation`.

**Why separate target attributes instead of one `target`?**

The attribute name encodes the target **kind** at the read site — before parsing or resolving the value. Humans and LLMs scanning BML can classify each reference from the element shape alone:

```text
<see block="core:ValueType">…</see>                    → see · block · type reference
<see file="02_mbml.md">…</see>                         → see · file · repository documentation
<see url="https://…">…</see>                           → see · url · web address
<see property="com.foo.Bar.properties.width">…</see>   → see · property · member path
<see capability="com.foo.Bar.capabilities.render">…</see> → see · capability · member path
```

A single generic `target` attribute would force readers to infer kind from value syntax (FQN vs filename vs URL vs member path). Separate attributes keep the documentation reading flow linear: verb (`see`) → target kind → target → relation → relationship text.

Member targets always resolve to **canonical definition paths** in the BOM (`com.foo.Bar.properties.width`) — the container segment (`.properties.`, `.capabilities.`, …) is part of the technical address. See § Definition paths · `16_framework_base_types.md` — Definition Addressing.

**Reading flow with relation:**

```text
<see block="core:ValueType" relation="Extends">…</see>   → see · block · type · Extends
<see file="02_mbml.md" relation="AuthoringGuide">…</see> → see · file · doc · AuthoringGuide
<see url="https://…" relation="DeepDive">…</see>        → see · url · web · DeepDive
<see block="core:Block" property="language" relation="Defines">…</see> → see · block · Block · property · language · Defines
```

Relation is a **Block reference** — not a free string — following Everything-is-a-Block. Each relation block carries its own `idea` and `documentation` explaining when to use it.

**Authoring rules:**

- Include only targets with a **direct relationship** to the current definition.
- Every `<see>` **must** include a text body describing the relationship.
- Do **not** repeat cross-links in `<documentation>`; use `<references>` instead.
- `block` values use **namespace prefixes** from the document's `xmlns:` declarations — same rules as `type`, `baseType`, and composition references (e.g. `core:Block`, `def:PropertyDefinition`, `bcore:Entity`).

```xml
<references>

    <see block="core:CompositeBlock" relation="Extends">
        Composable sub-type — owns child instances via default _parts aggregation.
    </see>

    <see block="core:ValueType" relation="Extends">
        Branch sub-type — payload types for properties and capabilities.
    </see>

    <see block="def:PropertyDefinition" relation="Defines">
        Meta-model member shape for property declarations on Block definitions.
    </see>

    <see block="core:Block" property="language" relation="Defines">
        NaturalLanguage property — documentation prose default on every block.
    </see>

    <see property="org.blockml.bml.core.Block.properties.language" relation="Defines">
        Same target — full canonical path authoring form.
    </see>

    <see file="02_mbml.md" relation="AuthoringGuide" language="German">
        Block-Definition — Idea, Dokumentation und Dokumentations-Erweiterungen.
    </see>

    <see url="https://blockml.org/schemas/core/block.xsd" relation="DeepDive">
        XML schema for block definition documents.
    </see>

</references>
```

`block` accepts any Block or Definition reference via xmlns prefix. Member attributes store the **canonical definition path** — resolved at parse time from a full path or from `block=` + local member name. Unknown Block FQN at validate time → `BML_UNKNOWN_TYPE` (error). Unknown member path → `BML_REFERENCE_UNKNOWN_MEMBER` (error). Omitted target → `BML_REFERENCE_MISSING_TARGET` (error). More than one target kind → `BML_REFERENCE_AMBIGUOUS_TARGET` (error). `block=` with exactly one member attribute is one member target — not ambiguous.

Maps to BOM `DocumentationReference { block?, file?, url?, property?, aggregation?, association?, capability?, relationFqn?, context, languageFqn? }`. Omitted `relation` → `org.blockml.bml.relation.SeeAlso`. Unknown relation FQN at validate time → `BML_UNKNOWN_RELATION` (error). Meta-model: inline Sub-Block `StructuralDefinition.Reference` on `StructuralDefinition.references` — see `16_framework_base_types.md` — Definition Branch.

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
                              — local declaration property; not inherited. Child blocks are concrete
                                by default unless they declare abstract=true.
                              — declared on StructuralDefinition; applies to block definitions
<final>                       — true | false (default false). Final types cannot be used as baseType.
                              — local declaration property; not inherited. Validator enforces effect.
                              — declared on StructuralDefinition; applies to block definitions
<visibility>                  — Sub-Blocks only: private | protected | public; must match <name>
<subTypes>          — override: permitted Sub-Block baseTypes (omit to inherit — see Framework Base Types)
<languages>         — Language references for <implementation language="...">
<properties>    — Property declarations. Omit if no custom properties or default overrides needed.
<aggregations>  — Aggregation declarations. Omit when inherited aggregations from baseType suffice.
<associations>  — Association declarations.
<capabilities>  — Capability declarations.
<contracts>     — Contract references (reusable partial definitions). Root block only.
<definition>    — Definition meta-model type FQN. Default: RootBlockDefinition on document root and
                embedded blocks; SubBlockDefinition on Sub-Blocks (BML_DEFINITION_TYPE_MISMATCH
                when incompatible with block role).
<subBlocks>     — Sub-Block definitions (see Sub-Blocks section; may nest recursively).
<embeddedBlocks> — Inline Library: embedded Block definitions (see Embedded Blocks section). Root block and embedded blocks only.
<aggregations>  — Aggregation declarations and definition-level compositions. Omit when inherited aggregations from baseType suffice.
                — <composition> must be nested inside an aggregation member element (never standalone).
```

Framework base types (`org.blockml.bml.core.Block`, `com.machineblocks.bml.core.Block`, …) are **BML files** in `@blockml/core` and `@machineblocks/mbom` — not code or YAML. See `16_framework_base_types.md`.

### Type Modifiers

```xml
<abstract>true</abstract>
<final>true</final>

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
Omitted abstract/final          — false (local declaration properties; not inherited from baseType)
Omitted languages / contracts   — inherit from baseType at validate
org.blockml.bml.core.Block        — sole type that omits <baseType> (inheritance root); effective subTypes []
```

**Container pattern:** BlockML uses a consistent syntax for typed collections on Block definitions. The container element defines context; each child is the actual definition or Block reference — no redundant wrapper elements when context is already unambiguous.

On these **definition containers**, every empty child element is a **type reference** (FQN via element name) — never a Block instance. The same empty-element XML pattern on an **instance** aggregation (`Block[]`) denotes a real empty instance instead. See `17_type_system_bml.md` — Empty child elements.

```text
<languages>    →  <lang:OpenSCAD/>           TypeReference(core:Language)[] child — type ref, not instance
<subTypes>     →  <core:Block/>              TypeReference(core:Block)[] child — type ref, not instance
<contracts>    →  <ac:Wall/>                 TypeReference(core:Block)[] child — type ref, not instance
<language>     →  <German/>                  TypeReference(NaturalLanguage) child — optional single (bare)
<type>         →  foo:MyBlock                FullyQualifiedName property text — required on root
<baseType>     →  core:Block                 FullyQualifiedName property text — optional; generics allowed
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
              empty element = type reference only — not a Block instance
              see 17_type_system_bml.md — Empty child elements
```

**Semantics:**

```text
Role            — reusable partial Block definition (replaces interfaces, traits, mixins)
                  + type-bound identifier (implements) via satisfiesTypeBound
baseType role   — framework taxonomy and branch detection (extends) — see 17_type_system_bml.md
Scope           — Properties, Aggregations, Associations, Capabilities, Constraints,
                  Suggestions, documentation, examples, references, optional Capability defaults
Ignored         — subBlocks, embeddedBlocks, and compositions on the contract Block
Partial members — contracts may declare incomplete members; the Block completes them
Merge order     — baseType chain → contracts (in declaration order) → Block
Type bounds     — satisfiesTypeBound(T, G): G on baseType chain OR G ∈ T.contracts[] (direct, V1)
Branch rules    — inBranch() uses baseType chain only; core branch types are not interface duplicates
Conflict rule   — later contract wins; Block overrides all contracts
Override rule   — only explicitly specified attributes replace inherited/merged values
                  local redeclarations that merge with a baseType or contract member must
                  declare override="true" (including contract completion) → BML_OVERRIDE_REQUIRED
final           — final members from any layer cannot be overridden
Sub-Blocks      — contracts not allowed on nested Sub-Blocks (root only)
Validation      — merge resolution at stage [8] via resolveEffectiveMembers()
                  type-bound checks at stage [8] via satisfiesTypeBound()
```

**Example — contract Block (partial definition):**

```xml
<block xmlns="http://blockml.org/schema/block" …>
  <name>IIdentifiable</name>
  <type>com.foo.IIdentifiable</type>
  <baseType>org.blockml.bml.core.Block</baseType>
  <version>1.0.0</version>
  <abstract>true</abstract>
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
    <id override="true">
      <documentation>Unique identifier</documentation>
      <constraints>…</constraints>
    </id>
    <offset override="true" type="type:Vector3D">
      <value>[0, 0, 0]</value>
    </offset>
    <direction override="true" type="type:Direction">
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

#### Composition instance IDs (aggregations)

For **aggregation** members, visibility additionally controls which **`bml:id` values** may be referenced in instance references (`basePresets`, `Step.part`, `{BlockFQN}::{id}`, …):

| Visibility | Instance ID reachability |
| ---------- | ------------------------ |
| **public** | Cross-document `{EnclosingBlockFQN}::{id}` references; unqualified ids within permitted BlockML access |
| **protected** | Declaring Block and its **child Blocks** (derived types / Sub-Blocks in the same definition tree) — not from arbitrary external documents |
| **private** | Declaring Block definition only |

There is **no** separate export flag on `<composition>` or `<bml:container>`. Reachability follows the **aggregation member's** visibility.

Qualified cross-document `{BlockFQN}::{id}` references require a **public** target aggregation and a **literal static `bml:id`** on the target instance — see § Qualified references and `00_bom_core.md` — Qualified Block Instance References.

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
abstract="true|false"   — local declaration property; not inherited. When true, this declaration is
                          semantically incomplete and creates an implementation obligation for concrete
                          descendants. Default: false.
override="true|false"   — local declaration property; not inherited. When true, this declaration
                          redefines an inherited member. Must be set on every redeclaration layer.
                          Default: false.
final="true|false"      — local declaration property; not inherited. When true on this declaration,
                          child blocks cannot override this member. Validator-enforced. Default: false.
```

Empty elements (`<abstract/>`) and attribute shorthand without value (`abstract` without `="true"`) are not permitted. Boolean properties require an explicit `true` or `false` value.

### Abstract, final, and override

`abstract`, `final`, and `override` are **local declaration properties**. They describe only the block or member on which they are declared and are **never inherited**. Only their semantic effects propagate:

```text
abstract=true  — creates an implementation obligation for concrete descendants
final=true     — prevents extension (blocks) or redeclaration (members) in descendants
override=true  — confirms a deliberate redefinition of an inherited member
```

| Attribute | Local meaning | Semantic effect |
|---|---|---|
| `abstract="true"` | This declaration is incomplete | Concrete descendants must implement |
| `final="true"` | This declaration is sealed | Descendants cannot override |
| `override="true"` | This declaration replaces an inherited member | Parent member must exist in baseType chain or contracts |

Every local redeclaration that merges with an existing member from the **baseType chain** or from **contracts[]** must declare `override="true"` — including contract member completion. Omission → `BML_OVERRIDE_REQUIRED`. A genuinely new member must not set `override="true"` → `BML_OVERRIDE_WITHOUT_PARENT`.

A member declaration is exactly one of:

```text
new            — no override
override       — refines or replaces an inherited member (override="true" required)
```

**Abstract → implementation**

An `abstract="true"` member may omit required parts on the declaring block (for example a property
without `type` or without `<value>`). A deriving block implements it with `override="true"` and a
locally complete declaration. Because `abstract` defaults to `false`, a redeclaration without
`abstract="true"` is locally concrete and satisfies the implementation obligation when complete for
the member kind.

```text
abstract member on a concrete block                  →  BML_ABSTRACT_MEMBER_NOT_IMPLEMENTED
```

Example — parent declares abstract member, child implements:

```xml
<!-- Parent -->
<width abstract="true" type="Length"/>

<!-- Child: locally concrete (abstract defaults to false); must be complete -->
<width override="true" type="Millimeter">
  <value>100</value>
</width>
```

**Keeping a member abstract in a child block**

To refine an inherited abstract member while keeping it abstract, explicitly declare
`abstract="true"` on the redeclaration:

```xml
<!-- Parent -->
<width abstract="true" type="Length"/>

<!-- Child: stays abstract; type is refined -->
<width override="true" abstract="true" type="Millimeter"/>

<!-- Grandchild must implement with a locally complete override -->
<width override="true" type="Millimeter">
  <value>100</value>
</width>
```

**Concrete parent → override**

`override="true"` on a concrete parent member replaces or narrows inherited attributes and values.
The redeclaration is locally concrete unless it explicitly declares `abstract="true"`.

`override="true"` without a matching parent member → `BML_OVERRIDE_WITHOUT_PARENT`.

On capabilities, `implementation` is a child element (type
`org.blockml.bml.definition.CapabilityDefinition.Implementation`) — not the boolean attribute from
`MemberDefinition`.

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
  <myReadOnlyProperty override="true">
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

`readOnly` is independent of `final`, `abstract`, and `override`: a child Block
may override the **value** of a `readOnly` member in its definition, but cannot override a `final`
member at all. An abstract member obligation must be satisfied with a locally complete override on a
deriving block before the enclosing block is concrete. Use `override="true"` to refine an inherited
member — each redeclaration layer must set it again.
without completing it.

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
<design:width override="true">
  <value>42</value>
</design:width>
```

Both resolve to key `(com.sap.ui5, width)` — the override merges correctly.

**`bml` prefix:** using `xmlns:bml` for member namespaces is permitted but **not recommended** — the `bml:` prefix is reserved for language directives (`bml:id`, `bml:each`, …). Prefer domain-specific prefixes (e.g. `ui5`, `html`, `aria`).

Undeclared prefix on a member element → `BML_UNKNOWN_NAMESPACE_PREFIX`.
A legacy `namespace="…"` attribute on a member element → parse error.

### Partial Member Overrides

Child Blocks override inherited members with `override="true"` or satisfy abstract implementation
obligations with a locally complete override. The flag is required whenever a local member
redeclaration merges with an existing member from the **baseType chain** or from **contracts[]** —
contract completion uses the same rule as baseType refinement. Only the **member name**, the mode
flag, and **changed attributes** need to be specified — all other attributes are inherited from the
parent definition.

To refine an inherited abstract member while keeping it abstract, use `override="true"` with
`abstract="true"`. To implement an inherited abstract member, use `override="true"` without
`abstract="true"` (defaults to locally concrete) and supply the missing required parts locally
(for example `type` and `<value>` on a property). On capabilities, supply a full `<implementation>`
child element (see Capabilities).

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
<size override="true">
  <value>[2,2,2]</value>
</size>
```

The effective definition is the **merge** of both declarations. Override matching uses the resolved `(namespace, name)` key — see § Member Namespace (Element QName).

```text
Same member kind required     — property overrides property, aggregation overrides aggregation, …
Only specified attrs replaced — unspecified attrs inherited from parent
override="true" required      — for any local redeclaration merging with a baseType or contract member
Inherited aggregation override  → override="true" required; type may be omitted
Private members               — cannot be overridden
final="true" on parent        — prevents override in child Blocks → BML_FINAL_MEMBER_OVERRIDE
override without parent       — BML_OVERRIDE_WITHOUT_PARENT
override omitted on merge     — BML_OVERRIDE_REQUIRED
abstract member on concrete block → BML_ABSTRACT_MEMBER_NOT_IMPLEMENTED
```

The parser stores override declarations in `members[]`; `resolveEffectiveMembers()` merges along the `baseType` chain, then contracts, then local declarations.

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

**Constraints** describe semantic restrictions — each entry is a Block instance extending `org.blockml.bml.core.Constraint`. The same `<constraints>` container is used on **Blocks**, **Properties**, **Aggregations**, **Associations**, and **Capabilities**. The embedding context determines the constraint target and automatic generic binding — no `target` property.

```xml
<block>
  <constraints>
    <constraint:RequiresMember name="width" validation="Error"/>
  </constraints>
  <properties>
    <textSize type="Integer">
      <value>9</value>
      <constraints>
        <constraint:Min value="1" validation="Error"/>
        <constraint:Max value="72" validation="Error"/>
      </constraints>
    </textSize>
  </properties>
</block>
```

Whether BlockML enforces a constraint depends on its optional `validation` property referencing `org.blockml.bml.core.Validation`. Constraints without `validation` are metadata only — the validator still checks type, branch compatibility, and generic binding. Wrong branch for context → `BML_CONSTRAINT_TARGET_MISMATCH`. See `18_constraints_and_suggestions.md` for the full hierarchy (ValueConstraint vs StructuralConstraint branches).

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
visibility   — optional; must match naming convention; on aggregations also controls composition instance ID reachability (see § Composition instance IDs)
```

**Type-reference vs instance aggregations** — determined by the aggregation `type` attribute, not by the XML shape of child elements. An empty child element such as `<con:MyContract />` is **ambiguous on the surface** — the aggregation `type` decides:

```text
TypeReference(T)[]  →  type reference only (element name = FQN; syntactic sugar — not an instance)
plain Block[]       →  real BlockInstance (empty = valid instance with no authored values)
```

Examples: `bootstrap` / `_blocks` on `org.blockml.bml.core.BlockLibrary` use `TypeReference(...)`; `<contracts>` / `<languages>` on Block definitions use `TypeReference(core:Block)[]` / `TypeReference(core:Language)[]`. See `17_type_system_bml.md` — TypeReference · Empty child elements.

Member visibility follows § Member Visibility. Protected aggregations (`_name`) are accessible in derived Blocks and by the direct composition owner; private aggregations (`__name`) are confined to the declaring Block. Cross-document `{BlockFQN}::{id}` references require a **public** target aggregation.

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
com.foo.Bar.idea                    →  Block idea
com.foo.Bar.summary                 →  Block summary
com.foo.Bar.keywords                →  Block keywords
com.foo.Bar.documentation           →  Block documentation
com.foo.Bar.not                     →  Block not (disambiguation)
com.foo.Bar.aliases                 →  Block aliases (alternative type names)
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

Both support the same directives: `bml:if`, `bml:each`, `bml:with`, and future container directives.

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
Inherited aggregation override  → override="true" required; type may be omitted
Standalone <composition>        → BML_STANDALONE_COMPOSITION (validation error)
```

Composition instance ID reachability is controlled by the **aggregation member's visibility** — see § Member Visibility — Composition instance IDs (aggregations). There is no `bml:exportIds` attribute.

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

<!-- Documentation element — StructuralDefinition.Documentation Sub-Block shape -->
<documentation language="German">…</documentation>
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

Sub-Blocks are Block definitions nested inside a parent Block. They are analogous to static inner classes in Java — they belong to the parent Block conceptually and share its FQN prefix. Sub-Blocks form a semantic type hierarchy within a single root document and may nest to arbitrary depth. Sub-Blocks are declared in a `<subBlocks>` section within the parent `<block>` document (root block, parent Sub-Block, or embedded block).

### Format

Sub-Blocks use the same format as the root Block — all fields as child elements. The preferred difference: `<type>` is omitted and the FQN is derived from the parent Block's type + the Sub-Block's `<name>`. An explicit `<type>` is allowed when it matches the derived value (see § Type References and Block Identity).

`<baseType>` is required on Sub-Blocks, just like on the root Block. Sub-Blocks may declare nested `<subBlocks>` to arbitrary depth. Sub-Blocks must not declare `<embeddedBlocks>` (`BML_EMBEDDED_BLOCKS_ON_SUBBLOCK`).

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

Calibrator.bml — composition in same file (parent Block context):
  <MySubBlock … />                    ✓  unqualified Sub-Block in parent context
  <cal:Calibrator.Base … />           ✓  qualified Sub-Block reference
  <_Utils … />                        ✓  protected — same Block
  <__Helper … />                      ✓  private — same Block only

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
Parent FQN:  com.foo.Vehicle
Sub-Block:   <name>Engine</name>
→ FQN:       com.foo.Vehicle.Engine

Parent FQN:  com.foo.Vehicle.Engine
Sub-Block:   <name>Cylinder</name>
→ FQN:       com.foo.Vehicle.Engine.Cylinder
```

`<type>` is normally omitted on Sub-Blocks — it is derived recursively as `resolve(parent.type) + "." + name` from the immediate enclosing block. When explicitly authored, it must match that expected value (`BML_SUBBLOCK_TYPE_MISMATCH`). Sub-Blocks may nest `<subBlocks>` to arbitrary depth. Sub-Blocks must not declare `<embeddedBlocks>` (`BML_EMBEDDED_BLOCKS_ON_SUBBLOCK`). Root blocks and embedded blocks may declare both `<subBlocks>` and `<embeddedBlocks>`.

### Embedded Blocks (Inline Library)

**Gedankenstütze:** `embeddedBlocks` is an **Inline Library** — a library co-located within a single Block document. Unlike Sub-Blocks, embedded blocks are **full Block documents** structurally equivalent to root blocks. Each embedded block's **FQN is the value of its `<type>` element** (e.g. `com.foo.internal.Physics`) — not nested under the enclosing block. Sub-Blocks on an embedded block derive their FQNs from the embedded block's type.

```text
type            — required; must be fully qualified (BML_MISSING_EMBEDDED_BLOCK_TYPE,
                  BML_UNQUALIFIED_EMBEDDED_BLOCK_TYPE)
FQN             — resolve(type); definition paths use the embedded block's own FQN
subBlocks       — allowed (Sub-Block FQNs derive from embedded block type)
embeddedBlocks  — allowed (nested inline libraries)
```

```xml
<block>
  <type>com.foo.Vehicle</type>
  …
  <subBlocks>
    <block>
      <name>Engine</name>
      <subBlocks>
        <block>
          <name>Cylinder</name>
          …
        </block>
      </subBlocks>
      <!-- not allowed on Sub-Blocks:
      <embeddedBlocks>…</embeddedBlocks>
      -->
    </block>
  </subBlocks>
  <embeddedBlocks>
    <block>
      <idea>Inline — equivalent to a separate .bml file</idea>
      <type>com.foo.internal.Physics</type>
      <baseType>org.blockml.bml.core.Block</baseType>
      <version>1.0.0</version>
      <subBlocks>
        <block>
          <name>Force</name>
          <baseType>org.blockml.bml.core.Block</baseType>
          <version>1.0.0</version>
        </block>
      </subBlocks>
      <embeddedBlocks>
        <block>
          <type>com.foo.internal.Math</type>
          <baseType>org.blockml.bml.core.Block</baseType>
          <version>1.0.0</version>
        </block>
      </embeddedBlocks>
    </block>
  </embeddedBlocks>
</block>
```

Within the enclosing document, an embedded definition and all its descendants **shadow** the corresponding library or file-based Block definition. Externally, embedded blocks and their Sub-Blocks are **invisible**. Composition references from within the same document must use the **fully qualified** Block type — never an unqualified or Sub-Block-relative name.

**Central distinction:**

```text
SubBlock       = semantically nested type within a root document
EmbeddedBlock  = full, locally embedded Block document
```

### Composition Block References

Composition child element names are type references. **Whether an empty child element denotes a type reference or a real empty instance depends on the parent aggregation `type`** — see `17_type_system_bml.md` — Empty child elements. Domain Blocks and ValueTypes require an `xmlns:` prefix or full FQN. **Sub-Blocks** declared on the enclosing root Block may additionally be referenced by **unqualified local name** within that Block's composition — resolved as `resolve(parent.type) + "." + localName`:

```xml
<!-- correct — domain / library types -->
<core:Step bml:id="step1" … />
<cal:Calibrator.Base bml:id="base_stud" … />

<!-- correct — unqualified Sub-Block in parent Block composition (Calibrator.bml) -->
<Base bml:id="base_stud" … />
<StudDiameter bml:id="samples_stud" … />

<!-- invalid — unqualified domain Block outside Sub-Block context -->
<Wall bml:id="wall" … />
```

Outside the declaring Block's composition context, Sub-Blocks require a qualified name (`RootBlock.SubBlock`), `xmlns:` prefix + qualified name, or full FQN → otherwise `BML_UNQUALIFIED_BLOCK_REFERENCE`.

The parser resolves the element QName via the document's `xmlns:` declarations and Sub-Block context rules, storing the **resolved FQN** on the BOM node.

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

**Library reference aggregations:** `bootstrap`, `_dependencies`, `_subLibraries`, and `_blocks` on `org.blockml.bml.core.BlockLibrary` are **TypeReference** aggregations — each empty child element (e.g. `<blockml:Library />`) is a **type reference** (element name → FQN), not a Block instance. **`bml:version` is forbidden** on these children. No separate reference Sub-Blocks (`Dependency`, `BlockRef`) are needed. **`bootstrap`** typically references a `README` block (`org.blockml.bml.core.Bootstrap`). **`_schemas`** is an **instance** aggregation and holds real `FilePathEntity` composition children.

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

Within the **declaring root Block's composition**, Sub-Blocks may be referenced by unqualified local name (`<Base … />`). Everywhere else they require a qualified name, `xmlns:` prefix + qualified name, or full FQN:

```text
Same file (Calibrator.bml defines Sub-Block Base):
  <Base bml:id="base_stud" … />                    ✓  parent Block context
  <cal:Calibrator.Base bml:id="base_stud" … />     ✓  qualified
  com.machineblocks…Calibrator.Base on element     ✓  full FQN

Other file (Set.bml composes Calibrator internals):
  <cal:Calibrator.Base … />                        ✓  parent Block namespace + qualified name
  <Base … />                                       ✗  BML_UNQUALIFIED_BLOCK_REFERENCE (outside parent context)
  xmlns + full FQN on element                      ✓  com.machineblocks.bml.calibration.Calibrator.Base
```

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
    <presets type="core:Block[]">
      <composition>

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
    </presets>
  </aggregations>

</block>
```

**`bml:id`** — stable kebab-case identifier. Used for references via `basePresets` and thumbnail filenames. Must be unique within the enclosing Block's `presets` aggregation. Never changes once published.

**`name`** — human-readable display name. Used in the SCAD Customizer JSON and editor UI. May be renamed without breaking references.

**`basePresets`** — space-separated preset ids on any MachineBlocks Block instance. Local ids resolve within the enclosing Block's `_presets`; cross-file entries use `{BlockFQN}::{id}`. Applied left-to-right; later entries override earlier. Own instance properties override all base presets.

Qualified `{BlockFQN}::{id}` references require the target instance in a **public** aggregation and a **literal static `bml:id`** — see `00_bom_core.md` — Qualified Block Instance References.

Presets can reference other presets — preset instances in `_presets` may themselves carry `basePresets`, forming an inheritance chain.

### Preset Reference Syntax

```text
{BlockFQN}::{preset-id}

Example:
  com.machineblocks.bml.bricks.StandardPresets::brick-2x4
```

Requirements for qualified cross-document references:

```text
1. Target aggregation member is public (unprefixed name or visibility="public")
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

**`bootstrap`, `_dependencies`, `_subLibraries`, and `_blocks`** are TypeReference aggregations — each child element name resolves to a Block FQN (type reference, not an instance). **`bml:version` is forbidden** — effective version is resolved from library context. See `17_type_system_bml.md` — Empty child elements.

**`bootstrap`** points to the library entry point — typically a `README` block (`org.blockml.bml.README`). Curated reading order lives in `<references>` with `relation=ReadFirst` (see `doc:BootstrapModel`). Example on `org.blockml.bml.Library`:

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
baseType missing              → BML_MISSING_BASE_TYPE (no default; except org.blockml.bml.core.Block — omits baseType)
root block without type       → BML_MISSING_BLOCK_TYPE
identity type/baseType child element → BML_IDENTITY_TYPE_CHILD_ELEMENT (use FullyQualifiedName text)
root name ≠ last type segment → BML_BLOCK_NAME_TYPE_MISMATCH
Sub-Block without name        → BML_MISSING_SUBBLOCK_NAME
Sub-Block explicit type mismatch → BML_SUBBLOCK_TYPE_MISMATCH
Sub-Block declares embeddedBlocks → BML_EMBEDDED_BLOCKS_ON_SUBBLOCK
<definition> incompatible with block role → BML_DEFINITION_TYPE_MISMATCH
embedded block without type   → BML_MISSING_EMBEDDED_BLOCK_TYPE
embedded block unqualified type → BML_UNQUALIFIED_EMBEDDED_BLOCK_TYPE
unresolvable type reference   → BML_UNKNOWN_TYPE
ambiguous unqualified fallback → BML_AMBIGUOUS_TYPE
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
override without parent       → BML_OVERRIDE_WITHOUT_PARENT
override omitted on merge     → BML_OVERRIDE_REQUIRED
abstract member not implemented → BML_ABSTRACT_MEMBER_NOT_IMPLEMENTED
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
qualified FQN::id targeting non-public aggregation  → BML_UNEXPORTED_INSTANCE_REF
qualified FQN::id with Expression id/ref    → BML_NON_STATIC_INSTANCE_REF
anonymous static child without bml:id     → auto-ID after directive expansion (not stored in BOM)
_steps missing or empty       → assembly order = document order of _parts
```
