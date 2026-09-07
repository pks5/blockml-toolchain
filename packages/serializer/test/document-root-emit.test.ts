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
    expect(xml.text).not.toMatch(/<name>/);
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

  it("does not invent <type> on a legacy Sub-Block that only authored <name>", () => {
    const source = [
      `<test:Sample ${NS}>`,
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <subBlocks>",
      "    <block>",
      "      <name>Utils</name>",
      "      <baseType>core:Block</baseType>",
      "      <is>helpers</is>",
      "    </block>",
      "  </subBlocks>",
      "</test:Sample>",
    ].join("\n");
    const parsed = parse(source, { filePath: "sub-legacy-no-type.bml" });
    const xml = serialize(parsed.document!);
    expect(xml.text).toMatch(/<block>/);
    expect(xml.text).toMatch(/<name>/);
    expect(xml.text).not.toMatch(/<type>/);
    const second = parse(xml.text!, { filePath: "sub-legacy-no-type.bml" });
    expect(second.document!.block.subBlocks[0]?.authoredTypeChild).toBeUndefined();
    expect(second.document!.block.subBlocks[0]?.type).toBe(
      "com.blockml.test.root.Sample.Utils",
    );
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

  it("re-emits an unqualified Sub-Block tag and omits child <name>", () => {
    const source = [
      `<test:Sample ${NS}>`,
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <subBlocks>",
      "    <Inner>",
      "      <baseType>core:Block</baseType>",
      "      <is>inner</is>",
      "    </Inner>",
      "  </subBlocks>",
      "</test:Sample>",
    ].join("\n");
    const parsed = parse(source, { filePath: "sub-tag.bml" });
    const xml = serialize(parsed.document!);
    expect(xml.text).toMatch(/<subBlocks>/);
    expect(xml.text).toMatch(/<Inner>/);
    expect(xml.text).toMatch(/<\/Inner>/);
    expect(xml.text).not.toMatch(/<name>\s*Inner\s*<\/name>/);
  });

  it("uses the longest xmlns package for a type-as-root tag", () => {
    const source = [
      `<block ${NS} xmlns:blockml="org.blockml.bml" xmlns:nested="com.blockml.test.root">`,
      "  <name>Sample</name>",
      "  <type>test:Sample</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "</block>",
    ].join("\n");
    const parsed = parse(source, { filePath: "longest.bml" });
    parsed.document!.source.rootForm = "type";
    parsed.document!.block.wrapperForm = "type";
    const xml = serialize(parsed.document!);
    expect(xml.text).toMatch(/<test:Sample\b/);
    expect(xml.text).not.toMatch(/<blockml:/);
    expect(xml.text).not.toMatch(/<nested:Sample\b/);
  });

  it("keeps aggregation and association constraints instead of self-closing", () => {
    const source = [
      `<test:Sample ${NS} xmlns:constraint="org.blockml.bml.constraint">`,
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <aggregations>",
      "    <children type=\"core:Block[]\">",
      "      <constraints>",
      "        <constraint:AllowedChildType type=\"core:Block\" />",
      "      </constraints>",
      "    </children>",
      "  </aggregations>",
      "  <associations>",
      "    <parent type=\"core:Block\">",
      "      <constraints>",
      "        <constraint:NoSelfReference />",
      "      </constraints>",
      "    </parent>",
      "  </associations>",
      "</test:Sample>",
    ].join("\n");
    const parsed = parse(source, { filePath: "member-constraints.bml" });
    expect(parsed.document).not.toBeNull();
    const xml = serialize(parsed.document!);
    expect(xml.success).toBe(true);
    expect(xml.text).toContain("<constraints>");
    expect(xml.text).toContain("AllowedChildType");
    expect(xml.text).toContain("NoSelfReference");
    expect(xml.text).not.toMatch(/<children[^>]*\/>/);
    expect(xml.text).not.toMatch(/<parent[^>]*\/>/);
  });

  it("re-emits a qualified embed tag and omits child <type>", () => {
    const source = [
      `<test:Sample ${NS}>`,
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <embeddedBlocks>",
      "    <test:Helper>",
      "      <baseType>core:Block</baseType>",
      "      <is>embed</is>",
      "    </test:Helper>",
      "  </embeddedBlocks>",
      "</test:Sample>",
    ].join("\n");
    const parsed = parse(source, { filePath: "embed-tag.bml" });
    const xml = serialize(parsed.document!);
    expect(xml.text).toMatch(/<test:Helper>/);
    expect(xml.text).toMatch(/<\/test:Helper>/);
    expect(xml.text).not.toMatch(/<type>/);
  });
});
