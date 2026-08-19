import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { documentationBlocks } from "../scripts/parser-documentation-blocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const blocksRoot = join(pkgRoot, "blocks/org/blockml/bml/compiler/parser");
const srcRoot = join(pkgRoot, "src");

const EXPECTED_DOC_BLOCKS = documentationBlocks.map((d) => d.name);

const schema = JSON.parse(
  readFileSync(join(__dirname, "fixtures/parser-schema.json"), "utf8"),
);

const TS_TYPE_EXPORTS = ["MapContext"];

const TS_FILE_MAP: Record<string, string> = {
  MapContext: "map/context.ts",
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

function walkTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkTsFiles(full));
    } else if (entry.endsWith(".ts")) {
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
  const compRegex = /<composition>\s*<(?:[\w]+:)?(\w+)\s*\/?>\s*<\/composition>/g;
  let m;
  while ((m = compRegex.exec(library)) !== null) {
    catalog.add(m[1]);
  }
  return catalog;
}

function parseTsInterfaceFields(filePath: string, interfaceName: string): Map<string, boolean> {
  const content = readFileSync(filePath, "utf8");
  const fields = new Map<string, boolean>();

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

function listExportedFunctionsFromSrc(): string[] {
  const exports: string[] = [];
  for (const file of walkTsFiles(srcRoot)) {
    const content = readFileSync(file, "utf8");
    const fnRegex = /^export function (\w+)/gm;
    let m;
    while ((m = fnRegex.exec(content)) !== null) {
      exports.push(m[1]);
    }
  }
  return exports.sort();
}

function readConstantsFromTs(): Record<string, string> {
  const content = readFileSync(join(srcRoot, "util/qname.ts"), "utf8");
  const xsi = content.match(/export const XSI_NS = "([^"]+)"/)?.[1];
  const bml = content.match(/export const BML_XMLNS = "([^"]+)"/)?.[1];
  const tre = content.match(/export const TYPE_REFERENCE_ENTITY =\s*\n?\s*"([^"]+)"/)?.[1];
  expect(xsi).toBeTruthy();
  expect(bml).toBeTruthy();
  expect(tre).toBeTruthy();
  return {
    XSI_NS: xsi!,
    BML_XMLNS: bml!,
    TYPE_REFERENCE_ENTITY: tre!,
    V1_ROOT_ELEMENT: "block",
  };
}

describe("Parser BML ↔ TS parity", () => {
  it("schema covers MapContext type block", () => {
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

  it("all src/**/*.ts exported functions have a capability", () => {
    const srcFns = listExportedFunctionsFromSrc();
    const schemaCaps = new Set(
      schema.capabilities.map((c: { tsExport: string }) => c.tsExport),
    );
    for (const fn of srcFns) {
      expect(schemaCaps.has(fn), `missing capability for function ${fn}`).toBe(true);
    }
    expect(schemaCaps.has("parse")).toBe(true);
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

  it("MapContext BML properties match TS interface", () => {
    const bmlPath = join(blocksRoot, "map/MapContext.bml");
    const bmlProps = parseBmlProperties(readFileSync(bmlPath, "utf8"));
    const bmlFieldNames = new Set(bmlProps.map((p) => p.name));

    const tsFields = parseTsInterfaceFields(join(srcRoot, TS_FILE_MAP.MapContext), "MapContext");

    for (const [fieldName, required] of tsFields) {
      expect(bmlFieldNames.has(fieldName), `MapContext.${fieldName} missing in BML`).toBe(true);
      if (required) {
        const bmlProp = bmlProps.find((p) => p.name === fieldName);
        expect(bmlProp?.required, `MapContext.${fieldName} should be required in BML`).toBe(true);
      }
    }
  });

  it("Parse capability matches parse() signature", () => {
    const capPath = join(blocksRoot, "capability/Parse.bml");
    const content = readFileSync(capPath, "utf8");
    expect(content).toContain("bomapi:ParseOptions");
    expect(content).toContain("bomapi:ParseResult");
    expect(content).toContain("core:Capability");
  });

  it("ParserConstants match util/qname.ts and V1 root", () => {
    const tsConstants = readConstantsFromTs();
    expect(schema.constants).toEqual(tsConstants);
  });

  it("MapTimeDiagnosticCodes match schema list", () => {
    expect(schema.mapTimeDiagnosticCodes.length).toBeGreaterThan(0);
    expect(schema.mapTimeDiagnosticCodes).toContain("BML_UNSUPPORTED_FORMAT");
    expect(schema.mapTimeDiagnosticCodes).toContain("BML_MAP_ERROR");
  });

  it("Library depends on blockml and bom libraries", () => {
    const library = readFileSync(join(blocksRoot, "Library.bml"), "utf8");
    expect(library).toContain("<blockml:Library />");
    expect(library).toContain("<bom:Library />");
    expect(library).toContain("<version>0.1.0</version>");
  });

  it("does not redefine BOM API types", () => {
    const bmlFiles = walkBmlFiles(blocksRoot);
    const names = bmlFiles.map((f) => f.split("/").pop()!.replace(".bml", ""));
    expect(names).not.toContain("ParseOptions");
    expect(names).not.toContain("ParseResult");
    expect(names).not.toContain("BomDocument");
  });
});
