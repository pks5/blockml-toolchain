import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { documentationBlocks } from "../scripts/lsp-documentation-blocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const blocksRoot = join(pkgRoot, "blocks/org/blockml/bml/lsp");

const EXPECTED_DOC_BLOCKS = documentationBlocks.map((d) => d.name);

const EXPECTED_CAPABILITIES = ["AnalyzeDocument", "AnalyzeWorkspace", "FormatDocument", "HoverAt", "DocumentSymbols", "DefinitionAt", "ReferencesAt", "SemanticTokensFor", "StartLanguageServer"];

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
  const library = readFileSync(join(blocksRoot, "Library.bml"), "utf8");
  const catalog = new Set<string>();
  const blocksSection = library.match(/<blocks(?:\s[^>]*)?>([\s\S]*?)<\/blocks>/)?.[1] ?? "";
  const readMeSection = library.match(/<readMe(?:\s[^>]*)?>([\s\S]*?)<\/readMe>/)?.[1] ?? "";
  const catalogSource = `${blocksSection}\n${readMeSection}` || library;
  const compRegex = /<(?:[\w]+:)?(\w+)\s*\/>/g;
  let m;
  while ((m = compRegex.exec(catalogSource)) !== null) {
    catalog.add(m[1]!);
  }
  return catalog;
}

describe("LSP Library.bml catalog", () => {
  it("lists all documentation blocks", () => {
    const catalog = parseLibraryCatalog();
    for (const name of EXPECTED_DOC_BLOCKS) {
      expect(catalog.has(name), `Library.bml missing ${name}`).toBe(true);
    }
  });

  it("lists all capability blocks", () => {
    const catalog = parseLibraryCatalog();
    for (const name of EXPECTED_CAPABILITIES) {
      expect(catalog.has(name), `Library.bml missing ${name}`).toBe(true);
    }
  });

  it("includes LspType and README", () => {
    const catalog = parseLibraryCatalog();
    expect(catalog.has("LspType")).toBe(true);
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
});
