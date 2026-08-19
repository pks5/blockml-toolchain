import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { validateConstraints } from "../src/index.js";
import { TypeRegistry } from "../src/registry/type-registry.js";

const FIXTURES_DIR = join(import.meta.dirname, "constraints");
const SPEC_PATH = join(FIXTURES_DIR, "constraints.test-spec.yaml");

interface SpecCase {
  id: string;
  fixture: string;
  expect: "pass" | "fail";
  diagnostic?: string;
}

function loadCases(): SpecCase[] {
  const text = readFileSync(SPEC_PATH, "utf8");
  const cases: SpecCase[] = [];
  let current: Partial<SpecCase> = {};
  for (const line of text.split("\n")) {
    const idMatch = line.match(/^\s+-\s+id:\s+(.+)$/);
    if (idMatch) {
      if (current.id) {
        cases.push(current as SpecCase);
      }
      current = { id: idMatch[1]!.trim() };
      continue;
    }
    const fixtureMatch = line.match(/^\s+fixture:\s+(.+)$/);
    if (fixtureMatch && current.id) {
      current.fixture = fixtureMatch[1]!.trim();
      continue;
    }
    const expectMatch = line.match(/^\s+expect:\s+(.+)$/);
    if (expectMatch && current.id) {
      current.expect = expectMatch[1]!.trim() as "pass" | "fail";
      continue;
    }
    const diagMatch = line.match(/^\s+diagnostic:\s+(.+)$/);
    if (diagMatch && current.id) {
      current.diagnostic = diagMatch[1]!.trim();
    }
  }
  if (current.id) {
    cases.push(current as SpecCase);
  }
  return cases;
}

describe("validateConstraints — constraints.test-spec.yaml", () => {
  const cases = loadCases();
  expect(cases.length).toBe(14);

  it.each(cases)("$id ($expect)", (spec) => {
    const filePath = join(FIXTURES_DIR, spec.fixture);
    const source = readFileSync(filePath, "utf8");
    const parsed = parse(source, { filePath });
    expect(parsed.success, JSON.stringify(parsed.diagnostics)).toBe(true);
    expect(parsed.document).not.toBeNull();

    const registry = new TypeRegistry();
    registry.register(parsed.document!);
    const diagnostics = validateConstraints(parsed.document!, registry);
    const errors = diagnostics.filter((d) => d.severity === "error");

    if (spec.expect === "pass") {
      expect(errors).toEqual([]);
    } else {
      expect(errors.length).toBeGreaterThan(0);
      if (spec.diagnostic) {
        expect(errors.some((d) => d.code === spec.diagnostic)).toBe(true);
      }
    }
  });
});
