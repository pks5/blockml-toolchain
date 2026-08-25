#!/usr/bin/env node
/**
 * One-shot generator for Serializer BML blocks.
 * Output under blocks/ is the SSOT; this script is a migration aid only.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { documentationBlocks } from "./serializer-documentation-blocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const blocksRoot = join(__dirname, "../blocks/org/blockml/bml/compiler/serializer");

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
  xmlns:core="org.blockml.bml.core"
  xmlns:def="org.blockml.bml.definition"
  xmlns:serializer="org.blockml.bml.compiler.serializer"
  xmlns:sercap="org.blockml.bml.compiler.serializer.capability"
  xmlns:serconfig="org.blockml.bml.compiler.serializer.config"
  xmlns:serdocumentation="org.blockml.bml.compiler.serializer.documentation"
  xmlns:seremit="org.blockml.bml.compiler.serializer.emit"
  xmlns:type="org.blockml.bml.type"`;

/** @typedef {{ name: string, type: string, required?: boolean, doc?: string, literal?: string }} Field */
/** @typedef {{ pkg: string, prefix: string, name: string, is: string, doc: string, abstract?: boolean, baseType?: string, fields?: Field[], refs?: string[] }} BlockDef */
/** @typedef {{ pkg: string, prefix: string, name: string, is: string, doc: string, inputs?: Field[], output?: Field, refs?: string[] }} CapabilityDef */

/** V1 hardcoded block child emit order — mirrors BlockDefinition.bml + bases (B12). */
const BLOCK_EMIT_ORDER_ENTRIES = [
  "name",
  "type",
  "baseType",
  "is",
  "isNot",
  "version",
  "definition",
  "since",
  "status",
  "summary",
  "documentation",
  "abstract",
  "final",
  "keywords",
  "changelog",
  "examples",
  "references",
  "constraints",
  "aliases",
  "language",
  "genericTypes",
  "contracts",
  "properties",
  "aggregations",
  "associations",
  "capabilities",
  "subBlocks",
  "embeddedBlocks",
  "bml:xml",
];

/** @type {BlockDef[]} */
const blocks = [
  {
    pkg: "",
    prefix: "serializer",
    name: "SerializerType",
    is: "Abstract marker for serializer implementation data-structure blocks",
    doc: "All org.blockml.bml.compiler.serializer.emit.* and .config.* types extend this marker. Distinct from bom:UrmodellType (parse-result data) and core:Capability (operations).",
    abstract: true,
    baseType: "core:Entity",
    refs: ["bom:UrmodellType"],
  },
  {
    pkg: "emit",
    prefix: "seremit",
    name: "EmitContext",
    is: "Per-serialize emit configuration and namespace mode",
    doc: "Created by createEmitContext(). useQName is true when document has BML-semantic prefixed xmlns bindings (B21).",
    fields: [
      { name: "bindings", type: "type:Text", required: true, doc: "Map: prefix → namespace URI from SourceInfo.namespaceBindings." },
      { name: "useQName", type: "type:Boolean", required: true, doc: "true when hasBmlSemanticQNameBindings(bindings)." },
      { name: "indent", type: "type:Integer", required: true, doc: "Pretty-print indent spaces; 0 = compact (B13)." },
    ],
  },
  {
    pkg: "emit",
    prefix: "seremit",
    name: "XmlWriter",
    is: "Indent-aware line-oriented XML text builder",
    doc: "Accumulates output lines with depth-based indentation. Used by all emit capabilities.",
    fields: [
      { name: "indent", type: "type:Integer", required: true, doc: "Spaces per depth level." },
      { name: "depth", type: "type:Integer", required: true, doc: "Current nesting depth for indentation." },
      { name: "lines", type: "type:Text[]", required: true, doc: "Accumulated output lines (TS: private parts[])." },
    ],
  },
  {
    pkg: "config",
    prefix: "serconfig",
    name: "BlockEmitOrder",
    is: "V1 hardcoded canonical <block> child sequence (B12)",
    doc: "Frozen snapshot of Definition member declaration order for Phase A. V2 reads Definition .bml dynamically.",
    fields: [
      { name: "entries", type: "type:Text[]", required: true, doc: "Ordered block child local names / section keys." },
    ],
  },
  {
    pkg: "config",
    prefix: "serconfig",
    name: "SerializerConstants",
    is: "Well-known namespace URIs used during emit",
    doc: "Excluded from BML-semantic QName binding detection (B21/B25).",
    fields: [
      { name: "XSI_NS", type: "type:Text", required: true, doc: "http://www.w3.org/2001/XMLSchema-instance" },
      { name: "BML_XMLNS", type: "type:Text", required: true, doc: "http://blockml.org/bml" },
    ],
  },
];

/** @type {CapabilityDef[]} */
const capabilities = [
  {
    pkg: "capability",
    prefix: "sercap",
    name: "Serialize",
    is: "Public entry: BomDocument → canonical BML XML (B26)",
    doc: "Orchestrates emit pipeline. Emit per B12–B25 / D8–D9. Does not call validator.",
    inputs: [
      { name: "document", type: "bomdoc:BomDocument", required: true },
      { name: "options", type: "bomapi:SerializeOptions", doc: "Default indent=2, xmlDeclaration=false." },
    ],
    output: { name: "result", type: "bomapi:SerializeResult", required: true },
    refs: ["serdocumentation:PublicApi", "bomapi:SerializeOptions", "bomapi:SerializeResult"],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "CreateEmitContext",
    is: "Build EmitContext from namespace bindings and indent",
    doc: "Sets useQName via HasBmlSemanticQNameBindings.",
    inputs: [
      { name: "bindings", type: "type:Text", required: true, doc: "Record<string, string> namespace bindings." },
      { name: "indent", type: "type:Integer", required: true },
    ],
    output: { name: "context", type: "seremit:EmitContext", required: true },
    refs: ["seremit:EmitContext", "sercap:HasBmlSemanticQNameBindings"],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "EmitBlockDefinition",
    is: "Emit full BlockDefinition tree in BLOCK_EMIT_ORDER (B12)",
    doc: "Walks serconfig:BlockEmitOrder; delegates to member/composition/type emit helpers.",
    inputs: [
      { name: "writer", type: "seremit:XmlWriter", required: true },
      { name: "block", type: "bomblock:BlockDefinition", required: true },
      { name: "context", type: "seremit:EmitContext", required: true },
    ],
    refs: ["serconfig:BlockEmitOrder", "serdocumentation:EmitOrder"],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "EmitRootStartTag",
    is: "Emit root <block> opening tag with xmlns and xsi attrs (B25)",
    doc: "Re-emits namespaceBindings, schemaLocation, noNamespaceSchemaLocation from SourceInfo.",
    inputs: [
      { name: "writer", type: "seremit:XmlWriter", required: true },
      { name: "bindings", type: "type:Text", required: true },
      { name: "schemaLocation", type: "type:Text" },
      { name: "noNamespaceSchemaLocation", type: "type:Text" },
    ],
    refs: ["serdocumentation:EmitRules"],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "EmitTypeExpression",
    is: "Serialize TypeExpression to attribute string",
    doc: "Named, union, struct, multiplicity, generic, self refs. Uses FqnToQName when context.useQName.",
    inputs: [
      { name: "expression", type: "bomtype:TypeExpression", required: true },
      { name: "context", type: "seremit:EmitContext", required: true },
    ],
    output: { name: "text", type: "type:Text", required: true },
    refs: ["sercap:FqnToQName", "serdocumentation:EmitRules"],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "EmitCompositionTemplate",
    is: "Emit CompositionTemplate as <composition> element tree",
    inputs: [
      { name: "writer", type: "seremit:XmlWriter", required: true },
      { name: "template", type: "bomcomp:CompositionTemplate", required: true },
      { name: "context", type: "seremit:EmitContext", required: true },
      { name: "wrapInAggregation", type: "type:Text", doc: "Optional aggregation local name wrapper." },
    ],
    refs: ["sercap:EmitCompositionNode"],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "EmitCompositionNode",
    is: "Dispatch emit for a CompositionNode variant",
    inputs: [
      { name: "writer", type: "seremit:XmlWriter", required: true },
      { name: "node", type: "bomcomp:CompositionNode", required: true },
      { name: "context", type: "seremit:EmitContext", required: true },
    ],
    refs: ["sercap:EmitBlockInstance"],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "EmitBlockInstance",
    is: "Emit BlockInstance composition element with member values and directives",
    inputs: [
      { name: "writer", type: "seremit:XmlWriter", required: true },
      { name: "instance", type: "bomcomp:BlockInstance", required: true },
      { name: "context", type: "seremit:EmitContext", required: true },
    ],
    refs: ["sercap:VisibilityPrefix", "sercap:FormatMemberValue"],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "EmitConstraintInstances",
    is: "Emit constraint BlockInstance children",
    inputs: [
      { name: "writer", type: "seremit:XmlWriter", required: true },
      { name: "instances", type: "bomcomp:BlockInstance[]", required: true },
      { name: "context", type: "seremit:EmitContext", required: true },
    ],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "EmitTypeReferenceEntity",
    is: "Emit TypeReferenceEntityInstance element",
    inputs: [
      { name: "writer", type: "seremit:XmlWriter", required: true },
      { name: "entity", type: "bomblock:TypeReferenceEntityInstance", required: true },
      { name: "context", type: "seremit:EmitContext", required: true },
    ],
    refs: ["sercap:FqnToQName"],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "HasBmlSemanticQNameBindings",
    is: "Detect QName-emit mode from namespace bindings (B21)",
    doc: "Returns true when any non-default, non-xsi, non-bml-default binding exists.",
    inputs: [{ name: "bindings", type: "type:Text", required: true }],
    output: { name: "result", type: "type:Boolean", required: true },
    refs: ["serconfig:SerializerConstants", "serdocumentation:EmitRules"],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "FqnToQName",
    is: "Convert resolved FQN to prefixed QName using bindings (B21)",
    doc: "On missing binding in QName mode, emit BML_NAMESPACE_UNBOUND diagnostic.",
    inputs: [
      { name: "fqn", type: "type:Text", required: true },
      { name: "bindings", type: "type:Text", required: true },
    ],
    output: { name: "qname", type: "type:Text", required: true },
    refs: ["serdocumentation:EmitRules", "serdocumentation:Diagnostics"],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "QnameToParts",
    is: "Split prefixed QName into prefix and local name",
    inputs: [{ name: "qname", type: "type:Text", required: true }],
    output: { name: "parts", type: "type:Text", required: true, doc: "{ prefix, local }" },
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "VisibilityPrefix",
    is: "Map visibility enum to XML localName prefix (B14)",
    inputs: [{ name: "visibility", type: "type:Text", doc: "private | protected | public | undefined" }],
    output: { name: "prefix", type: "type:Text", required: true, doc: "__ | _ | (empty)" },
    refs: ["serdocumentation:EmitRules"],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "EscapeAttr",
    is: "Escape string for XML attribute value",
    inputs: [{ name: "value", type: "type:Text", required: true }],
    output: { name: "escaped", type: "type:Text", required: true },
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "EscapeText",
    is: "Escape string for XML text content",
    inputs: [{ name: "value", type: "type:Text", required: true }],
    output: { name: "escaped", type: "type:Text", required: true },
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "NeedsCData",
    is: "Detect whether text requires CDATA wrapping (D8)",
    inputs: [{ name: "text", type: "type:Text", required: true }],
    output: { name: "result", type: "type:Boolean", required: true },
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "EmitCharacterData",
    is: "Emit text or CDATA character data (D8)",
    doc: "Emit text or CDATA character data (D8). Multiline values are written one XmlWriter line each so pretty-print indent applies per line; parse TrimText then recovers the BOM string (B13).",
    inputs: [
      { name: "writer", type: "seremit:XmlWriter", required: true },
      { name: "text", type: "type:Text", required: true },
      { name: "form", type: "type:Text", doc: "text | cdata — from authoredCharacterDataForm." },
    ],
    refs: ["sercap:EscapeText"],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "FormatBoolean",
    is: "Format boolean value as lowercase true/false (B15)",
    inputs: [{ name: "value", type: "type:Boolean", required: true }],
    output: { name: "text", type: "type:Text", required: true },
    refs: ["serdocumentation:EmitRules"],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "FormatMemberValue",
    is: "Format MemberValue for XML attribute emission",
    inputs: [{ name: "value", type: "core:Any", required: true }],
    output: { name: "text", type: "type:Text", required: true },
    refs: ["sercap:FormatBoolean", "sercap:EscapeAttr"],
  },
  {
    pkg: "capability",
    prefix: "sercap",
    name: "ShouldUseQName",
    is: "Alias for HasBmlSemanticQNameBindings on bindings map",
    inputs: [{ name: "bindings", type: "type:Text", required: true }],
    output: { name: "result", type: "type:Boolean", required: true },
    refs: ["sercap:HasBmlSemanticQNameBindings"],
  },
];

function fqn(b) {
  const pkg = b.pkg ? `.${b.pkg}` : "";
  return `org.blockml.bml.compiler.serializer${pkg}.${b.name}`;
}

function docFqn(name) {
  return `org.blockml.bml.compiler.serializer.documentation.${name}`;
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
      <documentation>${doc}</documentation>
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
      <documentation>${doc}</documentation>
    </${f.name}>`;
      }),
    );
  }
  if (output) {
    const req = output.required ? " (required)" : " (optional)";
    const base = output.doc ?? `${output.name}. TS type: ${output.type}.`;
    const doc = base.includes("(required)") || base.includes("(optional)") ? base : `${base}${req}`;
    parts.push(`    <${output.name} type="${output.type}">
      <documentation>${doc}</documentation>
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
  Serializer Documentation — ${d.name}
  FQN: ${docFqn(d.name)}
-->
<block
${XMLNS}
  xmlns:doc="org.blockml.bml.documentation">

  <name>${d.name}</name>
  <type>serdocumentation:${d.name}</type>
  <baseType>core:Documentation</baseType>
  <is>${d.is}</is>

  <documentation>${d.doc}</documentation>${refs}

</block>
`;
}

function renderBlock(b) {
  const base = b.baseType ?? "serializer:SerializerType";
  const abstract = b.abstract ? "\n\n  <abstract>true</abstract>" : "";
  const refs = b.refs?.length
    ? `\n\n  <references>\n${b.refs.map((r) => `    <see type="${r}" relation="SeeAlso" />`).join("\n")}\n  </references>`
    : "";

  return `<!--
  Serializer — ${b.name}
  FQN: ${fqn(b)}
-->
<block
${XMLNS}>

  <name>${b.name}</name>
  <type>${typeRef(b)}</type>
  <baseType>${base}</baseType>
  <is>${b.is}</is>

  <documentation>${b.doc || b.is}</documentation>${refs}${abstract}${renderFields(b.fields)}

</block>
`;
}

function renderCapability(c) {
  const refs = c.refs?.length
    ? `\n\n  <references>\n${c.refs.map((r) => `    <see type="${r}" relation="SeeAlso" />`).join("\n")}\n  </references>`
    : "";

  return `<!--
  Serializer Capability — ${c.name}
  FQN: ${fqn(c)}
-->
<block
${XMLNS}>

  <name>${c.name}</name>
  <type>${typeRef(c)}</type>
  <baseType>core:Capability</baseType>
  <is>${c.is}</is>

  <documentation>${c.doc || c.is}</documentation>${refs}${renderCapabilityFields(c.inputs, c.output)}

</block>
`;
}

function catalogEntry(b) {
  return `        <${typeRef(b)} />`;
}

// BlockEmitOrder gets literal entries injected at render time
const blockEmitOrderBlock = blocks.find((b) => b.name === "BlockEmitOrder");
if (blockEmitOrderBlock) {
  blockEmitOrderBlock.fields = [
    {
      name: "entries",
      type: "type:Text[]",
      required: true,
      doc: `Ordered: ${BLOCK_EMIT_ORDER_ENTRIES.join(", ")}`,
    },
  ];
}

// SerializerConstants literals
const constantsBlock = blocks.find((b) => b.name === "SerializerConstants");
if (constantsBlock) {
  constantsBlock.fields = [
    { name: "XSI_NS", type: "type:Text", required: true, literal: "http://www.w3.org/2001/XMLSchema-instance" },
    { name: "BML_XMLNS", type: "type:Text", required: true, literal: "http://blockml.org/bml" },
  ];
}

// Generate SerializerType + emit/config blocks
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

// Library catalog
const libraryBlocks = [
  "      <composition>",
  ...blocks.map(catalogEntry),
  ...capabilities.map(catalogEntry),
  ...documentationBlocks.map(
    (d) => `        <serdocumentation:${d.name} />`,
  ),
  "      </composition>",
].join("\n");

const library = `<!--
  BlockML Serializer Library Descriptor
  FQN: org.blockml.bml.compiler.serializer.Library
-->
<block
${XMLNS}
  xmlns:bomdocumentation="org.blockml.bml.bom.documentation">

  <name>Library</name>
  <type>serializer:Library</type>
  <baseType>core:BlockLibrary</baseType>
  <is>The BlockML Serializer compiler package library catalog</is>

  <documentation>
    Canonical serializer specification for BlockML — emit rules (B12–B25), emit architecture,
    and serialize() contract. TypeScript in packages/serializer/src/ implements this library.
    Input/output Urmodell types live in org.blockml.bml.bom.* (@blockml/bom).
    Membership is defined exclusively by this blocks list.
  </documentation>

  <version>0.6.0</version>

  <language>
    <English />
  </language>

  <properties>
    <description>
      <value>BlockML Serializer library</value>
    </description>
  </properties>

  <aggregations>
    <readMe>
      <composition>
        <serializer:README />
      </composition>
    </readMe>
    <dependencies>
      <composition>
        <blockml:Library />
      </composition>
      <composition>
        <bom:Library />
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
  BlockML Serializer — README
  FQN: org.blockml.bml.compiler.serializer.README
-->
<block
${XMLNS}
  xmlns:bomdocumentation="org.blockml.bml.bom.documentation">

  <name>README</name>
  <type>blockml:README</type>
  <baseType>core:ReadMe</baseType>
  <is>Reading entry for the Serializer compiler library</is>

  <documentation>
    The @blockml/serializer package converts BomDocument (Urmodell) to canonical BML XML.
    This library (org.blockml.bml.compiler.serializer.*) is the SSOT; TypeScript in
    packages/serializer/src/ implements it. Parity tests in packages/serializer/test/
    verify BML ↔ TS alignment.

    Start reading at org.blockml.bml.compiler.serializer.documentation.Introduction (ReadNext chain).

    Layer separation:
    • org.blockml.bml.bom.* (@blockml/bom) — Urmodell types serializer reads (BomDocument, …)
    • org.blockml.bml.compiler.serializer.* (this library) — emit rules and architecture
    • org.blockml.bml.definition.* (@blockml/core) — BML meta-model (V2 dynamic emit)

    Modules: documentation (narrative specs), emit (internal types), config (constants/order),
    capability (serialize + emit operations).

    Not in this library: ParseResult/ParseOptions (@blockml/parser); bomEquals (@blockml/bom).
  </documentation>

  <references>
    <see type="serdocumentation:Introduction" relation="ReadFirst" />
    <see type="serdocumentation:DesignDecisions" relation="SeeAlso" />
    <see type="serdocumentation:PublicApi" relation="SeeAlso" />
    <see type="bomdocumentation:PublicApi" relation="SeeAlso" />
  </references>

</block>
`;

writeFileSync(join(blocksRoot, "README.bml"), readme);

// Export schema for parity tests
const fixturesDir = join(__dirname, "../test/fixtures");
mkdirSync(fixturesDir, { recursive: true });
writeFileSync(
  join(fixturesDir, "serializer-schema.json"),
  JSON.stringify(
    {
      blocks: blocks.map((b) => ({
        fqn: fqn(b),
        tsExport: b.name,
        pkg: b.pkg || "root",
        abstract: !!b.abstract,
        baseType: b.baseType ?? "serializer:SerializerType",
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
      blockEmitOrder: BLOCK_EMIT_ORDER_ENTRIES,
      constants: {
        XSI_NS: "http://www.w3.org/2001/XMLSchema-instance",
        BML_XMLNS: "http://blockml.org/bml",
      },
      documentationBlocks: documentationBlocks.map((d) => d.name),
    },
    null,
    2,
  ),
);

console.log(
  `Generated ${blocks.length} type blocks + ${capabilities.length} capabilities + ${documentationBlocks.length} documentation blocks + Library.bml + README.bml`,
);
