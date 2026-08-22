import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { clearTargets } from "@blockml/compiler";
import { BML_DOCUMENT_NS } from "@blockml/xsd-target";
import { parseArgs, runCli } from "../src/cli.js";
import { resetBootstrapTargets } from "../src/bootstrap-targets.js";
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

describe("parseArgs", () => {
  it("maps compile positional to target", () => {
    expect(parseArgs(["compile", "blockdoc"]).target).toBe("blockdoc");
    expect(parseArgs(["compile", "blockdoc"]).file).toBeUndefined();
  });

  it("maps validate positional to file", () => {
    const parsed = parseArgs(["validate", "src/Foo.bml", "--all"]);
    expect(parsed.command).toBe("validate");
    expect(parsed.file).toBe("src/Foo.bml");
    expect(parsed.all).toBe(true);
    expect(parsed.target).toBeUndefined();
  });

  it("maps --no-xsd", () => {
    expect(parseArgs(["validate", "--no-xsd"]).noXsd).toBe(true);
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
  it("validates corpus from libraries without writing output", async () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const { code, stderr } = await runCli(
      ["validate", "--libraries", CORE_LIBRARY, "--no-xsd"],
      ROOT,
    );

    expect([0, 1]).toContain(code);
    expect(stderr).not.toMatch(/Wrote \d+ file\(s\)/);
    if (code === 1) {
      expect(stderr).toMatch(/\berror\b/);
    }
    if (stderr) {
      expect(stderr).toMatch(/^\w+ \w+ /m);
    }
  });

  it("treats --all as corpus validate", async () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const { code, stderr } = await runCli(
      ["validate", "--all", "--libraries", CORE_LIBRARY, "--no-xsd"],
      ROOT,
    );

    expect([0, 1]).toContain(code);
    expect(stderr).not.toMatch(/Wrote \d+ file\(s\)/);
  });

  it("validates a single file against the project registry", async () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const { code, stderr } = await runCli(
      ["validate", CORE_LIBRARY, "--libraries", CORE_LIBRARY, "--no-xsd"],
      ROOT,
    );

    expect([0, 1]).toContain(code);
    expect(stderr).not.toMatch(/Wrote \d+ file\(s\)/);
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

describe("runCli validate XSD", () => {
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

  it("reports XSD validation error for invalid root element", async () => {
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

    const { code, stderr } = await runCli(["validate", "src/Bad.bml"], tmpProject);
    expect(code).toBe(1);
    expect(stderr).toMatch(/BML_XSD_VALIDATION_ERROR/);
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

  it("skips XSD validation with --no-xsd even for invalid XML shape", async () => {
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

    const { stderr } = await runCli(["validate", "src/Bad.bml", "--no-xsd"], tmpProject);
    expect(stderr).not.toMatch(/BML_XSD_VALIDATION_ERROR/);
  });

  it("skips XSD validation when bom.config.json sets xsdValidation false", async () => {
    const schemasDir = join(tmpProject, "schemas");
    mkdirSync(schemasDir, { recursive: true });
    writeFileSync(join(tmpProject, "catalog.xml"), readFileSync(join(ROOT, "catalog.xml"), "utf8"));
    writeFileSync(join(schemasDir, "bml.xsd"), readFileSync(join(ROOT, "schemas/bml.xsd"), "utf8"));
    writeFileSync(
      join(tmpProject, "bom.config.json"),
      JSON.stringify({ xsdValidation: false }),
      "utf8",
    );

    const srcDir = join(tmpProject, "src");
    mkdirSync(srcDir, { recursive: true });
    const file = join(srcDir, "Bad.bml");
    writeFileSync(
      file,
      `<?xml version="1.0" encoding="UTF-8"?>
<notBlock xmlns="http://blockml.org/bml"></notBlock>`,
      "utf8",
    );

    const { stderr } = await runCli(["validate", "src/Bad.bml"], tmpProject);
    expect(stderr).not.toMatch(/BML_XSD_VALIDATION_ERROR/);
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
    const { code, stderr } = await runCli(["inspect"], ROOT);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Usage: blockml/);
  });

  it("requires host file and --src for fatblock", async () => {
    const { code, stderr } = await runCli(["compile", "fatblock"], ROOT);
    expect(code).toBe(2);
    expect(stderr).toMatch(/fatblock requires a host <file> argument/);
  });

  it("compiles fatblock into Host.fat.bml", async () => {
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
    expect(stderr).toMatch(/Wrote .*Host\.fat\.bml/);
    expect(existsSync(join(tmpProject, "src", "Host.fat.bml"))).toBe(true);
    const fat = readFileSync(join(tmpProject, "src", "Host.fat.bml"), "utf8");
    expect(fat).toContain("<embeddedBlocks>");
    expect(fat).toContain("cli:Peer");
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
    expect(stderr).toMatch(/Wrote 3 file\(s\)/);
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
