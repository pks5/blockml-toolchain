import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearTargets } from "@blockml/compiler";
import { getTargetCliHints, resetBootstrapTargets } from "../src/bootstrap-targets.js";
import { runCli } from "../src/cli.js";
import { loadConfig } from "../src/load-config.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const CORE_LIBRARY = join(
  ROOT,
  "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml",
);
const TMP = join(import.meta.dirname, ".tmp-blockdoc-compile");

function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) {
    return out;
  }
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".html")) {
        out.push(full);
      }
    }
  };
  walk(dir);
  return out;
}

describe("runCli compile blockdoc", () => {
  beforeEach(() => {
    clearTargets();
    resetBootstrapTargets();
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    clearTargets();
    resetBootstrapTargets();
  });

  it("defaults outDir to blockdoc", () => {
    const tmpProject = join(TMP, "empty");
    mkdirSync(tmpProject, { recursive: true });
    const config = loadConfig(tmpProject);
    expect(config.outDir).toBe("blockdoc");
    const hints = getTargetCliHints("blockdoc");
    const resolved =
      typeof hints?.defaultOutDir === "function"
        ? hints.defaultOutDir(config)
        : hints?.defaultOutDir;
    expect(resolved).toBe("blockdoc");
  });

  it("writes to blockdoc/ when --out is omitted", async () => {
    const bomRoot = join(ROOT, "packages/bom");
    const out = join(bomRoot, "blockdoc");
    rmSync(out, { recursive: true, force: true });
    try {
      const { code, stderr } = await runCli(["compile", "blockdoc"], bomRoot);
      expect(code, stderr).toBe(0);
      expect(stderr).toMatch(/to blockdoc\//);
      expect(existsSync(join(out, "index.html"))).toBe(true);
      expect(existsSync(join(out, "org/blockml/bml/bom/Library.html"))).toBe(true);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);

  it("without --src/--libraries documents project library packages and writes to --out", async () => {
    const outDir = join(TMP, "project-scan");
    const { code, stderr } = await runCli(
      ["compile", "blockdoc", "--out", outDir],
      ROOT,
    );

    expect(code, stderr).toBe(0);
    expect(stderr).toMatch(/Compilation succeeded\./);
    expect(existsSync(join(outDir, "index.html"))).toBe(true);
    expect(existsSync(join(outDir, "org/blockml/bml/bom/Library.html"))).toBe(true);
    expect(existsSync(join(outDir, "org/blockml/bml/lsp/Library.html"))).toBe(true);
    expect(existsSync(join(outDir, "org/blockml/bml/core/Block.html"))).toBe(false);
    expect(htmlFiles(outDir).some((p) => p.includes("node_modules"))).toBe(false);
  }, 120_000);

  it("with --libraries keeps library-graph pages including core", async () => {
    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const tmpProject = join(TMP, "libraries-core");
    mkdirSync(tmpProject, { recursive: true });
    const { code, stderr } = await runCli(
      ["compile", "blockdoc", "--out", "core-out", "--libraries", CORE_LIBRARY],
      tmpProject,
    );

    expect(code, stderr).toBe(0);
    expect(existsSync(join(tmpProject, "core-out", "org/blockml/bml/core/Block.html"))).toBe(
      true,
    );
  }, 60_000);
});
