import { describe, expect, it } from "vitest";
import { BlockDocTarget } from "../src/blockdoc-target.js";
import { DEFAULT_BLOCKDOC_OPTIONS } from "../src/options.js";
import type { RenderContext } from "@blockml/compiler";
import type { BomDocument } from "@blockml/bom";
import { TypeRegistry } from "@blockml/framework";

function mockContext(registry: TypeRegistry): RenderContext {
  return {
    session: {
      typeRegistry: registry,
      sourceFilePath: "<test>",
      outputBasePath: "doc",
      targetName: "blockdoc",
      documentKind: "block",
      isPresetBlock: false,
      scopeKind: "library",
    },
    blockFqn: "",
    outputRelativePath: "",
    child: () => mockContext(registry),
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
  });
});
