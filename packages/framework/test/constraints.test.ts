import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bomEquals } from "@blockml/bom";
import { parse } from "@blockml/parser";
import { serialize } from "@blockml/serializer";
import { validateConstraints } from "../src/index.js";
import { TypeRegistry } from "../src/registry/type-registry.js";

const FIXTURES_DIR = join(import.meta.dirname, "constraints");
const SPEC_PATH = join(FIXTURES_DIR, "constraints.test-spec.yaml");

interface SpecCase {
  id: string;
  fixture: string;
  expect: "pass" | "fail";
  diagnostic?: string;
  contractFixture?: string;
  roundtrip?: boolean;
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
    const contractMatch = line.match(/^\s+contractFixture:\s+(.+)$/);
    if (contractMatch && current.id) {
      current.contractFixture = contractMatch[1]!.trim();
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
      continue;
    }
    const roundtripMatch = line.match(/^\s+roundtrip:\s+(.+)$/);
    if (roundtripMatch && current.id) {
      current.roundtrip = roundtripMatch[1]!.trim() === "true";
    }
  }
  if (current.id) {
    cases.push(current as SpecCase);
  }
  return cases;
}

function buildRegistry(
  spec: SpecCase,
  mainDocument: NonNullable<ReturnType<typeof parse>["document"]>,
): TypeRegistry {
  const registry = new TypeRegistry();
  if (spec.contractFixture) {
    const contractPath = join(FIXTURES_DIR, spec.contractFixture);
    const contractSource = readFileSync(contractPath, "utf8");
    const contractParsed = parse(contractSource, { filePath: contractPath });
    expect(contractParsed.success, JSON.stringify(contractParsed.diagnostics)).toBe(true);
    expect(contractParsed.document).not.toBeNull();
    registry.register(contractParsed.document!);
  }
  registry.register(mainDocument);
  return registry;
}

describe("validateConstraints — constraints.test-spec.yaml", () => {
  const cases = loadCases();
  expect(cases.length).toBe(15);

  it.each(cases)("$id ($expect)", (spec) => {
    const filePath = join(FIXTURES_DIR, spec.fixture);
    const source = readFileSync(filePath, "utf8");
    const parsed = parse(source, { filePath });
    expect(parsed.success, JSON.stringify(parsed.diagnostics)).toBe(true);
    expect(parsed.document).not.toBeNull();

    const registry = buildRegistry(spec, parsed.document!);
    const diagnostics = validateConstraints(parsed.document!, registry);
    const errors = diagnostics.filter((d) => d.severity === "error");

    if (spec.roundtrip) {
      const ser = serialize(parsed.document!);
      expect(ser.success, JSON.stringify(ser.diagnostics)).toBe(true);
      expect(ser.text).not.toBeNull();
      const second = parse(ser.text!, { filePath });
      expect(second.success, JSON.stringify(second.diagnostics)).toBe(true);
      expect(second.document).not.toBeNull();
      const secondRegistry = buildRegistry(spec, second.document!);
      const secondErrors = validateConstraints(second.document!, secondRegistry).filter(
        (d) => d.severity === "error",
      );
      expect(secondErrors, JSON.stringify(secondErrors)).toEqual([]);
    }

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
