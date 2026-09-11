import { describe, expect, it } from "vitest";
import { parse } from "../src/parse.js";
import { serialize } from "@blockml/serializer";

const KEYWORD = "org.blockml.bml.meta.Keyword";
const ALIAS = "org.blockml.bml.meta.Alias";
const INTEGER_ENTITY = "org.blockml.bml.type.IntegerEntity";

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
  it("expands comma-separated keywords to Keyword entries", () => {
    const source = sample(
      "  <keywords>inheritance, nesting, FQN derivation</keywords>",
    );
    const result = parse(source, { filePath: "keywords-sugar.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(false);
    expect(result.document!.block.keywords).toEqual([
      { typeFqn: KEYWORD, value: "inheritance" },
      { typeFqn: KEYWORD, value: "nesting" },
      { typeFqn: KEYWORD, value: "FQN derivation" },
    ]);
  });

  it("expands a single keyword token without commas", () => {
    const source = sample("  <keywords>BML_UNKNOWN_CAPABILITY</keywords>");
    const result = parse(source, { filePath: "keywords-single.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(false);
    expect(result.document!.block.keywords).toEqual([
      { typeFqn: KEYWORD, value: "BML_UNKNOWN_CAPABILITY" },
    ]);
  });

  it("drops empty keyword tokens", () => {
    const source = sample("  <keywords>a, , b</keywords>");
    const result = parse(source, { filePath: "keywords-empty-tokens.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.document!.block.keywords).toEqual([
      { typeFqn: KEYWORD, value: "a" },
      { typeFqn: KEYWORD, value: "b" },
    ]);
  });

  it("maps long-form keyword children without sugar", () => {
    const source = sample(
      [
        "  <keywords>",
        '    <meta:Keyword value="author" />',
        '    <meta:Keyword value="new block" />',
        "  </keywords>",
      ].join("\n"),
    );
    const result = parse(source, { filePath: "keywords-longform.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(false);
    expect(result.document!.block.keywords).toEqual([
      { typeFqn: KEYWORD, value: "author" },
      { typeFqn: KEYWORD, value: "new block" },
    ]);
  });

  it("expands comma-separated aliases to Alias entries", () => {
    const source = sample("  <aliases>Sub-Block, nested type</aliases>");
    const result = parse(source, { filePath: "aliases-sugar.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(false);
    expect(result.document!.block.aliases).toEqual([
      { typeFqn: ALIAS, value: "Sub-Block" },
      { typeFqn: ALIAS, value: "nested type" },
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
      { typeFqn: KEYWORD, value: "foo" },
      { typeFqn: KEYWORD, value: "bar" },
    ]);
  });

  it("serializes keyword sugar as long-form children", () => {
    const source = sample(
      "  <keywords>inheritance, nesting, FQN derivation</keywords>",
    );
    const parsed = parse(source, { filePath: "keywords-roundtrip.bml", continueOnError: true });
    expect(parsed.document).not.toBeNull();
    const serialized = serialize(parsed.document!);
    expect(serialized.text).toContain('value="inheritance"');
    expect(serialized.text).toContain('value="nesting"');
    expect(serialized.text).toContain('value="FQN derivation"');
    expect(serialized.text).not.toContain(
      "<keywords>inheritance, nesting, FQN derivation</keywords>",
    );
  });
});

describe("PrimitiveEntity comma sugar", () => {
  it("expands comma-separated tokens on an IntegerEntity aggregation", () => {
    const source = sample(
      [
        "  <aggregations>",
        '    <counts type="type:IntegerEntity[]">1, 2, 3</counts>',
        "  </aggregations>",
      ].join("\n"),
    );
    const result = parse(source, { filePath: "integer-entity-sugar.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(false);
    const counts = result.document!.block.members.find((m) => m.name === "counts");
    expect(counts?.kind).toBe("aggregation");
    if (counts?.kind !== "aggregation") {
      return;
    }
    const values = (counts.composition?.children ?? []).map((child) => {
      if (child.kind !== "blockInstance") {
        return undefined;
      }
      const value = child.instance.memberValues.value;
      return {
        typeFqn: child.instance.typeFqn,
        value: value && value.kind === "literal" ? value.value : undefined,
      };
    });
    expect(values).toEqual([
      { typeFqn: INTEGER_ENTITY, value: 1 },
      { typeFqn: INTEGER_ENTITY, value: 2 },
      { typeFqn: INTEGER_ENTITY, value: 3 },
    ]);
  });

  it("does not comma-split TypeReferenceEntity aggregations", () => {
    const source = sample(
      [
        "  <aggregations>",
        '    <deps type="type:TypeReferenceEntity[]">a, b</deps>',
        "  </aggregations>",
      ].join("\n"),
    );
    const result = parse(source, { filePath: "tre-no-comma-sugar.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(true);
    const deps = result.document!.block.members.find((m) => m.name === "deps");
    expect(deps?.kind).toBe("aggregation");
    if (deps?.kind !== "aggregation") {
      return;
    }
    expect(deps.composition?.children ?? []).toEqual([]);
  });

  it("does not treat FixedKeyword as a comma-sugar target", () => {
    const source = sample(
      [
        "  <aggregations>",
        '    <tags type="meta:FixedKeyword[]">inheritance, nesting</tags>',
        "  </aggregations>",
      ].join("\n"),
    );
    const result = parse(source, { filePath: "fixed-keyword-no-sugar.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(true);
    const tags = result.document!.block.members.find((m) => m.name === "tags");
    expect(tags?.kind).toBe("aggregation");
    if (tags?.kind !== "aggregation") {
      return;
    }
    expect(tags.composition?.children ?? []).toEqual([]);
  });

  it("reports default=true on an aggregation as an unknown attribute", () => {
    const source = sample(
      [
        "  <aggregations>",
        '    <items type="core:Block[]" default="true" />',
        "  </aggregations>",
      ].join("\n"),
    );
    const result = parse(source, { filePath: "aggregation-default-unknown.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.diagnostics.some((d) => d.code === "BML_UNKNOWN_ATTRIBUTE")).toBe(true);
    const items = result.document!.block.members.find((m) => m.name === "items");
    expect(items?.kind).toBe("aggregation");
    if (items?.kind !== "aggregation") {
      return;
    }
    expect("default" in items).toBe(false);
    expect(items.unknownAttributes?.default).toBe("true");
  });
});
