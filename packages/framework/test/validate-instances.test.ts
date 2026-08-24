import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { TypeRegistry, validateInstances } from "../src/index.js";

function parseBlock(source: string, filePath: string) {
  const parsed = parse(source, { filePath, continueOnError: true });
  expect(parsed.document).not.toBeNull();
  return parsed.document!;
}

describe("validateInstances type and member completeness", () => {
  it("reports unknown instance typeFqn", () => {
    const host = parseBlock(
      [
        '<block xmlns="http://blockml.org/bml"',
        ' xmlns:core="org.blockml.bml.core"',
        ' xmlns:type="org.blockml.bml.type"',
        ' xmlns:test="com.blockml.test.inst">',
        "  <type>test:Host</type>",
        "  <baseType>core:Block</baseType>",
        "  <is>host</is>",
        "  <aggregations>",
        "    <children>",
        "      <composition>",
        "        <Missing />",
        "      </composition>",
        "    </children>",
        "  </aggregations>",
        "</block>",
      ].join("\n"),
      "unknown-instance-type.bml",
    );
    const registry = new TypeRegistry();
    registry.register(host);
    const diagnostics = validateInstances(host, registry);
    expect(diagnostics.some((d) => d.code === "BML_UNKNOWN_TYPE")).toBe(true);
  });

  it("reports unknown instance memberValues keys", () => {
    const child = parseBlock(
      [
        '<block xmlns="http://blockml.org/bml"',
        ' xmlns:core="org.blockml.bml.core"',
        ' xmlns:type="org.blockml.bml.type"',
        ' xmlns:test="com.blockml.test.inst">',
        "  <type>test:Child</type>",
        "  <baseType>core:Block</baseType>",
        "  <is>child</is>",
        "  <properties>",
        '    <label type="type:Text" />',
        "  </properties>",
        "</block>",
      ].join("\n"),
      "child.bml",
    );
    const host = parseBlock(
      [
        '<block xmlns="http://blockml.org/bml"',
        ' xmlns:core="org.blockml.bml.core"',
        ' xmlns:type="org.blockml.bml.type"',
        ' xmlns:test="com.blockml.test.inst">',
        "  <type>test:Host</type>",
        "  <baseType>core:Block</baseType>",
        "  <is>host</is>",
        "  <aggregations>",
        "    <children>",
        "      <composition>",
        '        <test:Child mystery="nope" />',
        "      </composition>",
        "    </children>",
        "  </aggregations>",
        "</block>",
      ].join("\n"),
      "unknown-member.bml",
    );
    const registry = new TypeRegistry();
    registry.register(child);
    registry.register(host);
    const diagnostics = validateInstances(host, registry);
    const diag = diagnostics.find((d) => d.code === "BML_UNKNOWN_PROPERTY");
    expect(diag).toBeDefined();
    expect(diag!.message).toMatch(/mystery/);
  });
});
