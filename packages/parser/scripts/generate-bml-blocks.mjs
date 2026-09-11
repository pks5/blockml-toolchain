#!/usr/bin/env node
/**
 * One-shot generator for Parser BML blocks.
 * Output under blocks/ is the SSOT; this script is a migration aid only.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { documentationBlocks } from "./parser-documentation-blocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const blocksRoot = join(__dirname, "../blocks/org/blockml/bml/compiler/parser");

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
  xmlns:bomtype="org.blockml.bml.bom.type"
  xmlns:bomvalue="org.blockml.bml.bom.value"
  xmlns:core="org.blockml.bml.core"
  xmlns:def="org.blockml.bml.definition"
  xmlns:parser="org.blockml.bml.compiler.parser"
  xmlns:parcap="org.blockml.bml.compiler.parser.capability"
  xmlns:parconfig="org.blockml.bml.compiler.parser.config"
  xmlns:pardocumentation="org.blockml.bml.compiler.parser.documentation"
  xmlns:parmap="org.blockml.bml.compiler.parser.map"
  xmlns:type="org.blockml.bml.type"
  xmlns:bomdocumentation="org.blockml.bml.bom.documentation"
  xmlns:bomcap="org.blockml.bml.bom.capability"
  xmlns:serdocumentation="org.blockml.bml.compiler.serializer.documentation"
  xmlns:valdocumentation="org.blockml.bml.compiler.validator.documentation"`;

/** @typedef {{ name: string, type: string, required?: boolean, doc?: string, literal?: string }} Field */
/** @typedef {{ pkg: string, prefix: string, name: string, is: string, doc: string, abstract?: boolean, baseType?: string, fields?: Field[], refs?: string[] }} BlockDef */
/** @typedef {{ pkg: string, prefix: string, name: string, is: string, doc: string, inputs?: Field[], output?: Field, refs?: string[] }} CapabilityDef */

const MAP_TIME_DIAGNOSTIC_CODES = [
  "BML_UNSUPPORTED_FORMAT",
  "BML_MALFORMED_XML",
  "BML_MISSING_ROOT",
  "BML_INVALID_ROOT",
  "BML_MISSING_BLOCK_TYPE",
  "BML_MISSING_EMBEDDED_BLOCK_TYPE",
  "BML_MISSING_SUBBLOCK_NAME",
  "BML_MAP_ERROR",
  "BML_UNKNOWN_NAMESPACE_PREFIX",
  "BML_UNQUALIFIED_BLOCK_REFERENCE",
  "BML_UNKNOWN_TYPE",
  "BML_INVALID_TYPE_REFERENCE",
  "BML_UNKNOWN_ELEMENT",
  "BML_UNKNOWN_ATTRIBUTE",
  "BML_UNKNOWN_DIRECTIVE",
  "BML_STANDALONE_COMPOSITION",
  "BML_NESTED_COMPOSITION",
  "BML_DUPLICATE_COMPOSITION",
  "BML_DUPLICATE_PROPERTY_VALUE",
  "BML_MIXED_MEMBER_VALUE",
  "BML_UNEXPECTED_TEXT",
  "BML_INVALID_VALUE",
];

/** @type {BlockDef[]} */
const blocks = [
  {
    pkg: "",
    prefix: "parser",
    name: "ParserType",
    is: "Abstract marker for parser implementation data-structure blocks",
    doc: "All org.blockml.bml.compiler.parser.map.* and .config.* types extend this marker. Distinct from bom:UrmodellType (parse-result data) and core:Capability (operations).",
    abstract: true,
    baseType: "core:Block",
    refs: ["bom:UrmodellType"],
  },
  {
    pkg: "map",
    prefix: "parmap",
    name: "MapContext",
    is: "Per-parse mapping configuration and namespace context",
    doc: "Created by createMapContext(). Passed through map/* modules during step [5].",
    fields: [
      { name: "filePath", type: "type:Text", required: true },
      { name: "source", type: "type:Text", required: true, doc: "Original source string." },
      { name: "bindings", type: "type:Text", required: true, doc: "Record<string, string> namespace bindings." },
      { name: "subBlockIndex", type: "type:Text", required: true, doc: "Map<string, string> sub-block lookup." },
      { name: "parentBlockType", type: "type:Text", doc: "Enclosing block type FQN when nested." },
      { name: "isRoot", type: "type:Boolean", required: true },
      { name: "isEmbedded", type: "type:Boolean", required: true },
      { name: "diagnostics", type: "bomcommon:Diagnostic[]", required: true, doc: "Shared map-time diagnostics; structural errors append here without aborting." },
      { name: "parseValue", type: "type:Text", doc: "Optional host parseValue hook from ParseOptions." },
      { name: "isCommaSugarPayload", type: "type:Text", doc: "Domain PrimitiveEntity payloads beyond the Core well-known comma-sugar set." },
    ],
  },
  {
    pkg: "map",
    prefix: "parmap",
    name: "XmlDomNode",
    is: "Host XML DOM node from @xmldom/xmldom",
    doc: "BML type gap: stands for TypeScript Node | Element | Document (@xmldom/xmldom). Core has no DOM ValueType; this is a host-boundary type, not a reconstructed DOM struct.",
  },
  {
    pkg: "map",
    prefix: "parmap",
    name: "QNameParts",
    is: "Prefix and local name from a QName split",
    doc: "BML type gap: stands for TypeScript { prefix: string; local: string } from splitQName() (packages/parser/src/util/qname.ts).",
    fields: [
      { name: "prefix", type: "type:Text", required: true },
      { name: "local", type: "type:Text", required: true },
    ],
  },
  {
    pkg: "map",
    prefix: "parmap",
    name: "VisibilityParse",
    is: "Logical name plus visibility from a localName prefix",
    doc: "BML type gap: stands for TypeScript { name: string; visibility: string } from parseVisibilityFromName().",
    fields: [
      { name: "name", type: "type:Text", required: true },
      { name: "visibility", type: "type:Text", required: true },
    ],
  },
  {
    pkg: "map",
    prefix: "parmap",
    name: "BmlMeta",
    is: "Parsed bml:id/version/bean/scope on a BlockInstance",
    doc: "BML type gap: stands for the object returned by parseBmlMeta() (packages/parser/src/map/directives.ts).",
    fields: [
      { name: "id", type: "bomvalue:MemberValue" },
      { name: "version", type: "bomvalue:MemberValue" },
      { name: "bean", type: "bomvalue:MemberValue" },
      { name: "scope", type: "type:Text" },
    ],
  },
  {
    pkg: "map",
    prefix: "parmap",
    name: "MapContextOptions",
    is: "Optional extras when building MapContext",
    doc: "BML type gap: stands for the options argument of createMapContext() (packages/parser/src/map/context.ts).",
    fields: [
      { name: "subBlockIndex", type: "type:Text", doc: "Map&lt;string, string&gt; sub-block lookup." },
      { name: "parentBlockType", type: "type:Text", doc: "Enclosing block type FQN when nested." },
      { name: "isRoot", type: "type:Boolean" },
      { name: "isEmbedded", type: "type:Boolean" },
      { name: "diagnostics", type: "bomcommon:Diagnostic[]" },
      { name: "parseValue", type: "type:Text", doc: "Optional host parseValue hook from ParseOptions." },
      { name: "isCommaSugarPayload", type: "type:Text", doc: "Domain PrimitiveEntity payloads beyond the Core well-known comma-sugar set." },
    ],
  },
  {
    pkg: "map",
    prefix: "parmap",
    name: "CharacterData",
    is: "Trimmed element character data and authored form",
    doc: "BML type gap: stands for TypeScript { text: string; form: \"text\" | \"cdata\" } from getCharacterData() (packages/parser/src/util/xml.ts).",
    fields: [
      { name: "text", type: "type:Text", required: true },
      { name: "form", type: "bomcommon:CharacterDataForm", required: true },
    ],
  },
  {
    pkg: "config",
    prefix: "parconfig",
    name: "ParserConstants",
    is: "Well-known URIs and V1 root element name",
    doc: "Shared across pipeline, qname resolution, and namespace extraction.",
    fields: [
      { name: "XSI_NS", type: "type:Text", required: true, literal: "http://www.w3.org/2001/XMLSchema-instance" },
      { name: "BML_XMLNS", type: "type:Text", required: true, literal: "http://blockml.org/bml" },
      { name: "TYPE_REFERENCE_ENTITY", type: "type:Text", required: true, literal: "org.blockml.bml.type.TypeReferenceEntity" },
      { name: "V1_ROOT_ELEMENT", type: "type:Text", required: true, literal: "block" },
    ],
  },
  {
    pkg: "config",
    prefix: "parconfig",
    name: "MapTimeDiagnosticCodes",
    is: "Diagnostic codes emitted during parse pipeline and mapping",
    doc: "Hard-fail codes return document: null. Map-time codes may attach to ParseResult with continueOnError.",
    fields: [
      { name: "codes", type: "type:Text[]", required: true, doc: `Ordered: ${MAP_TIME_DIAGNOSTIC_CODES.join(", ")}` },
    ],
  },
];

/** @type {CapabilityDef[]} */
const capabilities = [
  {
    pkg: "capability",
    prefix: "parcap",
    name: "Parse",
    is: "Public entry: BML XML string → ParseResult (B26)",
    doc: "Orchestrates pipeline [1]–[5]. Does not call validator or expand directives.",
    inputs: [
      { name: "source", type: "type:Text", required: true },
      { name: "options", type: "bomapi:ParseOptions", doc: "Default filePath=<memory>, continueOnError=true." },
    ],
    output: { name: "result", type: "bomapi:ParseResult", required: true },
    refs: ["pardocumentation:PublicApi", "bomapi:ParseOptions", "bomapi:ParseResult"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "DetectFormat",
    is: "Format detector — step [1] (B24)",
    doc: "Strip UTF-8 BOM; detect xml when first non-whitespace is '<'.",
    inputs: [{ name: "source", type: "type:Text", required: true }],
    output: { name: "format", type: "type:Text", doc: '"xml" | null' },
    refs: ["pardocumentation:ArchitectureOverview"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ParseXmlDom",
    is: "XML DOM parser — step [2] (B18)",
    doc: "Uses @xmldom/xmldom. Browser and Node compatible.",
    inputs: [
      { name: "source", type: "type:Text", required: true },
      { name: "filePath", type: "type:Text" },
    ],
    output: { name: "document", type: "parmap:XmlDomNode", required: true, doc: "DOM Document" },
    refs: ["pardocumentation:V1Scope"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "GetParseErrors",
    is: "Collect xmldom parse error messages",
    inputs: [{ name: "document", type: "parmap:XmlDomNode", required: true }],
    output: { name: "errors", type: "type:Text[]", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "DocumentElement",
    is: "Get root element from DOM document",
    inputs: [{ name: "document", type: "parmap:XmlDomNode", required: true }],
    output: { name: "element", type: "parmap:XmlDomNode", doc: "Element | null" },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "AssertBlockRoot",
    is: "Root type resolver — step [3]; <block> or a type tag",
    doc: "Accepts legacy <block> or a type-as-root tag (PascalCase local name, optional Package prefix). Throws BML_INVALID_ROOT otherwise (doc:DocumentFormat).",
    inputs: [{ name: "element", type: "parmap:XmlDomNode", required: true }],
    refs: ["parconfig:ParserConstants", "pardocumentation:ArchitectureOverview", "doc:DocumentFormat"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "IsDocumentRootLocalName",
    is: "True when a local name may wrap a Block definition",
    doc: "True for legacy block or a PascalCase type-or-name tag (optional visibility underscores). Used for the document root, Sub-Blocks under subBlocks, and embeds under embeddedBlocks (doc:DocumentFormat).",
    inputs: [{ name: "local", type: "type:Text", required: true }],
    output: { name: "allowed", type: "type:Boolean", required: true },
    refs: ["parcap:AssertBlockRoot", "doc:DocumentFormat"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ExtractNamespaceBindings",
    is: "Extract xmlns*, xsi schema locations, and authored rootForm from the document root",
    inputs: [{ name: "element", type: "parmap:XmlDomNode", required: true }],
    output: { name: "sourceInfo", type: "bomcommon:SourceInfo", required: true },
    refs: ["pardocumentation:AttributeClassification"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "MergeSourceInfo",
    is: "Merge SourceInfo with filePath and format",
    inputs: [
      { name: "partial", type: "bomcommon:SourceInfo", required: true },
      { name: "filePath", type: "type:Text", required: true },
      { name: "format", type: "type:Text", required: true },
    ],
    output: { name: "sourceInfo", type: "bomcommon:SourceInfo", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "CreateMapContext",
    is: "Build MapContext for step [5] mapping",
    inputs: [
      { name: "filePath", type: "type:Text", required: true },
      { name: "source", type: "type:Text", required: true },
      { name: "bindings", type: "type:Text", required: true },
      { name: "options", type: "parmap:MapContextOptions", doc: "subBlockIndex, parentBlockType, isRoot, isEmbedded, diagnostics." },
    ],
    output: { name: "context", type: "parmap:MapContext", required: true },
    refs: ["parmap:MapContext"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "MapDocumentBlock",
    is: "Map document root to BomDocument — step [5] entry",
    inputs: [
      { name: "element", type: "parmap:XmlDomNode", required: true },
      { name: "sourceInfo", type: "bomcommon:SourceInfo", required: true },
      { name: "ctx", type: "parmap:MapContext", required: true },
    ],
    output: { name: "document", type: "bomdoc:BomDocument", required: true },
    refs: ["parcap:MapBlock", "pardocumentation:BlockMetadataMapping"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "MapBlock",
    is: "Map XML element to BlockDefinition",
    inputs: [
      { name: "element", type: "parmap:XmlDomNode", required: true },
      { name: "ctx", type: "parmap:MapContext", required: true },
    ],
    output: { name: "block", type: "bomblock:BlockDefinition", required: true },
    refs: ["pardocumentation:MemberMapping"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "MapCompositionTemplate",
    is: "Map <composition> element to CompositionTemplate",
    inputs: [
      { name: "element", type: "parmap:XmlDomNode", required: true },
      { name: "ctx", type: "parmap:MapContext", required: true },
    ],
    output: { name: "template", type: "bomcomp:CompositionTemplate", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "MapBlockInstanceNode",
    is: "Map composition child node to BlockInstanceNode",
    inputs: [
      { name: "element", type: "parmap:XmlDomNode", required: true },
      { name: "ctx", type: "parmap:MapContext", required: true },
    ],
    output: { name: "node", type: "bomcomp:BlockInstanceNode", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "IsTypeReferenceEntitySugar",
    is: "Detect TypeReferenceEntityInstance sugar element",
    inputs: [{ name: "element", type: "parmap:XmlDomNode", required: true }],
    output: { name: "result", type: "type:Boolean", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "MapTypeReferenceEntityInstance",
    is: "Map TypeReferenceEntityInstance sugar element",
    inputs: [
      { name: "element", type: "parmap:XmlDomNode", required: true },
      { name: "ctx", type: "parmap:MapContext", required: true },
    ],
    output: { name: "entity", type: "bomblock:TypeReferenceEntityInstance", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "BuildSubBlockIndex",
    is: "Build sub-block name → type FQN index from BlockDefinition",
    inputs: [{ name: "block", type: "bomblock:BlockDefinition", required: true }],
    output: { name: "index", type: "type:Text", required: true, doc: "Map<string, string>" },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ParseTypeExpression",
    is: "Parse type attribute string to TypeExpression",
    inputs: [
      { name: "raw", type: "type:Text", required: true },
      { name: "ctx", type: "parmap:MapContext", required: true },
      { name: "implicitContext", type: "type:Text" },
    ],
    output: { name: "expression", type: "bomtype:TypeExpression", required: true },
    refs: ["pardocumentation:TypeDescriptorParsing"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ParseGenericArgumentList",
    is: "Parse a parenthesized TypeExpression list for bml:generics",
    inputs: [
      { name: "raw", type: "type:Text", required: true },
      { name: "bindings", type: "type:Text", required: true },
    ],
    output: { name: "arguments", type: "bomtype:TypeExpression[]", required: true },
    refs: ["parcap:ParseTypeExpression"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "InferCardinality",
    is: "Infer cardinality from TypeExpression shape",
    inputs: [{ name: "type", type: "bomtype:TypeExpression" }],
    output: { name: "cardinality", type: "type:Text" },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "TypeExpressionToString",
    is: "Serialize TypeExpression back to attribute string (internal/debug)",
    inputs: [{ name: "type", type: "bomtype:TypeExpression", required: true }],
    output: { name: "text", type: "type:Text", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ParseMemberValue",
    is: "Parse attribute/element value to MemberValue",
    doc: "Always classifies ExpressionValue and InterpolatedTextValue. Boolean/number heuristics run only without the parseValue hook (bootstrap). With the hook, skip keeps the authored string.",
    inputs: [
      { name: "raw", type: "type:Text", required: true },
      { name: "ctx", type: "parmap:MapContext", required: true },
    ],
    output: { name: "value", type: "bomvalue:MemberValue", required: true },
    refs: ["pardocumentation:ExpressionCapture"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ContainsUnescapedInterpolation",
    is: "Detect unescaped ${…} interpolation in raw text",
    doc: "True when raw contains ${ not preceded by a backslash. Used by ParseMemberValue and ParseDirectives to choose InterpolatedTextValue over a JSON-like literal.",
    inputs: [{ name: "raw", type: "type:Text", required: true }],
    output: { name: "result", type: "type:Boolean", required: true },
    refs: ["pardocumentation:ExpressionCapture", "parcap:ParseMemberValue"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ExpressionFromRaw",
    is: "Wrap raw ${…} text as ExpressionValue (B4)",
    inputs: [
      { name: "raw", type: "type:Text", required: true },
      { name: "source", type: "bomcommon:SourceLocation" },
    ],
    output: { name: "value", type: "bomvalue:ExpressionValue", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ParseDirectives",
    is: "Parse bml:each/if/unless/with directive attributes",
    inputs: [
      { name: "element", type: "parmap:XmlDomNode", required: true },
      { name: "ctx", type: "parmap:MapContext", required: true },
    ],
    output: { name: "directives", type: "bomcomp:DirectiveAttribute[]", required: true },
    refs: ["pardocumentation:AttributeClassification"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ParseGenericsBinding",
    is: "Parse bml:generics attribute or child element into GenericsBinding",
    inputs: [
      { name: "element", type: "parmap:XmlDomNode", required: true },
      { name: "ctx", type: "parmap:MapContext", required: true },
    ],
    output: { name: "binding", type: "bomcomp:GenericsBinding" },
    refs: ["parcap:ParseGenericArgumentList", "pardocumentation:AttributeClassification"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ParseBmlMeta",
    is: "Parse bml:id/version/bean/scope/status on BlockInstance",
    inputs: [{ name: "element", type: "parmap:XmlDomNode", required: true }],
    output: { name: "meta", type: "parmap:BmlMeta", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ParseVisibilityFromName",
    is: "Strip _/__ prefix from localName → logical name + visibility (B14)",
    inputs: [{ name: "localName", type: "type:Text", required: true }],
    output: { name: "result", type: "parmap:VisibilityParse", required: true },
    refs: ["pardocumentation:DesignDecisions"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "VisibilityPrefix",
    is: "Map visibility enum to XML prefix (shared with serializer util)",
    inputs: [{ name: "visibility", type: "type:Text" }],
    output: { name: "prefix", type: "type:Text", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "NormalizeBooleanValue",
    is: "Normalize boolean literal to lowercase canonical form (B15)",
    inputs: [{ name: "raw", type: "type:Text", required: true }],
    output: { name: "value", type: "type:Boolean", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "IsBooleanLiteral",
    is: "Detect true/false/True/False/… boolean value literals",
    inputs: [{ name: "raw", type: "type:Text", required: true }],
    output: { name: "result", type: "type:Boolean", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ParseBooleanAttribute",
    is: "Parse boolean XML attribute value",
    inputs: [{ name: "raw", type: "type:Text", required: true }],
    output: { name: "value", type: "type:Boolean", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "SplitQName",
    is: "Split prefixed QName into prefix and local name",
    inputs: [{ name: "qname", type: "type:Text", required: true }],
    output: { name: "parts", type: "parmap:QNameParts", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ResolvePrefix",
    is: "Resolve namespace prefix to URI from bindings",
    inputs: [
      { name: "prefix", type: "type:Text", required: true },
      { name: "bindings", type: "type:Text", required: true },
    ],
    output: { name: "uri", type: "type:Text", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ResolveBlockReference",
    is: "Resolve block type/baseType QName to FQN",
    inputs: [
      { name: "qname", type: "type:Text", required: true },
      { name: "bindings", type: "type:Text", required: true },
      { name: "ctx", type: "parmap:MapContext", required: true },
    ],
    output: { name: "fqn", type: "type:Text", required: true },
    refs: ["parconfig:ParserConstants"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ResolveTypeName",
    is: "Resolve type name to FQN with implicit namespaces",
    inputs: [
      { name: "name", type: "type:Text", required: true },
      { name: "bindings", type: "type:Text", required: true },
      { name: "implicitContext", type: "type:Text" },
    ],
    output: { name: "fqn", type: "type:Text", required: true },
    refs: ["pardocumentation:TypeDescriptorParsing"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "HasBmlSemanticQNameBindings",
    is: "Detect whether document uses BML-semantic prefixed xmlns",
    inputs: [{ name: "bindings", type: "type:Text", required: true }],
    output: { name: "result", type: "type:Boolean", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "FqnToQName",
    is: "Convert FQN to prefixed QName using bindings",
    inputs: [
      { name: "fqn", type: "type:Text", required: true },
      { name: "bindings", type: "type:Text", required: true },
    ],
    output: { name: "qname", type: "type:Text", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "SourceLoc",
    is: "Build SourceLocation from file path and line/column",
    inputs: [
      { name: "filePath", type: "type:Text", required: true },
      { name: "line", type: "type:Integer", required: true },
      { name: "column", type: "type:Integer", required: true },
    ],
    output: { name: "location", type: "bomcommon:SourceLocation", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ElementSourceLoc",
    is: "Extract SourceLocation from DOM element line/column attrs",
    doc: "Start from DOM locator line/column when present, else string search. End by scanning source for the matching close tag or self-closing start tag (endLine/endColumn).",
    inputs: [
      { name: "element", type: "parmap:XmlDomNode", required: true },
      { name: "filePath", type: "type:Text", required: true },
      { name: "source", type: "type:Text", required: true },
    ],
    output: { name: "location", type: "bomcommon:SourceLocation", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ElementStartTagIsSelfClosing",
    is: "Detect whether an element's start tag is authored as self-closing",
    doc: "True when the start tag ends with slash-greater-than. Used to record authoredEmptyElementForm on empty see references.",
    inputs: [
      { name: "source", type: "type:Text", required: true },
      { name: "element", type: "parmap:XmlDomNode", required: true },
    ],
    output: { name: "result", type: "type:Boolean", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "IsElement",
    is: "Type guard: DOM node is Element",
    inputs: [{ name: "node", type: "parmap:XmlDomNode", required: true }],
    output: { name: "result", type: "type:Boolean", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "IsComment",
    is: "Type guard: DOM node is comment",
    inputs: [{ name: "node", type: "parmap:XmlDomNode", required: true }],
    output: { name: "result", type: "type:Boolean", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "IsTextNode",
    is: "Type guard: DOM node is text",
    inputs: [{ name: "node", type: "parmap:XmlDomNode", required: true }],
    output: { name: "result", type: "type:Boolean", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "IsCData",
    is: "Type guard: DOM node is CDATA",
    inputs: [{ name: "node", type: "parmap:XmlDomNode", required: true }],
    output: { name: "result", type: "type:Boolean", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ElementChildren",
    is: "Get element child nodes as Element array",
    inputs: [{ name: "element", type: "parmap:XmlDomNode", required: true }],
    output: { name: "children", type: "parmap:XmlDomNode[]", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ElementLocalName",
    is: "Get element local name (without prefix)",
    inputs: [{ name: "element", type: "parmap:XmlDomNode", required: true }],
    output: { name: "localName", type: "type:Text", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "ElementPrefix",
    is: "Get element namespace prefix",
    inputs: [{ name: "element", type: "parmap:XmlDomNode", required: true }],
    output: { name: "prefix", type: "type:Text", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "GetAttribute",
    is: "Get attribute value from element by name",
    inputs: [
      { name: "element", type: "parmap:XmlDomNode", required: true },
      { name: "name", type: "type:Text", required: true },
    ],
    output: { name: "value", type: "type:Text" },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "GetCharacterData",
    is: "Extract text/CDATA content and authoredCharacterDataForm (D8)",
    doc: "Extract text/CDATA content and authoredCharacterDataForm (D8). Character data is passed through TrimText: common leading indent on every non-empty line is removed before the value is stored on the BOM.",
    inputs: [{ name: "element", type: "parmap:XmlDomNode", required: true }],
    output: { name: "data", type: "parmap:CharacterData", required: true },
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "CollectLeadingComments",
    is: "Collect comment siblings before element index (B11)",
    inputs: [
      { name: "siblings", type: "parmap:XmlDomNode[]", required: true },
      { name: "index", type: "type:Integer", required: true },
    ],
    output: { name: "comments", type: "type:Text[]", required: true },
    refs: ["pardocumentation:XmlCommentsParse"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "CollectTrailingComments",
    is: "Collect comment siblings after element (B11)",
    inputs: [
      { name: "siblings", type: "parmap:XmlDomNode[]", required: true },
      { name: "index", type: "type:Integer", required: true },
    ],
    output: { name: "comments", type: "type:Text[]", required: true },
    refs: ["pardocumentation:XmlCommentsParse"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "XmlTriviaFromElement",
    is: "Build XmlTrivia from element comment context",
    inputs: [{ name: "element", type: "parmap:XmlDomNode", required: true }],
    output: { name: "trivia", type: "bomcommon:XmlTrivia" },
    refs: ["pardocumentation:XmlCommentsParse"],
  },
  {
    pkg: "capability",
    prefix: "parcap",
    name: "TrimText",
    is: "Strip common leading indent, then trim, from text node value",
    doc: "Strip the longest leading whitespace prefix shared by every non-empty line (pretty-print indent), then trim surrounding whitespace. Relative extra indent on individual lines is kept. Used by GetCharacterData for documentation prose and other character-data hosts (B13).",
    inputs: [{ name: "value", type: "type:Text", required: true }],
    output: { name: "trimmed", type: "type:Text", required: true },
  },
];

function escapeXml(s) {
  return String(s)
    .replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;")
    .replace(/</g, "&lt;");
}

function fqn(b) {
  const pkg = b.pkg ? `.${b.pkg}` : "";
  return `org.blockml.bml.compiler.parser${pkg}.${b.name}`;
}

function docFqn(name) {
  return `org.blockml.bml.compiler.parser.documentation.${name}`;
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
      return `    <${f.name} type="${f.type}">
      <documentation>${escapeXml(doc)}</documentation>
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
  Parser Documentation — ${d.name}
  FQN: ${docFqn(d.name)}
-->
<block
${XMLNS}
  xmlns:doc="org.blockml.bml.documentation">

  <name>${d.name}</name>
  <type>pardocumentation:${d.name}</type>
  <baseType>core:Documentation</baseType>
  <is>${escapeXml(d.is)}</is>

  <documentation>${escapeXml(d.doc)}</documentation>${refs}

</block>
`;
}

function renderBlock(b) {
  const base = b.baseType ?? "parser:ParserType";
  const abstract = b.abstract ? "\n\n  <abstract>true</abstract>" : "";
  const refs = b.refs?.length
    ? `\n\n  <references>\n${b.refs.map((r) => `    <see type="${r}" relation="SeeAlso" />`).join("\n")}\n  </references>`
    : "";

  return `<!--
  Parser — ${b.name}
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
  Parser Capability — ${c.name}
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

function catalogEntry(b) {
  return `        <${typeRef(b)} />`;
}

// Generate blocks
for (const b of blocks) {
  const dir = b.pkg ? join(blocksRoot, b.pkg) : blocksRoot;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${b.name}.bml`), renderBlock(b));
}

const capDir = join(blocksRoot, "capability");
mkdirSync(capDir, { recursive: true });
for (const c of capabilities) {
  writeFileSync(join(capDir, `${c.name}.bml`), renderCapability(c));
}

const docDir = join(blocksRoot, "documentation");
mkdirSync(docDir, { recursive: true });
for (const d of documentationBlocks) {
  writeFileSync(join(docDir, `${d.name}.bml`), renderDocBlock(d));
}

const libraryBlocks = [
  "      <composition>",
  ...blocks.map(catalogEntry),
  ...capabilities.map(catalogEntry),
  ...documentationBlocks.map(
    (d) => `        <pardocumentation:${d.name} />`,
  ),
  "      </composition>",
].join("\n");

const library = `<!--
  BlockML Parser Library Descriptor
  FQN: org.blockml.bml.compiler.parser.Library
-->
<block
${XMLNS}>

  <name>Library</name>
  <type>parser:Library</type>
  <baseType>core:BlockLibrary</baseType>
  <is>The BlockML Parser compiler package library catalog</is>

  <documentation>
    Canonical parser specification for BlockML — BML → BOM mapping algorithm,
    Stage 1 pipeline [1]–[5], and parse() contract. TypeScript in packages/parser/src/
    implements this library. Input/output Urmodell types live in org.blockml.bml.bom.*
    (@blockml/bom). Membership is defined exclusively by this blocks list.
  </documentation>

  <version>0.7.1</version>

  <language>
    <English />
  </language>

  <properties>
    <description override="true">
      <value>BlockML Parser library</value>
    </description>
  </properties>

  <aggregations>
    <readMe override="true">
      <composition>
        <parser:README />
      </composition>
    </readMe>
    <dependencies override="true">
      <composition>
        <blockml:Library />
        <bom:Library />
      </composition>
    </dependencies>
    <blocks override="true">
${libraryBlocks}
    </blocks>
  </aggregations>

</block>
`;

writeFileSync(join(blocksRoot, "Library.bml"), library);

const readme = `<!--
  BlockML Parser — README
  FQN: org.blockml.bml.compiler.parser.README
-->
<block
${XMLNS}>

  <name>README</name>
  <type>parser:README</type>
  <baseType>core:ReadMe</baseType>
  <is>Reading entry for the Parser compiler library</is>

  <documentation>
    The @blockml/parser package converts BML XML to BomDocument (Urmodell).
    This library (org.blockml.bml.compiler.parser.*) is the SSOT; TypeScript in
    packages/parser/src/ implements it. Parity tests in packages/parser/test/
    verify BML ↔ TS alignment.

    Start reading at org.blockml.bml.compiler.parser.documentation.Introduction (ReadNext chain).

    Layer separation:
    • org.blockml.bml.bom.* (@blockml/bom) — Urmodell types parser produces
    • org.blockml.bml.compiler.parser.* (this library) — mapping rules and pipeline
    • org.blockml.bml.compiler.serializer.* (@blockml/serializer) — inverse emit
    • org.blockml.bml.definition.* (@blockml/core) — BML meta-model

    Modules: documentation (narrative specs), map (MapContext), config (constants),
    capability (parse + map operations).

    Not in this library: SerializeResult (@blockml/serializer); bomEquals (@blockml/bom).
  </documentation>

  <references>
    <see type="pardocumentation:Introduction" relation="ReadFirst" />
    <see type="pardocumentation:DesignDecisions" relation="SeeAlso" />
    <see type="pardocumentation:PublicApi" relation="SeeAlso" />
    <see type="bomdocumentation:PublicApi" relation="SeeAlso" />
    <see type="serdocumentation:Introduction" relation="SeeAlso" />
  </references>

</block>
`;

writeFileSync(join(blocksRoot, "README.bml"), readme);

const fixturesDir = join(__dirname, "../test/fixtures");
mkdirSync(fixturesDir, { recursive: true });
writeFileSync(
  join(fixturesDir, "parser-schema.json"),
  JSON.stringify(
    {
      blocks: blocks.map((b) => ({
        fqn: fqn(b),
        tsExport: b.name,
        pkg: b.pkg || "root",
        abstract: !!b.abstract,
        baseType: b.baseType ?? "parser:ParserType",
        fields: (b.fields ?? []).map((f) => ({
          name: f.name,
          type: f.type,
          required: !!f.required,
          literal: f.literal,
        })),
      })),
      capabilities: capabilities.map((c) => ({
        name: c.name,
        tsExport: c.name.charAt(0).toLowerCase() + c.name.slice(1),
        fqn: fqn(c),
        inputs: (c.inputs ?? []).map((f) => ({ name: f.name, type: f.type, required: !!f.required })),
        output: c.output ?? null,
      })),
      constants: {
        XSI_NS: "http://www.w3.org/2001/XMLSchema-instance",
        BML_XMLNS: "http://blockml.org/bml",
        TYPE_REFERENCE_ENTITY: "org.blockml.bml.type.TypeReferenceEntity",
        V1_ROOT_ELEMENT: "block",
      },
      mapTimeDiagnosticCodes: MAP_TIME_DIAGNOSTIC_CODES,
      documentationBlocks: documentationBlocks.map((d) => d.name),
    },
    null,
    2,
  ),
);

console.log(
  `Generated ${blocks.length} type blocks + ${capabilities.length} capabilities + ${documentationBlocks.length} documentation blocks + Library.bml + README.bml`,
);
