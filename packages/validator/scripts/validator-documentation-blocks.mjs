/**
 * Documentation block definitions for org.blockml.bml.compiler.validator.documentation.*
 * Content migrated from docs/06_compiler.md, docs/15_dev_setup.md,
 * docs/12_bom_object_model.md (validator-owned sections).
 */

/** @typedef {{ name: string, is: string, doc: string, refs?: { type: string, relation: string, context?: string }[] }} DocBlock */

/** @type {DocBlock[]} */
export const documentationBlocks = [
  {
    name: "Introduction",
    is: "Purpose and scope of the Validator package",
    doc: `The @blockml/validator package provides Stage-2 semantic validation on BomDocument.
    It orchestrates @blockml/framework utilities on a pragmatic fork of the Urmodell.

    This library (org.blockml.bml.compiler.validator.*) is the SSOT. TypeScript in
    packages/validator/src/ implements it. Parity tests in packages/validator/test/
    verify BML ↔ TS alignment.

    Pipeline placement: BomDocument ← Parser | BomBuilder → Validator → diagnostics +
    optional pragmaticModel. Consumed by @blockml/cli, @blockml/lsp (V2), and hosts.

    Validator never mutates the input Urmodell. Abort-on-error is a host concern — not
    enforced inside the validator package.`,
    refs: [
      { type: "valdocumentation:LayerSeparation", relation: "ReadNext" },
      { type: "bomdocumentation:Introduction", relation: "SeeAlso" },
    ],
  },
  {
    name: "LayerSeparation",
    is: "Validator vs framework vs BOM vs parser",
    doc: `Four layers relevant to validation:

    org.blockml.bml.bom.* (@blockml/bom) — Urmodell types (BomDocument, …).
    ValidateOptions, ValidateResult, TypeRegistryReader (B26) live here.

    org.blockml.bml.framework.* (@blockml/framework) — TypeRegistry, forkBom,
    validateTypes, validateConstraints, bootstrapTypeRegistry. Validator calls these;
    does not reimplement them.

    org.blockml.bml.compiler.validator.* (this package) — validate() orchestration
    and Stage-2 entry point contract only.

    org.blockml.bml.compiler.parser.* (@blockml/parser) — BML → BomDocument (Stage 1).
    Validator consumes parser output; does not call parse() directly (bootstrap is via framework).`,
    refs: [
      { type: "valdocumentation:ValidationPipeline", relation: "ReadNext" },
      { type: "fwdocumentation:Introduction", relation: "SeeAlso" },
    ],
  },
  {
    name: "ValidationPipeline",
    is: "validate() orchestration steps",
    doc: `validate(document, options?) pipeline (packages/validator/src/validate.ts):

    1. Resolve TypeRegistry — options.typeRegistry if instanceof TypeRegistry,
       else bootstrapTypeRegistry({ paths, libraryPaths, rootDir })
    2. forkBom(document) → pragmaticModel (structuredClone working copy)
    3. validateTypes(pragmaticModel, registry) → diagnostics[]
    4. validateVersions(pragmaticModel, registry) → append diagnostics
    5. validateConstraints(pragmaticModel, registry) → append diagnostics
    6. success = no diagnostic with severity === "error"
    7. Return ValidateResult { pragmaticModel?, diagnostics, success }

    When continueOnError === false and success === false, pragmaticModel is omitted
    from the result (early return with diagnostics only).`,
    refs: [
      { type: "valdocumentation:PublicApi", relation: "ReadNext" },
      { type: "valcap:Validate", relation: "Defines" },
    ],
  },
  {
    name: "PublicApi",
    is: "validate() entry point (B26)",
    doc: `validate(document: BomDocument, options?: ValidateOptions): ValidateResult

    ValidateOptions (owned by @blockml/bom):
    • typeRegistry — pre-built TypeRegistryReader / TypeRegistry instance (optional)
    • bootstrapPaths — corpus roots when bootstrapping (optional)
    • continueOnError — default true; when false, omit pragmaticModel on failure

    ValidateResult (owned by @blockml/bom):
    • pragmaticModel — forked BomDocument when validation completes or continueOnError
    • diagnostics — Diagnostic[]
    • success — false if any error-severity diagnostic

    Sync only; does not throw on validation errors. Host decides abort policy.`,
    refs: [
      { type: "bomapi:ValidateOptions", relation: "Defines" },
      { type: "bomapi:ValidateResult", relation: "Defines" },
      { type: "valcap:Validate", relation: "Defines" },
      { type: "valdocumentation:DesignDecisions", relation: "ReadNext" },
    ],
  },
  {
    name: "Diagnostics",
    is: "Validator diagnostics and host abort policy",
    doc: `The validator aggregates diagnostics from framework utilities (validateTypes,
    validateConstraints) and bootstrap (when TypeRegistry is built inline).

    Diagnostic type: org.blockml.bml.bom.common.Diagnostic (shared across toolchain).

    Host policy: CLI, IDE, and other orchestrators decide whether error diagnostics
    block serialize, compile, or other downstream steps. The validator package does
    not enforce abort-on-error — it reports diagnostics and success flag only.

    Cross-ref diagnostic codes: org.blockml.bml.framework.config.FrameworkDiagnosticCodes`,
    refs: [
      { type: "fwconfig:FrameworkDiagnosticCodes", relation: "SeeAlso" },
      { type: "valdocumentation:PackageOwnership", relation: "ReadNext" },
    ],
  },
  {
    name: "PackageOwnership",
    is: "Toolchain package responsibilities for validation",
    doc: `@blockml/validator — validate() orchestration; ValidateResult assembly. Owns this BML library.

    @blockml/bom — Urmodell types, ValidateOptions/ValidateResult (B26), Diagnostic.
    Validator consumes; does not redefine.

    @blockml/framework — TypeRegistry, forkBom, validateTypes, validateConstraints,
    bootstrapTypeRegistry. Validator delegates all semantic work here.

    @blockml/parser — BML → BomDocument; used indirectly via framework bootstrap.

    @blockml/cli — validate command host; may inject TypeRegistry or bootstrap paths.`,
    refs: [
      { type: "valdocumentation:ScopeExclusions", relation: "ReadNext" },
      { type: "bomdocumentation:PackageOwnership", relation: "SeeAlso" },
    ],
  },
  {
    name: "ScopeExclusions",
    is: "Explicit out-of-scope for the validator package",
    doc: `Out of scope for @blockml/validator:

    • TypeRegistry implementation — @blockml/framework
    • Individual validation rules — @blockml/framework (validateTypes/validateConstraints)
    • parse() / serialize() — @blockml/parser / @blockml/serializer
    • Render target emit / compile — @blockml/compiler
    • CLI file I/O — @blockml/cli
    • Language BML corpus — @blockml/core (npm)

    In scope: validate() orchestration on BomDocument with framework utilities.`,
    refs: [
      { type: "valdocumentation:Introduction", relation: "SeeAlso" },
    ],
  },
  {
    name: "DesignDecisions",
    is: "Normative validator design decisions",
    doc: `Pragmatic model (default fork): validate() always forks via forkBom before checks.
    Urmodell input is never mutated.

    continueOnError (default true): when false and validation fails, return diagnostics
    without pragmaticModel — host can abort before downstream work.

    TypeRegistry injection: hosts with pre-built registry skip bootstrap; supports
    LSP and incremental validation scenarios.

    success semantics: false when any diagnostic has severity === "error"; warnings
    alone do not fail success.

    Bootstrap modes: bootstrapPaths (corpus flat scan) or libraryPaths (Library.bml graph).
    validateVersions runs after validateTypes and before validateConstraints.

    No throw on validation failure — aligns with B26 sync diagnostic API across parser,
    serializer, validator, and compiler.`,
    refs: [
      { type: "valdocumentation:Diagnostics", relation: "ReadNext" },
    ],
  },
];
