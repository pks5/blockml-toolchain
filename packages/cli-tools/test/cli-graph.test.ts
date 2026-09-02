import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseArgs, runCli } from "../src/cli.js";

const TMP = join(import.meta.dirname, ".tmp-cli-graph");

function sampleBlock(name: string, extra = ""): string {
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:test="com.blockml.test.cligraph">',
    `  <name>${name}</name>`,
    `  <type>test:${name}</type>`,
    "  <baseType>core:Block</baseType>",
    "  <is>cli graph fixture</is>",
    "  <documentation>cli graph fixture</documentation>",
    extra,
    "</block>",
    "",
  ].join("\n");
}

describe("parseArgs graph", () => {
  it("maps graph uses FQN --json", () => {
    const parsed = parseArgs(["graph", "uses", "org.example.Wall", "--json"]);
    expect(parsed.command).toBe("graph");
    expect(parsed.subcommand).toBe("uses");
    expect(parsed.graphFqn).toBe("org.example.Wall");
    expect(parsed.json).toBe(true);
  });

  it("maps graph path from to --depth", () => {
    const parsed = parseArgs(["graph", "path", "org.example.Wall", "org.blockml.bml.core.Number", "--depth", "8"]);
    expect(parsed.subcommand).toBe("path");
    expect(parsed.graphFqn).toBe("org.example.Wall");
    expect(parsed.graphTo).toBe("org.blockml.bml.core.Number");
    expect(parsed.depth).toBe(8);
  });

  it("joins graph query tokens", () => {
    const parsed = parseArgs(["graph", "query", "MATCH", "(a:Block)", "RETURN", "a.fqn"]);
    expect(parsed.subcommand).toBe("query");
    expect(parsed.query).toBe("MATCH (a:Block) RETURN a.fqn");
  });
});

describe("blockml graph CLI", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(join(TMP, "blocks"), { recursive: true });
    writeFileSync(join(TMP, "package.json"), JSON.stringify({ name: "cli-graph-fixture", private: true }));
    writeFileSync(join(TMP, "blocks/Omega.bml"), sampleBlock("Omega"));
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("builds an index when missing and prints human-readable uses", async () => {
    const { code, stderr } = await runCli(["graph", "uses", "com.blockml.test.cligraph.Omega"], TMP);
    expect(code).toBe(0);
    expect(stderr).toMatch(/Graph index missing; building/);
    expect(stderr).toMatch(/BASE_TYPE/);
    expect(stderr).toMatch(/org\.blockml\.bml\.core\.Block/);
  });

  it("emits stable JSON GraphNeighbor objects", async () => {
    await runCli(["graph", "index"], TMP);
    const { code, stderr } = await runCli(["graph", "uses", "com.blockml.test.cligraph.Omega", "--json"], TMP);
    expect(code).toBe(0);
    const jsonStart = stderr.indexOf("[");
    expect(jsonStart).toBeGreaterThanOrEqual(0);
    const hits = JSON.parse(stderr.slice(jsonStart)) as Array<{
      relation: string;
      node: { fqn: string };
    }>;
    expect(hits.some((hit) => hit.relation === "BASE_TYPE" && hit.node.fqn === "org.blockml.bml.core.Block")).toBe(
      true,
    );
  });
});
