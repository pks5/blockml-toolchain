import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { commitWorktree } from "../src/pipeline/git.js";
import { fixtureTempDir } from "./fixture.js";

const TMP = fixtureTempDir("git-isolation");
const REPO = join(import.meta.dirname, "..", "..", "..");

function repoHead(): string {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: REPO,
    encoding: "utf8",
  });
  expect(result.status).toBe(0);
  return result.stdout.trim();
}

describe("transformer git isolation", () => {
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("does not commit the parent repo when the fixture has no .git", () => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
    writeFileSync(join(TMP, "marker.txt"), "isolation");
    const before = repoHead();
    expect(() =>
      commitWorktree(TMP, "transform(isolation): should-not-land"),
    ).toThrow();
    expect(repoHead()).toBe(before);
    const subjects = spawnSync("git", ["log", "-1", "--pretty=%s"], {
      cwd: REPO,
      encoding: "utf8",
    });
    expect(subjects.stdout).not.toContain("transform(isolation): should-not-land");
  });
});
