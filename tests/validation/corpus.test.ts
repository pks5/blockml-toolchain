import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { validate } from "@blockml/validator";

const ROOT = join(import.meta.dirname, "..", "..");

function corpusPath(parts: string[]): string {
  return join(ROOT, ...parts);
}

const STRICT_CORPUS_FILES = [
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
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/examples/Cross.bml",
  ]),
  corpusPath([
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/bricks/Standard.bml",
  ]),
  corpusPath([
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/calibration/Calibrator.bml",
  ]),
];

/** Published snapshots that predate override="true" on inherited member fills. */
const PUBLISHED_OVERRIDE_GAPS = new Set([
  corpusPath([
    "node_modules/@blockml/core/blocks/org/blockml/bml/definition/MemberDefinition.bml",
  ]),
  corpusPath([
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/examples/Cross.bml",
  ]),
  corpusPath([
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/bricks/Standard.bml",
  ]),
  corpusPath([
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/calibration/Calibrator.bml",
  ]),
]);

describe("validation corpus", () => {
  it.each(STRICT_CORPUS_FILES)("parse → validate: %s", (filePath) => {
    const source = readFileSync(filePath, "utf8");
    const parsed = parse(source, { filePath });
    expect(parsed.success, JSON.stringify(parsed.diagnostics)).toBe(true);
    expect(parsed.document).not.toBeNull();

    const result = validate(parsed.document!);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    const unexpected = PUBLISHED_OVERRIDE_GAPS.has(filePath)
      ? errors.filter((d) => d.code !== "BML_OVERRIDE_REQUIRED")
      : errors;
    expect(
      unexpected,
      `unexpected validation errors in ${filePath}: ${JSON.stringify(unexpected)}`,
    ).toEqual([]);
    expect(result.pragmaticModel).toBeDefined();
    if (!PUBLISHED_OVERRIDE_GAPS.has(filePath)) {
      expect(result.success).toBe(true);
    }
  });
});
