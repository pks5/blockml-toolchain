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
];

const T3_UNKNOWN_TYPE_FILES = [
  corpusPath([
    "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/examples/Cross.bml",
  ]),
];

describe("validation corpus T0–T2", () => {
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
});

describe("validation corpus T3 — published files lag closed registry/grammar", () => {
  it.each(T3_UNKNOWN_TYPE_FILES)("parse succeeds; unregistered domain types are errors: %s", (filePath) => {
    const source = readFileSync(filePath, "utf8");
    const parsed = parse(source, { filePath });
    expect(parsed.success, JSON.stringify(parsed.diagnostics)).toBe(true);
    expect(parsed.document).not.toBeNull();

    const result = validate(parsed.document!);
    expect(result.diagnostics.some((d) => d.code === "BML_UNKNOWN_TYPE")).toBe(true);
    expect(result.success).toBe(false);
  });

  it("Standard.bml trailing junk is unexpected text and keeps a BOM", () => {
    const filePath = corpusPath([
      "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/bricks/Standard.bml",
    ]);
    const source = readFileSync(filePath, "utf8");
    const parsed = parse(source, { filePath, continueOnError: true });
    expect(parsed.document).not.toBeNull();
    expect(parsed.diagnostics.some((d) => d.code === "BML_UNEXPECTED_TEXT")).toBe(true);
    expect(parsed.success).toBe(false);
  });

  it("Calibrator nested direct aggregations are structural errors", () => {
    const filePath = corpusPath([
      "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/calibration/Calibrator.bml",
    ]);
    const source = readFileSync(filePath, "utf8");
    const parsed = parse(source, { filePath, continueOnError: true });
    expect(parsed.document).not.toBeNull();
    expect(parsed.diagnostics.some((d) => d.code === "BML_UNKNOWN_ELEMENT")).toBe(true);
    expect(parsed.success).toBe(false);
  });
});
