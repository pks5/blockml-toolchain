import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, "..");
const blocksRoot = join(pkgRoot, "blocks/org/blockml/bml/cli");

const EXPECTED_DOC_BLOCKS = [
  "Introduction",
  "LayerSeparation",
  "ArchitectureOverview",
  "V1Scope",
  "PublicApi",
  "RuntimeBootstrap",
  "Commands",
  "CompileCommand",
  "ValidateCommand",
  "Configuration",
  "TargetBootstrap",
  "TargetCliMatrix",
  "ExitCodesAndDiagnostics",
  "DualCliModel",
  "Installation",
  "DesignDecisions",
  "PackageOwnership",
  "ScopeExclusions",
];

const EXPECTED_API_BLOCKS = [
  "BomConfig",
  "ParsedArgs",
  "CliResult",
  "WriteOutputOptions",
  "CliBootstrapOptions",
];

const EXPECTED_CAPABILITIES = [
  "LoadConfig",
  "ParseArgs",
  "FormatDiagnostic",
  "RunCli",
  "RunValidate",
  "ValidateAgainstXsd",
  "RunCompile",
  "RunCompileFatBlock",
  "BootstrapTargets",
  "RegisterTargetFactory",
  "BootstrapProjectTypeRegistry",
  "WriteOutputFiles",
  "DefaultOutDir",
  "WorkspaceRoot",
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
  const compRegex = /<(?:[\w]+:)?(\w+)\s*\/>/g;
  let m;
  while ((m = compRegex.exec(blocksSection!)) !== null) {
    catalog.add(m[1]);
  }
  return catalog;
}

describe("CLI BML library", () => {
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
    expect(catalog.has("CliType")).toBe(true);
  });

  it("README points ReadFirst to Introduction", () => {
    const readme = readFileSync(join(blocksRoot, "README.bml"), "utf8");
    expect(readme).toContain('type="clidocumentation:Introduction"');
    expect(readme).toContain('relation="ReadFirst"');
  });

  it("public TS surface matches modeled CLI API", () => {
    const index = readFileSync(join(pkgRoot, "src/index.ts"), "utf8");
    expect(index).toContain("runCli");
    expect(index).toContain("parseArgs");
    expect(index).toContain("loadConfig");
    expect(index).toContain("bootstrapTargets");
    expect(index).toContain("registerTargetFactory");
    expect(index).toContain("loadTargetFromPackage");
    expect(index).toContain("writeOutputFiles");
    expect(index).toContain("bootstrapProjectTypeRegistry");
    expect(index).toContain("formatDiagnostic");
    expect(index).toContain("validateFilesAgainstXsd");

    const loadConfig = readFileSync(join(pkgRoot, "src/load-config.ts"), "utf8");
    expect(loadConfig).toContain('outDir: "doc"');
    expect(loadConfig).toContain('srcDir: "blocks"');
    expect(loadConfig).toContain('targets: ["blockdoc"]');
    expect(loadConfig).toContain("targetPackages");
    expect(loadConfig).toContain("defaultTarget");
    expect(loadConfig).not.toContain("xsdValidation");

    const bootstrapTargets = readFileSync(join(pkgRoot, "src/bootstrap-targets.ts"), "utf8");
    expect(bootstrapTargets).toContain("blockdoc");
    expect(bootstrapTargets).toContain("xsd");
    expect(bootstrapTargets).toContain("fatblock");
  });

  it("package.json declares blockml.library", () => {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"));
    expect(pkg.blockml?.library).toBe("./blocks/org/blockml/bml/cli/Library.bml");
    expect(pkg.files).toContain("blocks");
  });
});
