import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseArgs, runCli } from "../src/cli.js";
import { destinationPathForNew, isValidBlockFqn, locateOwningLibrary } from "../src/run-new.js";
import { TypeRegistry } from "@blockml/framework";

const TMP = join(import.meta.dirname, ".tmp-cli-new");

function libraryXml(): string {
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    ' xsi:schemaLocation="http://blockml.org/bml https://blockml.org/schemas/bml.xsd"',
    ' xmlns:blockml="org.blockml.bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:example="com.example">',
    "  <name>Library</name>",
    "  <type>example:Library</type>",
    "  <baseType>core:BlockLibrary</baseType>",
    "  <is>cli new fixture library</is>",
    "  <version>0.0.1</version>",
    "  <language>",
    "    <English />",
    "  </language>",
    "  <aggregations>",
    "    <dependencies>",
    "      <composition>",
    "        <blockml:Library />",
    "      </composition>",
    "    </dependencies>",
    "  </aggregations>",
    "</block>",
    "",
  ].join("\n");
}

describe("parseArgs new", () => {
  it("maps new FQN with --baseType and --is", () => {
    const parsed = parseArgs([
      "new",
      "com.example.Foo",
      "--baseType",
      "org.blockml.bml.core.Block",
      "--is",
      "A foo block",
    ]);
    expect(parsed.command).toBe("new");
    expect(parsed.newFqn).toBe("com.example.Foo");
    expect(parsed.newBaseType).toBe("org.blockml.bml.core.Block");
    expect(parsed.newIs).toBe("A foo block");
  });
});

describe("new path helpers", () => {
  it("accepts dotted PascalCase FQNs", () => {
    expect(isValidBlockFqn("com.example.Foo")).toBe(true);
    expect(isValidBlockFqn("Foo")).toBe(false);
    expect(isValidBlockFqn("com.example.foo-bar")).toBe(false);
  });

  it("resolves destination under the owning Library directory", () => {
    const registry = new TypeRegistry();
    registry.register({
      kind: "block",
      source: { filePath: "/proj/blocks/com/example/Library.bml", format: "xml" },
      block: {
        name: "Library",
        type: "com.example.Library",
        is: "lib",
        members: [],
        subBlocks: [],
        embeddedBlocks: [],
        compositions: [],
      },
    });
    const owning = locateOwningLibrary(registry, "com.example.widget.Bar");
    expect(owning?.packageFqn).toBe("com.example");
    expect(destinationPathForNew("com.example.widget.Bar", owning, "/proj", "blocks")).toBe(
      "/proj/blocks/com/example/widget/Bar.bml",
    );
  });
});

describe("blockml new CLI", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(join(TMP, "blocks/com/example"), { recursive: true });
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({
        name: "cli-new-fixture",
        private: true,
        blockml: { library: "./blocks/com/example/Library.bml" },
      }),
    );
    writeFileSync(join(TMP, "blocks/com/example/Library.bml"), libraryXml());
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("creates a block file under the owning Library", async () => {
    const { code, stderr } = await runCli(
      ["new", "com.example.Foo", "--is", "A foo block"],
      TMP,
    );
    expect(code, stderr).toBe(0);
    expect(stderr).toMatch(/Created /);
    const created = readFileSync(join(TMP, "blocks/com/example/Foo.bml"), "utf8");
    expect(created).toMatch(/<example:Foo\b/);
    expect(created).toMatch(/<\/example:Foo>/);
    expect(created).not.toContain("xsi:schemaLocation");
    expect(created).not.toContain("xmlns:xsi");
    expect(created).not.toMatch(/<type>/);
    expect(created).toContain("Foo");
    expect(created).toContain("com.example");
    expect(created).toContain("A foo block");
    const library = readFileSync(join(TMP, "blocks/com/example/Library.bml"), "utf8");
    expect(library).not.toMatch(/<example:Foo\s*\/>/);
  });

  it("refuses to overwrite an existing file", async () => {
    await runCli(["new", "com.example.Foo", "--is", "A foo block"], TMP);
    const { code, stderr } = await runCli(["new", "com.example.Foo"], TMP);
    expect(code).toBe(1);
    expect(stderr).toMatch(/already exists/);
  });
});
