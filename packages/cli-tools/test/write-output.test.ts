import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { writeOutputFiles } from "../src/write-output.js";

const TMP = join(import.meta.dirname, ".tmp-write-output");

describe("writeOutputFiles", () => {
  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("removes stale files when cleanOutDir is true", () => {
    mkdirSync(join(TMP, "nested"), { recursive: true });
    writeFileSync(join(TMP, "stale.html"), "old");
    writeFileSync(join(TMP, "nested", "stale.html"), "old");

    writeOutputFiles(
      { files: [{ path: "fresh.html", content: "<html>new</html>" }] },
      TMP,
      import.meta.dirname,
      { cleanOutDir: true },
    );

    expect(existsSync(join(TMP, "stale.html"))).toBe(false);
    expect(existsSync(join(TMP, "nested", "stale.html"))).toBe(false);
    expect(readFileSync(join(TMP, "fresh.html"), "utf8")).toBe("<html>new</html>");
  });
});
