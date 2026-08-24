import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { TypeRegistry, validateTypes } from "../src/index.js";

function lineOf(source: string, snippet: string): number {
  const idx = source.indexOf(snippet);
  expect(idx).toBeGreaterThanOrEqual(0);
  return source.slice(0, idx).split("\n").length;
}

function sample(body: string): string {
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:type="org.blockml.bml.type"',
    ' xmlns:test="com.blockml.test.diag">',
    "  <type>test:Sample</type>",
    body,
    "</block>",
  ].join("\n");
}

describe("validateTypes diagnostic locations", () => {
  it("reports unknown baseType at baseTypeSource, not the block start", () => {
    const source = sample(
      [
        "  <baseType>test:Missing</baseType>",
        "  <is>sample</is>",
        "  <properties>",
        '    <count type="type:Integer" />',
        "  </properties>",
      ].join("\n"),
    );
    const parsed = parse(source, { filePath: "unknown-base.bml", continueOnError: true });
    expect(parsed.document).not.toBeNull();
    const diagnostics = validateTypes(parsed.document!, new TypeRegistry());
    const diag = diagnostics.find((d) => d.code === "BML_UNKNOWN_BASE_TYPE");
    expect(diag).toBeDefined();
    expect(diag!.source.line).toBe(lineOf(source, "test:Missing"));
    expect(diag!.source.line).toBeGreaterThan(1);
  });

  it("reports unknown property type String at typeSource", () => {
    const source = sample(
      [
        "  <baseType>core:Block</baseType>",
        "  <is>sample</is>",
        "  <properties>",
        '    <count type="String" />',
        "  </properties>",
      ].join("\n"),
    );
    const parsed = parse(source, { filePath: "unknown-string.bml", continueOnError: true });
    expect(parsed.document).not.toBeNull();
    const diagnostics = validateTypes(parsed.document!, new TypeRegistry());
    const diag = diagnostics.find((d) => d.code === "BML_UNKNOWN_TYPE");
    expect(diag).toBeDefined();
    expect(diag!.source.line).toBe(lineOf(source, 'type="String"'));
    expect(diag!.source.column).toBeGreaterThan(1);
  });

  it("does not flag well-known Integer", () => {
    const source = sample(
      [
        "  <baseType>core:Block</baseType>",
        "  <is>sample</is>",
        "  <properties>",
        '    <count type="type:Integer" />',
        "  </properties>",
      ].join("\n"),
    );
    const parsed = parse(source, { filePath: "known-int.bml", continueOnError: true });
    expect(parsed.document).not.toBeNull();
    const diagnostics = validateTypes(parsed.document!, new TypeRegistry());
    expect(diagnostics.some((d) => d.code === "BML_UNKNOWN_TYPE")).toBe(false);
  });

  it("does not flag unqualified Integer", () => {
    const source = sample(
      [
        "  <baseType>core:Block</baseType>",
        "  <is>sample</is>",
        "  <properties>",
        '    <count type="Integer" />',
        "  </properties>",
      ].join("\n"),
    );
    const parsed = parse(source, { filePath: "unqualified-int.bml", continueOnError: true });
    expect(parsed.document).not.toBeNull();
    const diagnostics = validateTypes(parsed.document!, new TypeRegistry());
    expect(diagnostics.some((d) => d.code === "BML_UNKNOWN_TYPE")).toBe(false);
  });

  it("flags xmlns-qualified domain types absent from the registry", () => {
    const source = [
      '<block xmlns="http://blockml.org/bml"',
      ' xmlns:core="org.blockml.bml.core"',
      ' xmlns:mbt="com.machineblocks.bml.type"',
      ' xmlns:test="com.blockml.test.diag">',
      "  <type>test:Sample</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <properties>",
      '    <size type="mbt:Size3D" />',
      '    <baseCutoutType type="mbt:BaseCutoutType" />',
      "  </properties>",
      "</block>",
    ].join("\n");
    const parsed = parse(source, { filePath: "domain-types.bml", continueOnError: true });
    expect(parsed.document).not.toBeNull();
    const diagnostics = validateTypes(parsed.document!, new TypeRegistry());
    expect(diagnostics.some((d) => d.code === "BML_UNKNOWN_TYPE")).toBe(true);
    expect(diagnostics.filter((d) => d.code === "BML_UNKNOWN_TYPE").length).toBeGreaterThanOrEqual(2);
  });
});
