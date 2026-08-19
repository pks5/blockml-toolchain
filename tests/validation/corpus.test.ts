import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { validate } from "@blockml/validator";

const ROOT = join(import.meta.dirname, "..", "..");

function corpusPath(parts: string[]): string {
  return join(ROOT, ...parts);
}

const CORPUS_FILES = [
  corpusPath([
    "node_modules/@blockml/core/blocks/org/blockml/bml/language/TypeScript.bml",
  ]),
  corpusPath(["node_modules/@blockml/core/blocks/org/blockml/bml/service/Math.bml"]),
  corpusPath(["node_modules/@blockml/core/blocks/org/blockml/bml/core/Block.bml"]),
  corpusPath([
    "node_modules/@blockml/core/blocks/org/blockml/bml/definition/BlockDefinition.bml",
  ]),
  corpusPath([
    "node_modules/@blockml/core/blocks/org/blockml/bml/definition/MemberDefinition.bml",
  ]),
  corpusPath([
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/core/NativeBlock.bml",
  ]),
  corpusPath([
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/core/CompositeBlock.bml",
  ]),
  corpusPath(["node_modules/@machineblocks/core/blocks/com/machineblocks/bml/core/Set.bml"]),
  corpusPath([
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/calibration/Calibrator.bml",
  ]),
  corpusPath([
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/bricks/Standard.bml",
  ]),
  corpusPath([
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/examples/Cross.bml",
  ]),
];

describe("validation corpus T0–T3", () => {
  it.each(CORPUS_FILES)("parse → validate: %s", (filePath) => {
    const source = readFileSync(filePath, "utf8");
    const parsed = parse(source, { filePath });
    expect(parsed.success, JSON.stringify(parsed.diagnostics)).toBe(true);
    expect(parsed.document).not.toBeNull();

    const result = validate(parsed.document!);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(
      errors,
      `unexpected validation errors in ${filePath}: ${JSON.stringify(errors)}`,
    ).toEqual([]);
    expect(result.success).toBe(true);
    expect(result.pragmaticModel).toBeDefined();
  });
});
