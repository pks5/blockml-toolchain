import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseArgs, runCli } from "../src/cli.js";

const TMP = join(import.meta.dirname, ".tmp-cli-inspect");
const NS = "com.blockml.test.cliinspect";

function sampleBlock(name: string, extra = "  <documentation>cli inspect fixture</documentation>"): string {
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ` xmlns:test="${NS}">`,
    `  <name>${name}</name>`,
    `  <type>test:${name}</type>`,
    "  <baseType>core:Block</baseType>",
    "  <is>cli inspect fixture</is>",
    extra,
    "</block>",
    "",
  ].join("\n");
}

describe("parseArgs inspect", () => {
  it("maps FQN and depth 0", () => {
    const parsed = parseArgs(["inspect", "org.example.Customer", "--depth", "0", "--json"]);
    expect(parsed.command).toBe("inspect");
    expect(parsed.inspectFqn).toBe("org.example.Customer");
    expect(parsed.depth).toBe(0);
    expect(parsed.json).toBe(true);
  });

  it("maps --help", () => {
    const parsed = parseArgs(["inspect", "--help"]);
    expect(parsed.command).toBe("inspect");
    expect(parsed.help).toBe(true);
  });
});

describe("blockml inspect CLI", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(join(TMP, "blocks"), { recursive: true });
    writeFileSync(join(TMP, "package.json"), JSON.stringify({ name: "cli-inspect-fixture", private: true }));
    writeFileSync(join(TMP, "blocks/Widget.bml"), sampleBlock("Widget"));
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("prints InspectResult JSON for a known FQN", async () => {
    const { code, stderr } = await runCli(["inspect", `${NS}.Widget`, "--depth", "0"], TMP);
    expect(code).toBe(0);
    const jsonStart = stderr.indexOf("{");
    expect(jsonStart).toBeGreaterThanOrEqual(0);
    const result = JSON.parse(stderr.slice(jsonStart)) as {
      root: string;
      depth: number;
      blocks: Record<string, { fqn: string; name: string }>;
    };
    expect(result.root).toBe(`${NS}.Widget`);
    expect(result.depth).toBe(0);
    expect(result.blocks[`${NS}.Widget`]?.name).toBe("Widget");
  });

  it("returns 2 for an unknown FQN", async () => {
    const { code, stderr } = await runCli(["inspect", `${NS}.Missing`], TMP);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Unknown Block FQN/);
  });

  it("returns 2 when FQN is missing", async () => {
    const { code, stderr } = await runCli(["inspect"], TMP);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Specify a Block FQN/);
    expect(stderr).toMatch(/Usage: blockml inspect/);
  });

  it("prints inspect usage and exits 0 for --help", async () => {
    const { code, stderr } = await runCli(["inspect", "--help"], TMP);
    expect(code).toBe(0);
    expect(stderr).toMatch(/Usage: blockml inspect/);
  });

  it("suggests a matching FQN for an unknown short name", async () => {
    const { code, stderr } = await runCli(["inspect", "Widget"], TMP);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Unknown Block FQN: Widget/);
    expect(stderr).toMatch(/Did you mean com\.blockml\.test\.cliinspect\.Widget\?/);
  });

  it("suggests the document-root FQN for a .bml path and still exits 2", async () => {
    const { code, stderr } = await runCli(["inspect", "blocks/Widget.bml"], TMP);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Unknown Block FQN: blocks\/Widget\.bml/);
    expect(stderr).toMatch(/Did you mean com\.blockml\.test\.cliinspect\.Widget\?/);
  });

  it("does not suggest an FQN for a .bml path that is not in the corpus", async () => {
    const { code, stderr } = await runCli(["inspect", "blocks/Missing.bml"], TMP);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Unknown Block FQN: blocks\/Missing\.bml/);
    expect(stderr).not.toMatch(/Did you mean/);
  });
});
