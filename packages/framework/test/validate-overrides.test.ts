import { describe, expect, it } from "vitest";
import type { BlockDefinition, BomDocument, MemberDefinition } from "@blockml/bom";
import { parse } from "@blockml/parser";
import { TypeRegistry, validateTypes } from "../src/index.js";

function typeDoc(block: BlockDefinition): BomDocument {
  return {
    kind: "block",
    source: { format: "xml", filePath: `${block.name}.bml` },
    block,
  };
}

function stub(
  name: string,
  type: string,
  extra: Partial<BlockDefinition> = {},
): BlockDefinition {
  return {
    name,
    type,
    members: extra.members ?? [],
    subBlocks: extra.subBlocks ?? [],
    embeddedBlocks: extra.embeddedBlocks ?? [],
    compositions: extra.compositions ?? [],
    ...extra,
  };
}

function property(name: string, extra: Partial<MemberDefinition> = {}): MemberDefinition {
  return {
    kind: "property",
    name,
    typeFqn: "org.blockml.bml.type.Text",
    type: { kind: "named", fqn: "org.blockml.bml.type.Text" },
    ...extra,
  };
}

function aggregation(name: string, extra: Partial<MemberDefinition> = {}): MemberDefinition {
  return {
    kind: "aggregation",
    name,
    typeFqn: "org.blockml.bml.core.Block",
    type: { kind: "named", fqn: "org.blockml.bml.core.Block" },
    ...extra,
  };
}

function registerCore(registry: TypeRegistry): void {
  registry.register(typeDoc(stub("Block", "org.blockml.bml.core.Block")));
}

function parseSample(body: string, filePath: string): BomDocument {
  const source = [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:type="org.blockml.bml.type"',
    ' xmlns:test="com.blockml.test.ovr">',
    "  <type>test:Sample</type>",
    "  <baseType>test:Parent</baseType>",
    "  <is>sample</is>",
    body,
    "</block>",
  ].join("\n");
  const parsed = parse(source, { filePath, continueOnError: true });
  expect(parsed.document).not.toBeNull();
  return parsed.document!;
}

function registryWithParent(parentMembers: MemberDefinition[]): TypeRegistry {
  const registry = new TypeRegistry();
  registerCore(registry);
  registry.register(
    typeDoc(
      stub("Parent", "com.blockml.test.ovr.Parent", {
        baseType: "org.blockml.bml.core.Block",
        members: parentMembers,
      }),
    ),
  );
  return registry;
}

describe("validateTypes member override", () => {
  it("requires override when a property is redeclared", () => {
    const document = parseSample(
      [
        "  <properties>",
        '    <label type="type:Text" />',
        "  </properties>",
      ].join("\n"),
      "property-override-required.bml",
    );
    const diagnostics = validateTypes(
      document,
      registryWithParent([property("label")]),
    );
    expect(diagnostics.some((d) => d.code === "BML_OVERRIDE_REQUIRED")).toBe(true);
  });

  it("requires override when an aggregation is filled with composition", () => {
    const document = parseSample(
      [
        "  <aggregations>",
        "    <items>",
        "      <composition>",
        "        <core:Block />",
        "      </composition>",
        "    </items>",
        "  </aggregations>",
      ].join("\n"),
      "aggregation-composition-override-required.bml",
    );
    const diagnostics = validateTypes(
      document,
      registryWithParent([aggregation("items")]),
    );
    expect(diagnostics.some((d) => d.code === "BML_OVERRIDE_REQUIRED")).toBe(true);
  });

  it("accepts an aggregation composition fill with override", () => {
    const document = parseSample(
      [
        "  <aggregations>",
        '    <items override="true">',
        "      <composition>",
        "        <core:Block />",
        "      </composition>",
        "    </items>",
        "  </aggregations>",
      ].join("\n"),
      "aggregation-composition-override-ok.bml",
    );
    const diagnostics = validateTypes(
      document,
      registryWithParent([aggregation("items")]),
    );
    expect(diagnostics.some((d) => d.code === "BML_OVERRIDE_REQUIRED")).toBe(false);
    expect(diagnostics.some((d) => d.code === "BML_OVERRIDE_WITHOUT_PARENT")).toBe(false);
  });

  it("requires override for a member inherited from a grandparent", () => {
    const registry = new TypeRegistry();
    registerCore(registry);
    registry.register(
      typeDoc(
        stub("Grandparent", "com.blockml.test.ovr.Grandparent", {
          baseType: "org.blockml.bml.core.Block",
          members: [aggregation("items")],
        }),
      ),
    );
    registry.register(
      typeDoc(
        stub("Parent", "com.blockml.test.ovr.Parent", {
          baseType: "com.blockml.test.ovr.Grandparent",
        }),
      ),
    );
    const document = parseSample(
      [
        "  <aggregations>",
        "    <items>",
        "      <composition>",
        "        <core:Block />",
        "      </composition>",
        "    </items>",
        "  </aggregations>",
      ].join("\n"),
      "grandparent-aggregation-override-required.bml",
    );
    const diagnostics = validateTypes(document, registry);
    expect(diagnostics.some((d) => d.code === "BML_OVERRIDE_REQUIRED")).toBe(true);
  });

  it("requires override when completing a contract member", () => {
    const registry = new TypeRegistry();
    registerCore(registry);
    registry.register(
      typeDoc(
        stub("INamed", "com.blockml.test.ovr.INamed", {
          baseType: "org.blockml.bml.core.Block",
          members: [property("label")],
        }),
      ),
    );
    const source = [
      '<block xmlns="http://blockml.org/bml"',
      ' xmlns:core="org.blockml.bml.core"',
      ' xmlns:type="org.blockml.bml.type"',
      ' xmlns:test="com.blockml.test.ovr">',
      "  <type>test:Sample</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <contracts>",
      "    <test:INamed />",
      "  </contracts>",
      "  <properties>",
      '    <label type="type:Text" />',
      "  </properties>",
      "</block>",
    ].join("\n");
    const parsed = parse(source, {
      filePath: "contract-override-required.bml",
      continueOnError: true,
    });
    expect(parsed.document).not.toBeNull();
    const diagnostics = validateTypes(parsed.document!, registry);
    expect(diagnostics.some((d) => d.code === "BML_OVERRIDE_REQUIRED")).toBe(true);
  });

  it("does not require override for a new aggregation", () => {
    const document = parseSample(
      [
        "  <aggregations>",
        "    <extra>",
        "      <composition>",
        "        <core:Block />",
        "      </composition>",
        "    </extra>",
        "  </aggregations>",
      ].join("\n"),
      "new-aggregation-ok.bml",
    );
    const diagnostics = validateTypes(
      document,
      registryWithParent([aggregation("items")]),
    );
    expect(diagnostics.some((d) => d.code === "BML_OVERRIDE_REQUIRED")).toBe(false);
  });

  it("reports override without a parent member", () => {
    const document = parseSample(
      [
        "  <aggregations>",
        '    <extra override="true" />',
        "  </aggregations>",
      ].join("\n"),
      "override-without-parent.bml",
    );
    const diagnostics = validateTypes(
      document,
      registryWithParent([aggregation("items")]),
    );
    expect(diagnostics.some((d) => d.code === "BML_OVERRIDE_WITHOUT_PARENT")).toBe(true);
  });
});
