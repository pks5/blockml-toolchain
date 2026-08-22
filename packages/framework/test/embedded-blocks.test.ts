import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BlockDefinition, BomDocument } from "@blockml/bom";
import { parse } from "@blockml/parser";
import { validateEmbeddedBlocks } from "../src/index.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");

function doc(block: BlockDefinition): BomDocument {
  return {
    kind: "block",
    source: { filePath: "test.bml", format: "xml" },
    block,
  };
}

describe("validateEmbeddedBlocks", () => {
  it("reports BML_SUBBLOCK_TYPE_MISMATCH when explicit sub-block type differs", () => {
    const host: BlockDefinition = {
      name: "Host",
      type: "com.blockml.test.Host",
      is: "host",
      members: [],
      subBlocks: [
        {
          name: "Part",
          type: "com.blockml.test.Wrong",
          is: "part",
          members: [],
          subBlocks: [],
          embeddedBlocks: [],
          compositions: [],
        },
      ],
      embeddedBlocks: [],
      compositions: [],
    };
    const diagnostics = validateEmbeddedBlocks(doc(host));
    expect(
      diagnostics.some((d) => d.code === "BML_SUBBLOCK_TYPE_MISMATCH"),
    ).toBe(true);
  });

  it("passes for valid core Block definition", () => {
    const file = join(
      ROOT,
      "node_modules/@blockml/core/blocks/org/blockml/bml/core/Block.bml",
    );
    const parsed = parse(readFileSync(file, "utf8"), { filePath: file });
    expect(parsed.document).not.toBeNull();
    const errors = validateEmbeddedBlocks(parsed.document!).filter(
      (d) => d.severity === "error",
    );
    expect(errors).toEqual([]);
  });
});
