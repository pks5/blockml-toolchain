import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const blocksRoot = join(pkgRoot, "blocks/org/blockml/bml/target/xsd");

const EXPECTED_DOC_BLOCKS = [
  "Introduction",
  "LayerSeparation",
  "ArchitectureOverview",
  "V1Scope",
  "PublicApi",
  "ParticleMappingRules",
  "DomainVocabularyRules",
  "CatalogAndOutputLayout",
  "Diagnostics",
  "DesignDecisions",
  "PackageOwnership",
  "ScopeExclusions",
];

const EXPECTED_API_BLOCKS = ["XsdOptions", "XsdRenderOutput", "CatalogEntry"];

const EXPECTED_CAPABILITIES = [
  "ResolveOptions",
  "Render",
  "EmitBlockXsd",
  "MemberPrefersElement",
  "ExtraElementNames",
  "EmitTypesXsd",
  "EmitServiceXsd",
  "VocabularyElements",
  "EmitCatalogXml",
  "CatalogRelativePath",
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
  const library = readFileSync(join(blocksRoot, "Library.bml"), "utf8");
  const catalog = new Set<string>();
  const blocksSection = library.match(/<blocks(?:\s[^>]*)?>([\s\S]*?)<\/blocks>/)?.[1];
  expect(blocksSection, "Library.bml blocks aggregation").toBeTruthy();
  const compRegex = /<(?:[\w]+:)?(\w+)\s*\/>/g;
  let m;
  while ((m = compRegex.exec(blocksSection!)) !== null) {
    catalog.add(m[1]);
  }
  return catalog;
}

describe("XSD BML library", () => {
  it("parses every .bml file without error diagnostics", () => {
    const files = walkBmlFiles(blocksRoot);
    expect(files.length).toBeGreaterThan(25);
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
    expect(catalog.has("XsdType")).toBe(true);
  });

  it("README points ReadFirst to Introduction", () => {
    const readme = readFileSync(join(blocksRoot, "README.bml"), "utf8");
    expect(readme).toContain('type="xsddocumentation:Introduction"');
    expect(readme).toContain('relation="ReadFirst"');
  });

  it("public TS surface matches modeled XSD API", () => {
    const index = readFileSync(join(pkgRoot, "src/index.ts"), "utf8");
    expect(index).toContain("XsdTarget");
    expect(index).toContain("XsdOptions");
    expect(index).toContain("XsdRenderOutput");
    expect(index).toContain("emitBlockXsd");
    expect(index).toContain("emitTypesXsd");
    expect(index).toContain("emitServiceXsd");
    expect(index).toContain("emitCatalogXml");
    expect(index).toContain("catalogRelativePath");
    expect(index).toContain("CatalogEntry");
    expect(index).toContain("BML_DOCUMENT_NS");
    expect(index).toContain("resolveXsdOptions");
    expect(index).toContain("DEFAULT_XSD_OPTIONS");

    const options = readFileSync(join(pkgRoot, "src/options.ts"), "utf8");
    expect(options).toContain("includeNonExported: true");
    expect(options).toContain("emitDomainSchemas: true");

    const target = readFileSync(join(pkgRoot, "src/xsd-target.ts"), "utf8");
    expect(target).toContain('readonly name = "xsd"');
    expect(target).toContain('"library"');
    expect(target).toContain('"corpus"');
    expect(target).toContain('"auto"');
    expect(target).toContain("catalog.xml");
  });

  it("package.json declares blockml.library", () => {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
    expect(pkg.blockml?.library).toBe(
      "./blocks/org/blockml/bml/target/xsd/Library.bml",
    );
    expect(pkg.files).toContain("blocks");
  });
});
