import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  bootstrapTypeRegistry,
  defaultBootstrapPaths,
  TypeRegistry,
} from "../src/index.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");

describe("TypeRegistry bootstrap", () => {
  it("loads framework and domain blocks from default paths", () => {
    const { registry, diagnostics } = bootstrapTypeRegistry(defaultBootstrapPaths());
    const bootstrapErrors = diagnostics.filter(
      (d) => d.severity === "error" && d.code !== "BML_MAP_ERROR",
    );
    expect(bootstrapErrors).toEqual([]);

    expect(registry.has("org.blockml.bml.core.Block")).toBe(true);
    expect(registry.has("com.machineblocks.bml.core.NativeBlock")).toBe(true);
    expect(registry.size()).toBeGreaterThan(50);
  });

  it("registers sub-blocks and retrieves by FQN", () => {
    const registry = new TypeRegistry();
    const { registry: boot } = bootstrapTypeRegistry(defaultBootstrapPaths());
    const blockDoc = boot.get("org.blockml.bml.core.Block");
    expect(blockDoc).toBeDefined();
    if (blockDoc) {
      registry.register(blockDoc);
      expect(registry.get("org.blockml.bml.core.Block")?.block.name).toBe("Block");
    }
  });

  it("loads core library via libraryPaths", () => {
    const libraryPath = join(
      ROOT,
      "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml",
    );
    const { registry, diagnostics } = bootstrapTypeRegistry({
      libraryPaths: [libraryPath],
      rootDir: ROOT,
    });
    const errors = diagnostics.filter(
      (d) => d.severity === "error" && d.code !== "BML_MAP_ERROR",
    );
    expect(errors, JSON.stringify(errors)).toEqual([]);
    expect(registry.has("org.blockml.bml.core.Block")).toBe(true);
    expect(registry.size()).toBeGreaterThan(50);
  });

  it("reports BML_LIBRARY_RESOLVE_ERROR for missing library path", () => {
    const { diagnostics } = bootstrapTypeRegistry({
      libraryPaths: [join(ROOT, "missing/Library.bml")],
      rootDir: ROOT,
    });
    expect(
      diagnostics.some((d) => d.code === "BML_LIBRARY_RESOLVE_ERROR"),
    ).toBe(true);
  });
});
