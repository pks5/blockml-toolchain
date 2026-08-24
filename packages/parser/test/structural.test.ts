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
});
