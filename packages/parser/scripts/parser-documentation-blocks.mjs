/**
 * Documentation block definitions for org.blockml.bml.compiler.parser.documentation.*
 * Content migrated from docs/13_bml_to_bom_mapping.md, docs/06_compiler.md,
 * docs/15_dev_setup.md, docs/00_system.md (parser-owned sections).
 */

/** @typedef {{ name: string, is: string, doc: string, refs?: { type: string, relation: string, context?: string }[] }} DocBlock */

/** @type {DocBlock[]} */
export const documentationBlocks = [
  {
    name: "Introduction",
    is: "Purpose and scope of the Parser package",
    doc: `The @blockml/parser package converts BML XML source to BomDocument (Urmodell).
    It is the forward mapping — enabling BML → BOM → BML roundtrip together with @blockml/serializer.

    This library (org.blockml.bml.compiler.parser.*) is the SSOT. TypeScript in
    packages/parser/src/ implements it. Parity tests in packages/parser/test/
    verify BML ↔ TS alignment.

    V1 build order: parser and serializer prove BML ↔ BOM roundtrip first; validator
    and compiler follow. Single-file scoped — one parse() invocation → one BomDocument.

    Pipeline placement: BML XML → Parser → BomDocument; consumed by serializer, validator,
    compiler, LSP. Depends on @blockml/bom (types) and @xmldom/xmldom (B18). Does not
    depend on @blockml/serializer, @blockml/validator, or TypeRegistry bootstrap.`,
    refs: [
      { type: "pardocumentation:LayerSeparation", relation: "ReadNext" },
      { type: "bomdocumentation:Introduction", relation: "SeeAlso" },
    ],
  },
  {
    name: "LayerSeparation",
    is: "Parser vs BOM vs core vs serializer vs validator",
    doc: `Five layers relevant to parsing:

    org.blockml.bml.bom.* (@blockml/bom) — Urmodell data structures the parser produces
    (BomDocument, BlockDefinition, MemberDefinition, …). ParseOptions and ParseResult (B26).

    org.blockml.bml.compiler.parser.* (this package) — BML → BOM mapping algorithm,
    Stage 1 pipeline [1]–[5], parse() entry point contract.

    org.blockml.bml.definition.* (@blockml/core) — BML meta-model. Parser links to Definition
    blocks for canonical paths; does not duplicate language grammar.

    org.blockml.bml.compiler.serializer.* (@blockml/serializer) — inverse mapping (BOM → BML).
    Emit rules B12–B25 live there, not here.

    @blockml/framework utilities — parseExpression() (Stage 2 AST), TypeRegistry, validateTypes.
    Parser stores ExpressionValue.raw only (B4); never writes AST to Urmodell.`,
    refs: [
      { type: "pardocumentation:ArchitectureOverview", relation: "ReadNext" },
      { type: "bomdocumentation:LayerSeparation", relation: "SeeAlso" },
    ],
  },
  {
    name: "ArchitectureOverview",
    is: "Parse pipeline [1]–[5] and module decomposition",
    doc: `Entry point: parse(source, options?) → ParseResult (B26).

    Stage 1 pipeline:
    [1] Format detect (B24) — detectFormat(); strip UTF-8 BOM; first '<' → xml
    [2] XML DOM (B18) — parseXmlDom() via @xmldom/xmldom
    [3] Root type resolver — assertBlockRoot(); V1: <block> only
    [4] Namespace resolver — extractNamespaceBindings(), mergeSourceInfo(); FQN resolution
    [5] BML → BOM mapper — mapDocumentBlock() → BomDocument

    Module decomposition (packages/parser/src/):
    • parse.ts → parcap:Parse orchestrates [1]–[5]
    • pipeline/format-detect.ts → parcap:DetectFormat
    • pipeline/xml-dom.ts → parcap:ParseXmlDom, GetParseErrors, DocumentElement
    • pipeline/root-type.ts → parcap:AssertBlockRoot
    • pipeline/namespaces.ts → parcap:ExtractNamespaceBindings, MergeSourceInfo
    • map/context.ts → parmap:MapContext, parcap:CreateMapContext
    • map/map-block.ts → parcap:MapDocumentBlock, MapBlock
    • map/map-composition.ts → composition tree mapping
    • map/type-expression.ts → parcap:ParseTypeExpression
    • map/member-value.ts → parcap:ParseMemberValue
    • map/directives.ts → parcap:ParseDirectives, ParseBmlMeta
    • util/* → visibility, boolean, qname, xml helpers`,
    refs: [
      { type: "pardocumentation:V1Scope", relation: "ReadNext" },
      { type: "parcap:Parse", relation: "Defines" },
    ],
  },
  {
    name: "V1Scope",
    is: "Phase A parser slice and deferred features",
    doc: `V1 (Phase A) parser implements:
    • Hardcoded BML → BOM mapper for <block> root documents
    • Single-file scope (B5) — no TypeRegistry bootstrap in parse()
    • Stage 1 only — no semantic validation (B8: XSD not Stage 1)
    • JSON BML authoring not planned (B6)
    • Tolerant parse by default (continueOnError: true)

    Deferred: cross-file resolution, parseFile/async, streaming, parse({ validate: true }),
    meta-driven mapping from Definition blocks (V2).`,
    refs: [
      { type: "pardocumentation:PublicApi", relation: "ReadNext" },
      { type: "pardocumentation:SingleFileScope", relation: "SeeAlso" },
    ],
  },
  {
    name: "PublicApi",
    is: "parse() entry point (B26)",
    doc: `parse(source: string, options?: ParseOptions): ParseResult

    ParseOptions (owned by @blockml/bom):
    • filePath — default "<memory>"; written to BomDocument.source.filePath
    • continueOnError — default true; keep mapping after errors when possible

    ParseResult (owned by @blockml/bom):
    • document — BomDocument | null (null on hard fail)
    • diagnostics — Diagnostic[]
    • success — false if any diagnostic has severity === "error"

    Behaviour:
    • B24 detect → [2] xmldom → [3]–[5] map
    • Hard fail → document: null (unsupported format, missing root, invalid root)
    • Mapping errors → BML_MAP_ERROR; with continueOnError still return document when possible
    • Sync only; no throw on recoverable errors
    • Does NOT call validator; does NOT expand directives`,
    refs: [
      { type: "bomapi:ParseOptions", relation: "Defines" },
      { type: "bomapi:ParseResult", relation: "Defines" },
      { type: "parcap:Parse", relation: "Defines" },
      { type: "pardocumentation:MappingPrinciples", relation: "ReadNext" },
    ],
  },
  {
    name: "MappingPrinciples",
    is: "Fundamental mapping rule — structure + preservation",
    doc: `BML → BOM → BML must always be possible. The mapper preserves authored structure
    and values — directives, aggregation declarations, literal syntax, unresolved type
    references, namespace bindings, and bml:xml metadata.

    Mapper responsibility: structure + classification + preservation.
    NOT mapper responsibility: canonicalization, expansion, merge, evaluation.

    BOM makes no statement about directive expansion, aggregation interpretation, or
    block rendering. Maximum authored surface: store as much as Urmodell can carry.`,
    refs: [
      { type: "pardocumentation:MemberMappingOrder", relation: "ReadNext" },
      { type: "bomdocumentation:AbstractionPrinciple", relation: "SeeAlso" },
    ],
  },
  {
    name: "MemberMappingOrder",
    is: "BML document order preserved in members[]",
    doc: `Append to members[] in BML document order — the order elements appear in source.

    • Element localName = member name (no name= attribute on member elements)
    • MUST NOT sort by name, kind, or type
    • Ordinal = index in members[] — roundtrip must preserve array order
    • Parser accepts any authored sibling order; serializer emits canonical order (B12)

    Inside containers (properties/aggregations/…): filter by kind, keep BOM array order.`,
    refs: [
      { type: "pardocumentation:AttributeClassification", relation: "ReadNext" },
    ],
  },
  {
    name: "AttributeClassification",
    is: "Fixed priority chain for XML attributes (Rules 1–3)",
    doc: `When mapping an XML element, every attribute is classified — first matching rule wins:

    Rule 1 — XML infrastructure:
    • xmlns* → SourceInfo.namespaceBindings (incl. xmlns:xsi — B25)
    • xsi:schemaLocation / xsi:noNamespaceSchemaLocation → SourceInfo (B25)
    • other xsi:* → ignore (not memberValues)

    Rule 2 — bml:* attributes:
    • Composition meta (bml:id, bml:version, …) → BlockInstance fields
    • Directives (bml:each, bml:if, …) → directives[]
    • Unknown bml:* → BML_UNKNOWN_DIRECTIVE (error at map time — B2)

    Rule 3 — All other attributes:
    • memberValues[name] (camelCase)
    • \${ expr } → ExpressionValue { raw } (B4)

    Serialize side of Rule 1 (B25 re-emit) → @blockml/serializer.`,
    refs: [
      { type: "pardocumentation:XmlCommentsParse", relation: "ReadNext" },
      { type: "parcap:ParseDirectives", relation: "SeeAlso" },
    ],
  },
  {
    name: "XmlCommentsParse",
    is: "Comment binding algorithm (B11 parse side)",
    doc: `Cross-ref: org.blockml.bml.bom.documentation.XmlComments for Urmodell storage model.

    Parse algorithm:
    • pendingLeading comments → bind to next element as leadingComments
    • Comments after element end tag → trailingComments on that element
    • Storage: xmlTrivia on elements, memberSectionTrivia, metadataTrivia

    Comment bodies only — without <!-- / -->. Whitespace/layout not stored (B13).
    Re-emit rules (B22) → @blockml/serializer.`,
    refs: [
      { type: "bomdocumentation:XmlComments", relation: "SeeAlso" },
      { type: "pardocumentation:TypeDescriptorParsing", relation: "ReadNext" },
    ],
  },
  {
    name: "TypeDescriptorParsing",
    is: "TypeExpression parsing at map time",
    doc: `Parse type attribute strings into BOM TypeExpression shapes (defined in @blockml/bom).

    • Named type refs → resolved FQN via namespace bindings + implicit namespaces
    • Union (A | B), struct ({ a: T }), multiplicity, nested (T[])[], generics (including unions as arguments), self refs
    • Ungrouped stacked multiplicity Integer[][] → BML_INVALID_TYPE_REFERENCE
    • Boolean.True/Boolean.False preserved as type refs (B16) — not rewritten to literals
    • Boolean values normalized to lowercase (B15)
    • Failure → BML_UNKNOWN_TYPE
    • Anonymous struct at specialized sites; context-bound implicit namespaces per 02_mbml.md`,
    refs: [
      { type: "parcap:ParseTypeExpression", relation: "Defines" },
      { type: "pardocumentation:BlockMetadataMapping", relation: "ReadNext" },
    ],
  },
  {
    name: "BlockMetadataMapping",
    is: "Block definition metadata field mapping",
    doc: `Map <block> child elements to BlockDefinition fields:

    Identity: name, type, baseType, is, isNot, version, definition
    Structural: since, status, summary, documentation, abstract, final
    Aggregations: keywords, changelog, examples, references, constraints, aliases,
    language, genericTypes, contracts, properties, aggregations, associations,
    capabilities, subBlocks, embeddedBlocks

    • xmlRendering (bml:xml metadata) stored on BlockDefinition — NOT in directives[] (B23/D3)
    • authoredPlacement stored for dual element|attribute forms (D9)
    • authoredCharacterDataForm for text vs CDATA (D8)
    • Visibility prefixes stripped → logical name + visibility (B14 parse half)`,
    refs: [
      { type: "pardocumentation:MemberMapping", relation: "ReadNext" },
      { type: "def:BlockDefinition", relation: "SeeAlso" },
    ],
  },
  {
    name: "MemberMapping",
    is: "Member definition and composition mapping",
    doc: `Property/aggregation/association/capability members:
    • Element QName = member identity (deprecated namespace= attr → error)
    • type attribute → TypeExpression; value/memberValues for properties
    • Composition under aggregation member elements (not standalone <composition>)
    • Constraints/suggestions → BlockInstance[] in document order
    • Sub-Blocks and embedded blocks → nested BlockDefinition trees
    • Redundant aggregation type on override → validator warning B19; parser must not apply

    Directives on composition: bml:each, bml:if, bml:unless, bml:with — stored unexpanded.`,
    refs: [
      { type: "pardocumentation:ExpressionCapture", relation: "ReadNext" },
      { type: "parcap:MapBlockInstanceNode", relation: "SeeAlso" },
    ],
  },
  {
    name: "ExpressionCapture",
    is: "Raw expression storage — no AST in Urmodell (B4)",
    doc: `\${ … } attribute/element values → ExpressionValue { raw, source }.
    Implementation CDATA → embeddedExpressions[] with source offsets.

    Parser step [5] captures raw text only. AST construction via parseExpression()
    in @blockml/framework (Stage 2 utility) — never stored on Urmodell.

    inputType/outputType on capabilities → TypeExpression at map time (B3).`,
    refs: [
      { type: "pardocumentation:SingleFileScope", relation: "ReadNext" },
      { type: "parcap:ExpressionFromRaw", relation: "SeeAlso" },
    ],
  },
  {
    name: "SingleFileScope",
    is: "One BomDocument per parse(); external refs as strings (B5)",
    doc: `parse() produces exactly one BomDocument per invocation.

    Cross-file references stored in authored form:
    • type/baseType FQNs as resolved strings
    • Preset refs as FQN::id strings (unmerged)
    • bml:version on instances — no registry lookup at parse time

    TypeRegistry bootstrap, effective member resolution, cross-file validation →
    @blockml/cli orchestrator + @blockml/framework utilities + @blockml/validator.`,
    refs: [
      { type: "pardocumentation:DesignDecisions", relation: "ReadNext" },
    ],
  },
  {
    name: "DesignDecisions",
    is: "Normative parser design decisions",
    doc: `B2: unknown bml:* → error at map; unknown custom props → validator warning.
    B3: inputType/outputType → TypeExpression at map time.
    B4: ExpressionValue.raw only; AST via core utility.
    B5: single-file parser scope.
    B6: JSON not planned.
    B7/B8: Phase A slice; XSD not Stage 1.
    B11: XML comments bound to elements (parse side).
    B14: strip _/__ → logical name + visibility.
    B15/B16: boolean values vs type refs.
    B18: @xmldom/xmldom for DOM.
    B19: redundant aggregation type — map must not apply.
    B23: preserve xmlRendering + D6 recipe at Stage 1.
    B24: format detector (BOM strip, first '<').
    B25: store xmlns:xsi + schemaLocation on SourceInfo.
    B26: parse() entry; types in @blockml/bom.`,
    refs: [
      { type: "pardocumentation:RoundtripContract", relation: "ReadNext" },
    ],
  },
  {
    name: "RoundtripContract",
    is: "Parse-side roundtrip obligations (B10/B11/B13/B20)",
    doc: `Phase-A gate: bomEquals(stripProvenance(parse(serialize(parse(f)))), parse(f)).
    Shared definition in @blockml/bom (B20).

    Parser obligations:
    • Preserve semantic content for serializer re-emit
    • Store xmlRendering, authoredPlacement, authoredCharacterDataForm, namespaceBindings
    • Do NOT require storing formatting whitespace (B13)
    • Single-file roundtrip tests do not require TypeRegistry bootstrap

    XML byte fidelity NOT a gate — see @blockml/serializer RoundtripContract.`,
    refs: [
      { type: "bomcap:BomEquals", relation: "SeeAlso" },
      { type: "serdocumentation:RoundtripContract", relation: "SeeAlso" },
      { type: "pardocumentation:Diagnostics", relation: "ReadNext" },
    ],
  },
  {
    name: "Diagnostics",
    is: "Map-time and pipeline diagnostic codes",
    doc: `Pipeline hard-fail codes (parse.ts):
    • BML_UNSUPPORTED_FORMAT — format detect failed
    • BML_MALFORMED_XML — DOM parse error
    • BML_MISSING_ROOT — no document element
    • BML_INVALID_ROOT — not <block> (V1)
    • BML_MAP_ERROR — mapping exception

    Map-time codes (mapper modules):
    • BML_UNKNOWN_NAMESPACE_PREFIX, BML_UNQUALIFIED_BLOCK_REFERENCE
    • BML_UNKNOWN_TYPE — type expression parse failure
    • BML_INVALID_TYPE_REFERENCE — ill-formed type expression (ungrouped stacked multiplicity)

    Host policy: whether to abort after diagnostics is orchestrator decision.
    Diagnostic type: org.blockml.bml.bom.common.Diagnostic.`,
    refs: [
      { type: "parconfig:MapTimeDiagnosticCodes", relation: "Defines" },
      { type: "pardocumentation:PackageOwnership", relation: "ReadNext" },
    ],
  },
  {
    name: "PackageOwnership",
    is: "Toolchain package responsibilities for parsing",
    doc: `@blockml/parser — BML XML → BomDocument; parse() → ParseResult.
    Owns mapping algorithm, Stage 1 pipeline [1]–[5], this BML library.

    @blockml/bom — Urmodell types, ParseOptions/ParseResult (B26), Diagnostic,
    bomEquals/stripProvenance (B20). Parser produces; does not redefine.

    @blockml/framework — TypeRegistry, parseExpression(), Definition meta-model, validateTypes.
    Parser consumes implicit namespace rules; defers AST and semantic validation.

    @blockml/serializer — BOM → BML inverse. @blockml/validator — Stage 2 checks.
    @blockml/cli — TypeRegistry bootstrap and orchestration.`,
    refs: [
      { type: "pardocumentation:ScopeExclusions", relation: "ReadNext" },
      { type: "bomdocumentation:PackageOwnership", relation: "SeeAlso" },
    ],
  },
  {
    name: "ScopeExclusions",
    is: "Explicit out-of-scope for the parser package",
    doc: `Out of scope for @blockml/parser:

    • BOM → BML emit — @blockml/serializer
    • Semantic validation — @blockml/validator
    • TypeRegistry bootstrap / cross-file resolve — @blockml/cli + @blockml/framework
    • parseExpression() AST — @blockml/framework (Stage 2)
    • Render target output — @blockml/compiler
    • parseFile, async, streaming — deferred API
    • Meta-driven mapping from Definition blocks — V2

    In scope: single-file BML XML → lossless BomDocument.`,
    refs: [
      { type: "pardocumentation:Introduction", relation: "SeeAlso" },
    ],
  },
];
