import { describe, expect, it } from "vitest";
import { bootstrapTypeRegistry, defaultBootstrapPaths, TypeRegistry } from "../src/index.js";

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
});
