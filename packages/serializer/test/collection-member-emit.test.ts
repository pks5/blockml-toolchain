import { describe, expect, it } from "vitest";
import { parse } from "../../parser/src/parse.js";
import { serialize } from "../src/serialize.js";

describe("collection instance emit", () => {
  it("emits repeated tags for an element-placed list", () => {
    const source = [
      '<block xmlns="http://blockml.org/bml"',
      ' xmlns:core="org.blockml.bml.core"',
      ' xmlns:test="com.blockml.test.collect">',
      "  <name>Sample</name>",
      "  <type>test:Sample</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <aggregations>",
      "    <children>",
      "      <composition>",
      "        <test:Child>",
      "          <labels>Hello</labels>",
      "          <labels>Good Bye</labels>",
      "        </test:Child>",
      "      </composition>",
      "    </children>",
      "  </aggregations>",
      "</block>",
    ].join("\n");
    const parsed = parse(source, { filePath: "emit-repeated.bml" });
    expect(parsed.document).not.toBeNull();
    const text = serialize(parsed.document!).text;
    expect(text).toContain("<labels>Hello</labels>");
    expect(text).toContain("<labels>Good Bye</labels>");
    expect(text).not.toMatch(/<labels>\s*\[/);
  });
});
