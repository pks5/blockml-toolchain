import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BlockDefinition, BomDocument } from "@blockml/bom";
import { TypeRegistry } from "@blockml/framework";
import { collectCandidateFqns, rootFqnsByFilePath } from "../src/collect-candidates.js";

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

function registerDoc(registry: TypeRegistry, document: BomDocument): void {
  registry.register(document);
}

function doc(filePath: string, block: BlockDefinition): BomDocument {
  return { kind: "block", source: { filePath, format: "xml" }, block };
}

describe("rootFqnsByFilePath", () => {
  it("picks root FQN when subBlocks are registered", () => {
    const registry = new TypeRegistry();
    const file = join("/proj", "src", "Host.bml");
    const sub = emptyBlock({
      name: "Part",
      type: "com.test.fat.Host.Part",
      baseType: "org.blockml.bml.core.Block",
    });
    const root = emptyBlock({
      name: "Host",
      type: "com.test.fat.Host",
      baseType: "org.blockml.bml.core.Block",
      subBlocks: [sub],
    });
    registerDoc(registry, doc(file, root));

    const roots = rootFqnsByFilePath(registry);
    expect(roots.get(file)).toBe("com.test.fat.Host");
  });
});

describe("collectCandidateFqns", () => {
  it("collects roots under srcDir excluding host", () => {
    const registry = new TypeRegistry();
    const src = join("/proj", "pkg");
    const hostFile = join(src, "Host.bml");
    const helperFile = join(src, "Helper.bml");

    registerDoc(registry, doc(hostFile, emptyBlock({
        name: "Host",
        type: "com.test.fat.Host",
        baseType: "org.blockml.bml.core.Block",
      })));
    registerDoc(registry, doc(helperFile, emptyBlock({
        name: "Helper",
        type: "com.test.fat.Helper",
        baseType: "org.blockml.bml.core.Block",
      })));

    const { fqns } = collectCandidateFqns(
      registry,
      "pkg",
      "/proj",
      "com.test.fat.Host",
    );
    expect(fqns).toEqual(["com.test.fat.Helper"]);
  });

  it("sorts FQNs ascending", () => {
    const registry = new TypeRegistry();
    const src = join("/proj", "pkg");
    for (const name of ["Zed", "Alpha"]) {
      registerDoc(registry, doc(join(src, `${name}.bml`), emptyBlock({
          name,
          type: `com.test.fat.${name}`,
          baseType: "org.blockml.bml.core.Block",
        })));
    }

    const { fqns } = collectCandidateFqns(registry, "pkg", "/proj", "com.test.fat.Host");
    expect(fqns).toEqual(["com.test.fat.Alpha", "com.test.fat.Zed"]);
  });
});
