import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { serialize } from "../src/serialize.js";

const NS = [
  'xmlns="http://blockml.org/bml"',
  'xmlns:core="org.blockml.bml.core"',
  'xmlns:test="com.blockml.test.generics"',
].join(" ");

describe("genericTypes documentation emit", () => {
  it("emits documentation children on genericTypes entries", () => {
    const source = [
      `<block ${NS}>`,
      "  <name>Host</name>",
      "  <type>test:Host</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <genericTypes>",
      '    <T baseType="core:ValueType">',
      "      <documentation>Payload type for this host.</documentation>",
      "    </T>",
      '    <R baseType="core:Block" />',
      "  </genericTypes>",
      "</block>",
    ].join("\n");
    const parsed = parse(source, { filePath: "generic-docs.bml" });
    expect(parsed.document).not.toBeNull();
    const xml = serialize(parsed.document!);
    expect(xml.success).toBe(true);
    expect(xml.text).toMatch(/<T\b[^>]*>/);
    expect(xml.text).toMatch(/<documentation>\s*Payload type for this host\.\s*<\/documentation>/);
    expect(xml.text).toMatch(/<R\b[^>]*\/>/);
    expect(xml.text).not.toMatch(/<R\b[^>]*>\s*<documentation>/);
  });

  it("round-trips genericTypes documentation without leaking onto the Block", () => {
    const source = [
      `<block ${NS}>`,
      "  <name>Host</name>",
      "  <type>test:Host</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <genericTypes>",
      '    <T baseType="core:ValueType">',
      "      <documentation>Payload type for this host.</documentation>",
      "    </T>",
      "  </genericTypes>",
      "</block>",
    ].join("\n");
    const first = parse(source, { filePath: "generic-docs-roundtrip.bml" });
    expect(first.document).not.toBeNull();
    const xml = serialize(first.document!);
    expect(xml.success).toBe(true);
    const second = parse(xml.text!, { filePath: "generic-docs-roundtrip-out.bml" });
    expect(second.document).not.toBeNull();
    expect(second.document!.block.documentations).toBeUndefined();
    expect(second.document!.block.genericTypes?.[0]?.documentations?.[0]?.text).toBe(
      "Payload type for this host.",
    );
  });
});
