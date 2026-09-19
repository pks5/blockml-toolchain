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
  "analyzeWorkspace",
  "formatDocument",
  "hoverAt",
  "documentSymbols",
  "definitionAt",
  "referencesAt",
  "semanticTokensFor",
  "createWorkspace",
  "loadBomConfig",
  "invalidateWorkspace",
  "bomLocationToRange",
  "bomSeverityToLsp",
  "diagnosticToLsp",
];

function walkBmlFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkBmlFiles(full));
    } else if (entry.name.endsWith(".bml")) {
      results.push(full);
    }
  }
  return results;
}

function parseLibraryCatalog(): Set<string> {
  const catalog = new Set<string>(["README"]);
  for (const file of walkBmlFiles(blocksRoot)) {
    const base = file.split("/").pop()!.replace(/\.bml$/, "");
    if (base !== "Library") {
      catalog.add(base);
    }
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
    expect(schemaCaps.has("analyzeWorkspace")).toBe(true);
    expect(schemaCaps.has("formatDocument")).toBe(true);
    expect(schemaCaps.has("hoverAt")).toBe(true);
    expect(schemaCaps.has("documentSymbols")).toBe(true);
    expect(schemaCaps.has("definitionAt")).toBe(true);
    expect(schemaCaps.has("referencesAt")).toBe(true);
    expect(schemaCaps.has("semanticTokensFor")).toBe(true);
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

  it("Library depends on parser, serializer, validator, and framework libraries", () => {
    const library = readFileSync(join(blocksRoot, "Library.bml"), "utf8");
    expect(library).toContain("<parser:Library />");
    expect(library).toContain("<serializer:Library />");
    expect(library).toContain("<validator:Library />");
    expect(library).toContain("<framework:Library />");
    const pkgVersion = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")).version;
    expect(library.match(/<version>\s*([^\s<]+)\s*<\/version>/)?.[1]).toBe(pkgVersion);
  });
});
