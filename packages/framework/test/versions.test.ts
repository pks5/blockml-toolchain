import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { validateVersions } from "../src/index.js";
import { TypeRegistry } from "../src/registry/type-registry.js";

const FIXTURES = join(import.meta.dirname, "versions", "fixtures");

function parseFile(name: string) {
  const file = join(FIXTURES, name);
  const parsed = parse(readFileSync(file, "utf8"), { filePath: file });
  expect(parsed.document).not.toBeNull();
  return parsed.document!;
}

describe("validateVersions", () => {
  it("passes for library member without explicit version", () => {
    const library = parseFile("valid-owning-library.bml");
    const parsed = parseFile("valid-framework-block.bml");
    const registry = new TypeRegistry();
    registry.register(library);
    registry.register(parsed);
    const diagnostics = validateVersions(parsed, registry);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("allows a standalone block without version", () => {
    const parsed = parseFile("invalid-missing-version.bml");
    const registry = new TypeRegistry();
    registry.register(parsed);
    const diagnostics = validateVersions(parsed, registry);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("allows a third-party namespace block without version", () => {
    const parsed = parseFile("invalid-third-party-missing-version.bml");
    const registry = new TypeRegistry();
    registry.register(parsed);
    const diagnostics = validateVersions(parsed, registry);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("reports BML_UNKNOWN_VERSION for mismatched bml:version pin", () => {
    const target = parseFile("valid-versioned-target.bml");
    const consumer = parseFile("invalid-version-pin.bml");
    const registry = new TypeRegistry();
    registry.register(target);
    registry.register(consumer);
    const diagnostics = validateVersions(consumer, registry);
    expect(diagnostics.some((d) => d.code === "BML_UNKNOWN_VERSION")).toBe(true);
  });

  it("reports BML_UNKNOWN_VERSION when bml:version pins an unversioned type", () => {
    const target = parseFile("invalid-missing-version.bml");
    const consumer = parseFile("invalid-unversioned-pin.bml");
    const registry = new TypeRegistry();
    registry.register(target);
    registry.register(consumer);
    const diagnostics = validateVersions(consumer, registry);
    expect(diagnostics.some((d) => d.code === "BML_UNKNOWN_VERSION")).toBe(true);
  });

  it("accepts bml:version matching the inherited library version", () => {
    const library = parseFile("valid-owning-library.bml");
    const member = parseFile("valid-framework-block.bml");
    const consumer = parseFile("valid-inherited-version-pin.bml");
    const registry = new TypeRegistry();
    registry.register(library);
    registry.register(member);
    registry.register(consumer);
    const diagnostics = validateVersions(consumer, registry);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("reports BML_UNKNOWN_VERSION when the pin does not match the inherited library version", () => {
    const library = parseFile("valid-owning-library.bml");
    const member = parseFile("valid-framework-block.bml");
    const consumer = parseFile("invalid-inherited-version-pin.bml");
    const registry = new TypeRegistry();
    registry.register(library);
    registry.register(member);
    registry.register(consumer);
    const diagnostics = validateVersions(consumer, registry);
    expect(diagnostics.some((d) => d.code === "BML_UNKNOWN_VERSION")).toBe(true);
  });
});
