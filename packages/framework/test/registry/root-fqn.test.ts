import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { parse } from "@blockml/parser";
import { readFileSync } from "node:fs";
import { bootstrapTypeRegistry, rootFqnByFilePath, rootFqns } from "../../src/index.js";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");

describe("rootFqnByFilePath / rootFqns", () => {
  it("returns one root per file using prefix exclusion", () => {
    const file = join(
      ROOT,
      "node_modules/@blockml/core/blocks/org/blockml/bml/core/Block.bml",
    );
    const parsed = parse(readFileSync(file, "utf8"), { filePath: file });
    expect(parsed.document).not.toBeNull();

    const { registry } = bootstrapTypeRegistry({
      paths: [file],
      rootDir: ROOT,
    });
    registry.register(parsed.document!);

    const byFile = rootFqnByFilePath(registry);
    expect(byFile.get(file)).toBe("org.blockml.bml.core.Block");
    expect(rootFqns(registry)).toContain("org.blockml.bml.core.Block");
  });
});
