import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseArgs, runCli } from "../src/cli.js";

const TMP = join(import.meta.dirname, ".tmp-cli-search");

function sampleBlock(name: string, extra: string): string {
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:test="com.blockml.test.clisearch">',
    `  <name>${name}</name>`,
    `  <type>test:${name}</type>`,
    "  <baseType>core:Block</baseType>",
    "  <is>cli search fixture</is>",
    extra,
    "</block>",
    "",
  ].join("\n");
}

describe("parseArgs search", () => {
  it("joins query tokens", () => {
    const parsed = parseArgs(["search", "AI", "workspace", "--json", "--limit", "5"]);
    expect(parsed.command).toBe("search");
    expect(parsed.query).toBe("AI workspace");
    expect(parsed.json).toBe(true);
    expect(parsed.limit).toBe(5);
    expect(parsed.index).toBeUndefined();
  });

  it("maps search index --force", () => {
    const parsed = parseArgs(["search", "index", "--force"]);
    expect(parsed.command).toBe("search");
    expect(parsed.index).toBe(true);
    expect(parsed.force).toBe(true);
    expect(parsed.query).toBeUndefined();
  });
});

describe("blockml search CLI", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(join(TMP, "blocks"), { recursive: true });
    writeFileSync(join(TMP, "package.json"), JSON.stringify({ name: "cli-search-fixture", private: true }));
    writeFileSync(
      join(TMP, "blocks/Omega.bml"),
      sampleBlock("Omega", "  <aliases>cli-omega-alias</aliases>\n  <documentation>cli omega docs</documentation>"),
    );
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("builds an index when missing and prints human-readable hits", async () => {
    const { code, stderr } = await runCli(["search", "cli-omega-alias"], TMP);
    expect(code).toBe(0);
    expect(stderr).toMatch(/Search index missing; building/);
    expect(stderr).toMatch(/com\.blockml\.test\.clisearch\.Omega/);
    expect(stderr).toMatch(/blocks\/Omega\.bml/);
  });

  it("emits stable JSON SearchResult objects", async () => {
    await runCli(["search", "index"], TMP);
    const { code, stderr } = await runCli(["search", "cli-omega-alias", "--json"], TMP);
    expect(code).toBe(0);
    const jsonStart = stderr.indexOf("[");
    expect(jsonStart).toBeGreaterThanOrEqual(0);
    const hits = JSON.parse(stderr.slice(jsonStart)) as Array<{
      fqn: string;
      name: string;
      file: string;
      score: number;
    }>;
    expect(hits[0]?.fqn).toBe("com.blockml.test.clisearch.Omega");
    expect(hits[0]?.name).toBe("Omega");
    expect(hits[0]?.file).toContain("Omega.bml");
    expect(typeof hits[0]?.score).toBe("number");
    expect(hits[0]).toHaveProperty("fqn");
    expect(hits[0]).toHaveProperty("name");
    expect(hits[0]).toHaveProperty("file");
    expect(hits[0]).toHaveProperty("score");
  });

  it("rebuilds via search index", async () => {
    const { code, stderr } = await runCli(["search", "index"], TMP);
    expect(code).toBe(0);
    expect(stderr).toMatch(/Indexed \d+ blocks/);
  });
});
