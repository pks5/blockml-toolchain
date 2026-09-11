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
  corpusPath(["node_modules/@machineblocks/core/blocks/com/machineblocks/bml/core/Set.bml"]),
];

/** Published @machineblocks/core still authors default="true" on aggregations.
 *  There is no default aggregation (docs/01_bom_core.md). */
const STALE_DEFAULT_AGGREGATION_CORPUS = [
  corpusPath([
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/core/CompositeBlock.bml",
  ]),
  corpusPath([
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/core/NativeBlock.bml",
  ]),
];

/** Stale SCAD positional arrays authored as BML StructType values (`[4,4,3]`).
 *  Structs are named field mappings; these files live in node_modules. */
const STALE_STRUCT_ARRAY_CORPUS = [
  corpusPath([
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/examples/Cross.bml",
  ]),
  corpusPath([
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/bricks/Standard.bml",
  ]),
];

/** Calibrator still uses positional struct arrays and removed core:Entity. */
const STALE_CALIBRATOR = corpusPath([
  "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/calibration/Calibrator.bml",
]);

describe("validation corpus", () => {
  it.each(STRICT_CORPUS_FILES)("parse → validate: %s", (filePath) => {
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

  it.each(STALE_DEFAULT_AGGREGATION_CORPUS)(
    "flags default=true on aggregations: %s",
    (filePath) => {
      const source = readFileSync(filePath, "utf8");
      const parsed = parse(source, { filePath, continueOnError: true });
      expect(parsed.document).not.toBeNull();
      const defaults = parsed.diagnostics.filter(
        (d) => d.code === "BML_UNKNOWN_ATTRIBUTE" && d.message === "Unknown attribute: default",
      );
      expect(defaults.length, JSON.stringify(parsed.diagnostics)).toBeGreaterThan(0);
      expect(parsed.success).toBe(false);
    },
  );

  it.each(STALE_STRUCT_ARRAY_CORPUS)(
    "flags positional arrays on StructType: %s",
    (filePath) => {
      const source = readFileSync(filePath, "utf8");
      const parsed = parse(source, { filePath });
      expect(parsed.success, JSON.stringify(parsed.diagnostics)).toBe(true);
      expect(parsed.document).not.toBeNull();

      const result = validate(parsed.document!);
      const errors = result.diagnostics.filter((d) => d.severity === "error");
      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.every(
          (d) =>
            d.code === "BML_INVALID_VALUE" &&
            d.message === "collection value on a non-list type",
        ),
        `unexpected validation errors in ${filePath}: ${JSON.stringify(errors)}`,
      ).toBe(true);
    },
  );

  it("flags stale Entity baseType and positional arrays on Calibrator", () => {
    const source = readFileSync(STALE_CALIBRATOR, "utf8");
    const parsed = parse(source, { filePath: STALE_CALIBRATOR });
    expect(parsed.success, JSON.stringify(parsed.diagnostics)).toBe(true);
    expect(parsed.document).not.toBeNull();

    const result = validate(parsed.document!);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(
      errors.every(
        (d) =>
          (d.code === "BML_INVALID_VALUE" && d.message === "collection value on a non-list type") ||
          (d.code === "BML_UNKNOWN_BASE_TYPE" &&
            d.message === "Unknown baseType: org.blockml.bml.core.Entity"),
      ),
      `unexpected validation errors in ${STALE_CALIBRATOR}: ${JSON.stringify(errors)}`,
    ).toBe(true);
    expect(errors.some((d) => d.code === "BML_UNKNOWN_BASE_TYPE")).toBe(true);
    expect(errors.some((d) => d.code === "BML_INVALID_VALUE")).toBe(true);
  });
});
