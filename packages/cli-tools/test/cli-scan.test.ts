import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { parseArgs, runCli } from "../src/cli.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");

describe("parseArgs scan", () => {
  it("maps package|type and selector list", () => {
    const parsed = parseArgs([
      "scan",
      "type",
      "org.blockml.bml.core.*",
      "org.blockml.bml.type.**",
      "--json",
    ]);
    expect(parsed.command).toBe("scan");
    expect(parsed.subcommand).toBe("type");
    expect(parsed.selectors).toEqual(["org.blockml.bml.core.*", "org.blockml.bml.type.**"]);
    expect(parsed.json).toBe(true);
  });

  it("maps --help", () => {
    const parsed = parseArgs(["scan", "--help"]);
    expect(parsed.command).toBe("scan");
    expect(parsed.help).toBe(true);
  });
});

describe("blockml scan CLI", () => {
  it("prints a matching type FQN", async () => {
    const { code, stderr } = await runCli(["scan", "type", "org.blockml.bml.core.Block"], ROOT);
    expect(code).toBe(0);
    expect(stderr.trim().split("\n")).toEqual(["org.blockml.bml.core.Block"]);
  });

  it("emits sorted JSON string[]", async () => {
    const { code, stderr } = await runCli(
      ["scan", "type", "org.blockml.bml.core.Block", "--json"],
      ROOT,
    );
    expect(code).toBe(0);
    expect(JSON.parse(stderr)).toEqual(["org.blockml.bml.core.Block"]);
  });

  it("exits 2 on an invalid selector", async () => {
    const { code, stderr } = await runCli(["scan", "type", "org.blockml.bml.core.Foo**"], ROOT);
    expect(code).toBe(2);
    expect(stderr).toMatch(/not a type selector|Specify one or more|Usage: blockml scan/);
  });

  it("exits 2 when selectors are missing", async () => {
    const { code, stderr } = await runCli(["scan", "type"], ROOT);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Specify one or more selectors/);
    expect(stderr).toMatch(/Usage: blockml scan/);
  });
});
