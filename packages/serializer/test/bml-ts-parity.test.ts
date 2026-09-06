import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { documentationBlocks } from "../scripts/serializer-documentation-blocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const blocksRoot = join(pkgRoot, "blocks/org/blockml/bml/compiler/serializer");
const srcRoot = join(pkgRoot, "src");

const EXPECTED_DOC_BLOCKS = documentationBlocks.map((d) => d.name);

const schema = JSON.parse(
  readFileSync(join(__dirname, "fixtures/serializer-schema.json"), "utf8"),
);

/** TS type exports that map to SerializerType blocks (not capabilities). */
const TS_TYPE_EXPORTS = ["EmitContext", "XmlWriter"];

/** TS function exports from src/ that map to sercap:* capabilities. */
const TS_CAPABILITY_EXPORTS = [
  "serialize",
  "createEmitContext",
  "emitBlockDefinition",
  "emitRootStartTag",
  "emitTypeExpression",
  "emitCompositionTemplate",
  "emitCompositionNode",
  "emitBlockInstance",
  "emitConstraintInstances",
  "emitTypeReferenceEntity",
  "hasBmlSemanticQNameBindings",
  "fqnToQName",
  "qnameToParts",
  "visibilityPrefix",
  "escapeAttr",
  "escapeText",
  "needsCData",
  "emitCharacterData",
  "formatBoolean",
  "formatMemberValue",
  "shouldUseQName",
];

const TS_FILE_MAP: Record<string, string> = {
  EmitContext: "emit/context.ts",
  XmlWriter: "emit/xml.ts",
};

function walkBmlFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkBmlFiles(full));
    } else if (entry.endsWith(".bml") && entry !== "Library.bml" && entry !== "README.bml") {
      results.push(full);
    }
  }
  return results;
}

function parseBmlProperties(content: string): { name: string; required: boolean }[] {
  const props: { name: string; required: boolean }[] = [];
  const propRegex = /<(\w+)\s+type="[^"]*">([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = propRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];
    props.push({ name, required: body.includes("(required)") });
  }
  return props;
}

function parseLibraryCatalog(): Set<string> {
  const library = readFileSync(join(blocksRoot, "Library.bml"), "utf8");
  const catalog = new Set<string>();
  const blocksSection = library.match(/<blocks(?:\s[^>]*)?>([\s\S]*?)<\/blocks>/)?.[1] ?? library;
  const compRegex = /<(?:[\w]+:)?(\w+)\s*\/>/g;
  let m;
  while ((m = compRegex.exec(blocksSection)) !== null) {
    catalog.add(m[1]);
  }
  return catalog;
}

function parseTsInterfaceFields(filePath: string, interfaceName: string): Map<string, boolean> {
  const content = readFileSync(filePath, "utf8");
  const fields = new Map<string, boolean>();

  if (interfaceName === "XmlWriter") {
    // Class with private fields — map public contract from constructor + documented state
    fields.set("indent", true);
    return fields;
  }

  const ifaceRegex = new RegExp(`\\binterface\\s+${interfaceName}\\b`);
  const ifaceMatch = content.match(ifaceRegex);
  if (!ifaceMatch || ifaceMatch.index === undefined) {
    return fields;
  }
  const ifaceStart = ifaceMatch.index;
  const braceStart = content.indexOf("{", ifaceStart);
  if (braceStart === -1) {
    return fields;
  }

  let depth = 0;
  let body = "";
  for (let i = braceStart; i < content.length; i++) {
    const ch = content[i];
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        body = content.slice(braceStart + 1, i);
        break;
      }
    }
  }

  const fieldRegex = /^\s*(\w+)(\?)?:\s/gm;
  let fieldMatch;
  while ((fieldMatch = fieldRegex.exec(body)) !== null) {
    fields.set(fieldMatch[1], fieldMatch[2] !== "?");
  }

  return fields;
}

function readBlockEmitOrderFromTs(): string[] {
  const content = readFileSync(join(srcRoot, "emit/block.ts"), "utf8");
  const match = content.match(/const BLOCK_EMIT_ORDER[^=]*=\s*\[([\s\S]*?)\];/);
  expect(match, "BLOCK_EMIT_ORDER in block.ts").toBeTruthy();
  const entries: string[] = [];
  const itemRegex = /"([^"]+)"/g;
  let m;
  while ((m = itemRegex.exec(match![1])) !== null) {
    entries.push(m[1]);
  }
  return entries;
}

function readConstantsFromTs(): { XSI_NS: string; BML_XMLNS: string } {
  const content = readFileSync(join(srcRoot, "emit/constants.ts"), "utf8");
  const xsi = content.match(/export const XSI_NS = "([^"]+)"/)?.[1];
  const bml = content.match(/export const BML_XMLNS = "([^"]+)"/)?.[1];
  expect(xsi).toBeTruthy();
  expect(bml).toBeTruthy();
  return { XSI_NS: xsi!, BML_XMLNS: bml! };
}

function listExportedFunctionsFromEmit(): string[] {
  const emitDir = join(srcRoot, "emit");
  const exports: string[] = [];
  for (const file of readdirSync(emitDir)) {
    if (!file.endsWith(".ts")) continue;
    const content = readFileSync(join(emitDir, file), "utf8");
    const fnRegex = /^export function (\w+)/gm;
    let m;
    while ((m = fnRegex.exec(content)) !== null) {
      exports.push(m[1]);
    }
  }
  return exports.sort();
}

describe("Serializer BML ↔ TS parity", () => {
  it("schema covers EmitContext and XmlWriter type blocks", () => {
    const schemaExports = new Set(schema.blocks.map((b: { tsExport: string }) => b.tsExport));
    for (const name of TS_TYPE_EXPORTS) {
      expect(schemaExports.has(name), `schema missing ${name}`).toBe(true);
    }
  });

  it("Library.bml catalog includes all blocks", () => {
    const catalog = parseLibraryCatalog();
    for (const b of schema.blocks) {
      if (b.abstract) continue;
      expect(catalog.has(b.tsExport), `Library.bml missing ${b.tsExport}`).toBe(true);
    }
    for (const c of schema.capabilities) {
      expect(catalog.has(c.name), `Library.bml missing capability ${c.name}`).toBe(true);
    }
    for (const name of EXPECTED_DOC_BLOCKS) {
      expect(catalog.has(name), `Library.bml missing documentation ${name}`).toBe(true);
    }
  });

  it("every TS type export has a BML file", () => {
    const bmlFiles = walkBmlFiles(blocksRoot);
    const bmlNames = new Set(bmlFiles.map((f) => f.split("/").pop()!.replace(".bml", "")));

    for (const name of TS_TYPE_EXPORTS) {
      expect(bmlNames.has(name), `missing BML file for ${name}`).toBe(true);
    }
  });

  it("capabilities match TS function exports", () => {
    const schemaCaps = new Set(
      schema.capabilities.map((c: { tsExport: string }) => c.tsExport),
    );
    for (const fn of TS_CAPABILITY_EXPORTS) {
      expect(schemaCaps.has(fn), `schema missing capability for ${fn}`).toBe(true);
    }
    expect(TS_CAPABILITY_EXPORTS).toContain("serialize");
  });

  it("all emit/*.ts exported functions have a capability", () => {
    const emitFns = listExportedFunctionsFromEmit();
    const schemaCaps = new Set(
      schema.capabilities.map((c: { tsExport: string }) => c.tsExport),
    );
    for (const fn of emitFns) {
      expect(schemaCaps.has(fn), `missing capability for emit function ${fn}`).toBe(true);
    }
  });

  it("documentation blocks extend core:Documentation", () => {
    const docDir = join(blocksRoot, "documentation");
    for (const name of EXPECTED_DOC_BLOCKS) {
      expect(
        readFileSync(join(docDir, `${name}.bml`), "utf8").includes("core:Documentation"),
        `${name}.bml should extend core:Documentation`,
      ).toBe(true);
    }
  });

  it("EmitContext BML properties match TS interface", () => {
    const bmlPath = join(blocksRoot, "emit/EmitContext.bml");
    const bmlProps = parseBmlProperties(readFileSync(bmlPath, "utf8"));
    const bmlFieldNames = new Set(bmlProps.map((p) => p.name));

    const tsFields = parseTsInterfaceFields(join(srcRoot, TS_FILE_MAP.EmitContext), "EmitContext");

    for (const [fieldName, required] of tsFields) {
      expect(bmlFieldNames.has(fieldName), `EmitContext.${fieldName} missing in BML`).toBe(true);
      if (required) {
        const bmlProp = bmlProps.find((p) => p.name === fieldName);
        expect(bmlProp?.required, `EmitContext.${fieldName} should be required in BML`).toBe(true);
      }
    }
  });

  it("Serialize capability matches serialize() signature", () => {
    const capPath = join(blocksRoot, "capability/Serialize.bml");
    const content = readFileSync(capPath, "utf8");
    expect(content).toContain("bomdoc:BomDocument");
    expect(content).toContain("bomapi:SerializeOptions");
    expect(content).toContain("bomapi:SerializeResult");
    expect(content).toContain("core:Capability");
  });

  it("BlockEmitOrder matches BLOCK_EMIT_ORDER in block.ts", () => {
    const tsOrder = readBlockEmitOrderFromTs();
    expect(schema.blockEmitOrder).toEqual(tsOrder);
  });

  it("SerializerConstants match constants.ts", () => {
    const tsConstants = readConstantsFromTs();
    expect(schema.constants).toEqual(tsConstants);
  });

  it("Library depends on blockml and bom libraries", () => {
    const library = readFileSync(join(blocksRoot, "Library.bml"), "utf8");
    expect(library).toContain("<blockml:Library />");
    expect(library).toContain("<bom:Library />");
    expect(library).toContain("<version>0.9.4</version>");
  });

  it("does not redefine BOM API types", () => {
    const bmlFiles = walkBmlFiles(blocksRoot);
    const names = bmlFiles.map((f) => f.split("/").pop()!.replace(".bml", ""));
    expect(names).not.toContain("SerializeOptions");
    expect(names).not.toContain("SerializeResult");
    expect(names).not.toContain("BomDocument");
  });
});
