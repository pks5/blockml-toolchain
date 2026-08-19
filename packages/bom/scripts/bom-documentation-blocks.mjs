/**
 * Documentation block definitions for org.blockml.bml.bom.documentation.*
 * Content migrated from docs/12_bom_object_model.md (v1.4.0).
 */

/** @typedef {{ name: string, is: string, doc: string, refs?: { type: string, relation: string, context?: string }[] }} DocBlock */

/** @type {DocBlock[]} */
export const documentationBlocks = [
  {
    name: "Introduction",
    is: "Purpose and scope of the BOM Urmodell package",
    doc: `The @blockml/bom package defines the formal Block Object Model (Urmodell) — canonical,
    immutable, lossless parse/build results produced by @blockml/parser (or V3 BomBuilder.seal())
    and consumed by serializer, validator, compiler, LSP, and render targets.

    This library (org.blockml.bml.bom.*) is the SSOT. TypeScript in packages/bom/src/ implements
    it. Parity tests in packages/bom/test/ verify BML ↔ TS alignment.

    Related reading outside this package:
    • Conceptual foundations — 01_bom_core.md
    • BML authoring syntax — org.blockml.bml.documentation.* (@blockml/core)
    • BML → BOM mapping — @blockml/parser (13_bml_to_bom_mapping.md)
    • Expression AST — 10_expression_language.md`,
    refs: [
      { type: "bomdocumentation:LayerSeparation", relation: "ReadNext" },
      { type: "bomdocumentation:ArchitectureOverview", relation: "SeeAlso" },
    ],
  },
  {
    name: "LayerSeparation",
    is: "Urmodell types vs BML definition meta-model",
    doc: `Two layers share names but differ in semantics:

    org.blockml.bml.definition.* (@blockml/core) — BML meta-model. Describes what block
    definition documents mean (PropertyDefinition, BlockDefinition meta-type, …).

    org.blockml.bml.bom.* (this package) — Urmodell runtime. Parse-result data structures
    (BomDocument, BlockDefinition as TS interface, MemberDefinition, …).

    Example: org.blockml.bml.definition.BlockDefinition describes BML syntax; org.blockml.bml.bom.block.BlockDefinition
    describes the parser output shape. See 19_definition_blocks_and_bml_xml.md.`,
    refs: [{ type: "def:BlockDefinition", relation: "SeeAlso" }],
  },
  {
    name: "ArchitectureOverview",
    is: "BML source to render pipeline",
    doc: `Pipeline roles:

    BML source → universal authoring and interchange format
    Urmodell (BOM) → canonical, immutable, lossless parse/build result (SSOT, read-only)
    BomBuilder (V3) → planned writable session; seal() → Urmodell (same types)
    Pragmatic Model → validator default fork + optional renderer forks (resolve only)
    Framework Utilities → derived views / merges on forks — never mutate Urmodell
    Render Target → chooses Urmodell / pragmatic / own forks + optional target working model

    Block in BML is the mandatory input concept — not a uniform runtime object model.
    The parser must read block documents; validators walk baseType chains. Internal
    representation after parse is implementation freedom.`,
    refs: [{ type: "bomdocumentation:AbstractionPrinciple", relation: "ReadNext" }],
  },
  {
    name: "AbstractionPrinciple",
    is: "Lossless representation and roundtrip guarantee",
    doc: `A BOM document is a lossless representation of BML source. It preserves authored
    structure and values — directives, aggregation declarations, literal syntax, unresolved
    type references, namespace bindings, and bml:xml metadata. BOM makes no statement about
    directive expansion, aggregation interpretation, or block rendering.

    Maximum authored surface: render targets and the serializer must read as much of the
    original document as the Urmodell can carry. Prefer first-class fields over hidden side channels.

    BML → BOM → BML must always be possible.`,
    refs: [{ type: "bomdocumentation:AuthoredSurfaceTable", relation: "ReadNext" }],
  },
  {
    name: "AuthoredSurfaceTable",
    is: "What BOM stores vs what downstream interprets",
    doc: `bml:each / bml:if / bml:with → directives[] unexpanded → Renderer expands
    xmlns / xmlns:prefix → SourceInfo.namespaceBindings 1:1 authored → Serializer QName emit (B21)
    xsi:schemaLocation / xsi:noNamespaceSchemaLocation → SourceInfo (B25) → re-emit on root
    bml:xml → xmlRendering block+member — NOT directives[] → Serializer, FatBlock, XSD
    element|attribute dual placement → authoredPlacement (D9) → MUST roundtrip authored form
    Text vs CDATA → authoredCharacterDataForm (D8) → emit CDATA when needed or authored
    Literal syntax [5,5,6] vs {x:5,…} → LiteralValue authored form → Renderer serializes
    \${ expr } → ExpressionValue { raw } — AST via parseExpression(), not evaluated
    aggregations declaration → AggregationDefinition declared only → TypeRegistry metadata
    composition children → CompositionNode tree → Renderer assembly patterns
    baseType FQN → string reference → TypeRegistry effective members
    Preset reference FQN::id → unmerged string → Renderer preset merge
    Capabilities → CapabilityDefinition in BOM → Renderer interprets (not invoked at parse)
    XML comments → XmlTrivia on following element (B11) → Serializer re-emits`,
  },
  {
    name: "DesignDecisions",
    is: "Normative Urmodell design decisions",
    doc: `Immutability: Urmodell (BomDocument) is immutable after parse or BomBuilder.seal().
    No utility or renderer writes derived data back. Validator/renderers use pragmatic forks.

    Builder / LSP reuse: construction-friendly, provenance-agnostic interfaces. Parser and
    BomBuilder produce the same graph. Source spans optional on types but populated by parser.

    Member inheritance: utility lookup only. BOM stores declared members per block.
    resolveEffectiveMembers() → EffectiveMemberSet — never flattened into BOM.

    Capabilities: stored in BOM; no synthetic getter/setter generation; renderer interprets.

    Member identity: uniqueness by resolved (namespace, name).

    Composition: nested inside aggregation on definitions only; instances open aggregations directly.

    Sub-Blocks: nested in BlockDefinition.subBlocks[]; FQN = parent.type + "." + name.

    Embedded Blocks: root embeddedBlocks[] only — virtual .bml files; FQN = type element.

    Directives: flow-control bml:* → directives[] unexpanded. bml:id/version → BlockInstance fields.
    bml:xml → first-class xmlRendering (not directives[]).

    XML comments (B11): bind to following element; trailing on next line + blank line (B22).
    Whitespace (B13): not on Urmodell. Dual placement (D9): store authoredPlacement.
    Visibility (B14): logical name in BOM; emit _/__ from visibility.

    Instance version: bml:version optional exact assert on external refs (BML_UNKNOWN_VERSION).
    Definition version: effectiveBlockVersion = own version | library.version | error.
    Instance id: bml:id only on BlockInstance.id; no auto-ID in BomDocument; bml:each requires id.

    Property values: deep copy only — never linked. FQN::id cross-instance refs only on associations.`,
  },
  {
    name: "PackageOwnership",
    is: "Toolchain package responsibilities for the Urmodell",
    doc: `@blockml/bom — all Urmodell interfaces, ParseResult/SerializeResult/ValidateResult (B26 + Stage 2),
    ValidateOptions, TypeRegistryReader, Diagnostic (compiler result type), bomEquals/stripProvenance (B20),
    future BomBuilder (V3).

    @blockml/framework — TypeRegistry, forkBom, resolveEffectiveMembers, validateTypes, parseExpression.
    Utilities never mutate Urmodell.

    @blockml/core — BlockML language BML corpus (org.blockml.bml.*); npm SSOT in node_modules.

    @blockml/parser — BML → BomDocument mapper; single file per invocation; parse() → ParseResult.
    Does not own BOM interfaces or expand directives.

    @blockml/serializer — BomDocument → canonical BML XML; serialize() → SerializeResult.

    @blockml/validator — checks on BomDocument using framework utilities.

    @blockml/cli — TypeRegistry bootstrap, validateTypes/validateConstraints, compile pipeline.

    @blockml/lsp (V2) — reuses parser, validator, serializer; no parallel IDE AST.

    @blockml/compiler — Target Registry facade.

    @machineblocks/core — domain BML; extends TypeRegistry bootstrap.`,
  },
  {
    name: "PublicApi",
    is: "Shared parse/serialize/validate results (B26 + Stage 2)",
    doc: `ParseResult: document (BomDocument | null), diagnostics[], success (false if any error).

    SerializeResult: text (string | null), diagnostics[], success.

    ValidateResult: optional pragmaticModel (forked BomDocument), diagnostics[], success.

    ParseOptions: filePath (default "<memory>"), continueOnError (default true).

    SerializeOptions: indent (default 2; 0=compact B13), xmlDeclaration (default false B17/B24).

    ValidateOptions: typeRegistry (TypeRegistryReader), bootstrapPaths, libraryPaths, continueOnError (default true).

    TypeRegistryReader: minimal get/has surface for ValidateOptions — implemented by @blockml/framework.

    bomEquals(a, b): structural equality modulo provenance (B20).
    stripProvenance(node): deep-clone omitting sourceLocation, endLine, endColumn, provenance source.
    Preserves ImplementationBlock.source (code body).

    Sync only. No throw on recoverable diagnostics. Diagnostic distinct from org.blockml.bml.core.Diagnostic.`,
    refs: [
      { type: "bomapi:ParseResult", relation: "Defines" },
      { type: "bomapi:ValidateResult", relation: "Defines" },
      { type: "bomcap:BomEquals", relation: "Defines" },
    ],
  },
  {
    name: "XmlComments",
    is: "XML comment binding rules (B11, B22)",
    doc: `Comments are part of maximum authored surface — parser binds, never drops.

    1. Comment(s) before element E → E.xmlTrivia.leadingComments[] (document order)
    2. Comment(s) after E end tag before next sibling → trailingComments[] (incl. same-line)
    3. File-header before root block → root BlockDefinition.xmlTrivia.leadingComments
    4. Before member-section container → memberSectionTrivia[section]
    5. Before metadata child (name, final, …) → metadataTrivia[localName]
    6. Dangling comment → trailingComments of previous sibling or root

    NOT preserved (Phase A): processing instructions; formatting whitespace (B13); attribute order.
    DO preserve: comments (B11); dual placement (D9); CDATA form (D8).

    Serializer: re-emit leading before element; trailing on next line after end tag + blank line (B22).
    Sibling order follows B12. Layout whitespace not part of BOM equality (B10/B13).`,
  },
  {
    name: "SubBlockAndEmbeddedBlocks",
    is: "Sub-Block FQN derivation and inline library embeds",
    doc: `Sub-Blocks omit type in BML by convention. FQN derived recursively:
    parent.type + "." + name (BML_SUBBLOCK_TYPE_MISMATCH if explicit type differs).

    Sub-Blocks share one BomDocument; may nest arbitrarily. Must not declare embeddedBlocks
    (BML_EMBEDDED_BLOCKS_ON_SUBBLOCK).

    embeddedBlocks: Inline Library on document root only. Each entry is a virtual .bml file.
    FQN = fully qualified type element value — not nested under root. No nested embeds
    (BML_NESTED_EMBEDDED_BLOCKS). Duplicate FQNs → BML_DUPLICATE_EMBEDDED_BLOCK.
    Shadows library definitions within BomDocument; invisible externally.

    Composition references to embeds must use fully qualified block type.`,
  },
  {
    name: "TypeExpressionsOverview",
    is: "Parse-time type expression model",
    doc: `TypeExpression (alias TypeDescriptor in V1) — structured parse-time AST, not a ValueType.
    Used for Capability inputType/outputType and Property type attributes.

    Union variants: named, union, genericParam, self, anonymousStruct.

    Anonymous struct = shorthand for inline class with ordered fields (FunctionMapping positional order).
    Single primitive = NamedTypeReference directly — not wrapped in one-field struct.

    Union variant discrimination and AST are validateTypes()/parseExpression() utility results —
    not stored in Canonical BOM.`,
    refs: [{ type: "bomtype:TypeExpression", relation: "Defines" }],
  },
  {
    name: "MemberValueSemantics",
    is: "Property value deep-copy rules",
    doc: `Property values are never linked — always deep copies on instances and definitions.
    Cross-instance FQN::id references exist only on associations (basePresets, Step.part, …).

    EnumType tokens (Standard, FQN::id) are resolution keys — BOM stores id + typeFqn only.
    Struct/primitive literals stay inline in authored form — not normalized at parse time.

    LiteralValue: kind literal, opaque value, typeFqn, optional authoredPlacement (D9).
    ExpressionValue: kind expression, raw \${} text only in BOM; AST via parseExpression().
    AddressValue: parsed org.blockml.bml.type.Address shape.

    Preset/config merge copies into render-time view — never writes references back to BomDocument.`,
    refs: [{ type: "bomvalue:MemberValue", relation: "Defines" }],
  },
  {
    name: "CompositionDirectives",
    is: "Directive placement and Thymeleaf model",
    doc: `Directives follow Thymeleaf model — attributes on modified element, stored unexpanded.

    bml:id, bml:version, bml:bean, bml:scope → BlockInstance fields (NOT directives[]).
    bml:with → composition, aggregation, bml:container, block instances.
    bml:each, bml:if, bml:unless → bml:container, block instances.

    Dynamic ids: bml:id="\${ 'val_' + i }" stored as ExpressionValue or literal on BlockInstance.id.
    Omitted bml:id stored absent — parser does not assign auto-IDs.`,
    refs: [{ type: "bomcomp:DirectiveAttribute", relation: "Defines" }],
  },
  {
    name: "InstanceIdRules",
    is: "bml:id identity and cross-instance references",
    doc: `bml:id identifies child within parent composition tree. No FQN fallback.

    Pipeline: Parse stores authored id → Validate cross-refs → Expand directives →
    Resolve/auto-ID static unreferenced children → Render.

    Auto-IDs NOT in BomDocument — only on expanded composition tree.
    Referenced instances and bml:each require explicit bml:id (BML_MISSING_ID).

    Auto-ID: hash(typeFqn, sibling index post-expansion, parent partId) → 6 hex chars.

    Qualified FQN::id: target in public aggregation, literal id, literal reference token.
    Same-document unqualified ids resolve within visible aggregations.`,
  },
  {
    name: "VersionRules",
    is: "Effective block version and instance version asserts",
    doc: `Definition effectiveBlockVersion = own version | library.version (if exported) | BML_MISSING_VERSION.
    Block in library: version >= library.version when both declared.

    Same-document Sub-Block refs: bml:version not allowed as resolution hint.
    External refs: bml:version omitted → registry context; present → exact assert (BML_UNKNOWN_VERSION).
    Library catalog sugar (readMe, bootstrap, dependencies, blocks): same bml:version rules.

    Framework convention: version only on Library.bml for org.blockml.bml.* / com.machineblocks.bml.*`,
  },
  {
    name: "ValidationResponsibilities",
    is: "Full validator checklist on BomDocument",
    doc: `Parser produces BomDocument. Validator (@blockml/validator + @blockml/core) checks:

    Member namespace uniqueness; baseType in TypeRegistry; property values inline deep copies;
    resolveEffectiveMembers for expression refs; effective version (BML_MISSING_VERSION);
    library block.version >= library.version; bml:version asserts (BML_UNKNOWN_VERSION);
    cross-instance refs to explicit authored id; qualified FQN::id on public aggregations;
    bml:each explicit id; Sub-Block qualified/FQN refs; generic param ≠ block/sub-block names;
    visibility rules; no duplicate visibility-prefix variants; expression types match;
    preset properties exist; property value cycles; basePresets resolve without cycles;
    contracts merge order; validateConstraints after resolveEffectiveMembers;
    readOnly enforcement (BML_READONLY_MEMBER_WRITE); library blocks/deps resolve;
    no outer library re-export from inner library (BML_LIBRARY_NESTING_VIOLATION).

    Validator does NOT expand directives, assign auto-IDs, or interpret aggregations.`,
    refs: [{ type: "bomdocumentation:RelatedDiagnostics", relation: "SeeAlso" }],
  },
  {
    name: "RelatedDiagnostics",
    is: "BOM-relevant diagnostic codes",
    doc: `BML_MISSING_BASE_TYPE, BML_MISSING_BLOCK_TYPE, BML_BLOCK_NAME_TYPE_MISMATCH,
    BML_MISSING_SUBBLOCK_NAME, BML_SUBBLOCK_TYPE_MISMATCH, BML_EMBEDDED_BLOCKS_ON_SUBBLOCK,
    BML_NESTED_EMBEDDED_BLOCKS, BML_DUPLICATE_EMBEDDED_BLOCK, BML_DEFINITION_TYPE_MISMATCH,
    BML_MISSING_EMBEDDED_BLOCK_TYPE, BML_UNQUALIFIED_EMBEDDED_BLOCK_TYPE, BML_AMBIGUOUS_TYPE,
    BML_CONSTRAINT_*, BML_MISSING_IS, BML_MISSING_DOCUMENTATION, BML_MISSING_ISNOT,
    BML_MISSING_SUMMARY, BML_DUPLICATE_*, BML_INVALID_SINCE_VERSION, BML_CHANGELOG_VERSION_ORDER,
    BML_EXAMPLE_*, BML_UNKNOWN_NATURAL_LANGUAGE, BML_MISSING_VERSION, BML_UNKNOWN_VERSION,
    BML_VERSION_BELOW_LIBRARY, BML_VERSION_MINOR_DRIFT, BML_LIBRARY_NESTING_VIOLATION,
    BML_MISSING_ID, BML_UNRESOLVABLE_INSTANCE_REF, BML_UNEXPORTED_INSTANCE_REF,
    BML_NON_STATIC_INSTANCE_REF, BML_DUPLICATE_MEMBER_*, BML_INVALID_PROPERTY_TYPE,
    BML_UNKNOWN_TYPE, BML_INVALID_DEFINITION_BRANCH, BML_INVALID_TYPE_REFERENCE,
    BML_UNKNOWN_PROPERTY, BML_UNKNOWN_DIRECTIVE, BML_DIRECTIVE_NOT_ALLOWED,
    BML_PROPERTY_CYCLE, BML_VISIBILITY_*, BML_FINAL_MEMBER_OVERRIDE, BML_OVERRIDE_*,
    BML_ABSTRACT_MEMBER_NOT_IMPLEMENTED, BML_READONLY_MEMBER_WRITE, BML_STANDALONE_COMPOSITION,
    BML_NAMESPACE_*, BML_XML_*, BML_PRESET_CYCLE, BML_GENERIC_*, BML_TYPE_BOUND_NOT_SATISFIED,
    BML_UNKNOWN_CONTRACT, BML_CONTRACT_*, BML_EXPR_UNKNOWN_PROPERTY.

    Full catalog: org.blockml.bml.diagnostic.* (@blockml/core) and 06_compiler.md.`,
  },
  {
    name: "CalibratorExample",
    is: "Reference BomDocument walkthrough",
    doc: `Source: com.machineblocks.bml.calibration.Calibrator.bml

    BomDocument kind block → BlockDefinition Calibrator
    type com.machineblocks.bml.calibration.Calibrator, baseType CompositeBlock, version 1.0.0

    Declared members only (not inherited size, offset, baseColor):
    numberOfSamples, font, size (ExpressionValue), _utils aggregation (Utils bean context),
    _parts aggregation (4 calibration rows).

    subBlocks: Utils, Base, StudDiameter, BaseWallThickness, TubeDiameter, PinDiameter.

    compositions: _utils → Utils instance; _parts → Base, StudDiameter, Base (id=base_wall), …

    Observations: Sub-Block refs by short name resolved via subBlocks[] tree.
    @utils.formatValue and #math.* stored as ExpressionValue { raw }.
    Inherited native properties not in members[] — validator uses resolveEffectiveMembers().`,
    refs: [{ type: "bomdoc:BomDocument", relation: "ExampleOf" }],
  },
  {
    name: "ScopeExclusions",
    is: "Topics intentionally outside @blockml/bom",
    doc: `Not specified in this library:

    Expression AST node union → 10_expression_language.md
    Embedded expressions in implementations → 10_expression_language.md
    BML → BOM mapping algorithm → @blockml/parser, 13_bml_to_bom_mapping.md
    Framework base types (BML) → @blockml/core, 16_framework_base_types.md
    ValueType / Language BML → 17_type_system_bml.md
    Dev setup → 15_dev_setup.md
    MBOM native params → NativeBlock.bml + com.machineblocks.bml.type.*
    MBOM → SCAD → 04_types.md, 05_scad_renderer.md
    ManagedObject / synthetic accessors → 08_managed_object.md
    Built-in #math / #strings → @blockml/core services

    Also outside Urmodell: EffectiveMemberSet, TypeRegistry (core utilities).`,
  },
];
