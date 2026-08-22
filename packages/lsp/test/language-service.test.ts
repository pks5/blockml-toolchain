import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { analyzeDocument, createWorkspace } from "../src/index.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");

describe("analyzeDocument", () => {
  it("returns no errors for valid constraint fixture", () => {
    const file = join(
      ROOT,
      "packages/framework/test/constraints/fixtures/valid-min-on-property.bml",
    );
    const text = readFileSync(file, "utf8");
    const workspace = createWorkspace(ROOT);
    const result = analyzeDocument(text, file, workspace);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  it("reports constraint violation for invalid fixture", () => {
    const file = join(
      ROOT,
      "packages/framework/test/constraints/fixtures/invalid-constraint-violation.bml",
    );
    const text = readFileSync(file, "utf8");
    const workspace = createWorkspace(ROOT);
    const result = analyzeDocument(text, file, workspace);
    expect(
      result.diagnostics.some((d) => d.code === "BML_CONSTRAINT_VIOLATION"),
    ).toBe(true);
  });
});
