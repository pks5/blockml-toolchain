import { describe, expect, it } from "vitest";
import type { BlockDefinition } from "@blockml/bom";
import { DEFAULT_BLOCKDOC_OPTIONS } from "../src/options.js";
import { renderBlockPage } from "../src/render-block-page.js";

const KNOWN = new Set([
  "com.example.Child",
  "com.example.Parent",
  "com.example.RefType",
]);

function minimalBlock(overrides: Partial<BlockDefinition> = {}): BlockDefinition {
  return {
    name: "Parent",
    type: "com.example.Parent",
    baseType: "com.example.RefType",
    is: "A parent block",
    members: [
      {
        kind: "property",
        name: "title",
        typeFqn: "com.example.RefType",
      },
      {
        kind: "aggregation",
        name: "blocks",
        composition: {
          aggregationName: "blocks",
          children: [
            {
              kind: "blockInstance",
              instance: {
                typeFqn: "com.example.Child",
                memberValues: { size: { kind: "literal", value: 1, typeFqn: "int" } },
              },
            },
          ],
        },
      },
    ],
    subBlocks: [],
    embeddedBlocks: [],
    compositions: [],
    ...overrides,
  };
}

describe("renderBlockPage", () => {
  it("links baseType and member types when known", () => {
    const html = renderBlockPage(
      minimalBlock(),
      DEFAULT_BLOCKDOC_OPTIONS,
      "index.html",
      KNOWN,
    );
    expect(html).toContain('<dt>baseType</dt><dd><a href="');
    expect(html).toContain("com.example.RefType");
    expect(html).toMatch(/<td>property<\/td><td>title<\/td><td><a href="/);
  });

  it("renders composition children", () => {
    const html = renderBlockPage(
      minimalBlock(),
      DEFAULT_BLOCKDOC_OPTIONS,
      "index.html",
      KNOWN,
    );
    expect(html).toContain("<h2>Composition</h2>");
    expect(html).toContain("<h3>blocks</h3>");
    expect(html).toContain("com.example.Child");
    expect(html).toContain("members: size");
  });
});
