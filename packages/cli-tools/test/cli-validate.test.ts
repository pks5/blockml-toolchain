import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { clearTargets } from "@blockml/compiler";
import { BML_DOCUMENT_NS } from "@blockml/xsd-target";
import { isCliEntry, parseArgs, runCli } from "../src/cli.js";
import { resetBootstrapTargets } from "../src/bootstrap-targets.js";
import { projectLibraryPackageDirs, projectLibraryPackageRoots, projectSourceRoots } from "../src/project-sources.js";
import {
  parseCatalogUriEntries,
  resolveBmlSchemaPath,
  validateFilesAgainstXsd,
} from "../src/xsd-validate.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const CORE_LIBRARY = join(
  ROOT,
  "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml",
);
const CORE_PATH_FRAGMENT = "node_modules/@blockml/core";

function namedListSection(text: string, titleStart: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.startsWith(titleStart));
  if (start < 0) {
    return "";
  }
  const items: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.startsWith("  ")) {
      break;
    }
    items.push(line.slice(2));
  }
  return items.join("\n");
}

function testedCount(stderr: string): number {
  const match = stderr.match(/Tested (\d+) blocks?/);
  return match ? Number(match[1]) : -1;
}

describe("parseArgs", () => {
  it("maps compile positional to target", () => {
    expect(parseArgs(["compile", "blockdoc"]).target).toBe("blockdoc");
    expect(parseArgs(["compile", "blockdoc"]).file).toBeUndefined();
  });

  it("maps compile --per-package", () => {
    expect(parseArgs(["compile", "fatblock", "--per-package"]).perPackage).toBe(true);
  });

  it("maps validate positional to file", () => {
    const parsed = parseArgs(["validate", "src/Foo.bml", "--all"]);
    expect(parsed.command).toBe("validate");
    expect(parsed.file).toBe("src/Foo.bml");
    expect(parsed.all).toBe(true);
    expect(parsed.target).toBeUndefined();
  });

  it("maps validate --verbose", () => {
    expect(parseArgs(["validate", "--verbose"]).verbose).toBe(true);
  });

  it("maps --help without consuming it as the command", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["--help"]).command).toBeUndefined();
    expect(parseArgs(["-h"]).help).toBe(true);
    expect(parseArgs(["help"]).command).toBe("help");
  });
});

describe("isCliEntry", () => {
  const tmpBin = join(import.meta.dirname, ".tmp-cli-bin");

  beforeEach(() => {
    mkdirSync(tmpBin, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpBin, { recursive: true, force: true });
  });

  it("matches an npm-style .bin symlink to the CLI module", () => {
    const modulePath = join(tmpBin, "cli.js");
    const binPath = join(tmpBin, "blockml");
    writeFileSync(modulePath, "");
    symlinkSync(modulePath, binPath);
    expect(isCliEntry(binPath, modulePath)).toBe(true);
    expect(isCliEntry(modulePath, modulePath)).toBe(true);
    expect(isCliEntry(join(tmpBin, "other.js"), modulePath)).toBe(false);
    expect(isCliEntry(undefined, modulePath)).toBe(false);
  });
});

describe("xsd-validate helpers", () => {
  it("parses catalog uri entries", () => {
    const catalog = readFileSync(join(ROOT, "catalog.xml"), "utf8");
    const entries = parseCatalogUriEntries(catalog);
    expect(entries.get(BML_DOCUMENT_NS)).toBe("./schemas/bml.xsd");
  });

  it("resolves bml.xsd from repo catalog", () => {
    const schemaPath = resolveBmlSchemaPath(ROOT);
    expect(schemaPath).toBeTruthy();
    expect(existsSync(schemaPath!)).toBe(true);
    expect(schemaPath).toMatch(/bml\.xsd$/);
  });
});

describe("runCli validate", () => {
  it("validates project sources with extra library seeds without writing output", async () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const { code, stderr } = await runCli(
      ["validate", "--libraries", CORE_LIBRARY],
      ROOT,
    );

    expect([0, 1]).toContain(code);
    expect(stderr).not.toMatch(/Wrote \d+ file\(s\)/);
    expect(stderr).toMatch(
      /Validation (succeeded|failed)\. Tested \d+ blocks?, \d+ with errors, \d+ warnings?, \d+ recommendations?\./,
    );
    if (code === 1) {
      expect(stderr).toMatch(/\berror\b/);
    }
    if (code === 0) {
      expect(stderr).toMatch(/Validation succeeded\./);
    }
  }, 20_000);

  it("seeds from package.json blockml.library without --libraries", async () => {
    const bomRoot = join(ROOT, "packages/bom");
    const { code, stderr } = await runCli(["validate"], bomRoot);
    expect([0, 1]).toContain(code);
    expect(stderr).toMatch(
      /Validation (succeeded|failed)\. Tested \d+ blocks?, \d+ with errors, \d+ warnings?, \d+ recommendations?\./,
    );
  });

  it("prints bootstrap sources with --verbose", async () => {
    const bomRoot = join(ROOT, "packages/bom");
    const { stderr } = await runCli(["validate", "--verbose"], bomRoot);
    expect(stderr).toMatch(/^srcDir: /m);
    expect(stderr).toMatch(/seeds:/);
    expect(stderr).toMatch(/Library\.bml/);
    expect(stderr).toMatch(/index \(search only\):/);
    expect(stderr).toMatch(/validate \(\d+\):/);
    expect(stderr).toMatch(/registry \(\d+\):/);
    expect(stderr).toMatch(
      /Validation (succeeded|failed)\. Tested \d+ blocks?, \d+ with errors, \d+ warnings?, \d+ recommendations?\./,
    );
  });

  it("projectSourceRoots is this package plus local packages/*, not node_modules", () => {
    const bomRoots = projectSourceRoots(join(ROOT, "packages/bom"), "blocks");
    expect(bomRoots.some((p) => p.includes(`${join("packages", "bom")}`))).toBe(true);
    expect(bomRoots.every((p) => !p.includes(`${join("packages", "parser")}`))).toBe(
      true,
    );

    const workspaceRoots = projectSourceRoots(ROOT, "blocks");
    expect(workspaceRoots).toContain(join(ROOT, "blocks"));
    expect(workspaceRoots.some((p) => p.includes(`${join("packages", "bom")}`))).toBe(
      true,
    );
    expect(workspaceRoots.every((p) => !p.includes("node_modules"))).toBe(true);
  });

  it("projectLibraryPackageRoots is packages with blockml.library, not node_modules", () => {
    const bomRoots = projectLibraryPackageRoots(join(ROOT, "packages/bom"));
    expect(bomRoots.some((p) => p.includes(`${join("packages", "bom")}`))).toBe(true);
    expect(bomRoots.every((p) => !p.includes(`${join("packages", "parser")}`))).toBe(
      true,
    );

    const workspaceRoots = projectLibraryPackageRoots(ROOT);
    expect(workspaceRoots).toContain(join(ROOT, "blocks"));
    expect(workspaceRoots.some((p) => p.includes(`${join("packages", "bom")}`))).toBe(
      true,
    );
    expect(workspaceRoots.some((p) => p.includes(`${join("packages", "lsp")}`))).toBe(
      true,
    );
    expect(workspaceRoots.every((p) => !p.includes("node_modules"))).toBe(true);
  });

  it("projectLibraryPackageDirs is package roots with blockml.library, not node_modules", () => {
    const bomDirs = projectLibraryPackageDirs(join(ROOT, "packages/bom"));
    expect(bomDirs).toEqual([join(ROOT, "packages/bom")]);

    const workspaceDirs = projectLibraryPackageDirs(ROOT);
    expect(workspaceDirs).toContain(ROOT);
    expect(workspaceDirs).toContain(join(ROOT, "packages/bom"));
    expect(workspaceDirs).toContain(join(ROOT, "packages/cli-tools"));
    expect(workspaceDirs.every((p) => !p.includes("node_modules"))).toBe(true);
  });

  it("default validate tests project sources; --all tests the full registry", async () => {
    const bomRoot = join(ROOT, "packages/bom");
    const project = await runCli(["validate", "--verbose"], bomRoot);
    const all = await runCli(["validate", "--all", "--verbose"], bomRoot);

    const projectValidate = namedListSection(project.stderr, "validate (");
    const projectRegistry = namedListSection(project.stderr, "registry (");
    const allValidate = namedListSection(all.stderr, "validate (");

    expect(projectValidate).not.toMatch(CORE_PATH_FRAGMENT);
    expect(projectRegistry).toMatch(CORE_PATH_FRAGMENT);
    expect(allValidate).toMatch(CORE_PATH_FRAGMENT);
    expect(testedCount(all.stderr)).toBeGreaterThan(testedCount(project.stderr));
  });

  it("default validate at workspace root includes packages/* and excludes npm core", async () => {
    const { stderr } = await runCli(["validate", "--verbose"], ROOT);
    const validate = namedListSection(stderr, "validate (");
    const registry = namedListSection(stderr, "registry (");
    expect(validate).toMatch(/packages\/bom\/blocks/);
    expect(validate).not.toMatch(CORE_PATH_FRAGMENT);
    expect(registry).toMatch(CORE_PATH_FRAGMENT);
  });

  it("treats --all as full-registry validate", async () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const { code, stderr } = await runCli(
      ["validate", "--all", "--libraries", CORE_LIBRARY],
      ROOT,
    );

    expect([0, 1]).toContain(code);
    expect(stderr).not.toMatch(/Wrote \d+ file\(s\)/);
    expect(stderr).toMatch(
      /Validation (succeeded|failed)\. Tested \d+ blocks?, \d+ with errors, \d+ warnings?, \d+ recommendations?\./,
    );
  });

  it("validates a single file against the project registry", async () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const { code, stderr } = await runCli(
      ["validate", CORE_LIBRARY, "--libraries", CORE_LIBRARY],
      ROOT,
    );

    expect([0, 1]).toContain(code);
    expect(stderr).not.toMatch(/Wrote \d+ file\(s\)/);
    expect(stderr).toMatch(
      /Validation (succeeded|failed)\. Tested 1 block, \d+ with errors, \d+ warnings?, \d+ recommendations?\./,
    );
  });

  it("returns 2 for a missing file", async () => {
    const { code, stderr } = await runCli(["validate", "no-such.bml"], ROOT);
    expect(code).toBe(2);
    expect(stderr).toMatch(/File not found: no-such\.bml/);
  });

  it("returns 2 when file and --all are combined", async () => {
    const { code } = await runCli(["validate", "no-such.bml", "--all"], ROOT);
    expect(code).toBe(2);
  });
});

describe("runCli validate (parse + semantic, no XSD)", () => {
  const tmpProject = join(import.meta.dirname, ".tmp-validate");

  beforeEach(() => {
    clearTargets();
    resetBootstrapTargets();
    mkdirSync(tmpProject, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpProject, { recursive: true, force: true });
    clearTargets();
    resetBootstrapTargets();
  });

  it("fails invalid structure without consulting XSD schemas", async () => {
    const srcDir = join(tmpProject, "src");
    mkdirSync(srcDir, { recursive: true });
    const file = join(srcDir, "Bad.bml");
    writeFileSync(
      file,
      `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:cli="com.test.cli">
  <name>Bad</name>
  <type>cli:Bad</type>
  <baseType>core:Block</baseType>
  <is>bad</is>
  <nmae>typo</nmae>
</block>`,
      "utf8",
    );

    const { code, stderr } = await runCli(["validate", "src/Bad.bml"], tmpProject);
    expect(code).toBe(1);
    expect(stderr).toMatch(/BML_UNKNOWN_ELEMENT/);
    expect(stderr).not.toMatch(/BML_XSD_VALIDATION_ERROR/);
    expect(stderr).toMatch(
      /Validation failed\. Tested 1 block, 1 with errors, \d+ warnings?, \d+ recommendations?\./,
    );
  });

  it("fails invalid root without XSD", async () => {
    const srcDir = join(tmpProject, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "Bad.bml"),
      `<?xml version="1.0" encoding="UTF-8"?>
<notBlock xmlns="http://blockml.org/bml"></notBlock>`,
      "utf8",
    );

    const { code, stderr } = await runCli(["validate", "src/Bad.bml"], tmpProject);
    expect(code).toBe(1);
    expect(stderr).toMatch(/BML_INVALID_ROOT/);
    expect(stderr).not.toMatch(/BML_XSD_VALIDATION_ERROR/);
    expect(stderr).toMatch(/Validation failed\. Tested 1 block,/);
  });

  it("accepts a type-as-root tag without XSD", async () => {
    const srcDir = join(tmpProject, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "Ok.bml"),
      `<cli:Ok xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:cli="com.test.cli">

  <name>Ok</name>
  <baseType>core:Block</baseType>
  <is>ok</is>
  <documentation>ok</documentation>
  <version>0.0.1</version>
</cli:Ok>
`,
      "utf8",
    );

    const { code, stderr } = await runCli(["validate", "src/Ok.bml"], tmpProject);
    expect(stderr).not.toMatch(/BML_INVALID_ROOT/);
    expect(code).toBe(0);
    expect(stderr).toMatch(/Validation succeeded\. Tested 1 block,/);
  });

  it("counts parse errors in the with-errors tally for project validate", async () => {
    const srcDir = join(tmpProject, "blocks");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(tmpProject, "package.json"),
      JSON.stringify({ name: "dup-value-validate", blockml: { srcDir: "blocks" } }),
      "utf8",
    );
    writeFileSync(
      join(srcDir, "Dup.bml"),
      `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:type="org.blockml.bml.type"
  xmlns:cli="com.test.cli">
  <name>Dup</name>
  <type>cli:Dup</type>
  <baseType>core:Block</baseType>
  <is>duplicate value</is>
  <properties>
    <title type="type:Text">
      <value>Keep</value>
      <value>Drop</value>
    </title>
  </properties>
</block>`,
      "utf8",
    );

    const { code, stderr } = await runCli(["validate"], tmpProject);
    expect(code).toBe(1);
    expect(stderr).toMatch(/BML_DUPLICATE_PROPERTY_VALUE/);
    expect(stderr).toMatch(
      /Validation failed\. Tested \d+ blocks?, 1 with errors, \d+ warnings?, \d+ recommendations?\./,
    );
  });
});

describe("xsd-validate standalone helper", () => {
  const tmpProject = join(import.meta.dirname, ".tmp-xsd-validate");

  beforeEach(() => {
    clearTargets();
    resetBootstrapTargets();
    mkdirSync(tmpProject, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpProject, { recursive: true, force: true });
    clearTargets();
    resetBootstrapTargets();
  });

  it("warns and skips when schemas are missing", () => {
    const srcDir = join(tmpProject, "src");
    mkdirSync(srcDir, { recursive: true });
    const file = join(srcDir, "Foo.bml");
    writeFileSync(
      file,
      `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:cli="com.test.cli">
  <name>Foo</name>
  <type>cli:Foo</type>
  <baseType>core:Block</baseType>
  <is>foo</is>
  <version>1.0.0</version>
</block>`,
      "utf8",
    );

    const diagnostics = validateFilesAgainstXsd([file], tmpProject);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "warning",
        code: "BML_XSD_SCHEMAS_MISSING",
      }),
    ]);
  });

  it("reports XSD validation error for invalid root element", () => {
    const schemasDir = join(tmpProject, "schemas");
    mkdirSync(schemasDir, { recursive: true });
    writeFileSync(join(tmpProject, "catalog.xml"), readFileSync(join(ROOT, "catalog.xml"), "utf8"));
    writeFileSync(join(schemasDir, "bml.xsd"), readFileSync(join(ROOT, "schemas/bml.xsd"), "utf8"));

    const srcDir = join(tmpProject, "src");
    mkdirSync(srcDir, { recursive: true });
    const file = join(srcDir, "Bad.bml");
    writeFileSync(
      file,
      `<?xml version="1.0" encoding="UTF-8"?>
<notBlock xmlns="http://blockml.org/bml"></notBlock>`,
      "utf8",
    );

    const diagnostics = validateFilesAgainstXsd([file], tmpProject);
    expect(diagnostics.some((d) => d.code === "BML_XSD_VALIDATION_ERROR")).toBe(true);
  });

  it("accepts valid block against bml.xsd", () => {
    const schemasDir = join(tmpProject, "schemas");
    mkdirSync(schemasDir, { recursive: true });
    writeFileSync(join(tmpProject, "catalog.xml"), readFileSync(join(ROOT, "catalog.xml"), "utf8"));
    writeFileSync(join(schemasDir, "bml.xsd"), readFileSync(join(ROOT, "schemas/bml.xsd"), "utf8"));

    const srcDir = join(tmpProject, "src");
    mkdirSync(srcDir, { recursive: true });
    const file = join(srcDir, "Good.bml");
    writeFileSync(
      file,
      `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:cli="com.test.cli">
  <name>Good</name>
  <type>cli:Good</type>
  <baseType>core:Block</baseType>
  <is>good</is>
  <version>1.0.0</version>
</block>`,
      "utf8",
    );

    const diagnostics = validateFilesAgainstXsd([file], tmpProject);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });
});

describe("runCli other commands", () => {
  const tmpProject = join(import.meta.dirname, ".tmp-xsd-project");
  const tmpOut = "schemas-out";

  beforeEach(() => {
    clearTargets();
    resetBootstrapTargets();
    mkdirSync(tmpProject, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpProject, { recursive: true, force: true });
    clearTargets();
    resetBootstrapTargets();
  });

  it("returns 2 for an unknown command", async () => {
    const { code, stderr } = await runCli(["frobnicate"], ROOT);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Usage: blockml/);
  });

  it("prints usage and exits 0 for --help and help", async () => {
    const flag = await runCli(["--help"], ROOT);
    expect(flag.code).toBe(0);
    expect(flag.stderr).toMatch(/Usage: blockml/);
    const token = await runCli(["help"], ROOT);
    expect(token.code).toBe(0);
    expect(token.stderr).toMatch(/Usage: blockml/);
  });

  it("requires host file or package.json blockml.library for fatblock", async () => {
    const { code, stderr } = await runCli(["compile", "fatblock"], tmpProject);
    expect(code).toBe(2);
    expect(stderr).toMatch(/fatblock requires a host <file> argument or package.json blockml.library/);
  });

  it("compiles fatblock into {hostFqn}.fat.bml at project root", async () => {
    const srcDir = join(tmpProject, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "Host.bml"),
      `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:cli="com.test.cli">
  <name>Host</name>
  <type>cli:Host</type>
  <baseType>core:Block</baseType>
  <is>host</is>
  <version>1.0.0</version>
</block>`,
      "utf8",
    );
    writeFileSync(
      join(srcDir, "Peer.bml"),
      `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:cli="com.test.cli">
  <name>Peer</name>
  <type>cli:Peer</type>
  <baseType>core:Block</baseType>
  <is>peer</is>
  <version>1.0.0</version>
</block>`,
      "utf8",
    );

    const { code, stderr } = await runCli(
      ["compile", "src/Host.bml", "fatblock", "--src", "src"],
      tmpProject,
    );

    expect(code, stderr).toBe(0);
    expect(stderr).toMatch(/Compilation succeeded\. Wrote .*com\.test\.cli\.Host\.fat\.bml/);
    expect(existsSync(join(tmpProject, "com.test.cli.Host.fat.bml"))).toBe(true);
    const fat = readFileSync(join(tmpProject, "com.test.cli.Host.fat.bml"), "utf8");
    expect(fat).toContain("<embeddedBlocks>");
    expect(fat).toContain("cli:Peer");
  });

  it("defaults fatblock host and src to package.json blockml.library", async () => {
    const libDir = join(tmpProject, "blocks", "com", "test", "lib");
    mkdirSync(libDir, { recursive: true });
    writeFileSync(
      join(tmpProject, "package.json"),
      JSON.stringify({
        name: "fatblock-default-lib",
        blockml: { library: "./blocks/com/test/lib/Library.bml" },
      }),
      "utf8",
    );
    writeFileSync(
      join(libDir, "Library.bml"),
      `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:lib="com.test.lib">
  <name>Library</name>
  <type>lib:Library</type>
  <baseType>core:Block</baseType>
  <is>library host</is>
  <version>1.0.0</version>
</block>`,
      "utf8",
    );
    writeFileSync(
      join(libDir, "Peer.bml"),
      `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:lib="com.test.lib">
  <name>Peer</name>
  <type>lib:Peer</type>
  <baseType>core:Block</baseType>
  <is>library peer</is>
  <version>1.0.0</version>
</block>`,
      "utf8",
    );

    const { code, stderr } = await runCli(["compile", "fatblock"], tmpProject);

    expect(code, stderr).toBe(0);
    expect(stderr).toMatch(/Compilation succeeded\. Wrote .*com\.test\.lib\.Library\.fat\.bml/);
    expect(existsSync(join(tmpProject, "com.test.lib.Library.fat.bml"))).toBe(true);
    const fat = readFileSync(join(tmpProject, "com.test.lib.Library.fat.bml"), "utf8");
    expect(fat).toContain("<embeddedBlocks>");
    expect(fat).toContain("lib:Peer");
  });

  it("rejects --per-package for non-fatblock targets", async () => {
    const { code, stderr } = await runCli(
      ["compile", "blockdoc", "--per-package"],
      tmpProject,
    );
    expect(code).toBe(2);
    expect(stderr).toMatch(/--per-package is only valid for fatblock/);
  });

  it("rejects --per-package combined with a host file", async () => {
    const { code, stderr } = await runCli(
      ["compile", "src/Host.bml", "fatblock", "--per-package"],
      tmpProject,
    );
    expect(code).toBe(2);
    expect(stderr).toMatch(/--per-package cannot be combined with a host <file>/);
  });

  it("compiles one fatblock per local package with --per-package", async () => {
    const writeLib = (dir: string, ns: string, peerName: string) => {
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "Library.bml"),
        `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:lib="${ns}">
  <name>Library</name>
  <type>lib:Library</type>
  <baseType>core:Block</baseType>
  <is>library host</is>
  <version>1.0.0</version>
</block>`,
        "utf8",
      );
      writeFileSync(
        join(dir, `${peerName}.bml`),
        `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:lib="${ns}">
  <name>${peerName}</name>
  <type>lib:${peerName}</type>
  <baseType>core:Block</baseType>
  <is>${peerName}</is>
  <version>1.0.0</version>
</block>`,
        "utf8",
      );
    };

    writeFileSync(
      join(tmpProject, "package.json"),
      JSON.stringify({
        name: "fatblock-workspace",
        blockml: { library: "./blocks/root/Library.bml" },
      }),
      "utf8",
    );
    writeLib(join(tmpProject, "blocks", "root"), "com.test.root", "RootPeer");

    const alpha = join(tmpProject, "packages", "alpha");
    mkdirSync(alpha, { recursive: true });
    writeFileSync(
      join(alpha, "package.json"),
      JSON.stringify({
        name: "alpha",
        blockml: { library: "./blocks/lib/Library.bml" },
      }),
      "utf8",
    );
    writeLib(join(alpha, "blocks", "lib"), "com.test.alpha", "AlphaPeer");

    const { code, stderr } = await runCli(
      ["compile", "fatblock", "--per-package"],
      tmpProject,
    );

    expect(code, stderr).toBe(0);
    expect(stderr).toMatch(/Compilation succeeded\. Wrote 2 file\(s\):/);
    expect(existsSync(join(tmpProject, "com.test.root.Library.fat.bml"))).toBe(true);
    expect(existsSync(join(tmpProject, "com.test.alpha.Library.fat.bml"))).toBe(true);
    expect(existsSync(join(alpha, "Library.fat.bml"))).toBe(false);
    expect(
      readFileSync(join(tmpProject, "com.test.root.Library.fat.bml"), "utf8"),
    ).toContain("lib:RootPeer");
    expect(
      readFileSync(join(tmpProject, "com.test.alpha.Library.fat.bml"), "utf8"),
    ).toContain("lib:AlphaPeer");
    expect(
      readFileSync(join(tmpProject, "com.test.root.Library.fat.bml"), "utf8"),
    ).not.toContain("lib:AlphaPeer");
  });

  it("rejects fatblock when host already has embeddedBlocks", async () => {
    const srcDir = join(tmpProject, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "Host.bml"),
      `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:cli="com.test.cli">
  <name>Host</name>
  <type>cli:Host</type>
  <baseType>core:Block</baseType>
  <is>host</is>
  <embeddedBlocks>
    <block>
      <type>cli:Nested</type>
      <baseType>core:Block</baseType>
      <is>nested</is>
      <version>1.0.0</version>
    </block>
  </embeddedBlocks>
</block>`,
      "utf8",
    );

    const { code, stderr } = await runCli(
      ["compile", "src/Host.bml", "fatblock", "--src", "src"],
      tmpProject,
    );

    expect(code).toBe(1);
    expect(stderr).toMatch(/BML_FATBLOCK_HOST_HAS_EMBEDDED_BLOCKS/);
    expect(stderr).toMatch(/Compilation failed with \d+ error\(s\)\./);
  });

  it("rejects fatblock when embed candidate has embeddedBlocks", async () => {
    const srcDir = join(tmpProject, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(
      join(srcDir, "Host.bml"),
      `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:cli="com.test.cli">
  <name>Host</name>
  <type>cli:Host</type>
  <baseType>core:Block</baseType>
  <is>host</is>
  <version>1.0.0</version>
</block>`,
      "utf8",
    );
    writeFileSync(
      join(srcDir, "Peer.bml"),
      `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:cli="com.test.cli">
  <name>Peer</name>
  <type>cli:Peer</type>
  <baseType>core:Block</baseType>
  <is>peer</is>
  <embeddedBlocks>
    <block>
      <type>cli:AlreadyFat</type>
      <baseType>core:Block</baseType>
      <is>already fat</is>
      <version>1.0.0</version>
    </block>
  </embeddedBlocks>
</block>`,
      "utf8",
    );

    const { code, stderr } = await runCli(
      ["compile", "src/Host.bml", "fatblock", "--src", "src"],
      tmpProject,
    );

    expect(code).toBe(1);
    expect(stderr).toMatch(/BML_FATBLOCK_EMBED_HAS_EMBEDDED_BLOCKS/);
    expect(stderr).toMatch(/Compilation failed with \d+ error\(s\)\./);
  });

  it("compiles xsd schemas and root catalog", async () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const { code, stderr } = await runCli(
      ["compile", "xsd", "--out", tmpOut, "--libraries", CORE_LIBRARY],
      tmpProject,
    );

    expect(code, stderr).toBe(0);
    expect(stderr).toMatch(/Compilation succeeded\. Wrote 3 file\(s\)/);
    expect(stderr).toMatch(/catalog\.xml/);

    expect(existsSync(join(tmpProject, tmpOut, "bml.xsd"))).toBe(true);
    expect(existsSync(join(tmpProject, tmpOut, "types.xsd"))).toBe(true);
    expect(existsSync(join(tmpProject, tmpOut, "service.xsd"))).toBe(true);

    const catalogPath = join(tmpProject, "catalog.xml");
    expect(existsSync(catalogPath)).toBe(true);
    const catalog = readFileSync(catalogPath, "utf8");
    expect(catalog).toContain(`name="${BML_DOCUMENT_NS}"`);
    expect(catalog).toContain(`uri="./${tmpOut}/bml.xsd"`);
  });
});
