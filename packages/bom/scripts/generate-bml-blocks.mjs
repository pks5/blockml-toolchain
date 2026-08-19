#!/usr/bin/env node
/**
 * One-shot generator for BOM Urmodell BML blocks.
 * Output under blocks/ is the SSOT; this script is a migration aid only.
 */
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { documentationBlocks } from "./bom-documentation-blocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const blocksRoot = join(__dirname, "../blocks/org/blockml/bml/bom");

const XMLNS = `  xmlns="http://blockml.org/bml"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://blockml.org/bml https://blockml.org/schemas/bml.xsd
                      "
  xmlns:blockml="org.blockml.bml"
  xmlns:bom="org.blockml.bml.bom"
  xmlns:bomapi="org.blockml.bml.bom.api"
  xmlns:bomblock="org.blockml.bml.bom.block"
  xmlns:bomcap="org.blockml.bml.bom.capability"
  xmlns:bomcommon="org.blockml.bml.bom.common"
  xmlns:bomcomp="org.blockml.bml.bom.composition"
  xmlns:bomdoc="org.blockml.bml.bom.document"
  xmlns:bomdocumentation="org.blockml.bml.bom.documentation"
  xmlns:bommember="org.blockml.bml.bom.member"
  xmlns:bomtype="org.blockml.bml.bom.type"
  xmlns:bomvalue="org.blockml.bml.bom.value"
  xmlns:core="org.blockml.bml.core"
  xmlns:def="org.blockml.bml.definition"
  xmlns:type="org.blockml.bml.type"`;

/** @typedef {{ name: string, type: string, required?: boolean, doc?: string, literal?: string }} Field */
/** @typedef {{ pkg: string, prefix: string, name: string, is: string, doc: string, abstract?: boolean, baseType?: string, fields?: Field[], kind?: string, refs?: string[], aliases?: string[] }} BlockDef */

/** @type {BlockDef[]} */
const blocks = [
  // Root
  {
    pkg: "",
    prefix: "bom",
    name: "UrmodellType",
    is: "Abstract marker for BOM Urmodell data-structure blocks",
    doc: "All org.blockml.bml.bom.* Urmodell types extend this abstract marker. These blocks describe parse-result data structures (Canonical BOM), not BML authoring grammar. Contrast with org.blockml.bml.definition.* (meta-model in @blockml/core).",
    abstract: true,
    baseType: "core:Entity",
    refs: ["def:BlockDefinition"],
  },

  // common
  {
    pkg: "common",
    prefix: "bomcommon",
    name: "SourceLocation",
    is: "BML source span for diagnostics and LSP",
    doc: "Optional provenance attached by the parser. Stripped by stripProvenance() for B20 equality.",
    fields: [
      { name: "file", type: "type:Text", required: true },
      { name: "line", type: "type:Integer", required: true },
      { name: "column", type: "type:Integer", required: true },
      { name: "endLine", type: "type:Integer" },
      { name: "endColumn", type: "type:Integer" },
    ],
  },
  {
    pkg: "common",
    prefix: "bomcommon",
    name: "SourceInfo",
    is: "Parse metadata for a BomDocument",
    doc: "Document-level source metadata. namespaceBindings preserves authored xmlns order (B21).",
    fields: [
      { name: "filePath", type: "type:Text", required: true },
      { name: "format", type: "type:Text", required: true, doc: 'Always "xml" for authoring.' },
      { name: "namespaceBindings", type: "type:Text", doc: "Map: prefix key (\"\" = default xmlns) → namespace identifier." },
      { name: "schemaLocation", type: "type:Text" },
      { name: "noNamespaceSchemaLocation", type: "type:Text" },
    ],
  },
  {
    pkg: "common",
    prefix: "bomcommon",
    name: "XmlTrivia",
    is: "XML comment trivia bound to an element (B11)",
    doc: "Comment bodies only — without <!-- / -->. Bound to the following XML element.",
    fields: [
      { name: "leadingComments", type: "type:Text[]" },
      { name: "trailingComments", type: "type:Text[]" },
    ],
  },
  {
    pkg: "common",
    prefix: "bomcommon",
    name: "MemberSectionName",
    is: "Member container section identifier",
    doc: 'String-literal union: "properties" | "aggregations" | "associations" | "capabilities".',
    fields: [{ name: "value", type: "type:Text", required: true }],
  },
  {
    pkg: "common",
    prefix: "bomcommon",
    name: "MetadataElementTrivia",
    is: "XML trivia keyed by metadata child localName",
    doc: "Map: metadata element localName → XmlTrivia.",
    fields: [{ name: "entries", type: "bomcommon:XmlTrivia", doc: "Record<string, XmlTrivia>." }],
  },
  {
    pkg: "common",
    prefix: "bomcommon",
    name: "XmlNodeKind",
    is: "XML node placement kind",
    doc: 'String-literal union: "attribute" | "element" | "text".',
    fields: [{ name: "value", type: "type:Text", required: true }],
  },
  {
    pkg: "common",
    prefix: "bomcommon",
    name: "CharacterDataForm",
    is: "Authored character data form (D8)",
    doc: 'String-literal union: "text" | "cdata".',
    fields: [{ name: "value", type: "type:Text", required: true }],
  },
  {
    pkg: "common",
    prefix: "bomcommon",
    name: "XmlRenderingBlock",
    is: "Block-level bml:xml rendering recipe",
    doc: "First-class xmlRendering — not flow-control directives[]. Lossless raw body.",
    fields: [{ name: "raw", type: "type:Text", required: true }],
  },
  {
    pkg: "common",
    prefix: "bomcommon",
    name: "XmlRenderingMember",
    is: "Member-level bml:xml rendering hints",
    doc: "Lossless raw value plus emit hints for dual placement (D9) and CDATA form (D8).",
    fields: [
      { name: "raw", type: "type:Text" },
      { name: "kinds", type: "bomcommon:XmlNodeKind[]", required: true },
      { name: "authoredPlacement", type: "bomcommon:XmlNodeKind" },
      { name: "authoredCharacterDataForm", type: "bomcommon:CharacterDataForm" },
    ],
  },
  {
    pkg: "common",
    prefix: "bomcommon",
    name: "DiagnosticSeverity",
    is: "Compiler diagnostic severity",
    doc: 'String-literal union: "error" | "warning" | "info". Distinct from org.blockml.bml.core.Diagnostic BML branch.',
    fields: [{ name: "value", type: "type:Text", required: true }],
  },
  {
    pkg: "common",
    prefix: "bomcommon",
    name: "Diagnostic",
    is: "Compiler result diagnostic (B26)",
    doc: "Shared with ParseResult and SerializeResult. Distinct from org.blockml.bml.core.Diagnostic.",
    fields: [
      { name: "severity", type: "bomcommon:DiagnosticSeverity", required: true },
      { name: "code", type: "type:Text", required: true },
      { name: "message", type: "type:Text", required: true },
      { name: "source", type: "bomcommon:SourceLocation", required: true },
    ],
  },

  // value
  {
    pkg: "value",
    prefix: "bomvalue",
    name: "Address",
    is: "Parsed org.blockml.bml.type.Address shape",
    doc: "BOM projection of Address ValueType — see @blockml/core type/Address.bml.",
    fields: [
      { name: "raw", type: "type:Text", required: true },
      { name: "scheme", type: "type:Text", required: true, doc: "string | null in TS — required field, nullable value." },
      { name: "path", type: "type:Text", required: true },
      { name: "isAbsolute", type: "type:Boolean", required: true },
      { name: "isRelative", type: "type:Boolean", required: true },
      { name: "isExpression", type: "type:Boolean", required: true },
    ],
  },
  {
    pkg: "value",
    prefix: "bomvalue",
    name: "MemberValue",
    is: "Abstract union of authored member values",
    doc: "Discriminated union: LiteralValue | ExpressionValue | AddressValue.",
    abstract: true,
  },
  {
    pkg: "value",
    prefix: "bomvalue",
    name: "LiteralValue",
    is: "Authored literal member value",
    doc: "value field is opaque (unknown) — MUST NOT be normalized at parse time (lossless roundtrip).",
    baseType: "bomvalue:MemberValue",
    kind: "literal",
    fields: [
      { name: "kind", type: "type:Text", required: true, literal: "literal" },
      { name: "value", type: "core:Any", required: true, doc: "Authored value exactly as in BML — opaque." },
      { name: "typeFqn", type: "type:Text", required: true },
      { name: "authoredPlacement", type: "type:Text", doc: '"attribute" | "element" when dual placement legal (D9).' },
    ],
  },
  {
    pkg: "value",
    prefix: "bomvalue",
    name: "ExpressionValue",
    is: "Authored ${…} expression member value",
    doc: "raw is the only expression field in Canonical BOM. AST via parseExpression() utility — not stored.",
    baseType: "bomvalue:MemberValue",
    kind: "expression",
    fields: [
      { name: "kind", type: "type:Text", required: true, literal: "expression" },
      { name: "raw", type: "type:Text", required: true },
      { name: "authoredPlacement", type: "type:Text" },
      { name: "source", type: "bomcommon:SourceLocation" },
    ],
  },
  {
    pkg: "value",
    prefix: "bomvalue",
    name: "AddressValue",
    is: "Parsed Address member value",
    baseType: "bomvalue:MemberValue",
    kind: "address",
    fields: [
      { name: "kind", type: "type:Text", required: true, literal: "address" },
      { name: "address", type: "bomvalue:Address", required: true },
    ],
  },

  // type
  {
    pkg: "type",
    prefix: "bomtype",
    name: "Multiplicity",
    is: "Collection multiplicity on a type reference",
    fields: [
      { name: "min", type: "type:Integer", required: true },
      { name: "max", type: "type:Text", required: true, doc: 'number or "*".' },
    ],
  },
  {
    pkg: "type",
    prefix: "bomtype",
    name: "InstanceConfiguration",
    is: "ValueType instance configuration on a type reference",
    fields: [
      { name: "named", type: "type:Text", doc: "Map: ValueType property name → LiteralValue | ExpressionValue." },
      { name: "positional", type: "bomvalue:MemberValue[]" },
    ],
  },
  {
    pkg: "type",
    prefix: "bomtype",
    name: "TypeExpression",
    is: "Abstract parse-time type expression union",
    doc: "Not a language ValueType. Parsed at map time into structured AST.",
    abstract: true,
  },
  {
    pkg: "type",
    prefix: "bomtype",
    name: "TypeDescriptor",
    is: "V1 alias for TypeExpression",
    doc: "Alias kept for Capability inputType/outputType. Same shape as TypeExpression.",
    baseType: "bomtype:TypeExpression",
    aliases: ["bomtype:TypeExpression"],
  },
  {
    pkg: "type",
    prefix: "bomtype",
    name: "NamedTypeReference",
    is: "Named type reference expression",
    baseType: "bomtype:TypeExpression",
    kind: "named",
    fields: [
      { name: "kind", type: "type:Text", required: true, literal: "named" },
      { name: "fqn", type: "type:Text", required: true },
      { name: "typeArguments", type: "bomtype:TypeExpression[]" },
      { name: "instanceConfiguration", type: "bomtype:InstanceConfiguration" },
      { name: "multiplicity", type: "bomtype:Multiplicity" },
    ],
  },
  {
    pkg: "type",
    prefix: "bomtype",
    name: "UnionTypeExpression",
    is: "Union type expression",
    baseType: "bomtype:TypeExpression",
    kind: "union",
    fields: [
      { name: "kind", type: "type:Text", required: true, literal: "union" },
      { name: "alternatives", type: "bomtype:TypeExpression[]", required: true },
    ],
  },
  {
    pkg: "type",
    prefix: "bomtype",
    name: "GenericParameterReference",
    is: "Generic parameter reference in type expression",
    baseType: "bomtype:TypeExpression",
    kind: "genericParam",
    fields: [
      { name: "kind", type: "type:Text", required: true, literal: "genericParam" },
      { name: "name", type: "type:Text", required: true },
    ],
  },
  {
    pkg: "type",
    prefix: "bomtype",
    name: "SelfTypeReference",
    is: "Self type reference (bml:Self)",
    baseType: "bomtype:TypeExpression",
    kind: "self",
    fields: [{ name: "kind", type: "type:Text", required: true, literal: "self" }],
  },
  {
    pkg: "type",
    prefix: "bomtype",
    name: "StructField",
    is: "Field in an anonymous struct type expression",
    fields: [
      { name: "name", type: "type:Text", required: true },
      { name: "type", type: "bomtype:TypeExpression", required: true },
    ],
  },
  {
    pkg: "type",
    prefix: "bomtype",
    name: "AnonymousStructType",
    is: "Anonymous struct type expression",
    baseType: "bomtype:TypeExpression",
    kind: "anonymousStruct",
    fields: [
      { name: "kind", type: "type:Text", required: true, literal: "anonymousStruct" },
      { name: "fields", type: "bomtype:StructField[]", required: true },
    ],
  },

  // block
  {
    pkg: "block",
    prefix: "bomblock",
    name: "TypeReferenceEntityInstance",
    is: "BOM shape for TypeReferenceEntity instances",
    doc: 'typeFqn is always "org.blockml.bml.type.TypeReferenceEntity".',
    fields: [
      { name: "typeFqn", type: "type:Text", required: true },
      { name: "value", type: "type:Text", required: true },
      { name: "boundB", type: "type:Text" },
    ],
  },
  {
    pkg: "block",
    prefix: "bomblock",
    name: "GenericType",
    is: "Generic type parameter on a Block definition",
    fields: [
      { name: "name", type: "type:Text", required: true },
      { name: "baseType", type: "type:Text", required: true },
      { name: "defaultType", type: "type:Text" },
    ],
  },
  {
    pkg: "block",
    prefix: "bomblock",
    name: "KeywordEntry",
    is: "Keyword Entity instance in BOM",
    fields: [
      { name: "typeFqn", type: "type:Text", required: true },
      { name: "term", type: "type:Text" },
      { name: "languageFqn", type: "type:Text" },
      { name: "weight", type: "type:Decimal" },
      { name: "source", type: "bomcommon:SourceLocation" },
    ],
  },
  {
    pkg: "block",
    prefix: "bomblock",
    name: "DocumentationProseEntry",
    is: "Documentation or summary prose entry",
    fields: [
      { name: "namespace", type: "type:Text", required: true },
      { name: "text", type: "type:Text", required: true },
      { name: "languageFqn", type: "type:Text", required: true },
      { name: "authoredCharacterDataForm", type: "bomcommon:CharacterDataForm" },
      { name: "source", type: "bomcommon:SourceLocation" },
    ],
  },
  {
    pkg: "block",
    prefix: "bomblock",
    name: "AliasEntry",
    is: "Alias Entity instance in BOM",
    fields: [
      { name: "typeFqn", type: "type:Text", required: true },
      { name: "name", type: "type:Text" },
      { name: "languageFqn", type: "type:Text" },
      { name: "legacy", type: "type:Boolean" },
      { name: "source", type: "bomcommon:SourceLocation" },
    ],
  },
  {
    pkg: "block",
    prefix: "bomblock",
    name: "ChangelogEntry",
    is: "Changelog entry in BOM",
    fields: [
      { name: "version", type: "type:Text", required: true },
      { name: "text", type: "type:Text", required: true },
      { name: "languageFqn", type: "type:Text" },
      { name: "source", type: "bomcommon:SourceLocation" },
    ],
  },
  {
    pkg: "block",
    prefix: "bomblock",
    name: "DocumentationExample",
    is: "Usage example entry in BOM",
    fields: [
      { name: "title", type: "type:Text", required: true },
      { name: "content", type: "type:Text", required: true },
      { name: "authoredCharacterDataForm", type: "bomcommon:CharacterDataForm" },
      { name: "contentLanguageFqn", type: "type:Text" },
      { name: "snippet", type: "type:Boolean" },
      { name: "namespace", type: "type:Text" },
      { name: "source", type: "bomcommon:SourceLocation" },
    ],
  },
  {
    pkg: "block",
    prefix: "bomblock",
    name: "DocumentationReference",
    is: "Cross-reference entry in BOM",
    fields: [
      { name: "type", type: "type:Text" },
      { name: "instance", type: "type:Text" },
      { name: "file", type: "type:Text" },
      { name: "url", type: "type:Text" },
      { name: "property", type: "type:Text" },
      { name: "aggregation", type: "type:Text" },
      { name: "association", type: "type:Text" },
      { name: "capability", type: "type:Text" },
      { name: "relationFqn", type: "type:Text" },
      { name: "context", type: "type:Text", required: true },
      { name: "languageFqn", type: "type:Text" },
      { name: "source", type: "bomcommon:SourceLocation" },
    ],
  },
  {
    pkg: "block",
    prefix: "bomblock",
    name: "BlockDefinition",
    is: "Parse-result shape of a block definition document",
    doc: "Urmodell BlockDefinition — distinct from org.blockml.bml.definition.BlockDefinition (meta-model). Stores declared members only — not inherited. TS: baseType and version optional for corpus compatibility; doc 12 normative future may require them.",
    refs: ["def:BlockDefinition"],
    fields: [
      { name: "name", type: "type:Text", required: true },
      { name: "type", type: "type:Text", required: true },
      { name: "baseType", type: "type:Text" },
      { name: "version", type: "type:Text" },
      { name: "is", type: "type:Text" },
      { name: "summaries", type: "bomblock:DocumentationProseEntry[]" },
      { name: "keywords", type: "bomblock:KeywordEntry[]" },
      { name: "language", type: "bomblock:TypeReferenceEntityInstance" },
      { name: "languageFqn", type: "type:Text" },
      { name: "documentations", type: "bomblock:DocumentationProseEntry[]" },
      { name: "isNot", type: "type:Text", doc: "TS field isNot; BML XML element is isnot." },
      { name: "aliases", type: "bomblock:AliasEntry[]" },
      { name: "since", type: "type:Text" },
      { name: "changelog", type: "bomblock:ChangelogEntry[]" },
      { name: "examples", type: "bomblock:DocumentationExample[]" },
      { name: "references", type: "bomblock:DocumentationReference[]" },
      { name: "abstract", type: "type:Boolean" },
      { name: "final", type: "type:Boolean" },
      { name: "xmlRendering", type: "bomcommon:XmlRenderingBlock" },
      { name: "visibility", type: "type:Text", doc: '"private" | "protected" | "public". Sub-Blocks only.' },
      { name: "contracts", type: "bomblock:TypeReferenceEntityInstance[]" },
      { name: "genericTypes", type: "bomblock:GenericType[]" },
      { name: "definitionFqn", type: "type:Text" },
      { name: "constraints", type: "bomcomp:BlockInstance[]" },
      { name: "members", type: "bommember:MemberDefinition[]", required: true },
      { name: "subBlocks", type: "bomblock:BlockDefinition[]", required: true },
      { name: "embeddedBlocks", type: "bomblock:BlockDefinition[]", required: true },
      { name: "compositions", type: "bomcomp:CompositionTemplate[]", required: true },
      { name: "xmlTrivia", type: "bomcommon:XmlTrivia" },
      { name: "memberSectionTrivia", type: "type:Text", doc: "Partial<Record<MemberSectionName, XmlTrivia>>." },
      { name: "metadataTrivia", type: "bomcommon:MetadataElementTrivia" },
      { name: "source", type: "bomcommon:SourceLocation" },
    ],
  },

  // member
  {
    pkg: "member",
    prefix: "bommember",
    name: "ConstrainableDefinition",
    is: "Mixin shape for constraint Block instances",
    fields: [{ name: "constraints", type: "bomcomp:BlockInstance[]" }],
  },
  {
    pkg: "member",
    prefix: "bommember",
    name: "MemberDefinitionBase",
    is: "Shared base for all member definition kinds",
    fields: [
      { name: "name", type: "type:Text", required: true },
      { name: "summaries", type: "bomblock:DocumentationProseEntry[]" },
      { name: "keywords", type: "bomblock:KeywordEntry[]" },
      { name: "documentations", type: "bomblock:DocumentationProseEntry[]" },
      { name: "since", type: "type:Text" },
      { name: "changelog", type: "bomblock:ChangelogEntry[]" },
      { name: "examples", type: "bomblock:DocumentationExample[]" },
      { name: "references", type: "bomblock:DocumentationReference[]" },
      { name: "namespace", type: "type:Text" },
      { name: "visibility", type: "type:Text" },
      { name: "readOnly", type: "type:Boolean" },
      { name: "abstract", type: "type:Boolean" },
      { name: "final", type: "type:Boolean" },
      { name: "override", type: "type:Boolean" },
      { name: "xmlRendering", type: "bomcommon:XmlRenderingMember" },
      { name: "constraints", type: "bomcomp:BlockInstance[]" },
      { name: "xmlTrivia", type: "bomcommon:XmlTrivia" },
      { name: "source", type: "bomcommon:SourceLocation" },
    ],
  },
  {
    pkg: "member",
    prefix: "bommember",
    name: "MemberDefinition",
    is: "Abstract union of member definition kinds",
    doc: "PropertyDefinition | AggregationDefinition | AssociationDefinition | CapabilityDefinition.",
    abstract: true,
  },
  {
    pkg: "member",
    prefix: "bommember",
    name: "PropertyValueEntry",
    is: "Namespaced property value entry",
    fields: [
      { name: "namespace", type: "type:Text", required: true, doc: '"" = canonical value.' },
      { name: "value", type: "bomvalue:MemberValue", required: true },
    ],
  },
  {
    pkg: "member",
    prefix: "bommember",
    name: "PropertyDefinition",
    is: "Property member definition (kind: property)",
    baseType: "bommember:MemberDefinitionBase",
    kind: "property",
    fields: [
      { name: "kind", type: "type:Text", required: true, literal: "property" },
      { name: "typeFqn", type: "type:Text", required: true },
      { name: "type", type: "bomtype:TypeExpression" },
      { name: "values", type: "bommember:PropertyValueEntry[]" },
      { name: "value", type: "bomvalue:MemberValue" },
      { name: "group", type: "type:Text" },
      { name: "suggestions", type: "bomcomp:BlockInstance[]" },
      { name: "groups", type: "bomblock:TypeReferenceEntityInstance[]" },
    ],
  },
  {
    pkg: "member",
    prefix: "bommember",
    name: "AggregationDefinition",
    is: "Aggregation member definition (kind: aggregation)",
    baseType: "bommember:MemberDefinitionBase",
    kind: "aggregation",
    fields: [
      { name: "kind", type: "type:Text", required: true, literal: "aggregation" },
      { name: "type", type: "bomtype:TypeExpression" },
      { name: "cardinality", type: "type:Text", doc: '"0..1" | "0..n" | "1..1" | "1..n".' },
      { name: "default", type: "type:Boolean" },
      { name: "composition", type: "bomcomp:CompositionTemplate" },
      { name: "groups", type: "bomblock:TypeReferenceEntityInstance[]" },
      { name: "authoredInAggregationsSection", type: "type:Boolean" },
    ],
  },
  {
    pkg: "member",
    prefix: "bommember",
    name: "AssociationDefinition",
    is: "Association member definition (kind: association)",
    baseType: "bommember:MemberDefinitionBase",
    kind: "association",
    fields: [
      { name: "kind", type: "type:Text", required: true, literal: "association" },
      { name: "type", type: "bomtype:TypeExpression", required: true },
      { name: "cardinality", type: "type:Text", required: true, doc: '"0..1" | "0..n".' },
    ],
  },
  {
    pkg: "member",
    prefix: "bommember",
    name: "EmbeddedExpression",
    is: "Embedded expression region in implementation source",
    fields: [
      { name: "raw", type: "type:Text", required: true },
      { name: "start", type: "type:Integer", required: true },
      { name: "end", type: "type:Integer", required: true },
    ],
  },
  {
    pkg: "member",
    prefix: "bommember",
    name: "ImplementationBlock",
    is: "Capability implementation source block",
    fields: [
      { name: "languageFqn", type: "type:Text", required: true },
      { name: "source", type: "type:Text", required: true, doc: "Preserved by stripProvenance — not provenance." },
      { name: "authoredCharacterDataForm", type: "bomcommon:CharacterDataForm" },
      { name: "embeddedExpressions", type: "bommember:EmbeddedExpression[]" },
      { name: "sourceLocation", type: "bomcommon:SourceLocation" },
    ],
  },
  {
    pkg: "member",
    prefix: "bommember",
    name: "CapabilityDefinition",
    is: "Capability member definition (kind: capability)",
    baseType: "bommember:MemberDefinitionBase",
    kind: "capability",
    fields: [
      { name: "kind", type: "type:Text", required: true, literal: "capability" },
      { name: "typeFqn", type: "type:Text", required: true },
      { name: "inputType", type: "bomtype:TypeDescriptor" },
      { name: "outputType", type: "bomtype:TypeDescriptor" },
      { name: "implementation", type: "bommember:ImplementationBlock" },
    ],
  },

  // composition
  {
    pkg: "composition",
    prefix: "bomcomp",
    name: "WithBinding",
    is: "bml:with binding entry",
    fields: [
      { name: "name", type: "type:Text", required: true },
      { name: "value", type: "bomvalue:ExpressionValue", required: true },
    ],
  },
  {
    pkg: "composition",
    prefix: "bomcomp",
    name: "DirectiveAttribute",
    is: "Abstract union of flow-control directives",
    doc: "EachDirective | IfDirective | UnlessDirective | WithDirective. Stored unexpanded.",
    abstract: true,
  },
  {
    pkg: "composition",
    prefix: "bomcomp",
    name: "EachDirective",
    is: "bml:each directive (type: each)",
    baseType: "bomcomp:DirectiveAttribute",
    kind: "each",
    fields: [
      { name: "type", type: "type:Text", required: true, literal: "each" },
      { name: "variables", type: "type:Text[]", required: true },
      { name: "statVariable", type: "type:Text" },
      { name: "collection", type: "bomvalue:ExpressionValue", required: true },
    ],
  },
  {
    pkg: "composition",
    prefix: "bomcomp",
    name: "IfDirective",
    is: "bml:if directive (type: if)",
    baseType: "bomcomp:DirectiveAttribute",
    kind: "if",
    fields: [
      { name: "type", type: "type:Text", required: true, literal: "if" },
      { name: "condition", type: "bomvalue:ExpressionValue", required: true },
    ],
  },
  {
    pkg: "composition",
    prefix: "bomcomp",
    name: "UnlessDirective",
    is: "bml:unless directive (type: unless)",
    baseType: "bomcomp:DirectiveAttribute",
    kind: "unless",
    fields: [
      { name: "type", type: "type:Text", required: true, literal: "unless" },
      { name: "condition", type: "bomvalue:ExpressionValue", required: true },
    ],
  },
  {
    pkg: "composition",
    prefix: "bomcomp",
    name: "WithDirective",
    is: "bml:with directive (type: with)",
    baseType: "bomcomp:DirectiveAttribute",
    kind: "with",
    fields: [
      { name: "type", type: "type:Text", required: true, literal: "with" },
      { name: "bindings", type: "bomcomp:WithBinding[]", required: true },
    ],
  },
  {
    pkg: "composition",
    prefix: "bomcomp",
    name: "BlockInstance",
    is: "Concrete child block in a composition",
    fields: [
      { name: "typeFqn", type: "type:Text", required: true },
      { name: "id", type: "bomvalue:MemberValue" },
      { name: "version", type: "bomvalue:MemberValue" },
      { name: "bean", type: "bomvalue:MemberValue" },
      { name: "scope", type: "type:Text", doc: '"local" | "context".' },
      { name: "basePresets", type: "type:Text" },
      { name: "renderGroup", type: "type:Text" },
      { name: "namespace", type: "type:Text" },
      { name: "memberValues", type: "type:Text", required: true, doc: "Record<string, MemberValue>." },
      { name: "aggregationCompositions", type: "bomcomp:InstanceAggregationComposition[]" },
      { name: "xmlTrivia", type: "bomcommon:XmlTrivia" },
      { name: "source", type: "bomcommon:SourceLocation" },
    ],
  },
  {
    pkg: "composition",
    prefix: "bomcomp",
    name: "CompositionTemplate",
    is: "Composition tree for an aggregation",
    fields: [
      { name: "aggregationName", type: "type:Text", required: true },
      { name: "directives", type: "bomcomp:DirectiveAttribute[]" },
      { name: "children", type: "bomcomp:CompositionNode[]", required: true },
      { name: "source", type: "bomcommon:SourceLocation" },
    ],
  },
  {
    pkg: "composition",
    prefix: "bomcomp",
    name: "InstanceAggregationComposition",
    is: "Inline aggregation composition on a Block instance",
    fields: [
      { name: "aggregationName", type: "type:Text", required: true },
      { name: "composition", type: "bomcomp:CompositionTemplate", required: true },
    ],
  },
  {
    pkg: "composition",
    prefix: "bomcomp",
    name: "CompositionNode",
    is: "Abstract union of composition tree nodes",
    doc: "BlockInstanceNode | VirtualContainerNode.",
    abstract: true,
  },
  {
    pkg: "composition",
    prefix: "bomcomp",
    name: "BlockInstanceNode",
    is: "Composition node wrapping a BlockInstance (kind: blockInstance)",
    baseType: "bomcomp:CompositionNode",
    kind: "blockInstance",
    fields: [
      { name: "kind", type: "type:Text", required: true, literal: "blockInstance" },
      { name: "instance", type: "bomcomp:BlockInstance", required: true },
      { name: "directives", type: "bomcomp:DirectiveAttribute[]" },
      { name: "source", type: "bomcommon:SourceLocation" },
    ],
  },
  {
    pkg: "composition",
    prefix: "bomcomp",
    name: "VirtualContainerNode",
    is: "Virtual bml:container node (kind: virtualContainer)",
    baseType: "bomcomp:CompositionNode",
    kind: "virtualContainer",
    fields: [
      { name: "kind", type: "type:Text", required: true, literal: "virtualContainer" },
      { name: "directives", type: "bomcomp:DirectiveAttribute[]" },
      { name: "children", type: "bomcomp:CompositionNode[]", required: true },
      { name: "source", type: "bomcommon:SourceLocation" },
    ],
  },

  // document
  {
    pkg: "document",
    prefix: "bomdoc",
    name: "BomDocument",
    is: "Root Urmodell document — every parsed BML file",
    doc: "Immutable after parse or BomBuilder.seal(). kind is always \"block\" in V1.",
    examples: [
      {
        title: "Calibrator reference shape",
        body: "Reference BomDocument from com.machineblocks.bml.calibration.Calibrator. Root BlockDefinition with declared members, subBlocks (Utils, Base, StudDiameter, …), and compositions from _utils/_parts aggregations. Inherited native properties are NOT in members[].",
      },
    ],
    fields: [
      { name: "kind", type: "type:Text", required: true, doc: 'V1: always "block".' },
      { name: "source", type: "bomcommon:SourceInfo", required: true },
      { name: "block", type: "bomblock:BlockDefinition", required: true },
    ],
  },

  // api
  {
    pkg: "api",
    prefix: "bomapi",
    name: "ParseOptions",
    is: "Options for parse() (B26)",
    fields: [
      { name: "filePath", type: "type:Text", doc: 'Default: "<memory>".' },
      { name: "continueOnError", type: "type:Boolean", doc: "Default: true." },
    ],
  },
  {
    pkg: "api",
    prefix: "bomapi",
    name: "SerializeOptions",
    is: "Options for serialize() (B26)",
    fields: [
      { name: "indent", type: "type:Integer", doc: "Default: 2. 0 = compact (B13)." },
      { name: "xmlDeclaration", type: "type:Boolean", doc: "Default: false (B17/B24)." },
    ],
  },
  {
    pkg: "api",
    prefix: "bomapi",
    name: "ParseResult",
    is: "Result of parse() (B26)",
    fields: [
      { name: "document", type: "bomdoc:BomDocument", required: true, doc: "BomDocument | null — null on hard fail." },
      { name: "diagnostics", type: "bomcommon:Diagnostic[]", required: true },
      { name: "success", type: "type:Boolean", required: true },
    ],
  },
  {
    pkg: "api",
    prefix: "bomapi",
    name: "SerializeResult",
    is: "Result of serialize() (B26)",
    fields: [
      { name: "text", type: "type:Text", required: true, doc: "string | null — null if serialize cannot produce text." },
      { name: "diagnostics", type: "bomcommon:Diagnostic[]", required: true },
      { name: "success", type: "type:Boolean", required: true },
    ],
  },

  // capability
  {
    pkg: "capability",
    prefix: "bomcap",
    name: "StripProvenance",
    is: "Deep-clone omitting provenance keys (B20)",
    doc: "Removes sourceLocation, endLine, endColumn, and provenance source/SourceInfo fields recursively. Preserves ImplementationBlock.source (implementation code body). Reference: packages/bom/src/equals.ts.",
    baseType: "core:Capability",
    fields: [
      { name: "input", type: "core:Any", required: true },
      { name: "output", type: "core:Any", required: true },
    ],
  },
  {
    pkg: "capability",
    prefix: "bomcap",
    name: "BomEquals",
    is: "Structural equality modulo provenance (B20)",
    doc: "deepEqual(stripProvenance(a), stripProvenance(b)). Roundtrip gate for BML → BOM → BML tests.",
    baseType: "core:Capability",
    fields: [
      { name: "inputA", type: "bomdoc:BomDocument", required: true },
      { name: "inputB", type: "bomdoc:BomDocument", required: true },
      { name: "output", type: "type:Boolean", required: true },
    ],
  },
];

function fqn(b) {
  return b.pkg ? `org.blockml.bml.bom.${b.pkg}.${b.name}` : `org.blockml.bml.bom.${b.name}`;
}

function typeRef(b) {
  return `${b.prefix}:${b.name}`;
}

function renderFields(fields) {
  if (!fields?.length) return "";
  const props = fields
    .map((f) => {
      const req = f.required ? " (required)" : " (optional)";
      const doc = f.doc ? `${f.doc}${req}` : `${f.name}${req}. TS type: ${f.type}.`;
      const value = f.literal ? `\n      <value>${f.literal}</value>` : "";
      return `    <${f.name} type="${f.type}">
      <documentation>${doc}</documentation>${value}
    </${f.name}>`;
    })
    .join("\n");
  return `\n\n  <properties>\n${props}\n  </properties>`;
}

function docFqn(name) {
  return `org.blockml.bml.bom.documentation.${name}`;
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
  BOM Documentation — ${d.name}
  FQN: ${docFqn(d.name)}
-->
<block
${XMLNS}
  xmlns:doc="org.blockml.bml.documentation">

  <name>${d.name}</name>
  <type>bomdocumentation:${d.name}</type>
  <baseType>core:Documentation</baseType>
  <is>${d.is}</is>

  <documentation>${d.doc}</documentation>${refs}

</block>
`;
}

function renderBlock(b) {
  const base = b.baseType ?? "bom:UrmodellType";
  const abstract = b.abstract ? "\n\n  <abstract>true</abstract>" : "";
  const refs = b.refs?.length
    ? `\n\n  <references>\n${b.refs.map((r) => `    <see type="${r}" relation="SeeAlso" />`).join("\n")}\n  </references>`
    : "";
  const aliases = b.aliases?.length
    ? `\n\n  <aliases>\n${b.aliases.map((a) => `    <alias type="${a}" />`).join("\n")}\n  </aliases>`
    : "";
  const examples = b.examples?.length
    ? `\n\n  <examples>\n${b.examples.map((ex) => `    <example title="${ex.title}">${ex.body}</example>`).join("\n")}\n  </examples>`
    : "";

  return `<!--
  BOM Urmodell — ${b.name}
  FQN: ${fqn(b)}
-->
<block
${XMLNS}>

  <name>${b.name}</name>
  <type>${typeRef(b)}</type>
  <baseType>${base}</baseType>
  <is>${b.is}</is>

  <documentation>${b.doc || b.is}</documentation>${refs}${aliases}${examples}${abstract}${renderFields(b.fields)}

</block>
`;
}

function catalogEntry(b) {
  return `      <composition><${typeRef(b)} /></composition>`;
}

// Generate Urmodell block files
for (const b of blocks) {
  const dir = b.pkg ? join(blocksRoot, b.pkg) : blocksRoot;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${b.name}.bml`), renderBlock(b));
}

// Generate documentation block files
const docDir = join(blocksRoot, "documentation");
mkdirSync(docDir, { recursive: true });
for (const d of documentationBlocks) {
  writeFileSync(join(docDir, `${d.name}.bml`), renderDocBlock(d));
}

// Remove legacy rules/ stubs superseded by documentation/
const rulesDir = join(blocksRoot, "rules");
try {
  rmSync(rulesDir, { recursive: true, force: true });
} catch {
  /* ignore */
}

// Library catalog
const libraryBlocks = [
  ...blocks.map(catalogEntry),
  ...documentationBlocks.map(
    (d) => `      <composition><bomdocumentation:${d.name} /></composition>`,
  ),
].join("\n");

const library = `<!--
  BlockML BOM Library Descriptor
  FQN: org.blockml.bml.bom.Library
-->
<block
${XMLNS}
  xmlns:cap="org.blockml.bml.capability">

  <name>Library</name>
  <type>blockml:Library</type>
  <baseType>core:BlockLibrary</baseType>
  <is>The BlockML BOM Urmodell library catalog</is>

  <documentation>
    Canonical BOM object model (Urmodell) for BlockML — TypeScript contracts in packages/bom/src/
    implement this library. Consumed by parser, serializer, validator, compiler, and LSP.
    Distinct from org.blockml.bml.definition.* (BML meta-model in @blockml/core).
    Membership is defined exclusively by this blocks list.
  </documentation>

  <version>0.1.0</version>

  <language>
    <English />
  </language>

  <properties>
    <description>
      <value>BlockML BOM Urmodell library</value>
    </description>
  </properties>

  <aggregations>
    <readMe>
      <composition>
        <bom:README />
      </composition>
    </readMe>
    <dependencies>
      <composition>
        <blockml:Library />
      </composition>
    </dependencies>
    <blocks>
${libraryBlocks}
    </blocks>
  </aggregations>

</block>
`;

writeFileSync(join(blocksRoot, "Library.bml"), library);

const readme = `<!--
  BlockML BOM — README
  FQN: org.blockml.bml.bom.README
-->
<block
${XMLNS}>

  <name>README</name>
  <type>blockml:README</type>
  <baseType>core:ReadMe</baseType>
  <is>Reading entry for the BOM Urmodell library</is>

  <documentation>
    The @blockml/bom package owns the Canonical BOM (Urmodell) — lossless, immutable parse results.
    This library (org.blockml.bml.bom.*) is the SSOT; TypeScript in packages/bom/src/ implements it.
    Parity tests in packages/bom/test/ verify BML ↔ TS alignment.

    Start reading at org.blockml.bml.bom.documentation.Introduction (ReadNext chain).

    Layer separation:
    • org.blockml.bml.definition.* (@blockml/core) — BML meta-model (what block documents mean)
    • org.blockml.bml.bom.* (this library) — parse-result data structures (BomDocument graph)

    Modules: documentation (narrative specs), common, block, member, composition, type, value,
    document (BomDocument root), api (B26), capability (bomEquals).

    Not in this library: EffectiveMemberSet, TypeRegistry (@blockml/core); BML→BOM mapping (@blockml/parser).
  </documentation>

  <references>
    <see type="bomdocumentation:Introduction" relation="ReadFirst" />
    <see type="bomdocumentation:DesignDecisions" relation="SeeAlso" />
    <see type="bomdocumentation:ValidationResponsibilities" relation="SeeAlso" />
    <see type="def:BlockDefinition" relation="SeeAlso" />
  </references>

</block>
`;

writeFileSync(join(blocksRoot, "README.bml"), readme);

// Export schema for parity tests
const fixturesDir = join(__dirname, "../test/fixtures");
mkdirSync(fixturesDir, { recursive: true });
writeFileSync(
  join(fixturesDir, "urmodell-schema.json"),
  JSON.stringify(
    {
      blocks: blocks.map((b) => ({
        fqn: fqn(b),
        tsExport: b.name,
        pkg: b.pkg || "root",
        abstract: !!b.abstract,
        baseType: b.baseType ?? "bom:UrmodellType",
        kind: b.kind,
        fields: (b.fields ?? []).map((f) => ({
          name: f.name,
          type: f.type,
          required: !!f.required,
          literal: f.literal,
        })),
      })),
      capabilities: ["bomEquals", "stripProvenance"],
      typeAliases: {
        TypeDescriptor: "TypeExpression",
        MemberSectionName: "string-literal-union",
        MetadataElementTrivia: "Record<string, XmlTrivia>",
        XmlNodeKind: "string-literal-union",
        CharacterDataForm: "string-literal-union",
        DiagnosticSeverity: "string-literal-union",
      },
      unions: {
        MemberDefinition: ["PropertyDefinition", "AggregationDefinition", "AssociationDefinition", "CapabilityDefinition"],
        TypeExpression: ["NamedTypeReference", "UnionTypeExpression", "GenericParameterReference", "SelfTypeReference", "AnonymousStructType"],
        MemberValue: ["LiteralValue", "ExpressionValue", "AddressValue"],
        CompositionNode: ["BlockInstanceNode", "VirtualContainerNode"],
        DirectiveAttribute: ["EachDirective", "IfDirective", "UnlessDirective", "WithDirective"],
      },
    },
    null,
    2,
  ),
);

console.log(
  `Generated ${blocks.length} Urmodell blocks + ${documentationBlocks.length} documentation blocks + Library.bml + README.bml`,
);
