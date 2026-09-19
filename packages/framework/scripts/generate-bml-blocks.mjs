#!/usr/bin/env node
/**
 * One-shot generator for Framework BML blocks.
 * Output under blocks/ is the SSOT; this script is a migration aid only.
 * Unused xmlns / xsi:schemaLocation are stripped on write (doc:DocumentFormat).
 */
import { writeFileSync as writeRaw, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bindWriteFileSync } from "../../../scripts/bml-xmlns.mjs";
import { documentationBlocks } from "./framework-documentation-blocks.mjs";

const writeFileSync = bindWriteFileSync(writeRaw);

const __dirname = dirname(fileURLToPath(import.meta.url));
const blocksRoot = join(__dirname, "../blocks/org/blockml/bml/framework");

const FRAMEWORK_DIAGNOSTIC_CODES = [
  "BML_BOOTSTRAP_READ_ERROR",
  "BML_CONSTRAINT_INFORMATION",
  "BML_CONSTRAINT_TARGET_MISMATCH",
  "BML_CONSTRAINT_UNKNOWN",
  "BML_CONSTRAINT_VIOLATION",
  "BML_CONSTRAINT_WARNING",
  "BML_DUPLICATE_EMBEDDED_BLOCK",
  "BML_DUPLICATE_MEMBER_VISIBILITY_VARIANT",
  "BML_EMBEDDED_BLOCKS_ON_SUBBLOCK",
  "BML_EXPRESSION_PARSE_ERROR",
  "BML_EXPR_NOT_ALLOWED_IN_INTERPOLATION",
  "BML_EXPR_SYNTAX_ERROR",
  "BML_EXPR_TYPE_MISMATCH",
  "BML_GENERIC_CONSTRAINT_VIOLATION",
  "BML_GENERICS_ARGUMENT_MISMATCH",
  "BML_GENERICS_DIRECTIVE_NOT_ALLOWED",
  "BML_INVALID_VALUE",
  "BML_LIBRARY_RESOLVE_ERROR",
  "BML_MEMBER_COLLISION",
  "BML_MISSING_GENERIC_TYPE_ARGUMENT",
  "BML_MISSING_ID",
  "BML_MISSING_VERSION",
  "BML_NESTED_EMBEDDED_BLOCKS",
  "BML_OPEN_GENERIC_INSTANCE",
  "BML_OVERRIDE_REQUIRED",
  "BML_OVERRIDE_WITHOUT_PARENT",
  "BML_PRESET_CYCLE",
  "BML_READONLY_MEMBER_WRITE",
  "BML_SUBBLOCK_TYPE_MISMATCH",
  "BML_TYPE_BOUND_NOT_SATISFIED",
  "BML_UNRESOLVABLE_INSTANCE_REF",
  "BML_UNKNOWN_BASE_TYPE",
  "BML_UNKNOWN_CONTRACT",
  "BML_UNKNOWN_TYPE",
  "BML_UNKNOWN_PROPERTY",
  "BML_UNKNOWN_VERSION",
  "BML_VISIBILITY_PRIVATE_OVERRIDE",
];

// Catalog; bindWriteFileSync keeps only prefixes used as QNames in that file.
const XMLNS = `  xmlns="http://blockml.org/bml"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://blockml.org/bml https://blockml.org/schemas/bml.xsd
                      "
  xmlns:blockml="org.blockml.bml"
  xmlns:bom="org.blockml.bml.bom"
  xmlns:bomapi="org.blockml.bml.bom.api"
  xmlns:bomblock="org.blockml.bml.bom.block"
  xmlns:bomcommon="org.blockml.bml.bom.common"
  xmlns:bomcomp="org.blockml.bml.bom.composition"
  xmlns:bomdoc="org.blockml.bml.bom.document"
  xmlns:bommember="org.blockml.bml.bom.member"
  xmlns:bomtype="org.blockml.bml.bom.type"
  xmlns:bomvalue="org.blockml.bml.bom.value"
  xmlns:core="org.blockml.bml.core"
  xmlns:def="org.blockml.bml.definition"
  xmlns:framework="org.blockml.bml.framework"
  xmlns:fwcap="org.blockml.bml.framework.capability"
  xmlns:fwconfig="org.blockml.bml.framework.config"
  xmlns:fwdocumentation="org.blockml.bml.framework.documentation"
  xmlns:fwexpression="org.blockml.bml.framework.expression"
  xmlns:fwregistry="org.blockml.bml.framework.registry"
  xmlns:parser="org.blockml.bml.compiler.parser"
  xmlns:type="org.blockml.bml.type"
  xmlns:bomdocumentation="org.blockml.bml.bom.documentation"
  xmlns:pardocumentation="org.blockml.bml.compiler.parser.documentation"
  xmlns:valdocumentation="org.blockml.bml.compiler.validator.documentation"`;

/** @typedef {{ name: string, type: string, required?: boolean, doc?: string, literal?: string, value?: string }} Field */
/** @typedef {{ pkg: string, prefix: string, name: string, is: string, doc: string, abstract?: boolean, baseType?: string, fields?: Field[], refs?: string[] }} BlockDef */
/** @typedef {{ pkg: string, prefix: string, name: string, is: string, doc: string, tsExport?: string, inputs?: Field[], output?: Field, refs?: string[] }} CapabilityDef */

/** @type {BlockDef[]} */
const blocks = [
  {
    pkg: "",
    prefix: "framework",
    name: "FrameworkType",
    is: "Abstract marker for framework implementation data-structure blocks",
    doc: "All org.blockml.bml.framework.registry.* and .expression.* types extend this marker. Distinct from bom:UrmodellType (parse-result data) and core:Capability (operations).",
    abstract: true,
    baseType: "core:Block",
    refs: ["bom:UrmodellType"],
  },
  {
    pkg: "registry",
    prefix: "fwregistry",
    name: "BootstrapResult",
    is: "Result of bootstrapTypeRegistry corpus walk",
    doc: "Returned by fwcap:BootstrapTypeRegistry. Registry may be partially populated when diagnostics are present. exportsByLibrary is set in libraryPaths mode. trace lists corpus, seeds, search index, visited libraries, and skipped covered roots.",
    fields: [
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
      { name: "diagnostics", type: "bomcommon:Diagnostic[]", required: true },
      { name: "exportsByLibrary", type: "type:Text", doc: "exportsByLibrary — Map&lt;libraryPath, Set&lt;exportedFqn&gt;&gt; when libraryPaths bootstrap. (optional)" },
      { name: "trace", type: "fwregistry:BootstrapTrace", doc: "Bootstrap source trace for hosts such as CLI --verbose. (optional)" },
    ],
  },
  {
    pkg: "registry",
    prefix: "fwregistry",
    name: "BootstrapTrace",
    is: "Resolved bootstrap sources for tracing",
    doc: "corpusPaths — scanned corpus roots. seeds — libraryPaths used. searchRoots — discovery index (not a corpus dump). librariesVisited — graph order. skippedCoveredRoots — library trees skipped because they sit inside corpus srcDir.",
    fields: [
      { name: "corpusPaths", type: "type:Text[]", required: true },
      { name: "seeds", type: "type:Text[]", required: true },
      { name: "searchRoots", type: "type:Text[]", required: true },
      { name: "librariesVisited", type: "type:Text[]", required: true },
      { name: "skippedCoveredRoots", type: "type:Text[]", required: true },
    ],
  },
  {
    pkg: "expression",
    prefix: "fwexpression",
    name: "ExpressionNode",
    is: "Abstract union of expression AST node variants",
    doc: "Discriminated by kind: literal | array | object | property | call | binary | interpolated.",
    abstract: true,
    baseType: "framework:FrameworkType",
    refs: ["fwexpression:LiteralExpressionNode"],
  },
  {
    pkg: "expression",
    prefix: "fwexpression",
    name: "LiteralExpressionNode",
    is: "Literal expression AST node",
    baseType: "fwexpression:ExpressionNode",
    doc: "kind: literal. value: string | number | boolean | null. BML union covers primitives; null is documented only.",
    fields: [
      { name: "kind", type: "type:Text", required: true, value: "literal" },
      { name: "value", type: "type:Text | type:Integer | type:Decimal | type:Boolean", required: true, doc: "BML type gap: TS string | number | boolean | null. Union covers primitive cases; null is documented only." },
    ],
  },
  {
    pkg: "expression",
    prefix: "fwexpression",
    name: "ArrayExpressionNode",
    is: "Array expression AST node",
    baseType: "fwexpression:ExpressionNode",
    doc: "kind: array. elements: ExpressionNode[].",
    fields: [
      { name: "kind", type: "type:Text", required: true, value: "array" },
      { name: "elements", type: "fwexpression:ExpressionNode[]", required: true },
    ],
  },
  {
    pkg: "expression",
    prefix: "fwexpression",
    name: "ObjectExpressionEntry",
    is: "One key/value pair in an object expression",
    doc: "BML type gap: stands for TypeScript Record&lt;string, ExpressionNode&gt;. Core has no Map ValueType; this struct is the per-entry shape.",
    baseType: "framework:FrameworkType",
    fields: [
      { name: "key", type: "type:Text", required: true },
      { name: "value", type: "fwexpression:ExpressionNode", required: true },
    ],
  },
  {
    pkg: "expression",
    prefix: "fwexpression",
    name: "ObjectExpressionNode",
    is: "Object expression AST node",
    baseType: "fwexpression:ExpressionNode",
    doc: "kind: object. entries: Record&lt;string, ExpressionNode&gt;.",
    fields: [
      { name: "kind", type: "type:Text", required: true, value: "object" },
      { name: "entries", type: "fwexpression:ObjectExpressionEntry[]", required: true, doc: "BML type gap: TS Record&lt;string, ExpressionNode&gt;." },
    ],
  },
  {
    pkg: "expression",
    prefix: "fwexpression",
    name: "PropertyExpressionNode",
    is: "Property path expression AST node",
    baseType: "fwexpression:ExpressionNode",
    doc: "kind: property. path: string[] (dot-separated property access).",
    fields: [
      { name: "kind", type: "type:Text", required: true, value: "property" },
      { name: "path", type: "type:Text[]", required: true },
    ],
  },
  {
    pkg: "expression",
    prefix: "fwexpression",
    name: "CallExpressionNode",
    is: "Function call expression AST node",
    baseType: "fwexpression:ExpressionNode",
    doc: "kind: call. callee: string. args: ExpressionNode[].",
    fields: [
      { name: "kind", type: "type:Text", required: true, value: "call" },
      { name: "callee", type: "type:Text", required: true },
      { name: "args", type: "fwexpression:ExpressionNode[]", required: true },
    ],
  },
  {
    pkg: "expression",
    prefix: "fwexpression",
    name: "BinaryExpressionNode",
    is: "Binary operator expression AST node",
    baseType: "fwexpression:ExpressionNode",
    doc: "kind: binary. operator: + | - | * | /. left/right: ExpressionNode.",
    fields: [
      { name: "kind", type: "type:Text", required: true, value: "binary" },
      { name: "operator", type: "type:Text", required: true },
      { name: "left", type: "fwexpression:ExpressionNode", required: true },
      { name: "right", type: "fwexpression:ExpressionNode", required: true },
    ],
  },
  {
    pkg: "expression",
    prefix: "fwexpression",
    name: "InterpolatedStringNode",
    is: "Interpolated text AST node",
    baseType: "fwexpression:ExpressionNode",
    doc: "kind: interpolated. parts: literal and hole ExpressionNode[].",
    fields: [
      { name: "kind", type: "type:Text", required: true, value: "interpolated" },
      { name: "parts", type: "fwexpression:ExpressionNode[]", required: true },
    ],
  },
  {
    pkg: "expression",
    prefix: "fwexpression",
    name: "ParseExpressionResult",
    is: "Successful parseExpression result",
    baseType: "framework:FrameworkType",
    doc: "Returned when ParseExpressionOutcome.ok === true.",
    fields: [
      { name: "ast", type: "fwexpression:ExpressionNode", required: true },
      { name: "resultTypeFqn", type: "type:Text", doc: "Optional resolved result type FQN." },
    ],
  },
  {
    pkg: "expression",
    prefix: "fwexpression",
    name: "ParseExpressionError",
    is: "Failed parseExpression error detail",
    baseType: "framework:FrameworkType",
    doc: "Returned when ParseExpressionOutcome.ok === false.",
    fields: [
      { name: "message", type: "type:Text", required: true },
      { name: "offset", type: "type:Integer", required: true },
    ],
  },
  {
    pkg: "expression",
    prefix: "fwexpression",
    name: "ParseExpressionOutcome",
    is: "Discriminated union result of parseExpression",
    baseType: "framework:FrameworkType",
    doc: "TS: { ok: true, result: ParseExpressionResult } | { ok: false, error: ParseExpressionError }.",
    fields: [
      { name: "ok", type: "type:Boolean", required: true },
      { name: "result", type: "fwexpression:ParseExpressionResult", doc: "Present when ok === true." },
      { name: "error", type: "fwexpression:ParseExpressionError", doc: "Present when ok === false." },
    ],
  },
  {
    pkg: "registry",
    prefix: "fwregistry",
    name: "BootstrapOptions",
    is: "Options for bootstrapTypeRegistry corpus or library graph modes",
    doc: "paths — flat corpus scan roots. libraryPaths — Library.bml entry points for dependency-ordered library mode. rootDir — relative path resolution base.",
    fields: [
      { name: "paths", type: "type:Text[]", doc: "Corpus roots for flat scan mode. (optional)" },
      { name: "libraryPaths", type: "type:Text[]", doc: "Library.bml file paths for library graph mode. (optional)" },
      { name: "rootDir", type: "type:Text", doc: "Working directory for relative paths. (optional)" },
    ],
  },
  {
    pkg: "config",
    prefix: "fwconfig",
    name: "FrameworkDiagnosticCodes",
    is: "Diagnostic codes emitted by framework utilities",
    doc: "Used by validateTypes, validateConstraints, and bootstrapTypeRegistry.",
    fields: [
      {
        name: "codes",
        type: "type:Text[]",
        required: true,
        doc: `Ordered: ${FRAMEWORK_DIAGNOSTIC_CODES.join(", ")}`,
      },
    ],
  },
];

/** @type {CapabilityDef[]} */
const capabilities = [
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "TypeRegistry",
    is: "In-memory index of BlockDefinition documents by type FQN",
    doc: `# In-memory index of BlockDefinition documents by type FQN

    Class exported from registry/type-registry.ts. Implements bomapi:TypeRegistryReader (get/has).

    - register prefers a non-node_modules source over a node_modules source for the same type FQN
      (workspace beats dependency). Same-origin last write wins.
    - withOverlay(document) returns a copy with that document registered — open-buffer overlay;
      does not mutate this registry.`,
    tsExport: "TypeRegistry",
    refs: ["bomapi:TypeRegistryReader", "fwdocumentation:TypeRegistryBootstrap"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "BootstrapTypeRegistry",
    is: "Populate TypeRegistry from corpus paths or Library.bml graph",
    doc: "Accepts fwregistry:BootstrapOptions or legacy paths[] + rootDir. Library mode resolves dependencies/subLibraries in order, then registers blocks from each library blocks root. Flat mode walks paths for all .bml files.",
    tsExport: "bootstrapTypeRegistry",
    inputs: [
      { name: "options", type: "fwregistry:BootstrapOptions", doc: "Bootstrap options object. (optional)" },
    ],
    output: { name: "result", type: "fwregistry:BootstrapResult", required: true },
    refs: ["fwcap:DefaultBootstrapPaths", "fwcap:ResolveLibrarySeeds", "fwregistry:BootstrapOptions", "parser:Library"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "DefaultBootstrapPaths",
    is: "Corpus fallback paths from production BlockML npm dependencies",
    doc: "Nearest package.json dependencies + optionalDependencies that have blockml.library or blockml.config.json. Resolve via node_modules walk-up. Package source root is srcDir (default blocks; foreign blockml.config.json may override srcDir only).",
    tsExport: "defaultBootstrapPaths",
    inputs: [{ name: "rootDir", type: "type:Text", doc: "Default process.cwd()." }],
    output: { name: "paths", type: "type:Text[]", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ResolveLibrarySeeds",
    is: "Merge package.json blockml.library with extra Library.bml paths",
    doc: "Identity seed from package.json blockml.library first, then extras (config.libraries or --libraries). Absolute paths, deduped by realpath. Missing files keep resolve().",
    tsExport: "resolveLibrarySeeds",
    inputs: [
      { name: "rootDir", type: "type:Text", doc: "Package directory. Default process.cwd(). (optional)" },
      { name: "extras", type: "type:Text[]", doc: "Additional Library.bml paths. (optional)" },
    ],
    output: { name: "seeds", type: "type:Text[]", required: true },
    refs: ["fwcap:BootstrapTypeRegistry"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ForkBom",
    is: "Deep-clone Urmodell for pragmatic / validation working copy",
    tsExport: "forkBom",
    inputs: [{ name: "document", type: "bomdoc:BomDocument", required: true }],
    output: { name: "copy", type: "bomdoc:BomDocument", required: true },
    refs: ["bomdocumentation:PublicApi"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ResolveContracts",
    is: "Merge contract Block members into effective member slice",
    doc: "Resolves block.contracts[] in declaration order via TypeRegistry. Returns merged members from contract Blocks only (ignores contract subBlocks/compositions/embeddedBlocks). Unknown contract FQN → BML_UNKNOWN_CONTRACT in validateTypes.",
    tsExport: "resolveContracts",
    inputs: [
      { name: "block", type: "bomblock:BlockDefinition", required: true },
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
    ],
    output: { name: "members", type: "bommember:MemberDefinition[]", required: true },
    refs: ["fwcap:ResolveEffectiveMembers", "fwcap:MemberIdentityKey"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ResolveEffectiveMembers",
    is: "Merge members along baseType chain, contracts, and local declarations",
    doc: "## Merge order\n\nbaseType chain (ancestors first) → contracts[] in declaration order → local members.\n\n## What inherits\n\nSpecified attributes replace; unspecified attributes inherit — except local declaration flags `abstract`, `final`, and `override`. Those describe only the current layer and are never copied from the parent. Omitted on a redeclaration → false (locally concrete). Restate `abstract=\"true\"` (with `override=\"true\"`) to keep a member abstract.\n\n## What still propagates\n\nAn unimplemented abstract ancestor stays an obligation; parent `final` still blocks further override.",
    tsExport: "resolveEffectiveMembers",
    inputs: [
      { name: "block", type: "bomblock:BlockDefinition", required: true },
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
    ],
    output: { name: "members", type: "bommember:MemberDefinition[]", required: true },
    refs: ["fwcap:CollectBaseTypeChain", "fwcap:MemberIdentityKey", "fwcap:ResolveContracts"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "CollectBaseTypeChain",
    is: "Walk baseType references to root via TypeRegistry",
    tsExport: "collectBaseTypeChain",
    inputs: [
      { name: "block", type: "bomblock:BlockDefinition", required: true },
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
    ],
    output: { name: "chain", type: "bomblock:BlockDefinition[]", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "MemberIdentityKey",
    is: "Stable identity key for member collision detection",
    tsExport: "memberIdentityKey",
    inputs: [{ name: "member", type: "bommember:MemberDefinition", required: true }],
    output: { name: "key", type: "type:Text", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "FindLocalMember",
    is: "Find a member declared on this block, not inherited",
    doc: "Looks up memberIdentityKey(member) in block.members only. Returns the local declaration, or undefined when the member is inherited or absent.",
    tsExport: "findLocalMember",
    inputs: [
      { name: "block", type: "bomblock:BlockDefinition", required: true },
      { name: "member", type: "bommember:MemberDefinition", required: true },
    ],
    output: { name: "local", type: "bommember:MemberDefinition", doc: "Declared member on this block, or undefined." },
    refs: ["fwcap:MemberIdentityKey", "fwcap:ResolveEffectiveMembers"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ParseExpression",
    is: "Parse expression source text into ExpressionNode AST",
    tsExport: "parseExpression",
    inputs: [{ name: "source", type: "type:Text", required: true }],
    output: { name: "outcome", type: "fwexpression:ParseExpressionOutcome", required: true },
    refs: ["fwdocumentation:ExpressionParsing"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ParseInterpolatedText",
    is: "Parse interpolated text into an InterpolatedStringNode AST",
    tsExport: "parseInterpolatedText",
    inputs: [{ name: "source", type: "type:Text", required: true }],
    output: { name: "outcome", type: "fwexpression:ParseExpressionOutcome", required: true },
    refs: ["fwdocumentation:ExpressionParsing"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "EvaluateExpression",
    is: "Evaluate a restricted expression AST against a this-scope",
    tsExport: "evaluateExpression",
    inputs: [{ name: "node", type: "fwexpression:ExpressionNode", required: true }],
    output: { name: "value", type: "type:Text", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "EvaluateInterpolatedText",
    is: "Evaluate interpolated text against a this-scope",
    tsExport: "evaluateInterpolatedText",
    inputs: [{ name: "source", type: "type:Text", required: true }],
    output: { name: "value", type: "type:Text", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ValidateTypes",
    is: "Semantic type checks on BomDocument using TypeRegistry",
    tsExport: "validateTypes",
    inputs: [
      { name: "document", type: "bomdoc:BomDocument", required: true },
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
    ],
    output: { name: "diagnostics", type: "bomcommon:Diagnostic[]", required: true },
    refs: ["fwcap:ResolveEffectiveMembers", "fwcap:ParseExpression"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ValidateConstraints",
    is: "Evaluate constraint BlockInstances in composition tree",
    tsExport: "validateConstraints",
    inputs: [
      { name: "document", type: "bomdoc:BomDocument", required: true },
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
    ],
    output: { name: "diagnostics", type: "bomcommon:Diagnostic[]", required: true },
    refs: ["fwdocumentation:ConstraintValidation"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ValidateVersions",
    is: "Minimal effectiveBlockVersion and bml:version assert checks",
    doc: "BML_MISSING_VERSION on standalone root blocks with no owning Library. Membership is the nearest Library.bml at the same package level or above (search stops one level below the source folder). Third-party libraries are not exempted by namespace. BML_UNKNOWN_VERSION when bml:version pin does not match a registered block version.",
    tsExport: "validateVersions",
    inputs: [
      { name: "document", type: "bomdoc:BomDocument", required: true },
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
    ],
    output: { name: "diagnostics", type: "bomcommon:Diagnostic[]", required: true },
    refs: ["bomdocumentation:VersionRules"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "RootFqnByFilePath",
    is: "Map file path to document-root block FQN from TypeRegistry",
    tsExport: "rootFqnByFilePath",
    inputs: [{ name: "registry", type: "fwcap:TypeRegistry", required: true }],
    output: { name: "roots", type: "type:Text", required: true, doc: "Map&lt;filePath, rootFqn&gt;." },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "RootFqns",
    is: "Root block FQNs from TypeRegistry",
    tsExport: "rootFqns",
    inputs: [{ name: "registry", type: "fwcap:TypeRegistry", required: true }],
    output: { name: "fqns", type: "type:Text[]", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "GetExportedFqns",
    is: "Exported block FQNs for a library path from BootstrapResult",
    doc: "Location-based members of the Library (nearest Library.bml walking up from each file). Not the authored blocks aggregation.",
    tsExport: "getExportedFqns",
    inputs: [
      { name: "libraryPath", type: "type:Text", required: true },
      { name: "bootstrap", type: "fwregistry:BootstrapResult", required: true },
      { name: "rootDir", type: "type:Text", doc: "rootDir — default process.cwd()." },
    ],
    output: { name: "exported", type: "type:Text", doc: "Set&lt;exportedFqn&gt; or undefined." },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "PeekLibraryTypeFqn",
    is: "Root type FQN of a Library.bml file",
    doc: "Reads Library.bml and returns document.block.type, or undefined if the file is missing or invalid. Used to compare library identity across realpaths (workspace vs npm copy).",
    tsExport: "peekLibraryTypeFqn",
    inputs: [{ name: "libraryPath", type: "type:Text", required: true }],
    output: { name: "typeFqn", type: "type:Text", doc: "Library type FQN, or undefined." },
    refs: ["fwcap:ResolveLibrarySeeds"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "LocateOwningLibrary",
    is: "Nearest Library for a block FQN by package prefix",
    doc: "Walks FQN package prefixes looking for {package}.Library in the TypeRegistry. First (most specific) match wins. Used by blockml new for destination path and by validateVersions when no file-path owner is available.",
    tsExport: "locateOwningLibrary",
    inputs: [
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
      { name: "fqn", type: "type:Text", required: true },
    ],
    output: { name: "libraryFqn", type: "type:Text", doc: "Owning library type FQN, or undefined." },
    refs: ["fwcap:GetExportedFqns"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ValidateEmbeddedBlocks",
    is: "Embedded block and sub-block placement rules",
    tsExport: "validateEmbeddedBlocks",
    inputs: [{ name: "document", type: "bomdoc:BomDocument", required: true }],
    output: { name: "diagnostics", type: "bomcommon:Diagnostic[]", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ValidateInstances",
    is: "Instance member rules against TypeRegistry",
    tsExport: "validateInstances",
    inputs: [
      { name: "document", type: "bomdoc:BomDocument", required: true },
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
    ],
    output: { name: "diagnostics", type: "bomcommon:Diagnostic[]", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ValidateGenerics",
    is: "Open generic instance and bml:generics placement checks",
    doc: "Open generic instance and bml:generics placement checks against TypeRegistry. Emits BML_OPEN_GENERIC_INSTANCE, BML_GENERICS_DIRECTIVE_NOT_ALLOWED, BML_GENERICS_ARGUMENT_MISMATCH, and reuses BML_GENERIC_CONSTRAINT_VIOLATION / BML_MISSING_GENERIC_TYPE_ARGUMENT. bml:generics is allowed whenever the instance type declares genericTypes. Open parameters require a binding. Parameters with defaultType may omit it; authored arguments override defaultType. BML_OPEN_GENERIC_INSTANCE applies only to domain Block instances. Children of a TypeReferenceEntity aggregation (Library blocks, contracts, …) are type references — empty QName sugar or explicit TypeReferenceEntity — not instances of the named type. They must not carry bml:generics; if present, emit BML_GENERICS_DIRECTIVE_NOT_ALLOWED.",
    tsExport: "validateGenerics",
    inputs: [
      { name: "document", type: "bomdoc:BomDocument", required: true },
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
    ],
    output: { name: "diagnostics", type: "bomcommon:Diagnostic[]", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ValidatePresets",
    is: "Preset member rules against TypeRegistry",
    tsExport: "validatePresets",
    inputs: [
      { name: "document", type: "bomdoc:BomDocument", required: true },
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
    ],
    output: { name: "diagnostics", type: "bomcommon:Diagnostic[]", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ValidateVisibility",
    is: "Visibility member rules against TypeRegistry",
    tsExport: "validateVisibility",
    inputs: [
      { name: "document", type: "bomdoc:BomDocument", required: true },
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
    ],
    output: { name: "diagnostics", type: "bomcommon:Diagnostic[]", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ValidateReadOnly",
    is: "Read-only member rules against TypeRegistry",
    tsExport: "validateReadOnly",
    inputs: [
      { name: "document", type: "bomdoc:BomDocument", required: true },
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
    ],
    output: { name: "diagnostics", type: "bomcommon:Diagnostic[]", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "GetPropertyNumericValue",
    is: "Extract numeric literal from PropertyDefinition value or values[]",
    tsExport: "getPropertyNumericValue",
    inputs: [{ name: "property", type: "bommember:PropertyDefinition", required: true }],
    output: { name: "value", type: "type:Number", doc: "undefined when no numeric literal." },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "IsLiteralValue",
    is: "Type guard for LiteralValue member values",
    tsExport: "isLiteralValue",
    inputs: [{ name: "value", type: "bomvalue:MemberValue", doc: "Member value or undefined." }],
    output: { name: "result", type: "type:Boolean", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "EvaluateParseValue",
    is: "Evaluate PrimitiveType.parseValue on authored text",
    tsExport: "evaluateParseValue",
    inputs: [
      { name: "typeFqn", type: "type:Text", required: true, doc: "Declared primitive FQN or type expression." },
      { name: "raw", type: "type:Text", required: true, doc: "Authored XML text." },
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
    ],
    output: { name: "result", type: "type:Text", required: true, doc: "ok+value, ok+skipped, or ok:false+message." },
    refs: ["fwcap:EvaluateCapability", "fwcap:ResolveEffectiveMembers", "fwcap:ValidateTypes"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "EvaluateCapability",
    is: "Evaluate a named host-evaluable TypeScript Capability",
    tsExport: "evaluateCapability",
    inputs: [
      { name: "typeFqn", type: "type:Text", required: true, doc: "Declared primitive FQN or type expression." },
      { name: "capabilityName", type: "type:Text", required: true, doc: "Capability member name." },
      { name: "args", type: "type:Text", required: true, doc: "Host argument list." },
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
    ],
    output: { name: "result", type: "type:Text", required: true, doc: "ok+value, ok+skipped, or ok:false+message." },
    refs: ["fwcap:EvaluateParseValue", "fwcap:ResolveEffectiveMembers"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ScanTypes",
    is: "List TypeRegistry FQNs matching TypeSelectors",
    tsExport: "scanTypes",
    inputs: [
      { name: "selectors", type: "type:Text[]", required: true, doc: "TypeSelector tokens." },
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
    ],
    output: { name: "hits", type: "type:Text[]", required: true, doc: "Matching type FQNs when ok." },
    refs: ["fwcap:ScanPackages", "fwcap:EvaluateCapability"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ScanPackages",
    is: "List known packages matching PackageSelectors",
    tsExport: "scanPackages",
    inputs: [
      { name: "selectors", type: "type:Text[]", required: true, doc: "PackageSelector tokens." },
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
    ],
    output: { name: "hits", type: "type:Text[]", required: true, doc: "Matching package identifiers when ok." },
    refs: ["fwcap:ScanTypes", "fwcap:EvaluateCapability"],
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ProjectSourceRoots",
    is: "Project-owned BML roots for this package plus local packages/*",
    tsExport: "projectSourceRoots",
    inputs: [
      { name: "rootDir", type: "type:Text", required: true },
      { name: "srcDir", type: "type:Text" },
    ],
    output: { name: "roots", type: "type:Text[]", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ProjectLibraryPackageRoots",
    is: "srcDir roots of local packages that declare blockml.library",
    tsExport: "projectLibraryPackageRoots",
    inputs: [{ name: "rootDir", type: "type:Text", required: true }],
    output: { name: "roots", type: "type:Text[]", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "ProjectLibraryPackageDirs",
    is: "Package directories that declare blockml.library",
    tsExport: "projectLibraryPackageDirs",
    inputs: [{ name: "rootDir", type: "type:Text", required: true }],
    output: { name: "dirs", type: "type:Text[]", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "RegistryFilesUnderRoots",
    is: "Registry file paths whose realpath lies under given roots",
    tsExport: "registryFilesUnderRoots",
    inputs: [
      { name: "registry", type: "fwcap:TypeRegistry", required: true },
      { name: "roots", type: "type:Text[]", required: true },
    ],
    output: { name: "files", type: "type:Text[]", required: true },
  },
  {
    pkg: "capability",
    prefix: "fwcap",
    name: "BootstrapFullProjectRegistry",
    is: "Bootstrap the same corpus as blockml validate --all",
    tsExport: "bootstrapFullProjectRegistry",
    inputs: [
      { name: "rootDir", type: "type:Text", required: true },
      { name: "srcDir", type: "type:Text" },
      { name: "libraries", type: "type:Text[]" },
    ],
    output: { name: "result", type: "fwregistry:BootstrapResult", required: true },
    refs: ["fwcap:ProjectSourceRoots", "fwcap:BootstrapTypeRegistry", "fwcap:ResolveLibrarySeeds"],
  },
];

function escapeXml(s) {
  return String(s)
    .replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;")
    .replace(/</g, "&lt;");
}

function fqn(b) {
  const pkg = b.pkg ? `.${b.pkg}` : "";
  return `org.blockml.bml.framework${pkg}.${b.name}`;
}

function docFqn(name) {
  return `org.blockml.bml.framework.documentation.${name}`;
}

function typeRef(b) {
  return `${b.prefix}:${b.name}`;
}

function renderFields(fields) {
  if (!fields?.length) return "";
  const props = fields
    .map((f) => {
      const req = f.required ? " (required)" : " (optional)";
      const base = f.doc ?? `${f.name}. TS type: ${f.type}.`;
      const doc = base.includes("(required)") || base.includes("(optional)") ? base : `${base}${req}`;
      const valueLine = f.value ? `\n      <value>${f.value}</value>` : f.literal ? `\n      <value>${f.literal}</value>` : "";
      return `    <${f.name} type="${f.type}">
      <documentation>${escapeXml(doc)}</documentation>${valueLine}
    </${f.name}>`;
    })
    .join("\n");
  return `\n\n  <properties>\n${props}\n  </properties>`;
}

function renderCapabilityFields(inputs, output) {
  const parts = [];
  if (inputs?.length) {
    parts.push(
      ...inputs.map((f) => {
        const req = f.required ? " (required)" : " (optional)";
        const base = f.doc ?? `${f.name}. TS type: ${f.type}.`;
        const doc = base.includes("(required)") || base.includes("(optional)") ? base : `${base}${req}`;
        return `    <${f.name} type="${f.type}">
      <documentation>${escapeXml(doc)}</documentation>
    </${f.name}>`;
      }),
    );
  }
  if (output) {
    const req = output.required ? " (required)" : " (optional)";
    const base = output.doc ?? `${output.name}. TS type: ${output.type}.`;
    const doc = base.includes("(required)") || base.includes("(optional)") ? base : `${base}${req}`;
    parts.push(`    <${output.name} type="${output.type}">
      <documentation>${escapeXml(doc)}</documentation>
    </${output.name}>`);
  }
  if (!parts.length) return "";
  return `\n\n  <properties>\n${parts.join("\n")}\n  </properties>`;
}

function renderDocBlock(d) {
  const refs = d.refs?.length
    ? `\n\n  <references>\n${d.refs
        .map(
          (r) =>
            `    <see type="${r.type}" relation="${r.relation}">${r.context ?? ""}</see>`,
        )
        .join("\n")}\n  </references>`
    : "";

  return `<!--
  Framework Documentation — ${d.name}
  FQN: ${docFqn(d.name)}
-->
<block
${XMLNS}
  xmlns:doc="org.blockml.bml.documentation">

  <name>${d.name}</name>
  <type>fwdocumentation:${d.name}</type>
  <baseType>core:Documentation</baseType>
  <is>${escapeXml(d.is)}</is>

  <documentation>${escapeXml(d.doc)}</documentation>${refs}

</block>
`;
}

function renderBlock(b) {
  const base = b.baseType ?? "framework:FrameworkType";
  const abstract = b.abstract ? "\n\n  <abstract>true</abstract>" : "";
  const refs = b.refs?.length
    ? `\n\n  <references>\n${b.refs.map((r) => `    <see type="${r}" relation="SeeAlso" />`).join("\n")}\n  </references>`
    : "";

  return `<!--
  Framework — ${b.name}
  FQN: ${fqn(b)}
-->
<block
${XMLNS}>

  <name>${b.name}</name>
  <type>${typeRef(b)}</type>
  <baseType>${base}</baseType>
  <is>${escapeXml(b.is)}</is>

  <documentation>${escapeXml(b.doc || b.is)}</documentation>${refs}${abstract}${renderFields(b.fields)}

</block>
`;
}

function renderCapability(c) {
  const refs = c.refs?.length
    ? `\n\n  <references>\n${c.refs.map((r) => `    <see type="${r}" relation="SeeAlso" />`).join("\n")}\n  </references>`
    : "";

  return `<!--
  Framework Capability — ${c.name}
  FQN: ${fqn(c)}
-->
<block
${XMLNS}>

  <name>${c.name}</name>
  <type>${typeRef(c)}</type>
  <baseType>core:Capability</baseType>
  <is>${escapeXml(c.is)}</is>

  <documentation>${escapeXml(c.doc || c.is)}</documentation>${refs}${renderCapabilityFields(c.inputs, c.output)}

</block>
`;
}


function capabilityTsExport(c) {
  return c.tsExport ?? c.name.charAt(0).toLowerCase() + c.name.slice(1);
}

// Generate FrameworkType + type/config blocks
for (const b of blocks) {
  const dir = b.pkg ? join(blocksRoot, b.pkg) : blocksRoot;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${b.name}.bml`), renderBlock(b));
}

// Generate capability blocks
const capDir = join(blocksRoot, "capability");
mkdirSync(capDir, { recursive: true });
for (const c of capabilities) {
  writeFileSync(join(capDir, `${c.name}.bml`), renderCapability(c));
}

// Generate documentation blocks
const docDir = join(blocksRoot, "documentation");
mkdirSync(docDir, { recursive: true });
for (const d of documentationBlocks) {
  writeFileSync(join(docDir, `${d.name}.bml`), renderDocBlock(d));
}

const library = `<!--
  BlockML Framework Library Descriptor
  FQN: org.blockml.bml.framework.Library
-->
<block
${XMLNS}>

  <name>Library</name>
  <type>framework:Library</type>
  <baseType>core:BlockLibrary</baseType>
  <is>The BlockML Framework utilities package library catalog</is>

  <documentation>
    Canonical framework specification for BlockML Stage-2 utilities — TypeRegistry,
    bootstrap, fork/resolve, parseExpression, validateTypes/validateConstraints.
    TypeScript in packages/framework/src/ implements this library.
    Urmodell types live in org.blockml.bml.bom.* (@blockml/bom).
    Membership is the nearest Library.bml at the same package level or above; search stops one level below the source folder.
  </documentation>

  <version>0.7.1</version>

  <language>
    <English />
  </language>

  <properties>
    <description override="true">
      <value>BlockML Framework utilities library</value>
    </description>
  </properties>

  <aggregations>
    <readMe override="true">
      <composition>
        <framework:README />
      </composition>
    </readMe>
    <dependencies override="true">
      <composition>
        <blockml:Library />
        <bom:Library />
        <parser:Library />
      </composition>
    </dependencies>
  </aggregations>

</block>
`;

writeFileSync(join(blocksRoot, "Library.bml"), library);

const readme = `<!--
  BlockML Framework — README
  FQN: org.blockml.bml.framework.README
-->
<block
${XMLNS}>

  <name>README</name>
  <type>framework:README</type>
  <baseType>core:ReadMe</baseType>
  <is>Reading entry for the Framework utilities library</is>

  <documentation>
    The @blockml/framework package provides Stage-2 utilities: TypeRegistry,
    bootstrapTypeRegistry, forkBom, resolveEffectiveMembers, parseExpression,
    validateTypes, and validateConstraints.

    This library (org.blockml.bml.framework.*) is the SSOT; TypeScript in
    packages/framework/src/ implements it. Parity tests in packages/framework/test/
    verify BML ↔ TS alignment.

    Start reading at org.blockml.bml.framework.documentation.Introduction (ReadNext chain).

    Layer separation:
    • org.blockml.bml.bom.* (@blockml/bom) — Urmodell types framework operates on
    • org.blockml.bml.framework.* (this library) — Stage-2 utilities
    • org.blockml.bml.compiler.parser.* (@blockml/parser) — parse() for bootstrap
    • org.blockml.bml.compiler.validator.* (@blockml/validator) — validate() orchestrator
    • org.blockml.bml.definition.* (@blockml/core) — language BML corpus (npm)

    Modules: documentation (narrative specs), registry, expression, config,
    capability (public operations).

    Not in this library: validate() orchestration (@blockml/validator); parse()/serialize() entry points.
  </documentation>

  <references>
    <see type="fwdocumentation:Introduction" relation="ReadFirst" />
    <see type="fwdocumentation:PublicApi" relation="SeeAlso" />
    <see type="bomdocumentation:PackageOwnership" relation="SeeAlso" />
    <see type="pardocumentation:Introduction" relation="SeeAlso" />
    <see type="valdocumentation:Introduction" relation="SeeAlso" />
  </references>

</block>
`;

writeFileSync(join(blocksRoot, "README.bml"), readme);

// Export schema for parity tests
const fixturesDir = join(__dirname, "../test/fixtures");
mkdirSync(fixturesDir, { recursive: true });
writeFileSync(
  join(fixturesDir, "framework-schema.json"),
  JSON.stringify(
    {
      blocks: blocks.map((b) => ({
        fqn: fqn(b),
        tsExport: b.name,
        pkg: b.pkg || "root",
        abstract: !!b.abstract,
        baseType: b.baseType ?? "framework:FrameworkType",
        fields: (b.fields ?? []).map((f) => ({
          name: f.name,
          type: f.type,
          required: !!f.required,
          literal: f.literal,
          value: f.value,
        })),
      })),
      capabilities: capabilities.map((c) => ({
        name: c.name,
        tsExport: capabilityTsExport(c),
        fqn: fqn(c),
        inputs: (c.inputs ?? []).map((f) => ({ name: f.name, type: f.type, required: !!f.required })),
        output: c.output ?? null,
      })),
      frameworkDiagnosticCodes: FRAMEWORK_DIAGNOSTIC_CODES,
      documentationBlocks: documentationBlocks.map((d) => d.name),
    },
    null,
    2,
  ),
);

console.log(
  `Generated ${blocks.length} type blocks + ${capabilities.length} capabilities + ${documentationBlocks.length} documentation blocks + Library.bml + README.bml`,
);
