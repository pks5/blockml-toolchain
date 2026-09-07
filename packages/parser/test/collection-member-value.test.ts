import { describe, expect, it } from "vitest";
import { parse } from "../src/parse.js";

function sample(body: string): string {
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:type="org.blockml.bml.type"',
    ' xmlns:test="com.blockml.test.collect">',
    "  <name>Sample</name>",
    "  <type>test:Sample</type>",
    "  <baseType>core:Block</baseType>",
    "  <is>sample</is>",
    body,
    "</block>",
  ].join("\n");
}

function firstInstance(source: string, filePath: string) {
  const result = parse(source, { filePath, continueOnError: true });
  expect(result.document).not.toBeNull();
  const children = result.document!.block.members.find((m) => m.name === "children");
  expect(children?.kind).toBe("aggregation");
  if (children?.kind !== "aggregation") {
    return { result, instance: undefined };
  }
  const child = children.composition?.children[0];
  expect(child?.kind).toBe("blockInstance");
  if (child?.kind !== "blockInstance") {
    return { result, instance: undefined };
  }
  return { result, instance: child.instance };
}

describe("collection instance member values", () => {
  it("keeps a compact JSON list on an attribute", () => {
    const { instance } = firstInstance(
      sample(
        [
          "  <aggregations>",
          "    <children>",
          "      <composition>",
          `        <test:Child labels="['Hello', 'Good Bye']" />`,
          "      </composition>",
          "    </children>",
          "  </aggregations>",
        ].join("\n"),
      ),
      "compact-attr.bml",
    );
    expect(instance?.memberValues.labels).toMatchObject({
      kind: "literal",
      value: ["Hello", "Good Bye"],
      authoredPlacement: "attribute",
    });
  });

  it("merges repeated instance elements into a list", () => {
    const { instance } = firstInstance(
      sample(
        [
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
        ].join("\n"),
      ),
      "repeated-elements.bml",
    );
    expect(instance?.memberValues.labels).toMatchObject({
      kind: "literal",
      value: ["Hello", "Good Bye"],
      authoredPlacement: "element",
    });
  });

  it("reports mix of attribute and repeated elements", () => {
    const { result } = firstInstance(
      sample(
        [
          "  <aggregations>",
          "    <children>",
          "      <composition>",
          `        <test:Child labels="['Hello']">`,
          "          <labels>Good Bye</labels>",
          "        </test:Child>",
          "      </composition>",
          "    </children>",
          "  </aggregations>",
        ].join("\n"),
      ),
      "mixed-forms.bml",
    );
    expect(result.diagnostics.some((d) => d.code === "BML_MIXED_MEMBER_VALUE")).toBe(true);
  });

  it("does not split space-separated association tokens into a list", () => {
    const { instance } = firstInstance(
      sample(
        [
          "  <aggregations>",
          "    <children>",
          "      <composition>",
          '        <test:Child linked="mine other" />',
          "      </composition>",
          "    </children>",
          "  </aggregations>",
        ].join("\n"),
      ),
      "space-separated.bml",
    );
    expect(instance?.memberValues.linked).toMatchObject({
      kind: "literal",
      value: "mine other",
    });
  });

  it("reports mix of compact JSON element and an extra tag", () => {
    const { result } = firstInstance(
      sample(
        [
          "  <aggregations>",
          "    <children>",
          "      <composition>",
          "        <test:Child>",
          "          <labels>['Hello']</labels>",
          "          <labels>Good Bye</labels>",
          "        </test:Child>",
          "      </composition>",
          "    </children>",
          "  </aggregations>",
        ].join("\n"),
      ),
      "mixed-json-tag.bml",
    );
    expect(result.diagnostics.some((d) => d.code === "BML_MIXED_MEMBER_VALUE")).toBe(true);
  });

});
