import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BlockDefinition, BomDocument } from "@blockml/bom";
import { TypeRegistry } from "@blockml/framework";
import { FatBlockTarget } from "../src/fatblock-target.js";
import { fatOutputBasename } from "../src/fat-output-path.js";
import type { RenderContext } from "@blockml/compiler";

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

function mockContext(
  registry: TypeRegistry,
  hostFile: string,
): RenderContext {
  return {
    session: {
      typeRegistry: registry,
      sourceFilePath: hostFile,
      outputBasePath: ".",
      targetName: "fatblock",
      scopeKind: "document",
    },
    blockFqn: "",
    outputRelativePath: "",
    child: () => mockContext(registry, hostFile),
  };
}

describe("fatOutputBasename", () => {
  it("uses host FQN plus .fat.bml", () => {
    expect(fatOutputBasename("org.blockml.bml.workspace.Library")).toBe(
      "org.blockml.bml.workspace.Library.fat.bml",
    );
  });
});

describe("FatBlockTarget", () => {
  it("renders {hostFqn}.fat.bml with embedded blocks", () => {
    const rootDir = "/proj";
    const srcDir = "pkg";
    const hostFile = join(rootDir, srcDir, "Host.bml");
    const registry = new TypeRegistry();

    const register = (doc: BomDocument) => registry.register(doc);

    register({
      kind: "block",
      source: { filePath: hostFile, format: "xml", namespaceBindings: { "": "http://blockml.org/bml" } },
      block: emptyBlock({
        name: "Host",
        type: "com.test.fat.Host",
        baseType: "org.blockml.bml.core.Block",
        is: "host block",
      }),
    });
    register({
      kind: "block",
      source: { filePath: join(rootDir, srcDir, "Peer.bml"), format: "xml" },
      block: emptyBlock({
        name: "Peer",
        type: "com.test.fat.Peer",
        baseType: "org.blockml.bml.core.Block",
        is: "peer",
      }),
    });

    const output = new FatBlockTarget().render(
      {
        scope: { kind: "document" },
        targetOptions: { srcDir, rootDir },
      },
      mockContext(registry, hostFile),
    );

    expect(output.files).toHaveLength(1);
    expect(output.files[0]?.path).toBe("com.test.fat.Host.fat.bml");
    expect(output.files[0]?.content).toContain("<embeddedBlocks>");
    expect(output.files[0]?.content).toContain("com.test.fat.Peer");
  });

  it("validateRequest requires srcDir", () => {
    const diagnostics = new FatBlockTarget().validateRequest?.({
      scope: { kind: "document" },
    }) ?? [];
    expect(diagnostics.some((d) => d.code === "BML_FATBLOCK_SRC_REQUIRED")).toBe(true);
  });
});
