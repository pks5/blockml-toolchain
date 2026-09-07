import { describe, expect, it } from "vitest";
import { documentSymbols, SymbolKind } from "../src/index.js";

const OUTLINE_BML = [
  '<block xmlns="http://blockml.org/bml"',
  ' xmlns:core="org.blockml.bml.core"',
  ' xmlns:type="org.blockml.bml.type"',
  ' xmlns:test="com.blockml.test.outline">',
  "  <name>OutlineMe</name>",
  "  <type>test:OutlineMe</type>",
  "  <baseType>core:Block</baseType>",
  "  <is>outline fixture</is>",
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

describe("documentSymbols", () => {
  it("returns a Class root with a Property child", () => {
    const symbols = documentSymbols(OUTLINE_BML, "outline.bml");
    expect(symbols).not.toBeNull();
    expect(symbols).toHaveLength(1);
    const root = symbols![0]!;
    expect(root.name).toBe("OutlineMe");
    expect(root.kind).toBe(SymbolKind.Class);
    expect(root.detail).toBe("com.blockml.test.outline.OutlineMe");
    expect(root.selectionRange).toEqual(root.range);
    expect(root.range.start.line).toBe(0);

    const count = root.children?.find((c) => c.name === "count");
    expect(count).toBeDefined();
    expect(count!.kind).toBe(SymbolKind.Property);
    expect(count!.detail).toContain("property");
    expect(count!.detail).toContain("org.blockml.bml.type.Integer");
  });

  it("nests a sub-block as a Class child with its own range", () => {
    const symbols = documentSymbols(OUTLINE_BML, "outline.bml");
    const root = symbols![0]!;
    const inner = root.children?.find((c) => c.name === "Inner");
    expect(inner).toBeDefined();
    expect(inner!.kind).toBe(SymbolKind.Class);
    expect(inner!.range.start.line).toBeGreaterThan(root.range.start.line);
    expect(inner!.detail).toBe("com.blockml.test.outline.Inner");
  });

  it("returns null for invalid XML", () => {
    expect(documentSymbols("<not-a-block>", "outline.bml")).toBeNull();
  });

  it("outlines a type-as-root document the same as legacy <block>", () => {
    const typed = [
      '<test:OutlineMe xmlns="http://blockml.org/bml"',
      ' xmlns:core="org.blockml.bml.core"',
      ' xmlns:type="org.blockml.bml.type"',
      ' xmlns:test="com.blockml.test.outline">',
      "  <name>OutlineMe</name>",
      "  <baseType>core:Block</baseType>",
      "  <is>outline fixture</is>",
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
      "</test:OutlineMe>",
    ].join("\n");
    const symbols = documentSymbols(typed, "outline-typed.bml");
    expect(symbols).not.toBeNull();
    expect(symbols![0]!.name).toBe("OutlineMe");
    expect(symbols![0]!.detail).toBe("com.blockml.test.outline.OutlineMe");
    expect(symbols![0]!.children?.find((c) => c.name === "count")).toBeDefined();
  });

  it("outlines an unqualified Sub-Block tag", () => {
    const typed = [
      '<test:OutlineMe xmlns="http://blockml.org/bml"',
      ' xmlns:core="org.blockml.bml.core"',
      ' xmlns:test="com.blockml.test.outline">',
      "  <baseType>core:Block</baseType>",
      "  <is>outline fixture</is>",
      "  <subBlocks>",
      "    <Inner>",
      "      <baseType>core:Block</baseType>",
      "    </Inner>",
      "  </subBlocks>",
      "</test:OutlineMe>",
    ].join("\n");
    const symbols = documentSymbols(typed, "outline-sub-tag.bml");
    expect(symbols).not.toBeNull();
    const inner = symbols![0]!.children?.find((c) => c.name === "Inner");
    expect(inner).toBeDefined();
    expect(inner!.detail).toBe("com.blockml.test.outline.OutlineMe.Inner");
  });
});
