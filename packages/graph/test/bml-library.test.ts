import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const blocksRoot = join(pkgRoot, "blocks/org/blockml/bml/graph");

const EXPECTED_DOC_BLOCKS = [
  "Introduction",
  "LayerSeparation",
  "ArchitectureOverview",
  "V1Scope",
  "PublicApi",
  "PackageOwnership",
  "ScopeExclusions",
];

const EXPECTED_CAPABILITIES = [
  "BuildIndex",
  "OpenIndex",
  "RebuildIndex",
  "Uses",
  "UsedBy",
  "Neighbors",
  "Ancestors",
  "Descendants",
  "Path",
  "Members",
  "Query",
  "Schema",
];

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

describe("Graph Library.bml catalog", () => {
  it("parses every .bml file without error diagnostics", () => {
    const files = [join(blocksRoot, "Library.bml"), join(blocksRoot, "README.bml"), ...walkBmlFiles(blocksRoot)];
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const result = parse(source, { filePath: file, continueOnError: true });
      const errors = (result.diagnostics ?? []).filter((d) => d.severity === "error");
      expect(errors, `${file} parse errors`).toEqual([]);
    }
  });

  it("lists all documentation and capability blocks", () => {
    const catalog = parseLibraryCatalog();
    for (const name of EXPECTED_DOC_BLOCKS) {
      expect(catalog.has(name), `Library.bml missing ${name}`).toBe(true);
    }
    for (const name of EXPECTED_CAPABILITIES) {
      expect(catalog.has(name), `Library.bml missing ${name}`).toBe(true);
    }
    expect(catalog.has("GraphType")).toBe(true);
    expect(catalog.has("README")).toBe(true);
  });

  it("has a BML file for every catalog block except README", () => {
    const bmlNames = new Set(
      walkBmlFiles(blocksRoot).map((f) => f.split("/").pop()!.replace(".bml", "")),
    );
    const catalog = parseLibraryCatalog();
    for (const name of catalog) {
      if (name === "README" || name === "Library") continue;
      expect(bmlNames.has(name), `missing BML for ${name}`).toBe(true);
    }
  });

  it("package.json declares blockml.library", () => {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as {
      blockml?: { library?: string };
      files?: string[];
    };
    expect(pkg.blockml?.library).toBe("./blocks/org/blockml/bml/graph/Library.bml");
    expect(pkg.files).toContain("blocks");
  });
});
