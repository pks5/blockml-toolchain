#!/usr/bin/env node
/**
 * One-shot generator for LSP BML blocks.
 * Output under blocks/ is the SSOT; this script is a migration aid only.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { documentationBlocks } from "./lsp-documentation-blocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const blocksRoot = join(__dirname, "../blocks/org/blockml/bml/lsp");

const XMLNS = `  xmlns="http://blockml.org/bml"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://blockml.org/bml https://blockml.org/schemas/bml.xsd
                      "
  xmlns:blockml="org.blockml.bml"
  xmlns:bom="org.blockml.bml.bom"
  xmlns:bomapi="org.blockml.bml.bom.api"
  xmlns:bomcommon="org.blockml.bml.bom.common"
  xmlns:bomdoc="org.blockml.bml.bom.document"
  xmlns:core="org.blockml.bml.core"
  xmlns:def="org.blockml.bml.definition"
  xmlns:framework="org.blockml.bml.framework"
  xmlns:fwcap="org.blockml.bml.framework.capability"
  xmlns:fwdocumentation="org.blockml.bml.framework.documentation"
  xmlns:parser="org.blockml.bml.compiler.parser"
  xmlns:serializer="org.blockml.bml.compiler.serializer"
  xmlns:sercap="org.blockml.bml.compiler.serializer.capability"
  xmlns:validator="org.blockml.bml.compiler.validator"
  xmlns:valcap="org.blockml.bml.compiler.validator.capability"
  xmlns:type="org.blockml.bml.type"
  xmlns:lsp="org.blockml.bml.lsp"
  xmlns:lspcap="org.blockml.bml.lsp.capability"
  xmlns:lspdocumentation="org.blockml.bml.lsp.documentation"`;

/** @typedef {{ name: string, type: string, required?: boolean, doc?: string }} Field */
/** @typedef {{ pkg: string, prefix: string, name: string, is: string, doc: string, abstract?: boolean, baseType?: string, refs?: string[] }} BlockDef */
/** @typedef {{ pkg: string, prefix: string, name: string, is: string, doc: string, tsExport?: string, inputs?: Field[], output?: Field, refs?: string[] }} CapabilityDef */

/** @type {BlockDef[]} */
const blocks = [
  {
    pkg: "",
    prefix: "lsp",
    name: "LspType",
    is: "Abstract marker for LSP implementation data-structure blocks",
    doc: "Reserved for future LSP-internal types.",
    abstract: true,
    baseType: "core:Entity",
    refs: ["bom:UrmodellType"],
  },
];

/** @type {CapabilityDef[]} */
const capabilities = [
  {
    pkg: "capability",
    prefix: "lspcap",
    name: "AnalyzeDocument",
    is: "Parse and validate a BML document in workspace context",
    doc: "Editor-neutral analysis: parse(text) then validate with workspace TypeRegistry.",
    tsExport: "analyzeDocument",
    inputs: [
      { name: "text", type: "type:Text", required: true },
      { name: "filePath", type: "type:Text", required: true },
      { name: "workspace", type: "lsp:WorkspaceState", required: true },
    ],
    output: { name: "result", type: "lsp:AnalysisResult", required: true },
    refs: ["lspdocumentation:PublicApi", "valcap:Validate", "parser:Parse"],
  },
  {
    pkg: "capability",
    prefix: "lspcap",
    name: "FormatDocument",
    is: "Parse then serialize a BML document to canonical XML",
    doc: "Editor-neutral format: parse(text) then serialize(). Returns null if parse cannot produce a document.",
    tsExport: "formatDocument",
    inputs: [
      { name: "text", type: "type:Text", required: true },
      { name: "indent", type: "type:Integer" },
      { name: "xmlDeclaration", type: "type:Boolean" },
    ],
    output: { name: "result", type: "type:Text", required: true },
    refs: ["lspdocumentation:PublicApi", "sercap:Serialize", "parser:Parse"],
  },
  {
    pkg: "capability",
    prefix: "lspcap",
    name: "HoverAt",
    is: "XML-token hover at an LSP position",
    doc: "Parse-only (no validator). Classifies the XML token at the cursor (element name, attribute key/value, text). Language tags (name, is, references, properties, …) show documentation from org.blockml.bml.definition.* members via resolveEffectiveMembers. Type QNames show the target TypeRegistry block (is + first documentation). Concrete member tags show that member. Hover range is the token — a whole prefix:Local or dotted FQN, not its parts. Whitespace, comments, and tag punctuation return null. Unknown FQN is still shown. Returns null if parse cannot produce a document.",
    tsExport: "hoverAt",
    inputs: [
      { name: "text", type: "type:Text", required: true },
      { name: "filePath", type: "type:Text", required: true },
      { name: "position", type: "type:Text", required: true, doc: "LSP 0-based Position { line, character }." },
      { name: "workspace", type: "lsp:WorkspaceState", required: true },
    ],
    output: { name: "result", type: "core:Any", required: true, doc: "HoverInfo | null." },
    refs: ["lspdocumentation:PublicApi", "parser:Parse"],
  },
  {
    pkg: "capability",
    prefix: "lspcap",
    name: "DocumentSymbols",
    is: "Hierarchical document outline from the Urmodell",
    doc: "Parse-only (no validator, no TypeRegistry). Walks Block members, subBlocks, and embeddedBlocks into a DocumentSymbol tree. selectionRange equals range. Returns null if parse cannot produce a document.",
    tsExport: "documentSymbols",
    inputs: [
      { name: "text", type: "type:Text", required: true },
      { name: "filePath", type: "type:Text", required: true },
    ],
    output: { name: "result", type: "core:Any", required: true, doc: "OutlineSymbol[] | null." },
    refs: ["lspdocumentation:PublicApi", "parser:Parse"],
  },
  {
    pkg: "capability",
    prefix: "lspcap",
    name: "DefinitionAt",
    is: "Go-to-definition from a type QName via TypeRegistry",
    doc: "Parse-only XML-token hit-test. Resolvable type QNames (prefix:Local, dotted FQN, or unqualified PascalCase in a type slot via implicit namespace) are jump targets. Returns LocationLink[]: originSelectionRange covers the whole QName; target is registry.get(fqn).block.source. Language tags and concrete member tags are not definitions. Unknown FQN, no hit, or no document → null. Disk TypeRegistry only.",
    tsExport: "definitionAt",
    inputs: [
      { name: "text", type: "type:Text", required: true },
      { name: "filePath", type: "type:Text", required: true },
      { name: "position", type: "type:Text", required: true, doc: "LSP 0-based Position { line, character }." },
      { name: "workspace", type: "lsp:WorkspaceState", required: true },
    ],
    output: { name: "result", type: "core:Any", required: true, doc: "LspLocationLink[] | null." },
    refs: ["lspdocumentation:PublicApi", "parser:Parse"],
  },
  {
    pkg: "capability",
    prefix: "lspcap",
    name: "ReferencesAt",
    is: "Find references to a type FQN from an LSP position",
    doc: "Parse-only hit-test, then scan the disk TypeRegistry. Usages: baseTypeSource and member typeFqn. includeDeclaration (default true) also includes the defining block.source. No hit / no document → null. Hit with no usages → empty list. Unsaved buffers are not overlayed into the scan.",
    tsExport: "referencesAt",
    inputs: [
      { name: "text", type: "type:Text", required: true },
      { name: "filePath", type: "type:Text", required: true },
      { name: "position", type: "type:Text", required: true, doc: "LSP 0-based Position { line, character }." },
      { name: "workspace", type: "lsp:WorkspaceState", required: true },
      { name: "includeDeclaration", type: "type:Boolean" },
    ],
    output: { name: "result", type: "core:Any", required: true, doc: "LspLocation[] | null." },
    refs: ["lspdocumentation:PublicApi", "parser:Parse"],
  },
  {
    pkg: "capability",
    prefix: "lspcap",
    name: "StartLanguageServer",
    is: "stdio LSP server entry (bin blockml-lsp)",
    doc: "packages/lsp/dist/server.js — document sync, publishDiagnostics, textDocument/formatting, textDocument/hover, textDocument/documentSymbol, textDocument/definition, and textDocument/references.",
    tsExport: "startLanguageServer",
    refs: ["lspdocumentation:ServerLifecycle"],
  },
];

function fqn(b) {
  const pkg = b.pkg ? `.${b.pkg}` : "";
  return `org.blockml.bml.lsp${pkg}.${b.name}`;
}

function docFqn(name) {
  return `org.blockml.bml.lsp.documentation.${name}`;
}

function typeRef(b) {
  return `${b.prefix}:${b.name}`;
}

function renderCapabilityFields(inputs, output) {
  const parts = [];
  if (inputs?.length) {
    parts.push(
      ...inputs.map((f) => {
        const req = f.required ? " (required)" : " (optional)";
        const base = f.doc ?? `${f.name}. TS type: ${f.type}.`;
        const doc =
          base.includes("(required)") || base.includes("(optional)") ? base : `${base}${req}`;
        return `    <${f.name} type="${f.type}">
      <documentation>${doc}</documentation>
    </${f.name}>`;
      }),
    );
  }
  if (output) {
    const req = output.required ? " (required)" : " (optional)";
    const base = output.doc ?? `${output.name}. TS type: ${output.type}.`;
    const doc =
      base.includes("(required)") || base.includes("(optional)") ? base : `${base}${req}`;
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
        .map((r) => `    <see type="${r.type}" relation="${r.relation}"></see>`)
        .join("\n")}\n  </references>`
    : "";

  return `<!--
  LSP Documentation — ${d.name}
  FQN: ${docFqn(d.name)}
-->
<block
${XMLNS}
  xmlns:doc="org.blockml.bml.documentation">

  <name>${d.name}</name>
  <type>lspdocumentation:${d.name}</type>
  <baseType>core:Documentation</baseType>
  <is>${d.is}</is>

  <documentation>${d.doc}</documentation>${refs}

</block>
`;
}

function renderBlock(b) {
  const base = b.baseType ?? "lsp:LspType";
  const abstract = b.abstract ? "\n\n  <abstract>true</abstract>" : "";
  const refs = b.refs?.length
    ? `\n\n  <references>\n${b.refs.map((r) => `    <see type="${r}" relation="SeeAlso" />`).join("\n")}\n  </references>`
    : "";

  return `<!--
  LSP — ${b.name}
  FQN: ${fqn(b)}
-->
<block
${XMLNS}>

  <name>${b.name}</name>
  <type>${typeRef(b)}</type>
  <baseType>${base}</baseType>
  <is>${b.is}</is>

  <documentation>${b.doc || b.is}</documentation>${refs}${abstract}

</block>
`;
}

function renderCapability(c) {
  const refs = c.refs?.length
    ? `\n\n  <references>\n${c.refs.map((r) => `    <see type="${r}" relation="SeeAlso" />`).join("\n")}\n  </references>`
    : "";

  return `<!--
  LSP Capability — ${c.name}
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
  return `      <composition><${typeRef(b)} /></composition>`;
}

function capabilityTsExport(c) {
  return c.tsExport ?? c.name.charAt(0).toLowerCase() + c.name.slice(1);
}

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
  ...blocks.map(catalogEntry),
  ...capabilities.map(catalogEntry),
  ...documentationBlocks.map(
    (d) => `      <composition><lspdocumentation:${d.name} /></composition>`,
  ),
].join("\n");

const library = `<!--
  BlockML LSP Library Descriptor
  FQN: org.blockml.bml.lsp.Library
-->
<block
${XMLNS}
  xmlns:bomdocumentation="org.blockml.bml.bom.documentation"
  xmlns:valdocumentation="org.blockml.bml.compiler.validator.documentation">

  <name>Library</name>
  <type>lsp:Library</type>
  <baseType>core:BlockLibrary</baseType>
  <is>The BlockML Language Server package library catalog</is>

  <documentation>
    Canonical LSP specification for BlockML IDE integration — editor-agnostic language
    service and stdio server. TypeScript in packages/lsp/src/ implements this library.
    Membership is defined exclusively by this blocks list.
  </documentation>

  <version>0.4.0</version>

  <language>
    <English />
  </language>

  <properties>
    <description>
      <value>BlockML Language Server library</value>
    </description>
  </properties>

  <aggregations>
    <readMe>
      <composition>
        <lsp:README />
      </composition>
    </readMe>
    <dependencies>
      <composition>
        <blockml:Library />
      </composition>
      <composition>
        <bom:Library />
      </composition>
      <composition>
        <parser:Library />
      </composition>
      <composition>
        <validator:Library />
      </composition>
      <composition>
        <framework:Library />
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
  BlockML LSP — README
  FQN: org.blockml.bml.lsp.README
-->
<block
${XMLNS}
  xmlns:bomdocumentation="org.blockml.bml.bom.documentation">

  <name>README</name>
  <type>blockml:README</type>
  <baseType>core:ReadMe</baseType>
  <is>Reading entry for the LSP library</is>

  <documentation>
    The @blockml/lsp package provides an editor-agnostic Language Server for BML (stdio).
    IDE clients (VS Code extension, etc.) connect via LSP; grammar and file associations
    stay in IDE-specific packages.

    Start at org.blockml.bml.lsp.documentation.Introduction.

    Bin: blockml-lsp → packages/lsp/dist/server.js
  </documentation>

  <references>
    <see type="lspdocumentation:Introduction" relation="ReadFirst" />
    <see type="lspdocumentation:PublicApi" relation="SeeAlso" />
  </references>

</block>
`;

writeFileSync(join(blocksRoot, "README.bml"), readme);

const fixturesDir = join(__dirname, "../test/fixtures");
mkdirSync(fixturesDir, { recursive: true });
writeFileSync(
  join(fixturesDir, "lsp-schema.json"),
  JSON.stringify(
    {
      blocks: blocks.map((b) => ({
        fqn: fqn(b),
        tsExport: b.name,
        pkg: b.pkg || "root",
        abstract: !!b.abstract,
        baseType: b.baseType ?? "lsp:LspType",
      })),
      capabilities: capabilities.map((c) => ({
        name: c.name,
        tsExport: capabilityTsExport(c),
        fqn: fqn(c),
        inputs: (c.inputs ?? []).map((f) => ({
          name: f.name,
          type: f.type,
          required: !!f.required,
        })),
        output: c.output ?? null,
      })),
      documentationBlocks: documentationBlocks.map((d) => d.name),
    },
    null,
    2,
  ),
);

console.log(
  `Generated ${blocks.length} type blocks + ${capabilities.length} capabilities + ${documentationBlocks.length} documentation blocks + Library.bml + README.bml`,
);
