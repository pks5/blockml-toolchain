import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { clearTargets } from "@blockml/compiler";
import { parseArgs, runCli } from "../src/cli.js";
import { resetBootstrapTargets } from "../src/bootstrap-targets.js";

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
});

describe("runCli validate", () => {
  it("validates corpus from libraries without writing output", () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const { code, stderr } = runCli(
      ["validate", "--libraries", CORE_LIBRARY],
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

  it("treats --all as corpus validate", () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const { code, stderr } = runCli(
      ["validate", "--all", "--libraries", CORE_LIBRARY],
      ROOT,
    );

    expect([0, 1]).toContain(code);
    expect(stderr).not.toMatch(/Wrote \d+ file\(s\)/);
  });

  it("validates a single file against the project registry", () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const { code, stderr } = runCli(
      ["validate", CORE_LIBRARY, "--libraries", CORE_LIBRARY],
      ROOT,
    );

    expect([0, 1]).toContain(code);
    expect(stderr).not.toMatch(/Wrote \d+ file\(s\)/);
  });

  it("returns 2 for a missing file", () => {
    const { code, stderr } = runCli(["validate", "no-such.bml"], ROOT);
    expect(code).toBe(2);
    expect(stderr).toMatch(/File not found: no-such\.bml/);
  });

  it("returns 2 when file and --all are combined", () => {
    const { code } = runCli(["validate", "no-such.bml", "--all"], ROOT);
    expect(code).toBe(2);
  });
});

describe("runCli other commands", () => {
  const tmpOut = join(import.meta.dirname, ".tmp-xsd-out");

  beforeEach(() => {
    clearTargets();
    resetBootstrapTargets();
  });

  afterEach(() => {
    rmSync(tmpOut, { recursive: true, force: true });
    clearTargets();
    resetBootstrapTargets();
  });

  it("returns 2 for an unknown command", () => {
    const { code, stderr } = runCli(["inspect"], ROOT);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Usage: blockml/);
  });

  it("rejects an unsupported compile target", () => {
    const { code, stderr } = runCli(["compile", "fatblock"], ROOT);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Unsupported target in minimal CLI: fatblock/);
  });

  it("compiles xsd without writing into doc/", () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const { code, stderr } = runCli(
      ["compile", "xsd", "--out", tmpOut, "--libraries", CORE_LIBRARY],
      ROOT,
    );

    expect(code, stderr).toBe(0);
    expect(stderr).toMatch(/Wrote \d+ file\(s\)/);
    const schemaPath = join(tmpOut, "bml.xsd");
    expect(existsSync(schemaPath)).toBe(true);
    expect(readFileSync(schemaPath, "utf8")).toContain("<xs:schema");
  });
});
