import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectWorktreeTrace } from "../src/pipeline/worktree-trace.js";

const TMP = join(import.meta.dirname, ".tmp-worktree-trace");

describe("collectWorktreeTrace", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("returns empty when workspaceRoot is not the git toplevel", () => {
    expect(collectWorktreeTrace(TMP)).toEqual({ diff: "", changedFiles: [] });
  });
});
