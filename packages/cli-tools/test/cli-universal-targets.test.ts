import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearTargets,
  getTarget,
  registeredTargetNames,
  type RenderTarget,
} from "@blockml/compiler";
import {
  bootstrapTargets,
  registerTargetFactory,
  resetBootstrapTargets,
} from "../src/bootstrap-targets.js";
import { loadConfig } from "../src/load-config.js";
import { runCli } from "../src/cli.js";
import { writeOutputFiles } from "../src/write-output.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const FIXTURE_TARGET = join(import.meta.dirname, "fixtures/mock-target");
const CORE_LIBRARY = join(
  ROOT,
  "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml",
);

describe("universal targets", () => {
  const tmpProject = join(import.meta.dirname, ".tmp-universal-targets");

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

  it("registerTargetFactory makes a custom target compilable", async () => {
    registerTargetFactory("mock", () => ({
      name: "mock",
      accepts: ["library", "corpus", "auto"],
      render: () => ({
        files: [{ path: "mock.txt", content: "ok" }],
      }),
    }));

    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const { code, stderr } = await runCli(
      ["compile", "mock", "--out", "mock-out", "--libraries", CORE_LIBRARY],
      tmpProject,
    );

    expect(code, stderr).toBe(0);
    expect(stderr).toMatch(/Compilation succeeded\./);
    expect(existsSync(join(tmpProject, "mock-out", "mock.txt"))).toBe(true);
    expect(readFileSync(join(tmpProject, "mock-out", "mock.txt"), "utf8")).toBe("ok");
  });

  it("loads a target from targetPackages config", async () => {
    writeFileSync(
      join(tmpProject, "bom.config.json"),
      JSON.stringify({
        targets: ["mock-plugin"],
        targetPackages: {
          "mock-plugin": FIXTURE_TARGET,
        },
      }),
      "utf8",
    );

    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const { code, stderr } = await runCli(
      ["compile", "mock-plugin", "--out", "plugin-out", "--libraries", CORE_LIBRARY],
      tmpProject,
    );

    expect(code, stderr).toBe(0);
    expect(stderr).toMatch(/Compilation succeeded\./);
    expect(
      readFileSync(join(tmpProject, "plugin-out", "mock-plugin.txt"), "utf8"),
    ).toBe("mock-plugin-ok");
  });

  it("returns exit 2 for unknown target in targets[]", async () => {
    writeFileSync(
      join(tmpProject, "bom.config.json"),
      JSON.stringify({ targets: ["does-not-exist"] }),
      "utf8",
    );

    const { code, stderr } = await runCli(["compile", "does-not-exist"], tmpProject);
    expect(code).toBe(2);
    expect(stderr).toMatch(/Unknown target in targets\[\]/);
  });

  it("resetBootstrapTargets clears compiler registry", async () => {
    registerTargetFactory("mock", () => ({
      name: "mock",
      accepts: ["auto"],
      render: () => ({ files: [] }),
    }));

    await bootstrapTargets(loadConfig(tmpProject), ["mock"], tmpProject);
    expect(registeredTargetNames()).toContain("mock");

    resetBootstrapTargets();
    expect(registeredTargetNames()).toEqual([]);
  });

  it("writeOutputFiles reads rootFiles from RenderOutput", () => {
    const outDir = join(tmpProject, "out");
    const result = writeOutputFiles(
      {
        files: [{ path: "a.txt", content: "a" }],
        rootFiles: [{ path: "catalog.xml", content: "<catalog />" }],
      },
      "out",
      tmpProject,
      { cleanOutDir: true },
    );

    expect(result.filesWritten).toBe(1);
    expect(result.rootFilesWritten).toEqual(["catalog.xml"]);
    expect(existsSync(join(outDir, "a.txt"))).toBe(true);
    expect(existsSync(join(tmpProject, "catalog.xml"))).toBe(true);
  });

  it("uses config.defaultTarget when compile target omitted", async () => {
    registerTargetFactory("mock", () => ({
      name: "mock",
      accepts: ["auto"],
      render: () => ({
        files: [{ path: "default-target.txt", content: "default" }],
      }),
    }));

    writeFileSync(
      join(tmpProject, "bom.config.json"),
      JSON.stringify({
        targets: ["mock"],
        defaultTarget: "mock",
      }),
      "utf8",
    );

    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const { code, stderr } = await runCli(
      ["compile", "--out", "default-out", "--libraries", CORE_LIBRARY],
      tmpProject,
    );

    expect(code, stderr).toBe(0);
    expect(stderr).toMatch(/Compilation succeeded\./);
    expect(existsSync(join(tmpProject, "default-out", "default-target.txt"))).toBe(true);
  });

  it("programmatic factory wins over plugin package mapping", async () => {
    writeFileSync(
      join(tmpProject, "bom.config.json"),
      JSON.stringify({
        targets: ["mock-plugin"],
        targetPackages: {
          "mock-plugin": FIXTURE_TARGET,
        },
      }),
      "utf8",
    );

    registerTargetFactory(
      "mock-plugin",
      () =>
        ({
          name: "mock-plugin",
          accepts: ["auto"],
          render: () => ({
            files: [{ path: "override.txt", content: "override" }],
          }),
        }) as RenderTarget,
    );

    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    await bootstrapTargets(loadConfig(tmpProject), ["mock-plugin"], tmpProject);
    expect(getTarget("mock-plugin")?.render).toBeTruthy();

    const { code, stderr } = await runCli(
      ["compile", "mock-plugin", "--out", "override-out", "--libraries", CORE_LIBRARY],
      tmpProject,
    );

    expect(code, stderr).toBe(0);
    expect(stderr).toMatch(/Compilation succeeded\./);
    expect(readFileSync(join(tmpProject, "override-out", "override.txt"), "utf8")).toBe(
      "override",
    );
  });

  it("labels unexpected target throws as Internal CLI error", async () => {
    registerTargetFactory("boom", () => ({
      name: "boom",
      accepts: ["library", "corpus", "auto"],
      render: () => {
        throw new Error("target exploded");
      },
    }));

    if (!existsSync(CORE_LIBRARY)) {
      throw new Error(`Missing fixture: ${CORE_LIBRARY}`);
    }

    const { code, stderr } = await runCli(
      ["compile", "boom", "--out", "boom-out", "--libraries", CORE_LIBRARY],
      tmpProject,
    );

    expect(code).toBe(2);
    expect(stderr).toMatch(/^Internal CLI error: target exploded/);
    expect(stderr).not.toMatch(/Compilation (succeeded|failed)/);
  });
});
