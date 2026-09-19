import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { validateVersions } from "../src/index.js";
import { TypeRegistry } from "../src/registry/type-registry.js";

const FIXTURES = join(import.meta.dirname, "versions", "fixtures");

describe("validateVersions", () => {
  it("passes for framework block without explicit version", () => {
    const file = join(FIXTURES, "valid-framework-block.bml");
    const parsed = parse(readFileSync(file, "utf8"), { filePath: file });
    expect(parsed.document).not.toBeNull();
    const registry = new TypeRegistry();
    registry.register(parsed.document!);
    const diagnostics = validateVersions(parsed.document!, registry);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("reports BML_MISSING_VERSION for standalone domain block without version", () => {
    const file = join(FIXTURES, "invalid-missing-version.bml");
    const parsed = parse(readFileSync(file, "utf8"), { filePath: file });
    expect(parsed.document).not.toBeNull();
    const registry = new TypeRegistry();
    registry.register(parsed.document!);
    const diagnostics = validateVersions(parsed.document!, registry);
    expect(diagnostics.some((d) => d.code === "BML_MISSING_VERSION")).toBe(true);
  });

  it("reports BML_MISSING_VERSION for third-party library namespace without version", () => {
    const file = join(FIXTURES, "invalid-third-party-missing-version.bml");
    const parsed = parse(readFileSync(file, "utf8"), { filePath: file });
    expect(parsed.document).not.toBeNull();
    const registry = new TypeRegistry();
    registry.register(parsed.document!);
    const diagnostics = validateVersions(parsed.document!, registry);
    expect(diagnostics.some((d) => d.code === "BML_MISSING_VERSION")).toBe(true);
  });

  it("reports BML_UNKNOWN_VERSION for mismatched bml:version pin", () => {
    const targetFile = join(FIXTURES, "valid-versioned-target.bml");
    const consumerFile = join(FIXTURES, "invalid-version-pin.bml");
    const target = parse(readFileSync(targetFile, "utf8"), { filePath: targetFile });
    const consumer = parse(readFileSync(consumerFile, "utf8"), { filePath: consumerFile });
    expect(target.document).not.toBeNull();
    expect(consumer.document).not.toBeNull();
    const registry = new TypeRegistry();
    registry.register(target.document!);
    registry.register(consumer.document!);
    const diagnostics = validateVersions(consumer.document!, registry);
    expect(diagnostics.some((d) => d.code === "BML_UNKNOWN_VERSION")).toBe(true);
  });
});
