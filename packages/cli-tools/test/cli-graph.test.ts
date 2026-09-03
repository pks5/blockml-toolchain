import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseArgs, runCli } from "../src/cli.js";

const TMP = join(import.meta.dirname, ".tmp-cli-graph");

function sampleBlock(name: string, extra = "", baseType = "core:Block"): string {
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:test="com.blockml.test.cligraph">',
    `  <name>${name}</name>`,
    `  <type>test:${name}</type>`,
    `  <baseType>${baseType}</baseType>`,
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

  it("maps --help and uses --depth", () => {
    const help = parseArgs(["graph", "--help"]);
    expect(help.command).toBe("graph");
    expect(help.help).toBe(true);
    const depth = parseArgs(["graph", "uses", "org.example.Wall", "--depth", "2"]);
    expect(depth.depth).toBe(2);
  });

  it("maps --origin --relation --limit", () => {
    const parsed = parseArgs([
      "graph",
      "used-by",
      "org.example.Wall",
      "--origin",
      "workspace,dependency",
      "--relation",
      "BASE_TYPE,MEMBER_TYPE",
      "--limit",
      "5",
    ]);
    expect(parsed.origin).toBe("workspace,dependency");
    expect(parsed.relation).toBe("BASE_TYPE,MEMBER_TYPE");
    expect(parsed.limit).toBe(5);
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

  it("returns 2 for an unknown FQN", async () => {
    await runCli(["graph", "index"], TMP);
    const { code, stderr } = await runCli(["graph", "uses", "com.blockml.test.cligraph.Missing"], TMP);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Unknown Block FQN: com\.blockml\.test\.cligraph\.Missing/);
  });

  it("returns 2 for an unknown path endpoint", async () => {
    await runCli(["graph", "index"], TMP);
    const { code, stderr } = await runCli(
      ["graph", "path", "com.blockml.test.cligraph.Omega", "com.blockml.test.cligraph.Missing"],
      TMP,
    );
    expect(code).toBe(2);
    expect(stderr).toMatch(/Unknown Block FQN: com\.blockml\.test\.cligraph\.Missing/);
  });

  it("prints graph usage and exits 0 for --help", async () => {
    const { code, stderr } = await runCli(["graph", "--help"], TMP);
    expect(code).toBe(0);
    expect(stderr).toMatch(/Usage: blockml graph/);
    expect(stderr).not.toMatch(/blockml compile/);
  });

  it("suggests a matching FQN for an unknown short name", async () => {
    await runCli(["graph", "index"], TMP);
    const { code, stderr } = await runCli(["graph", "uses", "Omega"], TMP);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Unknown Block FQN: Omega/);
    expect(stderr).toMatch(/Did you mean com\.blockml\.test\.cligraph\.Omega\?/);
  });

  it("suggests the document-root FQN for a .bml path and still exits 2", async () => {
    await runCli(["graph", "index"], TMP);
    const { code, stderr } = await runCli(["graph", "uses", "blocks/Omega.bml"], TMP);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Unknown Block FQN: blocks\/Omega\.bml/);
    expect(stderr).toMatch(/Did you mean com\.blockml\.test\.cligraph\.Omega\?/);
  });

  it("prints an outgoing path and no reverse path through Block", async () => {
    await runCli(["graph", "index"], TMP);
    const omega = "com.blockml.test.cligraph.Omega";
    const core = "org.blockml.bml.core.Block";
    const forward = await runCli(["graph", "path", omega, core], TMP);
    expect(forward.code).toBe(0);
    expect(forward.stderr).toMatch(/--BASE_TYPE-->/);
    const reverse = await runCli(["graph", "path", core, omega], TMP);
    expect(reverse.code).toBe(0);
    expect(reverse.stderr).toMatch(/No path\./);
  });

  it("prints a Ladybug Cypher example on graph schema", async () => {
    await runCli(["graph", "index"], TMP);
    const { code, stderr } = await runCli(["graph", "schema"], TMP);
    expect(code).toBe(0);
    expect(stderr).toMatch(/type\(\)/);
    expect(stderr).toMatch(/shortestPath\(\)/);
    expect(stderr).toMatch(/example: MATCH \(a:Block \{fqn: \$fqn\}\)/);
  });

  it("filters uses by origin, relation, and limit", async () => {
    writeFileSync(join(TMP, "blocks/Alpha.bml"), sampleBlock("Alpha", "", "test:Omega"));
    await runCli(["graph", "index"], TMP);
    const omega = "com.blockml.test.cligraph.Omega";
    const alpha = "com.blockml.test.cligraph.Alpha";

    const usedByWorkspace = await runCli(
      ["graph", "used-by", omega, "--json", "--origin", "workspace"],
      TMP,
    );
    expect(usedByWorkspace.code).toBe(0);
    const workspaceHits = JSON.parse(
      usedByWorkspace.stderr.slice(usedByWorkspace.stderr.indexOf("[")),
    ) as Array<{ node: { fqn: string }; relation: string }>;
    expect(workspaceHits.some((hit) => hit.node.fqn === alpha && hit.relation === "BASE_TYPE")).toBe(true);

    const usedByDep = await runCli(
      ["graph", "used-by", omega, "--json", "--origin", "dependency"],
      TMP,
    );
    expect(usedByDep.code).toBe(0);
    const depHits = JSON.parse(usedByDep.stderr.slice(usedByDep.stderr.indexOf("["))) as Array<{
      node: { fqn: string };
    }>;
    expect(depHits.some((hit) => hit.node.fqn === alpha)).toBe(false);

    const byRelation = await runCli(["graph", "used-by", omega, "--json", "--relation", "MEMBER_TYPE"], TMP);
    expect(byRelation.code).toBe(0);
    const relationHits = JSON.parse(byRelation.stderr.slice(byRelation.stderr.indexOf("["))) as unknown[];
    expect(relationHits).toEqual([]);

    const limited = await runCli(["graph", "used-by", omega, "--json", "--origin", "workspace", "--limit", "1"], TMP);
    expect(limited.code).toBe(0);
    const limitedHits = JSON.parse(limited.stderr.slice(limited.stderr.indexOf("["))) as unknown[];
    expect(limitedHits).toHaveLength(1);

    const bad = await runCli(["graph", "used-by", omega, "--origin", "nope"], TMP);
    expect(bad.code).toBe(2);
    expect(bad.stderr).toMatch(/Unknown origin: nope/);
  });
});
