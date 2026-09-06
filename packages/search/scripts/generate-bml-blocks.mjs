#!/usr/bin/env node
/**
 * One-shot generator for Search BML blocks.
 * Output under blocks/ is the SSOT; this script is a migration aid only.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { documentationBlocks } from "./search-documentation-blocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const blocksRoot = join(__dirname, "../blocks/org/blockml/bml/search");

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
  xmlns:search="org.blockml.bml.search"
  xmlns:searchcap="org.blockml.bml.search.capability"
  xmlns:searchdocumentation="org.blockml.bml.search.documentation"
  xmlns:type="org.blockml.bml.type"`;

/** @typedef {{ name: string, type: string, required?: boolean, doc?: string }} Field */
/** @typedef {{ pkg: string, prefix: string, name: string, is: string, doc: string, abstract?: boolean, baseType?: string, fields?: Field[], refs?: string[] }} BlockDef */
/** @typedef {{ pkg: string, prefix: string, name: string, is: string, doc: string, tsExport?: string, inputs?: Field[], output?: Field, refs?: string[] }} CapabilityDef */

/** @type {BlockDef[]} */
const blocks = [
  {
    pkg: "",
    prefix: "search",
    name: "SearchType",
    is: "Abstract marker for Search implementation data-structure blocks",
    doc: "SearchDocument, SearchResult, and related ValueTypes used as capability payloads.",
    abstract: true,
    baseType: "core:Entity",
    refs: ["bom:UrmodellType"],
  },
  {
    pkg: "",
    prefix: "search",
    name: "SearchDocument",
    is: "Indexed block record derived from BOM",
    doc: "One SearchDocument per TypeRegistry FQN (root and subBlocks). Aliases, keywords, and documentation stay separate fields.",
    baseType: "search:SearchType",
    fields: [
      { name: "id", type: "type:Text", required: true, doc: "Same as fqn." },
      { name: "fqn", type: "type:Text", required: true },
      { name: "name", type: "type:Text", required: true },
      { name: "aliases", type: "type:Text[]", required: true },
      { name: "keywords", type: "type:Text[]", required: true },
      { name: "documentation", type: "type:Text", required: true },
      { name: "file", type: "type:Text", required: true },
      { name: "library", type: "type:Text" },
      { name: "type", type: "type:Text" },
      { name: "baseType", type: "type:Text" },
      { name: "idea", type: "type:Text" },
    ],
  },
  {
    pkg: "",
    prefix: "search",
    name: "SearchResult",
    is: "One ranked hit from search()",
    doc: "Abstracted from Orama hits. Sorted by score descending, then FQN.",
    baseType: "search:SearchType",
    fields: [
      { name: "fqn", type: "type:Text", required: true },
      { name: "name", type: "type:Text", required: true },
      { name: "file", type: "type:Text", required: true },
      { name: "score", type: "type:Number", required: true },
      { name: "library", type: "type:Text" },
    ],
  },
  {
    pkg: "",
    prefix: "search",
    name: "SearchIndexOptions",
    is: "Project and cache location for index operations",
    doc: "rootDir defaults to process.cwd(); srcDir defaults to blocks; indexDir defaults to {rootDir}/.blockml/search.",
    baseType: "search:SearchType",
    fields: [
      { name: "rootDir", type: "type:Text" },
      { name: "srcDir", type: "type:Text" },
      { name: "libraries", type: "type:Text[]" },
      { name: "indexDir", type: "type:Text" },
    ],
  },
  {
    pkg: "",
    prefix: "search",
    name: "SearchOptions",
    is: "SearchIndexOptions plus result limit",
    doc: "limit defaults to 10.",
    baseType: "search:SearchIndexOptions",
    fields: [{ name: "limit", type: "type:Integer" }],
  },
  {
    pkg: "",
    prefix: "search",
    name: "BuildIndexResult",
    is: "In-memory index plus bootstrap diagnostics",
    doc: "Returned by buildIndex, rebuildIndex, and openIndex.",
    baseType: "search:SearchType",
    fields: [
      { name: "index", type: "search:SearchType", required: true, doc: "Opaque SearchIndex handle." },
      { name: "diagnostics", type: "bomcommon:Diagnostic[]", required: true },
      { name: "documents", type: "type:Integer", required: true },
    ],
  },
  {
    pkg: "",
    prefix: "search",
    name: "IndexStatus",
    is: "Presence and freshness of the persisted index",
    doc: "state is missing, ready, or stale.",
    baseType: "search:SearchType",
    fields: [
      { name: "state", type: "type:Text", required: true },
      { name: "documents", type: "type:Integer" },
      { name: "indexDir", type: "type:Text", required: true },
    ],
  },
];

/** @type {CapabilityDef[]} */
const capabilities = [
  {
    pkg: "capability",
    prefix: "searchcap",
    name: "BuildIndex",
    is: "Build an in-memory search index from the validate --all corpus",
    doc: "Calls bootstrapFullProjectRegistry, maps registry FQNs to SearchDocuments, and creates the Orama index. Does not write to disk.",
    tsExport: "buildIndex",
    inputs: [{ name: "options", type: "search:SearchIndexOptions" }],
    output: { name: "result", type: "search:BuildIndexResult", required: true },
    refs: ["fwcap:BootstrapFullProjectRegistry", "searchcap:SaveIndex"],
  },
  {
    pkg: "capability",
    prefix: "searchcap",
    name: "Search",
    is: "Full-text search over the local BML index",
    doc: "Opens a ready index or rebuilds when missing/stale, then searches. Boost: fqn 10, name 8, aliases 6, keywords 6, documentation 1.",
    tsExport: "search",
    inputs: [
      { name: "query", type: "type:Text", required: true },
      { name: "options", type: "search:SearchOptions" },
    ],
    output: { name: "results", type: "search:SearchResult[]", required: true },
    refs: ["searchcap:OpenIndex"],
  },
  {
    pkg: "capability",
    prefix: "searchcap",
    name: "RebuildIndex",
    is: "Full rebuild and persist of the search index",
    tsExport: "rebuildIndex",
    inputs: [{ name: "options", type: "search:SearchIndexOptions" }],
    output: { name: "result", type: "search:BuildIndexResult", required: true },
    refs: ["searchcap:BuildIndex", "searchcap:SaveIndex"],
  },
  {
    pkg: "capability",
    prefix: "searchcap",
    name: "LoadIndex",
    is: "Load a ready persisted index or return undefined",
    tsExport: "loadIndex",
    inputs: [{ name: "options", type: "search:SearchIndexOptions" }],
    output: { name: "index", type: "search:SearchType", doc: "SearchIndex or undefined." },
    refs: ["searchcap:GetIndexStatus"],
  },
  {
    pkg: "capability",
    prefix: "searchcap",
    name: "SaveIndex",
    is: "Persist Orama snapshot and freshness manifest",
    doc: "Writes .blockml/search/orama.json and manifest.json. Cache only; BML remains source of truth.",
    tsExport: "saveIndex",
    inputs: [
      { name: "index", type: "search:SearchType", required: true },
      { name: "options", type: "search:SearchIndexOptions" },
    ],
  },
  {
    pkg: "capability",
    prefix: "searchcap",
    name: "GetIndexStatus",
    is: "Report missing, ready, or stale for the persisted index",
    tsExport: "getIndexStatus",
    inputs: [{ name: "options", type: "search:SearchIndexOptions" }],
    output: { name: "status", type: "search:IndexStatus", required: true },
  },
  {
    pkg: "capability",
    prefix: "searchcap",
    name: "OpenIndex",
    is: "Load a ready index or rebuild when missing or stale",
    tsExport: "openIndex",
    inputs: [{ name: "options", type: "search:SearchIndexOptions" }],
    output: { name: "result", type: "search:BuildIndexResult", required: true },
    refs: ["searchcap:LoadIndex", "searchcap:RebuildIndex"],
  },
];

function escapeXml(s) {
  return String(s)
    .replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;")
    .replace(/</g, "&lt;");
}

function fqn(b) {
  const pkg = b.pkg ? `.${b.pkg}` : "";
  return `org.blockml.bml.search${pkg}.${b.name}`;
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
        const doc =
          base.includes("(required)") || base.includes("(optional)") ? base : `${base}${req}`;
        return `    <${f.name} type="${f.type}">
      <documentation>${escapeXml(doc)}</documentation>
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
      <documentation>${escapeXml(doc)}</documentation>
    </${output.name}>`);
  }
  if (!parts.length) return "";
  return `\n\n  <properties>\n${parts.join("\n")}\n  </properties>`;
}

function renderDocBlock(d) {
  const refs = d.refs?.length
    ? `\n\n  <references>\n${d.refs
        .map((r) => `    <see type="${r.type}" relation="${r.relation}" />`)
        .join("\n")}\n  </references>`
    : "";

  return `<!--
  Search Documentation — ${d.name}
  FQN: org.blockml.bml.search.documentation.${d.name}
-->
<block
${XMLNS}
  xmlns:doc="org.blockml.bml.documentation">

  <name>${d.name}</name>
  <type>searchdocumentation:${d.name}</type>
  <baseType>core:Documentation</baseType>
  <is>${escapeXml(d.is)}</is>

  <documentation>${escapeXml(d.doc)}</documentation>${refs}

</block>
`;
}

function renderBlock(b) {
  const base = b.baseType ?? "search:SearchType";
  const abstract = b.abstract ? "\n\n  <abstract>true</abstract>" : "";
  const refs = b.refs?.length
    ? `\n\n  <references>\n${b.refs.map((r) => `    <see type="${r}" relation="SeeAlso" />`).join("\n")}\n  </references>`
    : "";

  return `<!--
  Search — ${b.name}
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
  Search Capability — ${c.name}
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
  ...documentationBlocks.map((d) => `        <searchdocumentation:${d.name} />`),
  "      </composition>",
].join("\n");

const library = `<!--
  BlockML Search Library Descriptor
  FQN: org.blockml.bml.search.Library
-->
<block
${XMLNS}>

  <name>Library</name>
  <type>search:Library</type>
  <baseType>core:BlockLibrary</baseType>
  <is>The BlockML Search package library catalog</is>

  <documentation>
    Canonical search specification for BlockML — local full-text search over the
    validate --all BML corpus. TypeScript in packages/search/src/ implements this library.
    Membership is defined exclusively by this blocks list.
  </documentation>

  <version>0.8.0</version>

  <language>
    <English />
  </language>

  <properties>
    <description override="true">
      <value>BlockML Search library</value>
    </description>
  </properties>

  <aggregations>
    <readMe override="true">
      <composition>
        <search:README />
      </composition>
    </readMe>
    <dependencies override="true">
      <composition>
        <blockml:Library />
        <bom:Library />
        <framework:Library />
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
  BlockML Search — README
  FQN: org.blockml.bml.search.README
-->
<block
${XMLNS}>

  <name>README</name>
  <type>search:README</type>
  <baseType>core:ReadMe</baseType>
  <is>Reading entry for the Search library</is>

  <documentation>
    The @blockml/search package indexes the effective BML corpus of a project
    (same as blockml validate --all) and serves local full-text search.

    Start at org.blockml.bml.search.documentation.Introduction.
  </documentation>

  <references>
    <see type="searchdocumentation:Introduction" relation="ReadFirst" />
    <see type="searchdocumentation:PublicApi" relation="SeeAlso" />
  </references>

</block>
`;

writeFileSync(join(blocksRoot, "README.bml"), readme);

console.log(
  `Generated ${blocks.length} type blocks + ${capabilities.length} capabilities + ${documentationBlocks.length} documentation blocks + Library.bml + README.bml`,
);
