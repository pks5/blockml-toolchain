#!/usr/bin/env node
/**
 * One-shot generator for Validator BML blocks.
 * Output under blocks/ is the SSOT; this script is a migration aid only.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { documentationBlocks } from "./validator-documentation-blocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const blocksRoot = join(__dirname, "../blocks/org/blockml/bml/compiler/validator");

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
  xmlns:type="org.blockml.bml.type"
  xmlns:validator="org.blockml.bml.compiler.validator"
  xmlns:valcap="org.blockml.bml.compiler.validator.capability"
  xmlns:valdocumentation="org.blockml.bml.compiler.validator.documentation"
  xmlns:fwconfig="org.blockml.bml.framework.config"
  xmlns:bomdocumentation="org.blockml.bml.bom.documentation"`;

/** @typedef {{ name: string, type: string, required?: boolean, doc?: string }} Field */
/** @typedef {{ pkg: string, prefix: string, name: string, is: string, doc: string, abstract?: boolean, baseType?: string, refs?: string[] }} BlockDef */
/** @typedef {{ pkg: string, prefix: string, name: string, is: string, doc: string, tsExport?: string, inputs?: Field[], output?: Field, refs?: string[] }} CapabilityDef */

/** @type {BlockDef[]} */
const blocks = [
  {
    pkg: "",
    prefix: "validator",
    name: "ValidatorType",
    is: "Abstract marker for validator implementation data-structure blocks",
    doc: "Reserved for future validator-internal types. Distinct from bom:UrmodellType and core:Capability.",
    abstract: true,
    baseType: "core:Entity",
    refs: ["bom:UrmodellType"],
  },
];

/** @type {CapabilityDef[]} */
const capabilities = [
  {
    pkg: "capability",
    prefix: "valcap",
    name: "Validate",
    is: "Public entry: BomDocument → ValidateResult (B26)",
    doc: "Orchestrates TypeRegistry bootstrap/injection, forkBom, validateTypes, and validateConstraints. Does not mutate input Urmodell.",
    tsExport: "validate",
    inputs: [
      { name: "document", type: "bomdoc:BomDocument", required: true },
      { name: "options", type: "bomapi:ValidateOptions", doc: "Default continueOnError=true." },
    ],
    output: { name: "result", type: "bomapi:ValidateResult", required: true },
    refs: [
      "valdocumentation:PublicApi",
      "bomapi:ValidateOptions",
      "bomapi:ValidateResult",
      "fwcap:ForkBom",
      "fwcap:ValidateTypes",
      "fwcap:ValidateConstraints",
      "fwcap:BootstrapTypeRegistry",
    ],
  },
];

function fqn(b) {
  const pkg = b.pkg ? `.${b.pkg}` : "";
  return `org.blockml.bml.compiler.validator${pkg}.${b.name}`;
}

function docFqn(name) {
  return `org.blockml.bml.compiler.validator.documentation.${name}`;
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
  Validator Documentation — ${d.name}
  FQN: ${docFqn(d.name)}
-->
<block
${XMLNS}
  xmlns:doc="org.blockml.bml.documentation">

  <name>${d.name}</name>
  <type>valdocumentation:${d.name}</type>
  <baseType>core:Documentation</baseType>
  <is>${d.is}</is>

  <documentation>${d.doc}</documentation>${refs}

</block>
`;
}

function renderBlock(b) {
  const base = b.baseType ?? "validator:ValidatorType";
  const abstract = b.abstract ? "\n\n  <abstract>true</abstract>" : "";
  const refs = b.refs?.length
    ? `\n\n  <references>\n${b.refs.map((r) => `    <see type="${r}" relation="SeeAlso" />`).join("\n")}\n  </references>`
    : "";

  return `<!--
  Validator — ${b.name}
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
  Validator Capability — ${c.name}
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
  "      <composition>",
  ...blocks.map(catalogEntry),
  ...capabilities.map(catalogEntry),
  ...documentationBlocks.map(
    (d) => `        <valdocumentation:${d.name} />`,
  ),
  "      </composition>",
].join("\n");

const library = `<!--
  BlockML Validator Library Descriptor
  FQN: org.blockml.bml.compiler.validator.Library
-->
<block
${XMLNS}
  xmlns:bomdocumentation="org.blockml.bml.bom.documentation"
  xmlns:fwdocumentation="org.blockml.bml.framework.documentation">

  <name>Library</name>
  <type>validator:Library</type>
  <baseType>core:BlockLibrary</baseType>
  <is>The BlockML Validator compiler package library catalog</is>

  <documentation>
    Canonical validator specification for BlockML Stage-2 — validate() orchestration
    on BomDocument using @blockml/framework utilities. TypeScript in packages/validator/src/
    implements this library. Urmodell and API types live in org.blockml.bml.bom.*
    (@blockml/bom). Membership is defined exclusively by this blocks list.
  </documentation>

  <version>0.7.1</version>

  <language>
    <English />
  </language>

  <properties>
    <description override="true">
      <value>BlockML Validator library</value>
    </description>
  </properties>

  <aggregations>
    <readMe>
      <composition>
        <validator:README />
      </composition>
    </readMe>
    <dependencies>
      <composition>
        <blockml:Library />
        <bom:Library />
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
  BlockML Validator — README
  FQN: org.blockml.bml.compiler.validator.README
-->
<block
${XMLNS}
  xmlns:bomdocumentation="org.blockml.bml.bom.documentation"
  xmlns:fwdocumentation="org.blockml.bml.framework.documentation">

  <name>README</name>
  <type>validator:README</type>
  <baseType>core:ReadMe</baseType>
  <is>Reading entry for the Validator compiler library</is>

  <documentation>
    The @blockml/validator package validates BomDocument (Urmodell) and returns
    diagnostics plus an optional pragmatic model fork.

    This library (org.blockml.bml.compiler.validator.*) is the SSOT; TypeScript in
    packages/validator/src/ implements it. Parity tests in packages/validator/test/
    verify BML ↔ TS alignment.

    Start reading at org.blockml.bml.compiler.validator.documentation.Introduction (ReadNext chain).

    Layer separation:
    • org.blockml.bml.bom.* (@blockml/bom) — Urmodell types and ValidateOptions/ValidateResult
    • org.blockml.bml.framework.* (@blockml/framework) — TypeRegistry, validation utilities
    • org.blockml.bml.compiler.validator.* (this library) — validate() orchestration

    Modules: documentation (narrative specs), capability (validate entry point).

    Not in this library: validateTypes/validateConstraints implementation (@blockml/framework);
    parse()/serialize() entry points.
  </documentation>

  <references>
    <see type="valdocumentation:Introduction" relation="ReadFirst" />
    <see type="valdocumentation:PublicApi" relation="SeeAlso" />
    <see type="bomdocumentation:PublicApi" relation="SeeAlso" />
    <see type="fwdocumentation:Introduction" relation="SeeAlso" />
  </references>

</block>
`;

writeFileSync(join(blocksRoot, "README.bml"), readme);

const fixturesDir = join(__dirname, "../test/fixtures");
mkdirSync(fixturesDir, { recursive: true });
writeFileSync(
  join(fixturesDir, "validator-schema.json"),
  JSON.stringify(
    {
      blocks: blocks.map((b) => ({
        fqn: fqn(b),
        tsExport: b.name,
        pkg: b.pkg || "root",
        abstract: !!b.abstract,
        baseType: b.baseType ?? "validator:ValidatorType",
      })),
      capabilities: capabilities.map((c) => ({
        name: c.name,
        tsExport: capabilityTsExport(c),
        fqn: fqn(c),
        inputs: (c.inputs ?? []).map((f) => ({ name: f.name, type: f.type, required: !!f.required })),
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
