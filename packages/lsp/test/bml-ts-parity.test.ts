import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { documentationBlocks } from "../scripts/lsp-documentation-blocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const blocksRoot = join(pkgRoot, "blocks/org/blockml/bml/lsp");
const srcRoot = join(pkgRoot, "src");

const schema = JSON.parse(
  readFileSync(join(__dirname, "fixtures/lsp-schema.json"), "utf8"),
);

const TS_CAPABILITY_EXPORTS = [
  "analyzeDocument",
  "createWorkspace",
  "loadBomConfig",
  "invalidateWorkspace",
  "bomLocationToRange",
  "bomSeverityToLsp",
  "diagnosticToLsp",
];

function parseLibraryCatalog(): Set<string> {
  const library = readFileSync(join(blocksRoot, "Library.bml"), "utf8");
  const catalog = new Set<string>();
  const compRegex = /<composition>\s*<(?:[\w]+:)?(\w+)\s*\/?>\s*<\/composition>/g;
  let m;
  while ((m = compRegex.exec(library)) !== null) {
    catalog.add(m[1]!);
  }
  return catalog;
}

function listExportedFunctionsFromIndex(): string[] {
  const content = readFileSync(join(srcRoot, "index.ts"), "utf8");
  const exports: string[] = [];
  const re = /export\s*\{\s*([^}]+)\s*\}\s*from/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    for (const part of m[1]!.split(",")) {
      const name = part.trim().split(/\s+/).pop();
      if (name && /^[a-z]/.test(name)) {
        exports.push(name);
      }
    }
  }
  return exports.sort();
}

describe("LSP BML ↔ TS parity", () => {
  it("Library.bml catalog includes all documentation blocks", () => {
    const catalog = parseLibraryCatalog();
    for (const name of documentationBlocks.map((d) => d.name)) {
      expect(catalog.has(name)).toBe(true);
    }
  });

  it("capabilities match schema", () => {
    const schemaCaps = new Set(
      schema.capabilities.map((c: { tsExport: string }) => c.tsExport),
    );
    expect(schemaCaps.has("analyzeDocument")).toBe(true);
    expect(schemaCaps.has("startLanguageServer")).toBe(true);
  });

  it("index.ts exported functions have a capability or are workspace helpers", () => {
    const indexFns = listExportedFunctionsFromIndex();
    expect(indexFns).toEqual(TS_CAPABILITY_EXPORTS.sort());
    const schemaCaps = new Set(
      schema.capabilities.map((c: { tsExport: string }) => c.tsExport),
    );
    expect(schemaCaps.has("analyzeDocument")).toBe(true);
  });

  it("Library depends on parser, validator, and framework libraries", () => {
    const library = readFileSync(join(blocksRoot, "Library.bml"), "utf8");
    expect(library).toContain("<parser:Library />");
    expect(library).toContain("<validator:Library />");
    expect(library).toContain("<framework:Library />");
    expect(library).toContain("<version>0.1.0</version>");
  });
});
