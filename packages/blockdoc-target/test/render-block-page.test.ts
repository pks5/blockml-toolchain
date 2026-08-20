import { describe, expect, it } from "vitest";
import type { BlockDefinition } from "@blockml/bom";
import { DEFAULT_BLOCKDOC_OPTIONS } from "../src/options.js";
import { renderBlockPage } from "../src/render-block-page.js";

const KNOWN = new Set([
  "com.example.Child",
  "com.example.Parent",
  "com.example.RefType",
  "com.example.Parent.Documentation",
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
        kind: "property",
        name: "documentation",
        typeFqn: "com.example.type.Documentation",
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
    subBlocks: [
      {
        name: "Documentation",
        type: "com.example.Parent.Documentation",
        is: "Docs",
        members: [],
        subBlocks: [],
        embeddedBlocks: [],
        compositions: [],
      },
    ],
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
      "com.example.Parent",
    );
    expect(html).toContain('<dt>baseType</dt><dd><a href="');
    expect(html).toContain("com.example.RefType");
    expect(html).toMatch(/<h2>Properties<\/h2>/);
    expect(html).toMatch(/<td>title<\/td><td><a href="/);
    expect(html).not.toContain("<th>Kind</th>");
  });

  it("links unqualified member types to sub-blocks", () => {
    const html = renderBlockPage(
      minimalBlock(),
      DEFAULT_BLOCKDOC_OPTIONS,
      "index.html",
      KNOWN,
      "com.example.Parent",
    );
    expect(html).toContain("Documentation.html");
    expect(html).toContain("com.example.Parent.Documentation");
  });

  it("renders composition children", () => {
    const html = renderBlockPage(
      minimalBlock(),
      DEFAULT_BLOCKDOC_OPTIONS,
      "index.html",
      KNOWN,
      "com.example.Parent",
    );
    expect(html).toContain("<h2>Composition</h2>");
    expect(html).toContain("<h3>blocks</h3>");
    expect(html).toContain("com.example.Child");
    expect(html).toContain("members: size");
  });

  it("shows segment-only breadcrumb labels", () => {
    const html = renderBlockPage(
      minimalBlock(),
      DEFAULT_BLOCKDOC_OPTIONS,
      "index.html",
      KNOWN,
      "com.example.Parent",
    );
    expect(html).toContain('<a href="../../index.html">Index</a> / <a href="../index.html">com</a> / <a href="./index.html">example</a> / Parent');
    expect(html).not.toContain("com.example.Parent / com.example");
  });
});
