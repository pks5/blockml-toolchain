import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { bootstrapTypeRegistry, getExportedFqns } from "../../src/index.js";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");

describe("getExportedFqns", () => {
  it("returns block FQNs exported from a Library.bml bootstrap", () => {
    const libraryPath = join(
      ROOT,
      "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml",
    );
    const bootstrap = bootstrapTypeRegistry({
      libraryPaths: [libraryPath],
      rootDir: ROOT,
    });
    const exported = getExportedFqns(libraryPath, bootstrap, ROOT);
    expect(exported).toBeDefined();
    expect(exported!.has("org.blockml.bml.core.Block")).toBe(true);
    expect(bootstrap.exportsByLibrary?.get(libraryPath)?.has("org.blockml.bml.core.Block")).toBe(
      true,
    );
  });
});
