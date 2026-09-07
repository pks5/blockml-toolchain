import { beforeAll, describe, expect, it } from "vitest";
import { join } from "node:path";
import type { BomDocument } from "@blockml/bom";
import { parse } from "@blockml/parser";
import {
  bootstrapTypeRegistry,
  defaultBootstrapPaths,
  evaluateParseValue,
  TypeRegistry,
  validateTypes,
} from "../src/index.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");

function parseSample(body: string, filePath: string, extraXmlns = ""): BomDocument {
  const source = [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:type="org.blockml.bml.type"',
    extraXmlns,
    ' xmlns:test="com.blockml.test.parsevalue">',
    "  <type>test:Sample</type>",
    "  <baseType>core:Block</baseType>",
    "  <is>sample</is>",
    "  <properties>",
    body,
    "  </properties>",
    "</block>",
  ].join("\n");
  const parsed = parse(source, { filePath, continueOnError: true });
  expect(parsed.document).not.toBeNull();
  return parsed.document!;
}

let registry: TypeRegistry;

function bootstrappedRegistry(): TypeRegistry {
  return registry;
}

beforeAll(() => {
  registry = bootstrapTypeRegistry(defaultBootstrapPaths(ROOT), ROOT).registry;
});

describe("evaluateParseValue", () => {
  it("rejects Integer 1.5", () => {
    const registry = bootstrappedRegistry();
    const result = evaluateParseValue("org.blockml.bml.type.Integer", "1.5", registry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/not a whole number/i);
    }
  });

  it("rejects Boolean yes", () => {
    const registry = bootstrappedRegistry();
    const result = evaluateParseValue("org.blockml.bml.type.Boolean", "yes", registry);
    expect(result.ok).toBe(false);
  });

  it("rejects Version 1.0", () => {
    const registry = bootstrappedRegistry();
    const result = evaluateParseValue("org.blockml.bml.type.Version", "1.0", registry);
    expect(result.ok).toBe(false);
  });

  it("rejects TypeIdentifier !!!", () => {
    const registry = bootstrappedRegistry();
    const result = evaluateParseValue("org.blockml.bml.type.TypeIdentifier", "!!!", registry);
    expect(result.ok).toBe(false);
  });

  it("accepts a well-formed unknown TypeIdentifier FQN", () => {
    const registry = bootstrappedRegistry();
    const result = evaluateParseValue(
      "org.blockml.bml.type.TypeIdentifier",
      "com.example.UnknownType",
      registry,
    );
    expect(result).toEqual({ ok: true, value: "com.example.UnknownType" });
  });

  it("skips when the type is not in the registry", () => {
    const result = evaluateParseValue(
      "org.blockml.bml.type.Integer",
      "1.5",
      new TypeRegistry(),
    );
    expect(result).toEqual({ ok: true, skipped: true });
  });

  it("strips generics and multiplicity before lookup", () => {
    const registry = bootstrappedRegistry();
    const result = evaluateParseValue("Integer(unit:Millimeter)[]", "1.5", registry);
    expect(result.ok).toBe(false);
  });
});

describe("validateTypes parseValue literals", () => {
  it("reports BML_INVALID_VALUE for Integer 1.5", () => {
    const document = parseSample(
      '    <count type="type:Integer" value="1.5" />',
      "invalid-integer.bml",
    );
    const diagnostics = validateTypes(document, bootstrappedRegistry());
    expect(diagnostics.some((d) => d.code === "BML_INVALID_VALUE")).toBe(true);
  });

  it("reports BML_INVALID_VALUE for Boolean yes", () => {
    const document = parseSample(
      '    <flag type="type:Boolean" value="yes" />',
      "invalid-boolean.bml",
    );
    const diagnostics = validateTypes(document, bootstrappedRegistry());
    expect(diagnostics.some((d) => d.code === "BML_INVALID_VALUE")).toBe(true);
  });

  it("reports BML_INVALID_VALUE for Version 1.0", () => {
    const document = parseSample(
      '    <ver type="type:Version" value="1.0" />',
      "invalid-version.bml",
    );
    const diagnostics = validateTypes(document, bootstrappedRegistry());
    expect(diagnostics.some((d) => d.code === "BML_INVALID_VALUE")).toBe(true);
  });

  it("reports BML_INVALID_VALUE for TypeIdentifier !!!", () => {
    const document = parseSample(
      '    <id type="type:TypeIdentifier" value="!!!" />',
      "invalid-type-id.bml",
    );
    const diagnostics = validateTypes(document, bootstrappedRegistry());
    expect(diagnostics.some((d) => d.code === "BML_INVALID_VALUE")).toBe(true);
  });

  it("does not report BML_INVALID_VALUE for a well-formed unknown TypeIdentifier", () => {
    const document = parseSample(
      '    <id type="type:TypeIdentifier" value="com.example.UnknownType" />',
      "unknown-type-id.bml",
    );
    const diagnostics = validateTypes(document, bootstrappedRegistry());
    expect(diagnostics.some((d) => d.code === "BML_INVALID_VALUE")).toBe(false);
  });

  it("does not report BML_INVALID_VALUE when the registry is empty", () => {
    const document = parseSample(
      '    <count type="type:Integer" value="1.5" />',
      "empty-registry.bml",
    );
    const diagnostics = validateTypes(document, new TypeRegistry());
    expect(diagnostics.some((d) => d.code === "BML_INVALID_VALUE")).toBe(false);
  });

  it("skips annotation-namespaced values such as scad:value", () => {
    const document = parseSample(
      [
        '    <baseColor type="type:Color">',
        "      <value>#EAC645</value>",
        '      <scad:value>"#EAC645"</scad:value>',
        "    </baseColor>",
      ].join("\n"),
      "scad-color-facet.bml",
      ' xmlns:scad="com.machineblocks.bml.annotation.ScadAnnotation"',
    );
    const diagnostics = validateTypes(document, bootstrappedRegistry());
    expect(diagnostics.filter((d) => d.code === "BML_INVALID_VALUE")).toEqual([]);
  });

  it("reports BML_INVALID_VALUE for a JSON array on a non-list StructType", () => {
    const document = parseSample(
      '    <size type="core:Block" value="[4,4,3]" />',
      "struct-array.bml",
    );
    const diagnostics = validateTypes(document, bootstrappedRegistry());
    expect(
      diagnostics.some((d) => d.message === "collection value on a non-list type"),
    ).toBe(true);
  });

  it("reports BML_INVALID_VALUE for a JSON list on a scalar Text property", () => {
    const document = parseSample(
      `    <label type="type:Text" value="['Hello', 'Good Bye']" />`,
      "list-on-scalar.bml",
    );
    const diagnostics = validateTypes(document, bootstrappedRegistry());
    expect(diagnostics.some((d) => d.code === "BML_INVALID_VALUE")).toBe(true);
  });

  it("still reports BML_INVALID_VALUE for the canonical value when a facet is also present", () => {
    const document = parseSample(
      [
        '    <count type="type:Integer">',
        "      <value>1.5</value>",
        "      <scad:value>1.5</scad:value>",
        "    </count>",
      ].join("\n"),
      "scad-invalid-canonical.bml",
      ' xmlns:scad="com.machineblocks.bml.annotation.ScadAnnotation"',
    );
    const diagnostics = validateTypes(document, bootstrappedRegistry());
    expect(diagnostics.filter((d) => d.code === "BML_INVALID_VALUE")).toHaveLength(1);
  });
});
