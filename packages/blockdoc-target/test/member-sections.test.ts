import { describe, expect, it } from "vitest";
import type { BlockDefinition, MemberDefinition } from "@blockml/bom";
import { TypeRegistry } from "@blockml/framework";
import { DEFAULT_BLOCKDOC_OPTIONS } from "../src/options.js";
import {
  renderMemberTypeCell,
  resolveInheritedMemberType,
  resolveSubBlockTypeFqn,
} from "../src/member-sections.js";

function emptyBlock(overrides: Partial<BlockDefinition>): BlockDefinition {
  return {
    name: overrides.name ?? "Block",
    type: overrides.type ?? "com.example.Block",
    is: "block",
    members: [],
    subBlocks: [],
    embeddedBlocks: [],
    compositions: [],
    ...overrides,
  };
}

function register(registry: TypeRegistry, block: BlockDefinition): void {
  registry.register({
    kind: "block",
    block,
    source: { filePath: `${block.name}.bml`, format: "xml" },
  });
}

describe("resolveSubBlockTypeFqn", () => {
  it("matches unqualified member types to sub-blocks", () => {
    const block: BlockDefinition = {
      name: "StructuralDefinition",
      type: "org.blockml.bml.definition.StructuralDefinition",
      is: "Structural",
      members: [],
      subBlocks: [
        {
          name: "Documentation",
          type: "org.blockml.bml.definition.StructuralDefinition.Documentation",
          is: "Docs",
          members: [],
          subBlocks: [],
          embeddedBlocks: [],
          compositions: [],
        },
      ],
      embeddedBlocks: [],
      compositions: [],
    };

    expect(
      resolveSubBlockTypeFqn(block, "org.blockml.bml.type.Documentation"),
    ).toBe("org.blockml.bml.definition.StructuralDefinition.Documentation");
  });
});

describe("resolveInheritedMemberType", () => {
  const parent = emptyBlock({
    name: "Parent",
    type: "com.example.Parent",
    members: [
      {
        kind: "property",
        name: "label",
        typeFqn: "org.blockml.bml.type.Text",
      },
      {
        kind: "property",
        name: "note",
        typeFqn: "",
        abstract: true,
      },
    ],
  });

  const child = emptyBlock({
    name: "Child",
    type: "com.example.Child",
    baseType: "com.example.Parent",
    members: [
      {
        kind: "property",
        name: "label",
        typeFqn: "",
        override: true,
      },
      {
        kind: "property",
        name: "note",
        typeFqn: "",
        override: true,
        abstract: true,
      },
    ],
  });

  it("uses the parent member type when the override omits type", () => {
    const registry = new TypeRegistry();
    register(registry, parent);
    register(registry, child);
    const local = child.members[0]!;
    const resolved = resolveInheritedMemberType(local, child, registry);
    expect(resolved.member).toMatchObject({
      name: "label",
      kind: "property",
      typeFqn: "org.blockml.bml.type.Text",
    });
    expect(resolved.ownerBlock.type).toBe("com.example.Parent");
  });

  it("keeps an untyped abstract member when no ancestor has a type", () => {
    const registry = new TypeRegistry();
    register(registry, parent);
    register(registry, child);
    const local = child.members[1]!;
    const resolved = resolveInheritedMemberType(local, child, registry);
    expect(resolved.member).toBe(local);
    expect(resolved.ownerBlock.type).toBe("com.example.Child");
  });

  it("walks past an untyped parent to a typed grandparent", () => {
    const grandparent = emptyBlock({
      name: "Grandparent",
      type: "com.example.Grandparent",
      members: [
        {
          kind: "property",
          name: "title",
          typeFqn: "org.blockml.bml.type.Text",
        },
      ],
    });
    const mid = emptyBlock({
      name: "Mid",
      type: "com.example.Mid",
      baseType: "com.example.Grandparent",
      members: [
        {
          kind: "property",
          name: "title",
          typeFqn: "",
          override: true,
          abstract: true,
        },
      ],
    });
    const leaf = emptyBlock({
      name: "Leaf",
      type: "com.example.Leaf",
      baseType: "com.example.Mid",
      members: [
        {
          kind: "property",
          name: "title",
          typeFqn: "",
          override: true,
        },
      ],
    });
    const registry = new TypeRegistry();
    register(registry, grandparent);
    register(registry, mid);
    register(registry, leaf);
    const resolved = resolveInheritedMemberType(leaf.members[0]!, leaf, registry);
    expect(resolved.member).toMatchObject({ typeFqn: "org.blockml.bml.type.Text" });
    expect(resolved.ownerBlock.type).toBe("com.example.Grandparent");
  });
});

describe("renderMemberTypeCell inherited types", () => {
  it("renders the parent type for an override without type", () => {
    const parent = emptyBlock({
      name: "Parent",
      type: "com.example.Parent",
      members: [
        {
          kind: "property",
          name: "label",
          typeFqn: "org.blockml.bml.type.Text",
        } satisfies MemberDefinition,
      ],
    });
    const child = emptyBlock({
      name: "Child",
      type: "com.example.Child",
      baseType: "com.example.Parent",
      members: [
        {
          kind: "property",
          name: "label",
          typeFqn: "",
          override: true,
        },
      ],
    });
    const registry = new TypeRegistry();
    register(registry, parent);
    register(registry, child);

    const html = renderMemberTypeCell(
      child.members[0]!,
      child,
      "com/example/Child.html",
      DEFAULT_BLOCKDOC_OPTIONS,
      new Set(["org.blockml.bml.type.Text"]),
      registry,
    );
    expect(html).toContain("org.blockml.bml.type.Text");
    expect(html).toContain("<a href=");
    expect(html).not.toBe("—");
  });

  it("renders an em dash only when no ancestor provides a type", () => {
    const parent = emptyBlock({
      name: "Parent",
      type: "com.example.Parent",
      members: [
        {
          kind: "property",
          name: "slot",
          typeFqn: "",
          abstract: true,
        },
      ],
    });
    const child = emptyBlock({
      name: "Child",
      type: "com.example.Child",
      baseType: "com.example.Parent",
      members: [
        {
          kind: "property",
          name: "slot",
          typeFqn: "",
          override: true,
          abstract: true,
        },
      ],
    });
    const registry = new TypeRegistry();
    register(registry, parent);
    register(registry, child);

    expect(
      renderMemberTypeCell(
        child.members[0]!,
        child,
        "com/example/Child.html",
        DEFAULT_BLOCKDOC_OPTIONS,
        new Set(),
        registry,
      ),
    ).toBe("—");
  });
});
