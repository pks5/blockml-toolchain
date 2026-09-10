import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectWorktreeTrace } from "../src/pipeline/worktree-trace.js";
import { fixtureTempDir, writeProject } from "./fixture.js";

const TMP = fixtureTempDir("worktree-trace");

describe("collectWorktreeTrace", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("returns empty when there is no git repository", () => {
    expect(collectWorktreeTrace(TMP)).toEqual({ diff: "", changedFiles: [] });
  });

  it("traces changes from a package directory inside the worktree", () => {
    const pkg = join(TMP, "packages", "inner");
    writeProject(pkg, { "tracked.txt": "original" }, TMP);
    writeFileSync(join(pkg, "tracked.txt"), "changed");
    writeFileSync(join(pkg, "dirty.txt"), "untracked");
    const trace = collectWorktreeTrace(pkg);
    expect(trace.changedFiles).toContain("packages/inner/tracked.txt");
    expect(trace.changedFiles).toContain("packages/inner/dirty.txt");
    expect(trace.diff).toMatch(/tracked\.txt/);
  });
});
