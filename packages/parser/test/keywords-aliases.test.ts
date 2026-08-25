import { describe, expect, it } from "vitest";
import { parse } from "../src/parse.js";
import { serialize } from "@blockml/serializer";

const FREE_TEXT_KEYWORD = "org.blockml.bml.meta.FreeTextKeyword";
const FREE_TEXT_ALIAS = "org.blockml.bml.meta.FreeTextAlias";

function sample(body: string): string {
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:meta="org.blockml.bml.meta"',
    ' xmlns:type="org.blockml.bml.type"',
    ' xmlns:test="com.blockml.test.struct">',
    "  <name>Sample</name>",
    "  <type>test:Sample</type>",
    "  <baseType>core:Block</baseType>",
    "  <is>sample</is>",
    "  <documentation>sample</documentation>",
    body,
    "</block>",
  ].join("\n");
}

describe("keyword and alias shorthand", () => {
  it("expands comma-separated keywords to FreeTextKeyword entries", () => {
    const source = sample(
      "  <keywords>inheritance, nesting, FQN derivation</keywords>",
    );
    const result = parse(source, { filePath: "keywords-sugar.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(false);
    expect(result.document!.block.keywords).toEqual([
      { typeFqn: FREE_TEXT_KEYWORD, term: "inheritance" },
      { typeFqn: FREE_TEXT_KEYWORD, term: "nesting" },
      { typeFqn: FREE_TEXT_KEYWORD, term: "FQN derivation" },
    ]);
  });

  it("expands a single keyword token without commas", () => {
    const source = sample("  <keywords>BML_UNKNOWN_CAPABILITY</keywords>");
    const result = parse(source, { filePath: "keywords-single.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(false);
    expect(result.document!.block.keywords).toEqual([
      { typeFqn: FREE_TEXT_KEYWORD, term: "BML_UNKNOWN_CAPABILITY" },
    ]);
  });

  it("drops empty keyword tokens", () => {
    const source = sample("  <keywords>a, , b</keywords>");
    const result = parse(source, { filePath: "keywords-empty-tokens.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.document!.block.keywords).toEqual([
      { typeFqn: FREE_TEXT_KEYWORD, term: "a" },
      { typeFqn: FREE_TEXT_KEYWORD, term: "b" },
    ]);
  });

  it("maps long-form keyword children without sugar", () => {
    const source = sample(
      [
        "  <keywords>",
        '    <meta:FreeTextKeyword term="author" />',
        '    <meta:FreeTextKeyword term="new block" />',
        "  </keywords>",
      ].join("\n"),
    );
    const result = parse(source, { filePath: "keywords-longform.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(false);
    expect(result.document!.block.keywords).toEqual([
      { typeFqn: FREE_TEXT_KEYWORD, term: "author" },
      { typeFqn: FREE_TEXT_KEYWORD, term: "new block" },
    ]);
  });

  it("expands comma-separated aliases to FreeTextAlias entries", () => {
    const source = sample("  <aliases>Sub-Block, nested type</aliases>");
    const result = parse(source, { filePath: "aliases-sugar.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(false);
    expect(result.document!.block.aliases).toEqual([
      { typeFqn: FREE_TEXT_ALIAS, name: "Sub-Block" },
      { typeFqn: FREE_TEXT_ALIAS, name: "nested type" },
    ]);
  });

  it("maps member keyword sugar on a property", () => {
    const source = sample(
      [
        "  <properties>",
        '    <width type="type:Text">',
        "      <keywords>foo, bar</keywords>",
        "      <documentation>width</documentation>",
        "    </width>",
        "  </properties>",
      ].join("\n"),
    );
    const result = parse(source, { filePath: "member-keywords.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(false);
    const width = result.document!.block.members.find((m) => m.name === "width");
    expect(width?.keywords).toEqual([
      { typeFqn: FREE_TEXT_KEYWORD, term: "foo" },
      { typeFqn: FREE_TEXT_KEYWORD, term: "bar" },
    ]);
  });

  it("serializes keyword sugar as long-form children", () => {
    const source = sample(
      "  <keywords>inheritance, nesting, FQN derivation</keywords>",
    );
    const parsed = parse(source, { filePath: "keywords-roundtrip.bml", continueOnError: true });
    expect(parsed.document).not.toBeNull();
    const serialized = serialize(parsed.document!);
    expect(serialized.text).toContain('term="inheritance"');
    expect(serialized.text).toContain('term="nesting"');
    expect(serialized.text).toContain('term="FQN derivation"');
    expect(serialized.text).not.toContain(
      "<keywords>inheritance, nesting, FQN derivation</keywords>",
    );
  });
});
