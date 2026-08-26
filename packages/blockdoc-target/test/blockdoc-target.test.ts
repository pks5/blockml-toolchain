import { describe, expect, it } from "vitest";
import { BlockDocTarget } from "../src/blockdoc-target.js";
import { DEFAULT_BLOCKDOC_OPTIONS } from "../src/options.js";
import type { RenderContext } from "@blockml/compiler";
import type { BomDocument } from "@blockml/bom";
import { TypeRegistry } from "@blockml/framework";

function mockContext(registry: TypeRegistry, corpusRoots?: string[]): RenderContext {
  return {
    session: {
      typeRegistry: registry,
      sourceFilePath: "<test>",
      outputBasePath: "doc",
      targetName: "blockdoc",
      scopeKind: corpusRoots?.length ? "corpus" : "library",
      ...(corpusRoots?.length ? { corpusRoots } : {}),
    },
    blockFqn: "",
    outputRelativePath: "",
    child: () => mockContext(registry, corpusRoots),
  };
}

function registerBlock(
  registry: TypeRegistry,
  block: BomDocument["block"],
  filePath: string,
): void {
  registry.register({
    kind: "block",
    block,
    source: { filePath, format: "xml" },
  });
}

describe("BlockDocTarget package indexes", () => {
  it("emits hierarchical package index pages without sub-block packages", () => {
    const registry = new TypeRegistry();
    registerBlock(
      registry,
      {
        name: "Alpha",
        type: "com.example.pkg.Alpha",
        is: "Alpha block",
        members: [],
        subBlocks: [
          {
            name: "Child",
            type: "com.example.pkg.Alpha.Child",
            is: "Child block",
            members: [],
            subBlocks: [],
            embeddedBlocks: [],
            compositions: [],
          },
        ],
        embeddedBlocks: [],
        compositions: [],
      },
      "Alpha.bml",
    );
    registerBlock(
      registry,
      {
        name: "Beta",
        type: "com.example.other.Beta",
        is: "Beta block",
        members: [],
        subBlocks: [],
        embeddedBlocks: [],
        compositions: [],
      },
      "Beta.bml",
    );

    const target = new BlockDocTarget();
    const output = target.render(
      { scope: { kind: "library" }, targetOptions: DEFAULT_BLOCKDOC_OPTIONS },
      mockContext(registry),
    );

    expect(output.files.some((f) => f.path === "com/index.html")).toBe(true);
    expect(output.files.some((f) => f.path === "com/example/pkg/index.html")).toBe(true);
    expect(output.files.some((f) => f.path === "com/example/other/index.html")).toBe(true);
    expect(
      output.files.some((f) => f.path === "com/example/pkg/Alpha/index.html"),
    ).toBe(false);

    const pkgIndex = output.files.find((f) => f.path === "com/example/pkg/index.html");
    expect(pkgIndex?.content).toContain("<h2>Blocks</h2>");
    expect(pkgIndex?.content).toContain("Alpha");
    expect(pkgIndex?.content).not.toContain("Alpha.Child");
    expect(pkgIndex?.content).toContain('<span class="brand">BlockDoc</span>');
    expect(pkgIndex?.content).toContain('<a href="../index.html">Index</a>');
    expect(pkgIndex?.content).toContain('<a href="../../../all-blocks.html">All Blocks</a>');
    expect(pkgIndex?.content).toContain('src="../../../search.js"');

    const allBlocks = output.files.find((f) => f.path === "all-blocks.html");
    expect(allBlocks?.content).toContain("Alpha");
    expect(allBlocks?.content).toContain("Beta");
    expect(allBlocks?.content).toContain('<a href="./com/example/index.html">Index</a>');

    const siteIndex = output.files.find((f) => f.path === "index.html");
    expect(siteIndex?.content).toContain('url=./com/example/index.html');
    expect(siteIndex?.content).toContain('href="./com/example/index.html"');

    const searchIndexFile = output.files.find((f) => f.path === "search-index.json");
    expect(searchIndexFile).toBeDefined();
    const searchIndex = JSON.parse(searchIndexFile!.content) as {
      blocks: Array<{ name: string; type: string; href: string; keywords: string[] }>;
    };
    expect(searchIndex.blocks.map((b) => b.type).sort()).toEqual([
      "com.example.other.Beta",
      "com.example.pkg.Alpha",
      "com.example.pkg.Alpha.Child",
    ]);
    const alpha = searchIndex.blocks.find((b) => b.name === "Alpha");
    expect(alpha?.href).toBe("com/example/pkg/Alpha.html");
    expect(alpha?.keywords).toContain("Alpha");
    expect(alpha?.keywords).toContain("com.example.pkg.Alpha");

    const searchJs = output.files.find((f) => f.path === "search.js");
    expect(searchJs?.content).toContain("com.example.pkg.Alpha");
    expect(searchJs?.content).toContain("function search(");
  });

  it("emits a root package index when top-level packages differ", () => {
    const registry = new TypeRegistry();
    registerBlock(
      registry,
      {
        name: "Alpha",
        type: "com.example.Alpha",
        is: "Alpha block",
        members: [],
        subBlocks: [],
        embeddedBlocks: [],
        compositions: [],
      },
      "Alpha.bml",
    );
    registerBlock(
      registry,
      {
        name: "Beta",
        type: "org.other.Beta",
        is: "Beta block",
        members: [],
        subBlocks: [],
        embeddedBlocks: [],
        compositions: [],
      },
      "Beta.bml",
    );

    const target = new BlockDocTarget();
    const output = target.render(
      { scope: { kind: "library" }, targetOptions: DEFAULT_BLOCKDOC_OPTIONS },
      mockContext(registry),
    );

    const siteIndex = output.files.find((f) => f.path === "index.html");
    expect(siteIndex?.content).toContain("<h2>Sub-packages</h2>");
    expect(siteIndex?.content).toContain('<a href="./com/index.html">com</a>');
    expect(siteIndex?.content).toContain('<a href="./org/index.html">org</a>');
    expect(siteIndex?.content).not.toContain("http-equiv");
  });

  it("restricts emitted FQNs to session.corpusRoots when set", () => {
    const registry = new TypeRegistry();
    registerBlock(
      registry,
      {
        name: "Alpha",
        type: "com.example.pkg.Alpha",
        is: "Alpha block",
        members: [],
        subBlocks: [],
        embeddedBlocks: [],
        compositions: [],
      },
      "pkg-a/Alpha.bml",
    );
    registerBlock(
      registry,
      {
        name: "Beta",
        type: "com.example.other.Beta",
        is: "Beta block",
        members: [],
        subBlocks: [],
        embeddedBlocks: [],
        compositions: [],
      },
      "pkg-b/Beta.bml",
    );

    const target = new BlockDocTarget();
    const output = target.render(
      { scope: { kind: "corpus" }, targetOptions: DEFAULT_BLOCKDOC_OPTIONS },
      mockContext(registry, ["pkg-a"]),
    );

    expect(output.files.some((f) => f.path.endsWith("Alpha.html"))).toBe(true);
    expect(output.files.some((f) => f.path.endsWith("Beta.html"))).toBe(false);
    const searchIndexFile = output.files.find((f) => f.path === "search-index.json");
    expect(searchIndexFile).toBeDefined();
    const searchIndex = JSON.parse(searchIndexFile!.content) as {
      blocks: Array<{ type: string }>;
    };
    expect(searchIndex.blocks.map((b) => b.type)).toEqual(["com.example.pkg.Alpha"]);
  });
});
