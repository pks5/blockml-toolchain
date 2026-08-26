import { describe, expect, it } from "vitest";
import type { BlockDefinition } from "@blockml/bom";
import { DEFAULT_BLOCKDOC_OPTIONS } from "../src/options.js";
import { renderBlockPage, renderIndexPage } from "../src/render-block-page.js";

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
    expect(html).toContain('<p class="extends">extends <a href="');
    expect(html).toContain("com.example.RefType");
    expect(html).toContain('<h2 class="designation">A parent block</h2>');
    expect(html).not.toContain("<dt>FQN</dt>");
    expect(html).not.toContain("<dt>baseType</dt>");
    expect(html).not.toContain("<dt>is</dt>");
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

  it("shows a dotted package path above the block name", () => {
    const html = renderBlockPage(
      minimalBlock(),
      DEFAULT_BLOCKDOC_OPTIONS,
      "index.html",
      KNOWN,
      "com.example.Parent",
    );
    expect(html).toContain('<span class="brand">BlockDoc</span>');
    expect(html).toContain('<a href="../../index.html">Index</a>');
    expect(html).toContain('src="../../search.js"');
    expect(html).toContain("Search blocks…");
    expect(html).not.toContain('class="site-index"');
    expect(html).toContain(
      '<p class="package-fqn"><a href="../index.html">com</a>.<a href="./index.html">example</a></p>',
    );
    expect(html).not.toContain("nav class=\"breadcrumb\"");
    expect(html).not.toContain("Index</a> /");
  });
});

describe("renderIndexPage toolbar", () => {
  it("places BlockDoc and Index in the sticky toolbar", () => {
    const html = renderIndexPage(
      "BlockDoc",
      ["com.example.Parent"],
      DEFAULT_BLOCKDOC_OPTIONS,
      "index.html",
    );
    expect(html).toContain('<span class="brand">BlockDoc</span>');
    expect(html).toContain('<a href="./index.html">Index</a>');
    expect(html).toContain('src="./search.js"');
    expect(html).toContain('<div class="page">');
  });

  it("groups a single library by package prefix", () => {
    const html = renderIndexPage(
      "BlockDoc",
      [
        "org.blockml.bml.core.Library",
        "org.blockml.bml.core.Block",
        "org.blockml.bml.core.ValueType",
      ],
      DEFAULT_BLOCKDOC_OPTIONS,
      "index.html",
    );
    expect(html).toMatch(
      /<h2><a href="\.\/org\/blockml\/bml\/core\/index\.html">core<\/a><\/h2>/,
    );
    expect(html).not.toContain('class="library"');
    expect(html).not.toContain("<h3>");
  });

  it("groups multiple libraries under library headings then packages", () => {
    const html = renderIndexPage(
      "BlockDoc",
      [
        "org.blockml.bml.bom.Library",
        "org.blockml.bml.bom.api.ParseOptions",
        "org.blockml.bml.cli.Library",
        "org.blockml.bml.cli.documentation.Introduction",
      ],
      DEFAULT_BLOCKDOC_OPTIONS,
      "index.html",
    );
    expect(html).toMatch(
      /<section class="library"><h2><a href="\.\/org\/blockml\/bml\/bom\/index\.html">bom<\/a><\/h2>/,
    );
    expect(html).toContain('<p class="library-prefix">org.blockml.bml.bom</p>');
    expect(html).toContain('<a href="./org/blockml/bml/bom/Library.html">Library</a>');
    expect(html).toMatch(
      /<h3><a href="\.\/org\/blockml\/bml\/bom\/api\/index\.html">api<\/a><\/h3>/,
    );
    expect(html).toContain(
      '<a href="./org/blockml/bml/bom/api/ParseOptions.html">ParseOptions</a>',
    );
    expect(html).toMatch(
      /<section class="library"><h2><a href="\.\/org\/blockml\/bml\/cli\/index\.html">cli<\/a><\/h2>/,
    );
    expect(html).toMatch(
      /<h3><a href="\.\/org\/blockml\/bml\/cli\/documentation\/index\.html">documentation<\/a><\/h3>/,
    );
    expect(html).not.toMatch(/<h2><a href="[^"]+">api<\/a><\/h2>/);
    expect(html).not.toMatch(/<h2><a href="[^"]+">documentation<\/a><\/h2>/);
  });
});
