/**
 * Documentation block definitions for org.blockml.bml.framework.documentation.*
 * Content migrated from docs/06_compiler.md, docs/15_dev_setup.md,
 * docs/12_bom_object_model.md (framework-owned sections).
 */

/** @typedef {{ name: string, is: string, doc: string, refs?: { type: string, relation: string, context?: string }[] }} DocBlock */

/** @type {DocBlock[]} */
export const documentationBlocks = [
  {
    name: "Introduction",
    is: "Purpose and scope of the Framework utilities package",
    doc: `The @blockml/framework package provides Stage-2 framework utilities: TypeRegistry,
    bootstrapTypeRegistry, forkBom, resolveEffectiveMembers, parseExpression, validateTypes,
    and validateConstraints.

    This library (org.blockml.bml.framework.*) is the SSOT. TypeScript in
    packages/framework/src/ implements it. Parity tests in packages/framework/test/
    verify BML ↔ TS alignment.

    Stage-2 placement: after parse (Stage 1) and before render/compile targets.
    Consumed by @blockml/validator (orchestrator) and @blockml/cli (bootstrap host).

    Language BML corpus remains in npm @blockml/core (node_modules). Framework utilities
    operate on BomDocument (Urmodell) from @blockml/bom — they do not redefine meta-model blocks.`,
    refs: [
      { type: "fwdocumentation:LayerSeparation", relation: "ReadNext" },
      { type: "bomdocumentation:Introduction", relation: "SeeAlso" },
    ],
  },
  {
    name: "LayerSeparation",
    is: "Framework vs BOM vs parser vs validator vs core",
    doc: `Five layers relevant to framework utilities:

    org.blockml.bml.bom.* (@blockml/bom) — Urmodell data structures (BomDocument, …).
    ValidateOptions, ValidateResult, TypeRegistryReader (B26) live here.

    org.blockml.bml.framework.* (this package) — TypeRegistry, fork/resolve/validate utilities,
    parseExpression AST (Stage 2). Does not own validate() orchestration.

    org.blockml.bml.compiler.parser.* (@blockml/parser) — BML → BomDocument (Stage 1).
    bootstrapTypeRegistry calls parse() on corpus files.

    org.blockml.bml.compiler.validator.* (@blockml/validator) — validate() entry point;
    orchestrates framework utilities on a pragmatic fork.

    org.blockml.bml.definition.* (@blockml/core) — BML meta-model corpus (npm).
    Framework reads Definition types via TypeRegistry; does not duplicate grammar blocks.`,
    refs: [
      { type: "fwdocumentation:ArchitectureOverview", relation: "ReadNext" },
      { type: "bomdocumentation:LayerSeparation", relation: "SeeAlso" },
    ],
  },
  {
    name: "ArchitectureOverview",
    is: "Module decomposition for framework utilities",
    doc: `Module decomposition (packages/framework/src/):

    registry/type-registry.ts — fwcap:TypeRegistry (register, get, has, keys, size)
    registry/bootstrap.ts — fwcap:BootstrapTypeRegistry, fwcap:DefaultBootstrapPaths
    registry/library-bootstrap.ts — library graph resolution (Library.bml dependencies)
    fork/fork-bom.ts — fwcap:ForkBom (structuredClone pragmatic copy)
    resolve/resolve-effective-members.ts — fwcap:ResolveEffectiveMembers,
      fwcap:ResolveContracts, fwcap:CollectBaseTypeChain, fwcap:MemberIdentityKey
    expression/parse-expression.ts — fwcap:ParseExpression
    expression/types.ts — fwexpression:* AST node types
    validate/validate-types.ts — fwcap:ValidateTypes, fwcap:GetPropertyNumericValue,
      fwcap:IsLiteralValue
    validate/validate-versions.ts — fwcap:ValidateVersions
    validate/validate-constraints.ts — fwcap:ValidateConstraints

    Internal data-structure types extend framework:FrameworkType.
    Public operations are fwcap:* capabilities.`,
    refs: [
      { type: "fwdocumentation:PublicApi", relation: "ReadNext" },
      { type: "fwcap:TypeRegistry", relation: "Defines" },
    ],
  },
  {
    name: "PublicApi",
    is: "Framework public exports from index.ts",
    doc: `Public exports from @blockml/framework (packages/framework/src/index.ts):

    TypeRegistry — class; register/get/has/keys/size on BomDocument index
    bootstrapTypeRegistry(options?) → BootstrapResult
    defaultBootstrapPaths(rootDir?) → string[]
    resolveLibrarySeeds(rootDir?, extras?) → string[]
    BootstrapOptions — paths?, libraryPaths?, rootDir?
    BootstrapResult — registry, diagnostics, exportsByLibrary?, trace?
    BootstrapTrace — corpusPaths, seeds, searchRoots, librariesVisited, skippedCoveredRoots
    rootFqnByFilePath(registry) → Map&lt;filePath, rootFqn&gt;
    forkBom(document) → BomDocument
    resolveEffectiveMembers(block, registry) → MemberDefinition[]
    resolveContracts(block, registry) → MemberDefinition[] (contract slice; used by resolveEffectiveMembers)
    collectBaseTypeChain(block, registry) → BlockDefinition[]
    memberIdentityKey(member) → string
    parseExpression(source) → ParseExpressionOutcome
    validateTypes(document, registry) → Diagnostic[]
    validateVersions(document, registry) → Diagnostic[]
    validateConstraints(document, registry) → Diagnostic[]
    getPropertyNumericValue(property) → number | undefined
    isLiteralValue(value) → boolean

    Types: BootstrapResult, BootstrapTrace, BootstrapOptions, ExpressionNode, ParseExpressionResult, ParseExpressionOutcome

    Not exported from index: getLiteralNumericValue (internal helper in validate-types.ts).`,
    refs: [
      { type: "fwdocumentation:TypeRegistryBootstrap", relation: "ReadNext" },
      { type: "bomapi:TypeRegistryReader", relation: "SeeAlso" },
    ],
  },
  {
    name: "TypeRegistryBootstrap",
    is: "defaultBootstrapPaths and bootstrapTypeRegistry",
    doc: `bootstrapTypeRegistry(options?) supports two modes:

    corpus (default) — walks options.paths (or defaultBootstrapPaths()) for all .bml files,
    parses via @blockml/parser parse(), registers each document root block.

    library — when options.libraryPaths is set, resolves each Library.bml dependency graph
    (dependencies, subLibraries) in order, then registers blocks from each library blocks root
    except trees already covered by options.paths (srcDir / corpus). Missing Library path →
    BML_LIBRARY_RESOLVE_ERROR. Outer re-export of inner-only block →
    BML_LIBRARY_NESTING_VIOLATION (minimal check).

    defaultBootstrapPaths(rootDir?) returns BlockML srcDir roots for production
    npm dependencies (package.json dependencies + optionalDependencies) of the nearest
    package, resolved via node_modules walk-up. Used as corpus fallback when no paths
    are given. A BlockML package is identified by blockml.library or blockml.config.json;
    its source root is srcDir (default "blocks", override only in that package's
    blockml.config.json).

    resolveLibrarySeeds(rootDir, extras?) prepends package.json blockml.library, then
    extras (config.libraries / --libraries), deduped by realpath.

    bootstrapTypeRegistry also indexes Library.bml under all BlockML packages found in
    node_modules and workspace packages/ along the directory walk (FQN search space).
    First Library.bml wins per type FQN unless that file is the current library
    (self-loop); then another file with the same type is used. node_modules is
    indexed before workspace packages.

    BootstrapResult: { registry, diagnostics, exportsByLibrary?, trace? }
    trace lists corpusPaths, seeds, searchRoots (index only), librariesVisited, and
    skippedCoveredRoots. Read errors emit BML_BOOTSTRAP_READ_ERROR (warning). Parse
    diagnostics are collected but do not stop registration of successfully parsed
    documents.

    Hosts (@blockml/cli, @blockml/validator) may inject a pre-built TypeRegistry via
    ValidateOptions.typeRegistry instead of bootstrapping. ValidateOptions.libraryPaths
    selects library mode when typeRegistry is omitted.`,
    refs: [
      { type: "fwdocumentation:EffectiveMembers", relation: "ReadNext" },
      { type: "fwcap:BootstrapTypeRegistry", relation: "Defines" },
    ],
  },
  {
    name: "EffectiveMembers",
    is: "resolveEffectiveMembers and baseType chain merge",
    doc: `resolveEffectiveMembers(block, registry) merges members[] in order:

    1. baseType chain (via collectBaseTypeChain) — earliest to latest
    2. contracts[] in declaration order (via resolveContracts) — contract Block members only;
       subBlocks/compositions/embeddedBlocks on contract types are ignored
    3. local block.members — override earlier layers when override=true

    collectBaseTypeChain walks block.baseType → registry.get(baseType) until absent or cycle.
    resolveContracts resolves each contracts[] FQN via TypeRegistry; unknown contract →
    BML_UNKNOWN_CONTRACT (validateTypes).
    memberIdentityKey(member) = (namespace ?? "") + ":" + name — collision detection key.

    Partial merge: later layer replaces only explicitly authored attributes on the member.
    Used by validateTypes (member collision, override rules) and validateConstraints (effective
    PropertyDefinition constraints).

    EffectiveMemberSet is a runtime view — not stored on Urmodell (BOM SSOT).`,
    refs: [
      { type: "fwdocumentation:ExpressionParsing", relation: "ReadNext" },
      { type: "fwcap:ResolveEffectiveMembers", relation: "Defines" },
      { type: "fwcap:ResolveContracts", relation: "SeeAlso" },
    ],
  },
  {
    name: "ExpressionParsing",
    is: "parseExpression AST — no Urmodell writeback (B4)",
    doc: `parseExpression(source) parses expression text into an ExpressionNode AST.
    Returns ParseExpressionOutcome: { ok: true, result } | { ok: false, error }.

    Parser stores ExpressionValue.raw only (B4). validateTypes re-parses expressions
    at validation time and emits BML_EXPRESSION_PARSE_ERROR on failure.

    AST node kinds: literal, array, object, property, call, binary.
    Optional resultTypeFqn on ParseExpressionResult for typed expression metadata.

    Expression AST is a Stage-2 utility — never written back to Urmodell member values.`,
    refs: [
      { type: "fwdocumentation:ConstraintValidation", relation: "ReadNext" },
      { type: "fwexpression:ExpressionNode", relation: "Defines" },
    ],
  },
  {
    name: "ConstraintValidation",
    is: "validateConstraints branch dispatch and embed contexts",
    doc: `validateConstraints evaluates constraints on the effective member set from
    resolveEffectiveMembers (baseType + contracts + local). Property ValuePresent and other
    ValueConstraints on effective PropertyDefinition are checked against authored local values.

    Embed contexts for directly declared constraint BlockInstances:
    block — BlockConstraint (RequiresMember), ValueConstraint (Min/Max/ValuePresent)
    property — PropertyConstraint (MustBeReadOnly), ValueConstraint
    aggregation — AggregationConstraint (AllowedChildType)
    association — AssociationConstraint (NoSelfReference)
    capability — CapabilityConstraint (RequiresImplementation)

    Wrong branch for context → BML_CONSTRAINT_TARGET_MISMATCH.
    Unknown constraint type → BML_CONSTRAINT_UNKNOWN.
    Violation → BML_CONSTRAINT_VIOLATION.

    Fixtures: packages/framework/test/constraints/fixtures/*.bml`,
    refs: [
      { type: "fwdocumentation:Diagnostics", relation: "ReadNext" },
      { type: "fwcap:ValidateConstraints", relation: "Defines" },
    ],
  },
  {
    name: "Diagnostics",
    is: "Framework diagnostic codes",
    doc: `Diagnostic codes emitted by framework utilities (see fwconfig:FrameworkDiagnosticCodes):

    validateTypes:
    • BML_UNKNOWN_BASE_TYPE — baseType FQN not in TypeRegistry (at baseTypeSource)
    • BML_UNKNOWN_CONTRACT — contracts[] FQN not in TypeRegistry
    • BML_UNKNOWN_TYPE — named type FQN not in TypeRegistry and not a well-known primitive (member types at typeSource; instance typeFqn on the instance)
    • BML_TYPE_BOUND_NOT_SATISFIED — capability throws[] type is not core:Exception (baseType chain or direct contracts[])
    • BML_MEMBER_COLLISION — duplicate member identity in effective set
    • BML_OVERRIDE_WITHOUT_PARENT — override without resolvable base member
    • BML_OVERRIDE_REQUIRED — override on non-overridable member
    • BML_EXPRESSION_PARSE_ERROR — parseExpression failed on ExpressionValue.raw

    validateInstances:
    • BML_UNKNOWN_TYPE — composition instance typeFqn not in TypeRegistry
    • BML_UNKNOWN_PROPERTY — instance memberValues key not in effective members (error)

    validateGenerics:
    • BML_OPEN_GENERIC_INSTANCE — aggregated domain Block instance still has open genericTypes without bml:generics (not TypeReferenceEntity sugar)
    • BML_GENERICS_DIRECTIVE_NOT_ALLOWED — bml:generics not on a Block instance (including TypeReferenceEntity QName sugar)
    • BML_GENERICS_ARGUMENT_MISMATCH — bml:generics does not match declared genericTypes (including on a non-generic type)
    • BML_MISSING_GENERIC_TYPE_ARGUMENT — directive present but a required argument has no defaultType
    • BML_GENERIC_CONSTRAINT_VIOLATION — argument fails parameter baseType via satisfiesTypeBound

    validateVersions:
    • BML_MISSING_VERSION — standalone root block missing effective version (non-framework convention)
    • BML_UNKNOWN_VERSION — bml:version pin does not match registered block version

    validateConstraints:
    • BML_CONSTRAINT_VIOLATION — constraint predicate failed
    • BML_CONSTRAINT_UNKNOWN — unrecognized constraint type FQN
    • BML_CONSTRAINT_TARGET_MISMATCH — constraint branch wrong for embed context

    bootstrap:
    • BML_BOOTSTRAP_READ_ERROR — file read failure during corpus walk (warning)
    • BML_LIBRARY_RESOLVE_ERROR — Library.bml path or dependency could not be resolved
    • BML_LIBRARY_NESTING_VIOLATION — outer library re-exports inner-only block

    Diagnostic type: org.blockml.bml.bom.common.Diagnostic.`,
    refs: [
      { type: "fwconfig:FrameworkDiagnosticCodes", relation: "Defines" },
      { type: "fwdocumentation:PackageOwnership", relation: "ReadNext" },
    ],
  },
  {
    name: "PackageOwnership",
    is: "Toolchain package responsibilities for framework utilities",
    doc: `@blockml/framework — TypeRegistry, bootstrap, forkBom, resolveEffectiveMembers,
    parseExpression, validateTypes, validateConstraints. Owns this BML library.

    @blockml/bom — Urmodell types, ValidateOptions/ValidateResult, TypeRegistryReader,
    Diagnostic. Framework consumes; does not redefine.

    @blockml/parser — parse() used during bootstrap only.

    @blockml/validator — validate() orchestrator; calls framework utilities.

    @blockml/core (npm) — language/meta-model BML corpus; bootstrap source.

    @blockml/cli — TypeRegistry bootstrap host and validate/compile orchestration.`,
    refs: [
      { type: "fwdocumentation:ScopeExclusions", relation: "ReadNext" },
      { type: "bomdocumentation:PackageOwnership", relation: "SeeAlso" },
    ],
  },
  {
    name: "ScopeExclusions",
    is: "Explicit out-of-scope for the framework package",
    doc: `Out of scope for @blockml/framework:

    • parse() / serialize() public entry points — @blockml/parser / @blockml/serializer
    • validate() orchestration — @blockml/validator
    • CLI / file orchestration — @blockml/cli
    • Render target emit — @blockml/compiler / domain packages
    • Language BML block authorship — @blockml/core (npm)
    • BomBuilder (V3) — future; framework accepts its output types only

    In scope: Stage-2 utilities on BomDocument with TypeRegistry-backed semantic checks.`,
    refs: [
      { type: "fwdocumentation:Introduction", relation: "SeeAlso" },
    ],
  },
];
