import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const blocksRoot = join(pkgRoot, "blocks/org/blockml/bml/target/fatblock");

const EXPECTED_DOC_BLOCKS = [
  "Introduction",
  "LayerSeparation",
  "ArchitectureOverview",
  "V1Scope",
  "PublicApi",
  "CandidateCollection",
  "EmbedAssemblyRules",
  "NamespaceMergeRules",
  "OutputLayout",
  "Diagnostics",
  "DesignDecisions",
  "PackageOwnership",
  "ScopeExclusions",
];

const EXPECTED_API_BLOCKS = [
  "FatBlockOptions",
  "FatBlockRenderOutput",
  "AssembleFatDocumentResult",
];

const EXPECTED_CAPABILITIES = [
  "ResolveOptions",
  "ValidateRequest",
  "Render",
  "RootFqnsByFilePath",
  "CollectCandidateFqns",
  "MatchesIncludePattern",
  "FilterByIncludes",
  "CloneBlockDefinition",
  "MergeNamespaceBindings",
  "AssembleFatDocument",
  "SerializeFatDocument",
  "FatOutputBasename",
];

function walkBmlFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkBmlFiles(full));
    } else if (entry.endsWith(".bml")) {
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

describe("FatBlock BML library", () => {
  it("parses every .bml file without error diagnostics", () => {
    const files = walkBmlFiles(blocksRoot);
    expect(files.length).toBeGreaterThan(30);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const result = parse(source, { filePath: file, continueOnError: true });
      const errors = (result.diagnostics ?? []).filter((d) => d.severity === "error");
      expect(errors, `${file} parse errors`).toEqual([]);
      expect(result.document, `${file} document`).toBeTruthy();
    }
  });

  it("Library.bml catalog lists every definition block on disk", () => {
    const catalog = parseLibraryCatalog();
    const onDisk = walkBmlFiles(blocksRoot)
      .filter((f) => !f.endsWith("Library.bml") && !f.endsWith("README.bml"))
      .map((f) => f.split("/").pop()!.replace(/\.bml$/, ""));
    for (const name of onDisk) {
      expect(catalog.has(name), `Library.bml missing ${name}`).toBe(true);
    }
    for (const name of EXPECTED_DOC_BLOCKS) {
      expect(catalog.has(name), `doc ${name}`).toBe(true);
    }
    for (const name of EXPECTED_API_BLOCKS) {
      expect(catalog.has(name), `api ${name}`).toBe(true);
    }
    for (const name of EXPECTED_CAPABILITIES) {
      expect(catalog.has(name), `cap ${name}`).toBe(true);
    }
    expect(catalog.has("FatblockType")).toBe(true);
  });

  it("README points ReadFirst to Introduction", () => {
    const readme = readFileSync(join(blocksRoot, "README.bml"), "utf8");
    expect(readme).toContain('type="fbdocumentation:Introduction"');
    expect(readme).toContain('relation="ReadFirst"');
  });

  it("public TS surface matches modeled FatBlock API", () => {
    const index = readFileSync(join(pkgRoot, "src/index.ts"), "utf8");
    expect(index).toContain("FatBlockTarget");
    expect(index).toContain("FatBlockOptions");
    expect(index).toContain("assembleFatDocument");
    expect(index).toContain("serializeFatDocument");
    expect(index).toContain("collectCandidateFqns");
    expect(index).toContain("mergeNamespaceBindings");
    expect(index).toContain("fatOutputBasename");

    const options = readFileSync(join(pkgRoot, "src/options.ts"), "utf8");
    expect(options).toContain('embeddedBlocksStrategy: "error"');

    const target = readFileSync(join(pkgRoot, "src/fatblock-target.ts"), "utf8");
    expect(target).toContain('readonly name = "fatblock"');
    expect(target).toContain('"document"');
    expect(target).toContain("BML_FATBLOCK_SRC_REQUIRED");
  });

  it("package.json declares blockml.library", () => {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
    expect(pkg.blockml?.library).toBe(
      "./blocks/org/blockml/bml/target/fatblock/Library.bml",
    );
    expect(pkg.files).toContain("blocks");
  });
});
