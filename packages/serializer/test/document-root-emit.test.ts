import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { serialize } from "../src/serialize.js";

const NS = [
  'xmlns="http://blockml.org/bml"',
  'xmlns:core="org.blockml.bml.core"',
  'xmlns:test="com.blockml.test.root"',
].join(" ");

describe("document root form-fidelity", () => {
  it("keeps legacy <block> plus child <type> on serialize", () => {
    const source = [
      `<block ${NS}>`,
      "  <name>Sample</name>",
      "  <type>test:Sample</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "</block>",
    ].join("\n");
    const parsed = parse(source, { filePath: "legacy.bml" });
    expect(parsed.document).not.toBeNull();
    const xml = serialize(parsed.document!);
    expect(xml.success).toBe(true);
    expect(xml.text).toMatch(/<block\b/);
    expect(xml.text).toMatch(/<\/block>/);
    expect(xml.text).toMatch(/<type>/);
    expect(xml.text).not.toMatch(/<test:Sample\b/);
  });

  it("re-emits a qualified type-as-root tag and omits child <type>", () => {
    const source = [
      `<test:Sample ${NS}>`,
      "  <name>Sample</name>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "</test:Sample>",
    ].join("\n");
    const parsed = parse(source, { filePath: "qualified.bml" });
    expect(parsed.document).not.toBeNull();
    const xml = serialize(parsed.document!);
    expect(xml.success).toBe(true);
    expect(xml.text).toMatch(/<test:Sample\b/);
    expect(xml.text).toMatch(/<\/test:Sample>/);
    expect(xml.text).not.toMatch(/<type>/);
    expect(xml.text).not.toMatch(/<block\b/);
  });

  it("re-emits an unqualified type-as-root tag", () => {
    const source = [
      `<Sample ${NS}>`,
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "</Sample>",
    ].join("\n");
    const parsed = parse(source, { filePath: "unqualified.bml" });
    expect(parsed.document).not.toBeNull();
    const xml = serialize(parsed.document!);
    expect(xml.success).toBe(true);
    expect(xml.text).toMatch(/<Sample\b/);
    expect(xml.text).toMatch(/<\/Sample>/);
    expect(xml.text).not.toMatch(/<type>/);
  });

  it("still emits nested <block> with child <type>", () => {
    const source = [
      `<test:Sample ${NS}>`,
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <subBlocks>",
      "    <block>",
      "      <name>Inner</name>",
      "      <type>test:Inner</type>",
      "      <baseType>core:Block</baseType>",
      "      <is>inner</is>",
      "    </block>",
      "  </subBlocks>",
      "</test:Sample>",
    ].join("\n");
    const parsed = parse(source, { filePath: "nested.bml" });
    expect(parsed.document).not.toBeNull();
    const xml = serialize(parsed.document!);
    expect(xml.text).toMatch(/<test:Sample\b/);
    expect(xml.text).toMatch(/<subBlocks>/);
    expect(xml.text).toMatch(/<block>/);
    expect(xml.text).toMatch(/<type>\s*test:Inner\s*<\/type>/);
  });
});
