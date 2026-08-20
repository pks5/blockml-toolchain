import { describe, expect, it } from "vitest";
import { resolveSubBlockTypeFqn } from "../src/member-sections.js";
import type { BlockDefinition } from "@blockml/bom";

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
