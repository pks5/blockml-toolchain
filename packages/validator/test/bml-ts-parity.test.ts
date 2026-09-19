import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { documentationBlocks } from "../scripts/validator-documentation-blocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const blocksRoot = join(pkgRoot, "blocks/org/blockml/bml/compiler/validator");
const srcRoot = join(pkgRoot, "src");

const EXPECTED_DOC_BLOCKS = documentationBlocks.map((d) => d.name);

const schema = JSON.parse(
  readFileSync(join(__dirname, "fixtures/validator-schema.json"), "utf8"),
);

const TS_CAPABILITY_EXPORTS = ["validate", "validateStyle"];

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

function listExportedFunctionsFromSrc(): string[] {
  const exports: string[] = [];
  for (const entry of readdirSync(srcRoot)) {
    if (!entry.endsWith(".ts")) continue;
    const content = readFileSync(join(srcRoot, entry), "utf8");
    const fnRegex = /^export function (\w+)/gm;
    let m;
    while ((m = fnRegex.exec(content)) !== null) {
      exports.push(m[1]);
    }
  }
  return exports.sort();
}

describe("Validator BML ↔ TS parity", () => {
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

  it("capabilities match TS function exports", () => {
    const schemaCaps = new Set(
      schema.capabilities.map((c: { tsExport: string }) => c.tsExport),
    );
    for (const fn of TS_CAPABILITY_EXPORTS) {
      expect(schemaCaps.has(fn), `schema missing capability for ${fn}`).toBe(true);
    }
  });

  it("all src exported functions have a capability", () => {
    const srcFns = listExportedFunctionsFromSrc();
    const schemaCaps = new Set(
      schema.capabilities.map((c: { tsExport: string }) => c.tsExport),
    );
    for (const fn of srcFns) {
      expect(schemaCaps.has(fn), `missing capability for function ${fn}`).toBe(true);
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

  it("Validate capability matches validate() signature", () => {
    const capPath = join(blocksRoot, "capability/Validate.bml");
    const content = readFileSync(capPath, "utf8");
    expect(content).toContain("bomdoc:BomDocument");
    expect(content).toContain("bomapi:ValidateOptions");
    expect(content).toContain("bomapi:ValidateResult");
    expect(content).toContain("core:Capability");
  });

  it("Library catalogs style types and rule instances", () => {
    const catalog = parseLibraryCatalog();
    for (const name of [
      "StyleRule",
      "StyleCheck",
      "PreferCDataWhenNeedsEscape",
      "PreferMarkdownStructure",
      "PreferEmptyElementSelfClosing",
      "PreferTypeAsTag",
      "PreferOmitRedundantType",
      "PreferOmitRedundantName",
      "PreferOmitUnusedNamespace",
      "CDataWhenEscaping",
      "MarkdownStructure",
      "EmptyElementSelfClosing",
      "TypeAsTag",
      "OmitRedundantType",
      "OmitRedundantName",
      "OmitUnusedNamespace",
      "ValidateStyle",
    ]) {
      expect(catalog.has(name), `Library.bml missing ${name}`).toBe(true);
    }
  });

  it("Library depends on blockml, bom, and framework libraries", () => {
    const library = readFileSync(join(blocksRoot, "Library.bml"), "utf8");
    expect(library).toContain("<blockml:Library />");
    expect(library).toContain("<bom:Library />");
    expect(library).toContain("<framework:Library />");
    const pkgVersion = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")).version;
    expect(library.match(/<version>\s*([^\s<]+)\s*<\/version>/)?.[1]).toBe(pkgVersion);
    expect(library).toContain("core:BlockLibrary");
  });

  it("does not redefine BOM API types", () => {
    const bmlFiles = walkBmlFiles(blocksRoot);
    const names = bmlFiles.map((f) => f.split("/").pop()!.replace(".bml", ""));
    expect(names).not.toContain("ValidateOptions");
    expect(names).not.toContain("ValidateResult");
    expect(names).not.toContain("BomDocument");
  });
});
