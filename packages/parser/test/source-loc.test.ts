import { describe, expect, it } from "vitest";
import { parse } from "../src/parse.js";

const NESTED = [
  '<block xmlns="http://blockml.org/bml"',
  ' xmlns:core="org.blockml.bml.core"',
  ' xmlns:type="org.blockml.bml.type"',
  ' xmlns:test="com.blockml.test.spans">',
  "  <type>test:Outer</type>",
  "  <baseType>core:Block</baseType>",
  "  <is>outer</is>",
  "  <subBlocks>",
  "    <block>",
  "      <name>Inner</name>",
  "      <type>test:Inner</type>",
  "      <baseType>core:Block</baseType>",
  "    </block>",
  "  </subBlocks>",
  "  <properties>",
  '    <count type="type:Integer" />',
  "  </properties>",
  "</block>",
].join("\n");

describe("parser source spans", () => {
  it("attaches end spans on members", () => {
    const result = parse(NESTED, { filePath: "spans.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    const count = result.document!.block.members.find((m) => m.name === "count");
    expect(count?.source).toBeDefined();
    expect(count!.source!.endLine).toBeDefined();
    expect(count!.source!.endColumn).toBeDefined();
    expect(count!.source!.endColumn).toBeGreaterThan(count!.source!.column);
  });

  it("gives nested blocks distinct start lines", () => {
    const result = parse(NESTED, { filePath: "spans.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    const outer = result.document!.block;
    const inner = outer.subBlocks[0];
    expect(outer.source?.line).toBe(1);
    expect(inner?.source?.line).toBeDefined();
    expect(inner!.source!.line).toBeGreaterThan(outer.source!.line);
    expect(inner!.source!.line).not.toBe(outer.source!.line);
  });

  it("records type and baseType element spans", () => {
    const result = parse(NESTED, { filePath: "spans.bml", continueOnError: true });
    const block = result.document!.block;
    expect(block.typeSource?.line).toBeGreaterThan(1);
    expect(block.baseTypeSource?.line).toBeGreaterThan(block.typeSource!.line);
    expect(block.typeSource?.endColumn).toBeDefined();
    expect(block.baseTypeSource?.endColumn).toBeDefined();
  });
});
