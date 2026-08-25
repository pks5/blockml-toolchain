import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const blocksRoot = join(pkgRoot, "blocks/org/blockml/bml/target/blockdoc");

const EXPECTED_DOC_BLOCKS = [
  "Introduction",
  "LayerSeparation",
  "ArchitectureOverview",
  "V1Scope",
  "PublicApi",
  "PathAndLayout",
  "TypeLinkRules",
  "MemberAndCompositionRules",
  "PageChrome",
  "SiteAssembly",
  "DesignDecisions",
  "PackageOwnership",
  "ScopeExclusions",
];

const EXPECTED_API_BLOCKS = [
  "SiteMode",
  "OutLayout",
  "BlockDocOptions",
  "BlockDocRenderOutput",
  "SearchIndexEntry",
  "SearchIndex",
];

const EXPECTED_CAPABILITIES = [
  "Render",
  "ResolveOptions",
  "FqnToHtmlPath",
  "RelativeHref",
  "EscapeHtml",
  "CollectRootFqns",
  "CollectPackagePrefixes",
  "FilterExportedFqns",
  "RenderTypeExpression",
  "ResolveSubBlockType",
  "RenderMemberSections",
  "CollectCompositionGroups",
  "RenderComposition",
  "RenderDottedPackagePath",
  "RenderBlockPage",
  "RenderSiteIndex",
  "RenderPackageIndex",
  "BuildSearchIndex",
  "RenderToolbar",
  "AssembleSite",
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
  const blocksSection = library.match(
    /<blocks>([\s\S]*?)<\/blocks>/,
  )?.[1];
  expect(blocksSection, "Library.bml blocks aggregation").toBeTruthy();
  const compRegex = /<(?:[\w]+:)?(\w+)\s*\/>/g;
  let m;
  while ((m = compRegex.exec(blocksSection!)) !== null) {
    catalog.add(m[1]);
  }
  return catalog;
}

describe("BlockDoc BML library", () => {
  it("parses every .bml file without error diagnostics", () => {
    const files = walkBmlFiles(blocksRoot);
    expect(files.length).toBeGreaterThan(40);
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
    expect(catalog.has("BlockdocType")).toBe(true);
  });

  it("README points ReadFirst to Introduction", () => {
    const readme = readFileSync(join(blocksRoot, "README.bml"), "utf8");
    expect(readme).toContain('type="bddocumentation:Introduction"');
    expect(readme).toContain('relation="ReadFirst"');
  });

  it("public TS surface matches modeled options and path helpers", () => {
    const index = readFileSync(join(pkgRoot, "src/index.ts"), "utf8");
    expect(index).toContain("BlockDocTarget");
    expect(index).toContain("BlockDocOptions");
    expect(index).toContain("fqnToHtmlPath");
    expect(index).toContain("escapeHtml");
    expect(index).toContain("resolveBlockDocOptions");

    const options = readFileSync(join(pkgRoot, "src/options.ts"), "utf8");
    expect(options).toContain('siteMode: "merged"');
    expect(options).toContain('outLayout: "fqn"');
    expect(options).toContain("includeNonExported: true");

    const target = readFileSync(join(pkgRoot, "src/blockdoc-target.ts"), "utf8");
    expect(target).toContain('readonly name = "blockdoc"');
    expect(target).toContain('"library"');
    expect(target).toContain('"corpus"');
    expect(target).toContain('"auto"');
  });
});
