import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const blocksRoot = join(pkgRoot, "blocks/org/blockml/bml/compiler/runtime");

const EXPECTED_DOC_BLOCKS = [
  "Introduction",
  "LayerSeparation",
  "ArchitectureOverview",
  "V1Scope",
  "PublicApi",
  "CompileIO",
  "CompileScopeRules",
  "TargetRegistry",
  "RenderContextRules",
  "ExternalTargetContract",
  "Diagnostics",
  "DesignDecisions",
  "PackageOwnership",
  "ScopeExclusions",
];

const EXPECTED_API_BLOCKS = [
  "CompileScopeKind",
  "CompileInput",
  "CompileScope",
  "CompileRequest",
  "CompileOptions",
  "CompileBomOptions",
  "CompilerResult",
  "RenderOutputFile",
  "RenderOutput",
  "RenderSession",
  "RenderContext",
  "RenderTarget",
  "ScopeConfigHints",
  "ResolvedScope",
];

const EXPECTED_CAPABILITIES = [
  "CompileToOutput",
  "CompileBmlToOutput",
  "CompileBomToOutput",
  "RegisterTarget",
  "GetTarget",
  "ClearTargets",
  "RegisteredTargetNames",
  "ResolveScope",
  "ScopeAccepts",
  "CompileBmlToBom",
  "ValidateRegistryDocuments",
  "BuildRenderSession",
  "CreateRenderContext",
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
  const blocksSection = library.match(/<blocks>([\s\S]*?)<\/blocks>/)?.[1];
  expect(blocksSection, "Library.bml blocks aggregation").toBeTruthy();
  const compRegex = /<composition>\s*<(?:[\w]+:)?(\w+)\s*\/?>\s*<\/composition>/g;
  let m;
  while ((m = compRegex.exec(blocksSection!)) !== null) {
    catalog.add(m[1]);
  }
  return catalog;
}

describe("Compiler runtime BML library", () => {
  it("parses every .bml file without error diagnostics", () => {
    const files = walkBmlFiles(blocksRoot);
    expect(files.length).toBeGreaterThan(35);
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
    expect(catalog.has("RuntimeType")).toBe(true);
    expect(catalog.has("RuntimeConstants")).toBe(true);
  });

  it("README points ReadFirst to Introduction", () => {
    const readme = readFileSync(join(blocksRoot, "README.bml"), "utf8");
    expect(readme).toContain('type="rundocumentation:Introduction"');
    expect(readme).toContain('relation="ReadFirst"');
  });

  it("public TS surface matches modeled runtime API", () => {
    const index = readFileSync(join(pkgRoot, "src/index.ts"), "utf8");
    expect(index).toContain("CompileRequest");
    expect(index).toContain("CompileBomOptions");
    expect(index).toContain("RenderTarget");
    expect(index).toContain("registerTarget");
    expect(index).toContain("getTarget");
    expect(index).toContain("clearTargets");
    expect(index).toContain("registeredTargetNames");
    expect(index).toContain("resolveScope");
    expect(index).toContain("scopeAccepts");
    expect(index).toContain("compileBmlToBom");
    expect(index).toContain("validateRegistryDocuments");
    expect(index).toContain("compileToOutput");
    expect(index).toContain("compileBomToOutput");
    expect(index).toContain("compileBmlToOutput");
    expect(index).toContain("createRenderContext");
    expect(index).toContain("buildRenderSession");

    const target = readFileSync(join(pkgRoot, "src/compile-to-output.ts"), "utf8");
    expect(target).toContain("BML_UNKNOWN_TARGET");
    expect(target).toContain("BML_TARGET_SCOPE_MISMATCH");
    expect(target).toContain("BML_MISSING_TYPE_REGISTRY");

    const scope = readFileSync(join(pkgRoot, "src/scope.ts"), "utf8");
    expect(scope).toContain("BML_COMPILE_SCOPE_EMPTY");
    expect(scope).toContain('"document"');
    expect(scope).toContain('"library"');
    expect(scope).toContain('"corpus"');
  });

  it("package.json declares blockml.library", () => {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
    expect(pkg.blockml?.library).toBe(
      "./blocks/org/blockml/bml/compiler/runtime/Library.bml",
    );
    expect(pkg.files).toContain("blocks");
  });

  it("Library.bml declares expected dependencies", () => {
    const library = readFileSync(join(blocksRoot, "Library.bml"), "utf8");
    expect(library).toContain("<blockml:Library");
    expect(library).toContain("<bom:Library");
    expect(library).toContain("<framework:Library");
    expect(library).toContain("<parser:Library");
    expect(library).toContain("<validator:Library");
  });
});
