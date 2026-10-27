import { describe, expect, it } from "vitest";
import type { WithDirective } from "@blockml/bom";
import { parse } from "../src/parse.js";

function sample(withAttr: string): string {
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:bml="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:test="com.blockml.test.struct">',
    "  <name>Sample</name>",
    "  <type>test:Sample</type>",
    "  <baseType>core:Block</baseType>",
    "  <is>sample</is>",
    "  <aggregations>",
    "    <parts>",
    "      <composition>",
    `        <test:Part bml:with="${withAttr}" />`,
    "      </composition>",
    "    </parts>",
    "  </aggregations>",
    "</block>",
  ].join("\n");
}

function withDirective(withAttr: string): WithDirective {
  const result = parse(sample(withAttr), { filePath: "with.bml", continueOnError: true });
  expect(result.document).not.toBeNull();
  const parts = result.document!.block.members.find((member) => member.name === "parts");
  expect(parts?.kind).toBe("aggregation");
  if (parts?.kind !== "aggregation") {
    throw new Error("parts aggregation missing");
  }
  const child = parts.composition?.children[0];
  expect(child?.kind).toBe("blockInstance");
  if (child?.kind !== "blockInstance") {
    throw new Error("instance missing");
  }
  const directive = child.directives?.find((entry) => entry.type === "with");
  expect(directive?.type).toBe("with");
  if (directive?.type !== "with") {
    throw new Error("with directive missing");
  }
  return directive;
}

describe("bml:with binding split", () => {
  it("keeps a call argument comma inside one binding", () => {
    const directive = withDirective("cap=${#math.min(size.x, size.y)}");
    expect(directive.bindings).toEqual([
      expect.objectContaining({
        name: "cap",
        value: expect.objectContaining({
          kind: "expression",
          raw: "#math.min(size.x, size.y)",
        }),
      }),
    ]);
  });

  it("keeps a nested call as one binding", () => {
    const directive = withDirective("cap=${#math.min(#math.max(a, b), c)}");
    expect(directive.bindings.map((binding) => binding.name)).toEqual(["cap"]);
    expect(directive.bindings[0]?.value.raw).toBe("#math.min(#math.max(a, b), c)");
  });

  it("still splits two bindings on a top-level comma", () => {
    const directive = withDirective("x=${ i },y=${ rows }");
    expect(directive.bindings.map((binding) => [binding.name, binding.value.raw])).toEqual([
      ["x", "i"],
      ["y", "rows"],
    ]);
  });

  it("keeps commas inside braces, brackets, and quotes", () => {
    const directive = withDirective("pt=${ {x: 1, y: 2} }, xs=${ [1, 2] }, label=${ 'a,b' }");
    expect(directive.bindings.map((binding) => [binding.name, binding.value.raw])).toEqual([
      ["pt", "{x: 1, y: 2}"],
      ["xs", "[1, 2]"],
      ["label", "'a,b'"],
    ]);
  });
});
