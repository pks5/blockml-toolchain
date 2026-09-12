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

  it("reports unknown empty instance child elements", () => {
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
      "child-empty.bml",
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
        "        <test:Child>",
        "          <test>",
        "          </test>",
        "        </test:Child>",
        "      </composition>",
        "    </children>",
        "  </aggregations>",
        "</block>",
      ].join("\n"),
      "unknown-empty-member.bml",
    );
    const registry = new TypeRegistry();
    registry.register(child);
    registry.register(host);
    const diagnostics = validateInstances(host, registry);
    const diag = diagnostics.find((d) => d.code === "BML_UNKNOWN_PROPERTY");
    expect(diag).toBeDefined();
    expect(diag!.message).toMatch(/test/);
  });

  it("reports unknown instance aggregation fills", () => {
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
      "child-agg.bml",
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
        "        <test:Child>",
        "          <test>",
        "            <test:Child />",
        "          </test>",
        "        </test:Child>",
        "      </composition>",
        "    </children>",
        "  </aggregations>",
        "</block>",
      ].join("\n"),
      "unknown-aggregation-fill.bml",
    );
    const registry = new TypeRegistry();
    registry.register(child);
    registry.register(host);
    const diagnostics = validateInstances(host, registry);
    const diag = diagnostics.find((d) => d.code === "BML_UNKNOWN_PROPERTY");
    expect(diag).toBeDefined();
    expect(diag!.message).toMatch(/test/);
  });

  it("accepts unqualified composition tags that name the enclosing block", () => {
    const host = parseBlock(
      [
        '<block xmlns="http://blockml.org/bml"',
        ' xmlns:core="org.blockml.bml.core"',
        ' xmlns:type="org.blockml.bml.type"',
        ' xmlns:test="com.blockml.test.inst">',
        "  <name>Host</name>",
        "  <type>test:Host</type>",
        "  <baseType>core:Block</baseType>",
        "  <is>host</is>",
        "  <aggregations>",
        "    <values>",
        "      <composition>",
        "        <Host />",
        "      </composition>",
        "    </values>",
        "  </aggregations>",
        "</block>",
      ].join("\n"),
      "self-instance.bml",
    );
    const registry = new TypeRegistry();
    registry.register(host);
    const diagnostics = validateInstances(host, registry);
    expect(diagnostics.some((d) => d.code === "BML_UNKNOWN_TYPE")).toBe(false);
    const values = host.block.members.find((m) => m.name === "values");
    expect(values?.kind).toBe("aggregation");
    if (values?.kind !== "aggregation") {
      return;
    }
    const child = values.composition?.children[0];
    expect(child?.kind).toBe("blockInstance");
    if (child?.kind === "blockInstance") {
      expect(child.instance.typeFqn).toBe("com.blockml.test.inst.Host");
    }
  });
});
