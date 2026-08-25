import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bomEquals } from "@blockml/bom";
import { parse } from "@blockml/parser";
import { serialize } from "@blockml/serializer";
import { validateConstraints, bootstrapTypeRegistry, defaultBootstrapPaths } from "../src/index.js";
import { TypeRegistry } from "../src/registry/type-registry.js";

const FIXTURES_DIR = join(import.meta.dirname, "constraints");
const SPEC_PATH = join(FIXTURES_DIR, "constraints.test-spec.yaml");

interface SpecCase {
  id: string;
  fixture: string;
  expect: "pass" | "fail";
  diagnostic?: string;
  contractFixture?: string;
  parentFixture?: string;
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
    const parentMatch = line.match(/^\s+parentFixture:\s+(.+)$/);
    if (parentMatch && current.id) {
      current.parentFixture = parentMatch[1]!.trim();
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
  if (spec.parentFixture) {
    const parentPath = join(FIXTURES_DIR, spec.parentFixture);
    const parentSource = readFileSync(parentPath, "utf8");
    const parentParsed = parse(parentSource, { filePath: parentPath });
    expect(parentParsed.success, JSON.stringify(parentParsed.diagnostics)).toBe(true);
    expect(parentParsed.document).not.toBeNull();
    registry.register(parentParsed.document!);
  }
  registry.register(mainDocument);
  return registry;
}

describe("validateConstraints — constraints.test-spec.yaml", () => {
  const cases = loadCases();
  expect(cases.length).toBe(20);

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

describe("validateConstraints — ValuePresent semantics", () => {
  it("emits a single diagnostic for a local ValuePresent violation", () => {
    const filePath = join(FIXTURES_DIR, "fixtures/invalid-value-present-missing.bml");
    const parsed = parse(readFileSync(filePath, "utf8"), { filePath });
    expect(parsed.document).not.toBeNull();
    const registry = new TypeRegistry();
    registry.register(parsed.document!);
    const errors = validateConstraints(parsed.document!, registry).filter(
      (d) => d.code === "BML_CONSTRAINT_VIOLATION",
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]?.source.file).toBe(filePath);
    expect(errors[0]?.source.line).toBeLessThanOrEqual(
      readFileSync(filePath, "utf8").split("\n").length,
    );
  });

  it("reports inherited ValuePresent on the child document, not the ancestor property line", () => {
    const filePath = join(FIXTURES_DIR, "fixtures/invalid-inherited-constraint-violation.bml");
    const contractPath = join(FIXTURES_DIR, "fixtures/contracts/IIdentifiable.bml");
    const parsed = parse(readFileSync(filePath, "utf8"), { filePath });
    const contract = parse(readFileSync(contractPath, "utf8"), { filePath: contractPath });
    expect(parsed.document).not.toBeNull();
    expect(contract.document).not.toBeNull();
    const registry = new TypeRegistry();
    registry.register(contract.document!);
    registry.register(parsed.document!);
    const errors = validateConstraints(parsed.document!, registry).filter(
      (d) => d.code === "BML_CONSTRAINT_VIOLATION",
    );
    expect(errors.length).toBeGreaterThan(0);
    const childLines = readFileSync(filePath, "utf8").split("\n").length;
    for (const error of errors) {
      expect(error.source.file).toBe(filePath);
      expect(error.source.line).toBeGreaterThanOrEqual(1);
      expect(error.source.line).toBeLessThanOrEqual(childLines);
    }
  });
});

describe("validateConstraints — core library ValuePresent slots", () => {
  it("accepts core types whose values are bound later", () => {
    const { registry } = bootstrapTypeRegistry(defaultBootstrapPaths());
    const fqns = [
      "org.blockml.bml.meta.FixedAlias",
      "org.blockml.bml.meta.FixedKeyword",
      "org.blockml.bml.meta.FreeTextAlias",
      "org.blockml.bml.meta.FreeTextKeyword",
      "org.blockml.bml.type.Boolean",
      "org.blockml.bml.type.Constant",
    ];
    for (const fqn of fqns) {
      const doc = registry.get(fqn);
      expect(doc, fqn).toBeDefined();
      if (!doc) {
        continue;
      }
      const errors = validateConstraints(doc, registry).filter((d) => d.severity === "error");
      expect(errors, `${fqn}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });
});
