import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");

describe("blockml help pages", () => {
  it("prints root help with workflow and tool roles for --help and help", async () => {
    const flag = await runCli(["--help"], ROOT);
    expect(flag.code).toBe(0);
    expect(flag.stderr).toMatch(/Usage: blockml/);
    expect(flag.stderr).toMatch(/Workflow:/);
    expect(flag.stderr).toMatch(/search\s+where something is/);
    expect(flag.stderr).toMatch(/scan\s+which packages or types match selectors/);
    expect(flag.stderr).toMatch(/inspect\s+give me this Block already resolved/);
    expect(flag.stderr).toMatch(/graph\s+how it connects/);
    expect(flag.stderr).toMatch(/blockml <command> --help/);

    const token = await runCli(["help"], ROOT);
    expect(token.code).toBe(0);
    expect(token.stderr).toBe(flag.stderr);
  });

  it("prints inspect help with depth cap and not a write format", async () => {
    const { code, stderr } = await runCli(["inspect", "--help"], ROOT);
    expect(code).toBe(0);
    expect(stderr).toMatch(/Usage: blockml inspect/);
    expect(stderr).toMatch(/cap 3/);
    expect(stderr).toMatch(/Not a write format/);
    expect(stderr).not.toMatch(/Workflow:/);
  });

  it("prints graph help without compile usage", async () => {
    const { code, stderr } = await runCli(["graph", "--help"], ROOT);
    expect(code).toBe(0);
    expect(stderr).toMatch(/Usage: blockml graph/);
    expect(stderr).toMatch(/Prefer named operations/);
    expect(stderr).not.toMatch(/blockml compile/);
  });

  it("prints search, validate, compile, new, and transform help", async () => {
    const search = await runCli(["search", "--help"], ROOT);
    expect(search.code).toBe(0);
    expect(search.stderr).toMatch(/When: find FQNs/);

    const scan = await runCli(["scan", "--help"]);
    expect(scan.code).toBe(0);
    expect(scan.stderr).toMatch(/When: list packages or types/);

    const validate = await runCli(["validate", "--help"], ROOT);
    expect(validate.code).toBe(0);
    expect(validate.stderr).toMatch(/Do not use --all as the default/);

    const compile = await runCli(["compile", "--help"], ROOT);
    expect(compile.code).toBe(0);
    expect(compile.stderr).toMatch(/Do not patch compile output/);

    const created = await runCli(["new", "--help"], ROOT);
    expect(created.code).toBe(0);
    expect(created.stderr).toMatch(/owning Library catalog/);

    const transform = await runCli(["transform", "--help"], ROOT);
    expect(transform.code).toBe(0);
    expect(transform.stderr).toMatch(/available template/);
  });

  it("prints short USAGE on unknown command without the workflow block", async () => {
    const { code, stderr } = await runCli(["frobnicate"], ROOT);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Usage: blockml/);
    expect(stderr).not.toMatch(/Workflow:/);
    expect(stderr).not.toMatch(/Do not invent model semantics/);
  });

  it("prints short inspect usage when FQN is missing", async () => {
    const { code, stderr } = await runCli(["inspect"], ROOT);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Specify a Block FQN/);
    expect(stderr).toMatch(/Usage: blockml inspect/);
    expect(stderr).not.toMatch(/Not a write format/);
  });
});
