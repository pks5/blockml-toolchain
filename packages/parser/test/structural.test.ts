import { describe, expect, it } from "vitest";
import { parse } from "../src/parse.js";
import { serialize } from "@blockml/serializer";

function sample(body: string, extraBlockAttrs = ""): string {
  return [
    `<block xmlns="http://blockml.org/bml"${extraBlockAttrs}`,
    ' xmlns:bml="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:type="org.blockml.bml.type"',
    ' xmlns:test="com.blockml.test.struct">',
    "  <name>Sample</name>",
    "  <type>test:Sample</type>",
    "  <baseType>core:Block</baseType>",
    "  <is>sample</is>",
    body,
    "</block>",
  ].join("\n");
}

describe("structural BML validation", () => {
  it("reports unknown root element, stores residual, and keeps the BOM", () => {
    const source = sample("  <nmae>typo</nmae>");
    const result = parse(source, { filePath: "unknown-element.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.success).toBe(false);
    const diag = result.diagnostics.find((d) => d.code === "BML_UNKNOWN_ELEMENT");
    expect(diag).toBeDefined();
    expect(diag!.source.line).toBeGreaterThan(1);
    expect(result.document!.block.name).toBe("Sample");
    expect(result.document!.block.type).toBe("com.blockml.test.struct.Sample");
    const residual = result.document!.block.unknownElements?.find((n) => n.localName === "nmae");
    expect(residual).toBeDefined();
    expect(residual!.innerXml).toContain("typo");
  });

  it("does not treat empty unknown root tags as aggregations", () => {
    const source = sample("  <nmae/>");
    const result = parse(source, { filePath: "unknown-empty.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNKNOWN_ELEMENT")).toBe(true);
    expect(result.document!.block.members.some((m) => m.name === "nmae")).toBe(false);
    expect(result.document!.block.unknownElements?.some((n) => n.localName === "nmae")).toBe(true);
  });

  it("reports unknown attribute on <block>", () => {
    const source = sample("", ' extra="nope"');
    const result = parse(source, { filePath: "unknown-block-attr.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    const diag = result.diagnostics.find((d) => d.code === "BML_UNKNOWN_ATTRIBUTE");
    expect(diag).toBeDefined();
    expect(result.document!.block.unknownAttributes?.extra).toBe("nope");
  });

  it("reports unknown attribute on <name>", () => {
    const source = [
      '<block xmlns="http://blockml.org/bml"',
      ' xmlns:core="org.blockml.bml.core"',
      ' xmlns:test="com.blockml.test.struct">',
      '  <name foo="bar">Sample</name>',
      "  <type>test:Sample</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "</block>",
    ].join("\n");
    const result = parse(source, { filePath: "unknown-name-attr.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNKNOWN_ATTRIBUTE")).toBe(true);
    expect(result.document!.block.unknownAttributes?.foo).toBe("bar");
  });

  it("reports unknown bml:* as BML_UNKNOWN_DIRECTIVE", () => {
    const source = sample("", ' bml:ech="items"');
    const result = parse(source, { filePath: "unknown-directive.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    const diag = result.diagnostics.find((d) => d.code === "BML_UNKNOWN_DIRECTIVE");
    expect(diag).toBeDefined();
    expect(result.document!.block.unknownAttributes?.["bml:ech"]).toBe("items");
  });

  it("does not treat a property named nmae as a Gerüst error", () => {
    const source = sample("  <properties>\n    <nmae type=\"type:Text\" />\n  </properties>");
    const result = parse(source, { filePath: "property-nmae.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNKNOWN_ELEMENT")).toBe(false);
    expect(result.document!.block.members.some((m) => m.name === "nmae")).toBe(true);
  });

  it("serialize roundtrip keeps the unknown tag", () => {
    const source = sample("  <nmae>typo</nmae>");
    const parsed = parse(source, { filePath: "roundtrip.bml", continueOnError: true });
    expect(parsed.document).not.toBeNull();
    const serialized = serialize(parsed.document!);
    expect(serialized.text).toMatch(/<nmae>/);
    expect(serialized.text).toContain("typo");
  });

  it("reports a second composition on the same aggregation", () => {
    const source = sample(
      [
        "  <aggregations>",
        "    <children>",
        "      <composition><test:Keep /></composition>",
        "      <composition><test:Drop /></composition>",
        "    </children>",
        "  </aggregations>",
      ].join("\n"),
    );
    const result = parse(source, { filePath: "dup-composition.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    const diag = result.diagnostics.find((d) => d.code === "BML_DUPLICATE_COMPOSITION");
    expect(diag).toBeDefined();
    const children = result.document!.block.members.find((m) => m.name === "children");
    expect(children?.kind).toBe("aggregation");
    if (children?.kind === "aggregation") {
      expect(children.composition?.children.some((n) => n.kind === "blockInstance" && n.instance.typeFqn.endsWith("Keep"))).toBe(true);
      expect(children.unknownElements?.some((n) => n.localName === "composition")).toBe(true);
    }
  });

  it("reports standalone composition at block root", () => {
    const source = sample("  <composition><test:Child /></composition>");
    const result = parse(source, { filePath: "standalone-composition.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_STANDALONE_COMPOSITION")).toBe(true);
    expect(result.document!.block.members.some((m) => m.name === "composition")).toBe(false);
    expect(result.document!.block.unknownElements?.some((n) => n.localName === "composition")).toBe(true);
  });

  it("reports unexpected text between root children and keeps the BOM", () => {
    const source = sample("  sds");
    const result = parse(source, { filePath: "unexpected-text.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    const diag = result.diagnostics.find((d) => d.code === "BML_UNEXPECTED_TEXT");
    expect(diag).toBeDefined();
    const textLine = source.split("\n").findIndex((l) => l.includes("sds")) + 1;
    expect(diag!.source.line).toBe(textLine);
    expect(diag!.source.column).toBe(3);
    expect(diag!.source.endLine).toBe(textLine);
    expect(diag!.source.endColumn).toBe(6);
    expect(result.document!.block.name).toBe("Sample");
  });

  it("does not flag indent whitespace between tags", () => {
    const source = sample("  <properties>\n    <ok type=\"type:Text\" />\n  </properties>");
    const result = parse(source, { filePath: "whitespace.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(false);
  });

  it("keeps character data on name and is", () => {
    const result = parse(sample(""), { filePath: "identity-text.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(false);
    expect(result.document!.block.name).toBe("Sample");
    expect(result.document!.block.is).toBe("sample");
  });

  it("keeps character data inside bml:xml", () => {
    const source = sample("  <bml:xml>${ bml:Self }</bml:xml>");
    const result = parse(source, { filePath: "bml-xml-text.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(false);
  });
});
