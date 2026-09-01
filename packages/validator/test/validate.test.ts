import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { TypeRegistry } from "@blockml/framework";
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

  it("reports BML_OPEN_GENERIC_INSTANCE through validate()", () => {
    const ns = [
      'xmlns="http://blockml.org/bml"',
      'xmlns:bml="org.blockml.bml.annotation.BmlAnnotation"',
      'xmlns:core="org.blockml.bml.core"',
      'xmlns:test="com.blockml.test.generics"',
    ].join(" ");
    const generic = parse(
      [
        `<block ${ns}>`,
        "  <name>MyBlock</name>",
        "  <type>test:MyBlock</type>",
        "  <baseType>core:Block</baseType>",
        "  <is>generic box</is>",
        "  <genericTypes>",
        '    <T baseType="core:Block" />',
        "  </genericTypes>",
        "</block>",
      ].join("\n"),
      { filePath: "my-block.bml", continueOnError: true },
    );
    const host = parse(
      [
        `<block ${ns}>`,
        "  <name>Host</name>",
        "  <type>test:Host</type>",
        "  <baseType>core:Block</baseType>",
        "  <is>host</is>",
        "  <aggregations>",
        "    <children>",
        "      <composition>",
        "        <test:MyBlock />",
        "      </composition>",
        "    </children>",
        "  </aggregations>",
        "</block>",
      ].join("\n"),
      { filePath: "open-instance.bml", continueOnError: true },
    );
    expect(generic.document).not.toBeNull();
    expect(host.document).not.toBeNull();
    const registry = new TypeRegistry();
    registry.register(generic.document!);
    registry.register(host.document!);
    const result = validate(host.document!, { typeRegistry: registry });
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "BML_OPEN_GENERIC_INSTANCE")).toBe(
      true,
    );
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
