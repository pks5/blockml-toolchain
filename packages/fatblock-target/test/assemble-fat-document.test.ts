import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BlockDefinition, BomDocument } from "@blockml/bom";
import { TypeRegistry } from "@blockml/framework";
import { assembleFatDocument } from "../src/assemble-fat-document.js";

function emptyBlock(overrides: Partial<BlockDefinition>): BlockDefinition {
  return {
    name: overrides.name ?? "Block",
    type: overrides.type ?? "com.test.Block",
    members: [],
    subBlocks: [],
    embeddedBlocks: [],
    compositions: [],
    ...overrides,
  };
}

function doc(
  filePath: string,
  block: BlockDefinition,
  extra?: Partial<BomDocument["source"]>,
): BomDocument {
  return {
    kind: "block",
    source: { filePath, format: "xml", ...extra },
    block,
  };
}

function registerDoc(registry: TypeRegistry, document: BomDocument): void {
  registry.register(document);
}

describe("assembleFatDocument", () => {
  const rootDir = "/proj";
  const srcDir = "pkg";
  const hostFile = join(rootDir, srcDir, "Host.bml");
  const helperFile = join(rootDir, srcDir, "Helper.bml");
  const extraFile = join(rootDir, srcDir, "Extra.bml");

  it("embeds peer root blocks sorted by FQN with subBlocks preserved", () => {
    const registry = new TypeRegistry();
    registerDoc(registry, doc(hostFile, emptyBlock({
        name: "Host",
        type: "com.test.fat.Host",
        baseType: "org.blockml.bml.core.Block",
        is: "host",
      }), { namespaceBindings: { "": "http://blockml.org/bml" } }));
    registerDoc(registry, doc(helperFile, emptyBlock({
        name: "Helper",
        type: "com.test.fat.Helper",
        baseType: "org.blockml.bml.core.Block",
        is: "helper",
        subBlocks: [
          emptyBlock({
            name: "Part",
            type: "com.test.fat.Helper.Part",
            baseType: "org.blockml.bml.core.Block",
          }),
        ],
      })));
    registerDoc(registry, doc(extraFile, emptyBlock({
        name: "Extra",
        type: "com.test.fat.Extra",
        baseType: "org.blockml.bml.core.Block",
      })));

    const { document, diagnostics } = assembleFatDocument(
      registry,
      hostFile,
      { srcDir, rootDir },
      rootDir,
    );

    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(document).not.toBeNull();
    expect(document!.block.type).toBe("com.test.fat.Host");
    expect(document!.block.embeddedBlocks.map((b) => b.type)).toEqual([
      "com.test.fat.Extra",
      "com.test.fat.Helper",
    ]);
    const helperEmbed = document!.block.embeddedBlocks.find(
      (b) => b.type === "com.test.fat.Helper",
    );
    expect(helperEmbed?.subBlocks).toHaveLength(1);
    expect(helperEmbed?.subBlocks[0]?.type).toBe("com.test.fat.Helper.Part");
  });

  it("rejects host with embeddedBlocks", () => {
    const registry = new TypeRegistry();
    registerDoc(registry, doc(hostFile, emptyBlock({
        name: "Host",
        type: "com.test.fat.Host",
        embeddedBlocks: [
          emptyBlock({ name: "X", type: "com.test.fat.X" }),
        ],
      })));

    const { document, diagnostics } = assembleFatDocument(
      registry,
      hostFile,
      { srcDir, rootDir },
      rootDir,
    );

    expect(document).toBeNull();
    expect(diagnostics.some((d) => d.code === "BML_FATBLOCK_HOST_HAS_EMBEDDED_BLOCKS")).toBe(
      true,
    );
  });

  it("rejects embed candidate with embeddedBlocks", () => {
    const registry = new TypeRegistry();
    registerDoc(registry, doc(hostFile, emptyBlock({
        name: "Host",
        type: "com.test.fat.Host",
      })));
    registerDoc(registry, doc(helperFile, emptyBlock({
        name: "Helper",
        type: "com.test.fat.Helper",
        embeddedBlocks: [
          emptyBlock({ name: "Nested", type: "com.test.fat.Nested" }),
        ],
      })));

    const { document, diagnostics } = assembleFatDocument(
      registry,
      hostFile,
      { srcDir, rootDir },
      rootDir,
    );

    expect(document).toBeNull();
    expect(
      diagnostics.some((d) => d.code === "BML_FATBLOCK_EMBED_HAS_EMBEDDED_BLOCKS"),
    ).toBe(true);
  });
});
