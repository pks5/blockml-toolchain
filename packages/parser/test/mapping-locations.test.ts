import { describe, expect, it } from "vitest";
import { parse } from "../src/parse.js";

function lineOf(source: string, snippet: string): number {
  const idx = source.indexOf(snippet);
  expect(idx).toBeGreaterThanOrEqual(0);
  return source.slice(0, idx).split("\n").length;
}

const PREFIX = [
  '<block xmlns="http://blockml.org/bml"',
  ' xmlns:core="org.blockml.bml.core"',
  ' xmlns:type="org.blockml.bml.type"',
  ' xmlns:test="com.blockml.test.diag">',
  "  <type>test:Sample</type>",
  "  <baseType>core:Block</baseType>",
  "  <is>sample</is>",
  "  <properties>",
].join("\n");

const SUFFIX = ["  </properties>", "</block>"].join("\n");

describe("parse mapping diagnostic locations", () => {
  it("reports unknown namespace prefix on the type attribute, not line 1", () => {
    const source = `${PREFIX}\n    <count type="foo:Bar" />\n${SUFFIX}`;
    const result = parse(source, { filePath: "unknown-prefix.bml", continueOnError: true });
    const diag = result.diagnostics.find((d) => d.code === "BML_UNKNOWN_NAMESPACE_PREFIX");
    expect(diag).toBeDefined();
    expect(diag!.source.line).toBe(lineOf(source, "foo:Bar"));
    expect(diag!.source.line).toBeGreaterThan(1);
    expect(diag!.source.column).toBeGreaterThan(1);
    expect(diag!.source.endColumn).toBeGreaterThan(diag!.source.column);
  });

  it("records typeSource on the type attribute value", () => {
    const source = `${PREFIX}\n    <count type="type:Integer" />\n${SUFFIX}`;
    const result = parse(source, { filePath: "type-source.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    const count = result.document!.block.members.find((m) => m.name === "count");
    expect(count?.typeSource).toBeDefined();
    expect(count!.typeSource!.line).toBe(lineOf(source, "type:Integer"));
    expect(count!.typeSource!.column).toBeGreaterThan(count!.source!.column);
    expect(count!.typeSource!.endColumn).toBeGreaterThan(count!.typeSource!.column);
  });

  it("reports empty type at the property, not line 1", () => {
    const source = `${PREFIX}\n    <count type="" />\n${SUFFIX}`;
    const result = parse(source, { filePath: "empty-type.bml", continueOnError: true });
    const diag = result.diagnostics.find((d) => d.code === "BML_UNKNOWN_TYPE");
    expect(diag).toBeDefined();
    expect(diag!.source.line).toBe(lineOf(source, "<count"));
    expect(diag!.source.line).toBeGreaterThan(1);
  });

  it("reports invalid type reference at the type attribute value", () => {
    const source = `${PREFIX}\n    <count type="Integer[][]" />\n${SUFFIX}`;
    const result = parse(source, { filePath: "invalid-type.bml", continueOnError: true });
    const diag = result.diagnostics.find((d) => d.code === "BML_INVALID_TYPE_REFERENCE");
    expect(diag).toBeDefined();
    expect(diag!.source.line).toBe(lineOf(source, "Integer[][]"));
    expect(diag!.source.line).toBeGreaterThan(1);
    expect(diag!.source.endColumn).toBeGreaterThan(diag!.source.column);
  });
});
