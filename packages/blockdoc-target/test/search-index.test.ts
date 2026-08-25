import { describe, expect, it } from "vitest";
import type { BlockDefinition } from "@blockml/bom";
import {
  buildSearchIndexEntry,
  collectKeywords,
  filterSearchIndex,
  serializeSearchIndex,
} from "../src/search-index.js";
import { renderSearchScript } from "../src/toolbar.js";

function block(overrides: Partial<BlockDefinition> = {}): BlockDefinition {
  return {
    name: "Alpha",
    type: "com.example.pkg.Alpha",
    is: "An example block",
    members: [],
    subBlocks: [],
    embeddedBlocks: [],
    compositions: [],
    ...overrides,
  };
}

describe("collectKeywords", () => {
  it("indexes name, FQN, segments, and is", () => {
    expect(collectKeywords(block())).toEqual([
      "Alpha",
      "com.example.pkg.Alpha",
      "com",
      "example",
      "pkg",
      "An example block",
    ]);
  });

  it("includes aliases and authored keywords", () => {
    const keywords = collectKeywords(
      block({
        aliases: [{ typeFqn: "org.blockml.bml.core.Alias", name: "ExampleAlpha" }],
        keywords: [
          { typeFqn: "org.blockml.bml.meta.FreeTextKeyword", term: "quickstart" },
        ],
      }),
    );
    expect(keywords).toContain("ExampleAlpha");
    expect(keywords).toContain("Alias");
    expect(keywords).toContain("quickstart");
    expect(keywords).toContain("FreeTextKeyword");
  });
});

describe("buildSearchIndexEntry", () => {
  it("uses the site-root href and omits empty is", () => {
    const withIs = buildSearchIndexEntry(block(), "com/example/pkg/Alpha.html");
    expect(withIs.href).toBe("com/example/pkg/Alpha.html");
    expect(withIs.is).toBe("An example block");

    const withoutIs = buildSearchIndexEntry(
      block({ is: undefined }),
      "com/example/pkg/Alpha.html",
    );
    expect(withoutIs.is).toBeUndefined();
  });
});

describe("serializeSearchIndex", () => {
  it("wraps entries in a blocks document", () => {
    const json = serializeSearchIndex([
      buildSearchIndexEntry(block(), "com/example/pkg/Alpha.html"),
    ]);
    const parsed = JSON.parse(json) as { blocks: Array<{ type: string }> };
    expect(parsed.blocks).toHaveLength(1);
    expect(parsed.blocks[0]?.type).toBe("com.example.pkg.Alpha");
  });
});

describe("filterSearchIndex", () => {
  const entries = [
    buildSearchIndexEntry(block(), "com/example/pkg/Alpha.html"),
    buildSearchIndexEntry(
      block({ name: "Beta", type: "com.example.pkg.Beta", is: "Other" }),
      "com/example/pkg/Beta.html",
    ),
    buildSearchIndexEntry(
      block({ name: "Alphabet", type: "com.example.pkg.Alphabet", is: "Prefix sibling" }),
      "com/example/pkg/Alphabet.html",
    ),
  ];

  it("matches keywords case-insensitively and ranks exact name first", () => {
    const hits = filterSearchIndex(entries, "alpha");
    expect(hits.map((h) => h.name)).toEqual(["Alpha", "Alphabet"]);
  });

  it("requires every token to match", () => {
    const hits = filterSearchIndex(entries, "example beta");
    expect(hits.map((h) => h.name)).toEqual(["Beta"]);
  });

  it("returns nothing for a blank query", () => {
    expect(filterSearchIndex(entries, "   ")).toEqual([]);
  });
});

describe("renderSearchScript", () => {
  it("inlines the index so file:// pages can search", () => {
    const script = renderSearchScript([
      buildSearchIndexEntry(block(), "com/example/pkg/Alpha.html"),
    ]);
    expect(script).toContain("com.example.pkg.Alpha");
    expect(script).toContain("com/example/pkg/Alpha.html");
    expect(script).toContain("function search(");
    expect(script).toContain("document.currentScript");
  });
});
