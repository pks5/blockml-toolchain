import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "../src/parse.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");

function parseMb(rel: string) {
  const filePath = join(ROOT, "node_modules/@machineblocks/core/blocks", rel);
  const source = readFileSync(filePath, "utf8");
  return parse(source, { filePath, continueOnError: true });
}

describe("machineblocks type files parse", () => {
  it.each([
    ["com/machineblocks/bml/type/SizeXYZ.bml", "com.machineblocks.bml.type.SizeXYZ"],
    ["com/machineblocks/bml/type/Auto.bml", "com.machineblocks.bml.type.Auto"],
    ["com/machineblocks/bml/type/BaseCutout.bml", "com.machineblocks.bml.type.BaseCutout"],
    ["com/machineblocks/bml/type/Align.bml", "com.machineblocks.bml.type.Align"],
  ])("%s", (rel, typeFqn) => {
    const result = parseMb(rel);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors, JSON.stringify(errors)).toEqual([]);
    expect(result.document?.block.type).toBe(typeFqn);
  });
});
