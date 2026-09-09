import { beforeAll, describe, expect, it } from "vitest";
import { join } from "node:path";
import { bootstrapTypeRegistry, defaultBootstrapPaths, scanPackages, scanTypes } from "../src/index.js";
import type { TypeRegistry } from "../src/index.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");

let registry: TypeRegistry;

beforeAll(() => {
  registry = bootstrapTypeRegistry(defaultBootstrapPaths(ROOT), ROOT).registry;
});

describe("scanTypes", () => {
  it("returns an exact type FQN", () => {
    const result = scanTypes(["org.blockml.bml.core.Block"], registry);
    expect(result).toEqual({ ok: true, hits: ["org.blockml.bml.core.Block"] });
  });

  it("includes the starting package for trailing TypeSelector **", () => {
    const result = scanTypes(["org.blockml.bml.core.**"], registry);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hits).toContain("org.blockml.bml.core.Block");
      expect(result.hits).toContain("org.blockml.bml.core.Capability");
      expect(result.hits.every((hit) => hit.startsWith("org.blockml.bml.core."))).toBe(true);
    }
  });

  it("rejects an invalid TypeSelector", () => {
    const result = scanTypes(["org.blockml.bml.core.Foo**"], registry);
    expect(result.ok).toBe(false);
  });
});

describe("scanPackages", () => {
  it("lists direct child packages", () => {
    const result = scanPackages(["org.blockml.bml.*"], registry);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hits).toContain("org.blockml.bml.core");
      expect(result.hits).toContain("org.blockml.bml.type");
      expect(result.hits).not.toContain("org.blockml.bml");
      expect(result.hits).not.toContain("org.blockml.bml.core.capability");
    }
  });

  it("does not include the starting package for PackageSelector **", () => {
    const result = scanPackages(["org.blockml.bml.**"], registry);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.hits).not.toContain("org.blockml.bml");
      expect(result.hits).toContain("org.blockml.bml.core");
    }
  });
});
