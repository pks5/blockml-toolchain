import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { validate } from "../src/index.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");

describe("validate() integration", () => {
  it("returns success for valid constraint fixture", () => {
    const file = join(
      ROOT,
      "packages/framework/test/constraints/fixtures/valid-min-on-property.bml",
    );
    const parsed = parse(readFileSync(file, "utf8"), { filePath: file });
    expect(parsed.document).not.toBeNull();
    const result = validate(parsed.document!);
    expect(result.success).toBe(true);
    expect(result.pragmaticModel).toBeDefined();
  });

  it("returns failure with diagnostic for constraint violation", () => {
    const file = join(
      ROOT,
      "packages/framework/test/constraints/fixtures/invalid-constraint-violation.bml",
    );
    const parsed = parse(readFileSync(file, "utf8"), { filePath: file });
    expect(parsed.document).not.toBeNull();
    const result = validate(parsed.document!);
    expect(result.success).toBe(false);
    expect(
      result.diagnostics.some((d) => d.code === "BML_CONSTRAINT_VIOLATION"),
    ).toBe(true);
  });

  it("omits pragmaticModel when continueOnError is false and validation fails", () => {
    const file = join(
      ROOT,
      "packages/framework/test/constraints/fixtures/invalid-constraint-violation.bml",
    );
    const parsed = parse(readFileSync(file, "utf8"), { filePath: file });
    expect(parsed.document).not.toBeNull();
    const result = validate(parsed.document!, { continueOnError: false });
    expect(result.success).toBe(false);
    expect(result.pragmaticModel).toBeUndefined();
  });

  it("bootstraps via libraryPaths when provided", () => {
    const file = join(
      ROOT,
      "node_modules/@blockml/core/blocks/org/blockml/bml/core/Block.bml",
    );
    const parsed = parse(readFileSync(file, "utf8"), { filePath: file });
    expect(parsed.document).not.toBeNull();
    const result = validate(parsed.document!, {
      libraryPaths: [
        join(ROOT, "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml"),
      ],
    });
    expect(result.success).toBe(true);
  });
});
