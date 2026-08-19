import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bomEquals } from "@blockml/bom";
import { parse } from "@blockml/parser";
import { serialize } from "@blockml/serializer";

const ROOT = join(import.meta.dirname, "..", "..");

function corpusPath(parts: string[]): string {
  return join(ROOT, ...parts);
}

function roundtrip(filePath: string): void {
  const source = readFileSync(filePath, "utf8");
  const first = parse(source, { filePath });
  expect(first.success, `parse failed: ${filePath} ${JSON.stringify(first.diagnostics)}`).toBe(
    true,
  );
  expect(first.document).not.toBeNull();

  const ser = serialize(first.document!);
  expect(ser.success, `serialize failed: ${filePath}`).toBe(true);
  expect(ser.text).not.toBeNull();

  const second = parse(ser.text!, { filePath });
  expect(
    second.success,
    `re-parse failed: ${filePath} ${JSON.stringify(second.diagnostics)}`,
  ).toBe(true);
  expect(second.document).not.toBeNull();

  expect(
    bomEquals(first.document!, second.document!),
    `bomEquals failed: ${filePath}`,
  ).toBe(true);
}

describe("roundtrip T0 — Minimal", () => {
  const files = [
    corpusPath([
      "node_modules/@blockml/core/blocks/org/blockml/bml/language/TypeScript.bml",
    ]),
    corpusPath([
      "node_modules/@blockml/core/blocks/org/blockml/bml/service/Math.bml",
    ]),
  ];

  it.each(files)("%s", (file) => roundtrip(file));
});

describe("roundtrip T1 — Framework", () => {
  const files = [
    corpusPath(["node_modules/@blockml/core/blocks/org/blockml/bml/core/Block.bml"]),
    corpusPath([
      "node_modules/@blockml/core/blocks/org/blockml/bml/definition/BlockDefinition.bml",
    ]),
    corpusPath([
      "node_modules/@blockml/core/blocks/org/blockml/bml/definition/MemberDefinition.bml",
    ]),
  ];

  it.each(files)("%s", (file) => roundtrip(file));
});

describe("roundtrip T2 — Domain", () => {
  const files = [
    corpusPath([
      "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/core/NativeBlock.bml",
    ]),
    corpusPath([
      "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/core/CompositeBlock.bml",
    ]),
    corpusPath([
      "node_modules/@machineblocks/core/blocks/com/machineblocks/bml/core/Set.bml",
    ]),
  ];

  it.each(files)("%s", (file) => roundtrip(file));
});

describe("roundtrip T3 — Real-world", () => {
  const files = [
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

  it.each(files)("%s", (file) => roundtrip(file));
});
