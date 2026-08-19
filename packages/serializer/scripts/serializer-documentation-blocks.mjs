/**
 * Documentation block definitions for org.blockml.bml.compiler.serializer.documentation.*
 * Content migrated from docs/13_bml_to_bom_mapping.md, docs/15_dev_setup.md,
 * docs/06_compiler.md, docs/00_system.md (serializer-owned sections).
 */

/** @typedef {{ name: string, is: string, doc: string, refs?: { type: string, relation: string, context?: string }[] }} DocBlock */

/** @type {DocBlock[]} */
export const documentationBlocks = [
  {
    name: "Introduction",
    is: "Purpose and scope of the Serializer package",
    doc: `The @blockml/serializer package converts BomDocument (Urmodell) to canonical BML XML.
    It is the inverse of the parser mapping — enabling BML → BOM → BML roundtrip.

    This library (org.blockml.bml.compiler.serializer.*) is the SSOT. TypeScript in
    packages/serializer/src/ implements it. Parity tests in packages/serializer/test/
    verify BML ↔ TS alignment.

    The serializer is NOT a render target emitter (SCAD, JSON, …). Target output stays
    in @blockml/compiler and domain target packages.

    Pipeline placement: BomDocument ← Parser | BomBuilder; BomDocument → Serializer → BML XML.
    Consumes types from @blockml/bom only — no dependency on @blockml/parser or @blockml/validator.

    V1 ships a hardcoded inverse mapper aligned with docs/13. Meta-driven output via
    Definition blocks + bml:xml is deferred to V2 (see org.blockml.bml.core).`,
    refs: [
      { type: "serdocumentation:LayerSeparation", relation: "ReadNext" },
      { type: "bomdocumentation:Introduction", relation: "SeeAlso" },
    ],
  },
  {
    name: "LayerSeparation",
    is: "Serializer vs parser vs BOM vs core",
    doc: `Four layers relevant to serialization:

    org.blockml.bml.bom.* (@blockml/bom) — Urmodell data structures the serializer reads
    (BomDocument, BlockDefinition, MemberDefinition, SourceInfo, XmlTrivia, …).
    SerializeOptions and SerializeResult (B26) also live here.

    org.blockml.bml.compiler.serializer.* (this package) — emit rules (B12–B25), emit
    architecture, serialize() entry point contract.

    org.blockml.bml.definition.* (@blockml/core) — BML meta-model. V2 serializer reads
    Definition blocks + bml:xml for dynamic emit order. V1 uses a hardcoded snapshot.

    @blockml/parser — BML → BomDocument mapper (inverse direction). Does not own serializer rules.

    The serializer accepts any Urmodell provenance (parser or future BomBuilder.seal()).`,
    refs: [
      { type: "serdocumentation:ArchitectureOverview", relation: "ReadNext" },
      { type: "bomdocumentation:LayerSeparation", relation: "SeeAlso" },
    ],
  },
  {
    name: "ArchitectureOverview",
    is: "Emit pipeline and module decomposition",
    doc: `Entry point: serialize(document, options?) → SerializeResult (B26).

    Pipeline:
    1. Read document.source.namespaceBindings (default { "": "http://blockml.org/bml" })
    2. createEmitContext(bindings, indent) → EmitContext { bindings, useQName, indent }
    3. new XmlWriter(indent) — line-oriented XML builder with depth/indent
    4. Optional <?xml version="1.0" encoding="UTF-8"?> when xmlDeclaration=true
    5. emitRootStartTag — root <block> with xmlns* and xsi:schemaLocation (B25)
    6. emitBlockDefinition — walk BlockDefinition in BLOCK_EMIT_ORDER (B12)
    7. Return { text: writer.toString(), diagnostics, success }

    Module decomposition (packages/serializer/src/):
    • serialize.ts → capability:Serialize orchestrates the pipeline
    • emit/context.ts → seremit:EmitContext, sercap:CreateEmitContext
    • emit/xml.ts → seremit:XmlWriter, escaping/format helpers
    • emit/block.ts → sercap:EmitBlockDefinition, sercap:EmitRootStartTag
    • emit/composition.ts → composition tree emit (templates, instances, directives)
    • emit/type-expression.ts → sercap:EmitTypeExpression (TypeExpression → attribute string)
    • emit/qname.ts → FQN↔QName, visibility prefixes (B14, B21)
    • emit/constants.ts → serconfig:SerializerConstants (XSI_NS, BML_XMLNS)

    Internal types extend serializer:SerializerType. Public operations are sercap:* capabilities.`,
    refs: [
      { type: "serdocumentation:V1Scope", relation: "ReadNext" },
      { type: "sercap:Serialize", relation: "Defines" },
    ],
  },
  {
    name: "V1Scope",
    is: "Phase A hardcoded inverse vs V2 meta-serializer",
    doc: `V1 (Phase A): hardcoded inverse mapper in @blockml/serializer. Emit order (B12)
    is a frozen snapshot of Definition member declaration order — see serdocumentation:EmitOrder.
    Sufficient for the roundtrip gate (B10).

    V2 (deferred): meta-driven serializer reads Definition .bml files via TypeRegistry,
    resolves effective members dynamically, and emits per bml:xml metadata (D1–D9 in
    org.blockml.bml.core). Aligns with 19_definition_blocks_and_bml_xml.md.

    V1 serializer note: roundtrip tests still catch mapping gaps and information loss even
    without meta-driven emit. When Definition .bml members are reordered, V1 requires updating
    the hardcoded BLOCK_EMIT_ORDER; V2 picks up changes automatically.`,
    refs: [
      { type: "serdocumentation:PublicApi", relation: "ReadNext" },
      { type: "def:BlockDefinition", relation: "SeeAlso" },
    ],
  },
  {
    name: "PublicApi",
    is: "serialize() entry point (B26)",
    doc: `serialize(document: BomDocument, options?: SerializeOptions): SerializeResult

    SerializeOptions (owned by @blockml/bom):
    • indent — default 2; pretty-print spaces (B13); 0 = compact
    • xmlDeclaration — default false; omit <?xml …?> (B17/B24)

    SerializeResult (owned by @blockml/bom):
    • text — string | null (null only if serialize cannot produce text)
    • diagnostics — Diagnostic[]
    • success — false if any diagnostic has severity === "error"

    Behaviour:
    • Emit per B12–B25 / D8–D9 (authoredPlacement, authoredCharacterDataForm)
    • BML_NAMESPACE_UNBOUND → error diagnostic; prefer still emitting text when possible
    • Does NOT call the validator — host decides abort-on-diagnostics
    • Sync only; no throw on recoverable errors
    • Never write UTF-8 BOM on output

    Not in V1 API: serializeFile, async variants, streaming.`,
    refs: [
      { type: "bomapi:SerializeOptions", relation: "Defines" },
      { type: "bomapi:SerializeResult", relation: "Defines" },
      { type: "sercap:Serialize", relation: "Defines" },
      { type: "serdocumentation:EmitOrder", relation: "ReadNext" },
    ],
  },
  {
    name: "EmitOrder",
    is: "Canonical block child sequence (B12)",
    doc: `B12 — decided. Canonical BOM→BML element order for Block definition documents follows
    the member declaration order of the Definition meta-model — not alphabetical order.

    V1: hardcoded in serconfig:BlockEmitOrder (frozen snapshot of Definition .bml lists).
    V2: dynamic — load Definition types via TypeRegistry / effective members.

    Canonical <block> child sequence (V1 — emit only when present and not omit-equivalent B17):
    name, type, baseType, is, isNot, version, definition,
    since, status, summary, documentation, abstract, final,
    keywords, changelog, examples, references, constraints,
    aliases, language, genericTypes, contracts,
    properties, aggregations, associations, capabilities, subBlocks, embeddedBlocks, bml:xml

    bml:xml remain in authored slots; xmlns* / xsi:schemaLocation (B25) on root start-tag.
    Leading/trailing XmlTrivia emit immediately before/after the corresponding element (B11).

    Inside containers:
    • properties/aggregations/associations/capabilities — members[] filtered by kind, BOM order
    • genericTypes/contracts/aliases/… — corresponding BOM array order
    • subBlocks/embeddedBlocks — subBlocks[] / embeddedBlocks[] order
    • Member element internals — V1 hardcoded from MemberDefinition.bml; V2 from Definition files

    Identity-first: BlockDefinition.bml requires name → type → baseType before is.`,
    refs: [
      { type: "serconfig:BlockEmitOrder", relation: "Defines" },
      { type: "serdocumentation:EmitRules", relation: "ReadNext" },
    ],
  },
  {
    name: "EmitRules",
    is: "Visibility, boolean, omit, QName/FQN, XSI (B14–B17, B21, B25)",
    doc: `Visibility prefix emit (B14):
    private → localName "__" + name; protected → "_" + name; public → bare name.
    Visibility is SSOT; prefix is reconstructible. Same on composition instance attributes.

    Type-reference emit (B21):
    No BML-semantic prefixed xmlns (excluding xsi) → FQN-emit mode.
    Otherwise → QName-emit mode using namespaceBindings; first authored prefix wins.
    Missing binding in QName mode → BML_NAMESPACE_UNBOUND (no silent FQN fallback).
    xmlns:xsi alone does NOT force QName mode (B25 interaction).

    Boolean literals vs type refs (B15/B16):
    Boolean values → always lowercase true/false.
    Boolean.True/Boolean.False type refs → preserve as TypeExpression (QName or FQN per B21).

    Omit-by-default (B17):
    SHOULD omit: abstract/final/override/readOnly when false, empty containers, visibility
    when prefix encodes it, default-false flags, …
    MUST NOT omit: required identity, true flags, non-default enums, authoredPlacement (D9),
    authored CDATA form (D8), comments, …

    XSI infrastructure (B25):
    Re-emit every stored namespaceBindings entry (including xsi) and, when present,
    xsi:schemaLocation / xsi:noNamespaceSchemaLocation on root start-tag.
    Do not invent schemaLocation when absent.`,
    refs: [
      { type: "serdocumentation:XmlCommentsEmit", relation: "ReadNext" },
      { type: "sercap:FqnToQName", relation: "SeeAlso" },
      { type: "sercap:VisibilityPrefix", relation: "SeeAlso" },
    ],
  },
  {
    name: "XmlCommentsEmit",
    is: "Comment re-emit layout (B11/B22)",
    doc: `Cross-ref: org.blockml.bml.bom.documentation.XmlComments for parse-side binding (B11).

    Serializer re-emit:
    • leadingComments → <!-- body --> lines immediately before the element
    • trailingComments → next line after element end tag (B22 — not same-line)
    • blank line after trailing-comment block so comment reads as trailing to previous element

    Whitespace/layout is not part of BOM equality (B10/B13). Parse accepts same-line trailing;
    serializer normalizes to next-line layout.`,
    refs: [
      { type: "bomdocumentation:XmlComments", relation: "SeeAlso" },
      { type: "serdocumentation:RoundtripContract", relation: "ReadNext" },
    ],
  },
  {
    name: "RoundtripContract",
    is: "BOM equality gate and whitespace normalization (B10/B13/B20)",
    doc: `Authoritative Phase-A gate (B10 + B20): BOM deep equality after parse → serialize → parse.
    Use bomEquals(stripProvenance(a), stripProvenance(b)) from @blockml/bom.

    NOT a gate: byte-identical or normalized XML equality. XML diffs may be logged as
    diagnostics/snapshots but must not fail Phase A.

    Serializer may normalize:
    • formatting whitespace (indent, blank lines, attribute spacing) — B13
    • Boolean casing (True→true) where mapper canonicalized
    • self-closing style, attribute order, …

    Success is defined on the object graph, not byte-identical XML.
    Provenance (source, sourceLocation, end spans) is stripped for equality.`,
    refs: [
      { type: "bomcap:BomEquals", relation: "SeeAlso" },
      { type: "serdocumentation:DesignDecisions", relation: "ReadNext" },
    ],
  },
  {
    name: "DesignDecisions",
    is: "Normative serializer design decisions",
    doc: `Emit order (B12): Definition member declaration order — V1 hardcoded, V2 from Definition .bml.

    Whitespace (B13): formatting whitespace not stored; may normalize on emit.

    Visibility (B14): _ / __ derived from visibility on emit; BOM stores logical name + visibility.

    Omit defaults (B17): omit semantically equivalent absent nodes/attributes on emit.

    Type-ref emit (B21): QName if any BML-semantic prefixed xmlns; FQN in FQN-only docs.

    Trailing comments (B22): next line after end tag + blank line after block.

    XSI (B25): store + re-emit xmlns:xsi and schemaLocation on SourceInfo / root tag.

    Dual placement (D9): emit authoredPlacement form on roundtrip — cross-ref org.blockml.bml.core.

    Provenance-agnostic: serializer works on parser- or builder-origin Urmodell.`,
    refs: [
      { type: "serdocumentation:Diagnostics", relation: "ReadNext" },
    ],
  },
  {
    name: "Diagnostics",
    is: "Serializer diagnostics and host policy",
    doc: `BML_NAMESPACE_UNBOUND — emitted when QName-emit mode requires a namespace prefix
    that is not bound in document.source.namespaceBindings. Error severity; prefer still
    emitting text when possible so host can decide abort policy.

    Host policy (CLI / IDE): whether to refuse serialize after Stage-2 diagnostics is an
    orchestrator decision. The serializer package does not call the validator.

    Diagnostic type: org.blockml.bml.bom.common.Diagnostic (shared with parser/compiler).`,
    refs: [
      { type: "bomcommon:Diagnostic", relation: "SeeAlso" },
      { type: "serdocumentation:PackageOwnership", relation: "ReadNext" },
    ],
  },
  {
    name: "PackageOwnership",
    is: "Toolchain package responsibilities for serialization",
    doc: `@blockml/serializer — BomDocument → canonical BML XML; serialize() → SerializeResult.
    Owns emit rules B12–B25 (serializer-side), emit architecture, this BML library.

    @blockml/bom — Urmodell types, SerializeOptions/SerializeResult (B26), Diagnostic,
    bomEquals/stripProvenance (B20). Serializer consumes; does not redefine.

    @blockml/framework — TypeRegistry, Definition meta-model, bml:xml directive spec (D1–D9).
    V2 serializer consumes; V1 uses hardcoded snapshot.

    @blockml/parser — BML → BomDocument; inverse mapping owned separately.

    @blockml/lsp (V2) — format document → @blockml/serializer.

    @blockml/compiler / render targets — NOT canonical BML roundtrip; separate emit paths.`,
    refs: [
      { type: "serdocumentation:ScopeExclusions", relation: "ReadNext" },
      { type: "bomdocumentation:PackageOwnership", relation: "SeeAlso" },
    ],
  },
  {
    name: "ScopeExclusions",
    is: "Explicit out-of-scope for the serializer package",
    doc: `Out of scope for @blockml/serializer:

    • Meta-driven bml:xml serializer (V2) — specified in org.blockml.bml.core; not V1
    • Render target emit (SCAD, JSON, MBOM serialize) — @blockml/compiler / domain packages
    • Semantic validation — @blockml/validator
    • Parser mapping (BML → BOM) — @blockml/parser
    • TypeRegistry bootstrap, effective member resolution — @blockml/core
    • BomBuilder (V3) — future; serializer accepts its output types only
    • File I/O (serializeFile), async, streaming — deferred API surfaces

    In scope: canonical BML XML roundtrip emit from any valid BomDocument.`,
    refs: [
      { type: "serdocumentation:Introduction", relation: "SeeAlso" },
    ],
  },
];
