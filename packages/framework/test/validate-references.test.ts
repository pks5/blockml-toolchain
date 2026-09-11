import { describe, expect, it } from "vitest";
import type { BlockDefinition, BomDocument, MemberDefinition } from "@blockml/bom";
import { parse } from "@blockml/parser";
import { TypeRegistry, validateInstances, validateTypes } from "../src/index.js";

function lineOf(source: string, snippet: string): number {
  const idx = source.indexOf(snippet);
  expect(idx).toBeGreaterThanOrEqual(0);
  return source.slice(0, idx).split("\n").length;
}

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

function property(name: string, typeFqn: string): MemberDefinition {
  return {
    kind: "property",
    name,
    typeFqn,
    type: { kind: "named", fqn: typeFqn },
  };
}

function registerCore(registry: TypeRegistry): void {
  registry.register(typeDoc(stub("Block", "org.blockml.bml.core.Block")));
  registry.register(typeDoc(stub("Exception", "org.blockml.bml.core.Exception", {
    baseType: "org.blockml.bml.core.Block",
  })));
  registry.register(typeDoc(stub("TypeReference", "org.blockml.bml.type.TypeReference", {
    baseType: "org.blockml.bml.type.TypeIdentifier",
  })));
  registry.register(typeDoc(stub("TypeIdentifier", "org.blockml.bml.type.TypeIdentifier")));
  registry.register(typeDoc(stub("TypeReferenceEntity", "org.blockml.bml.type.TypeReferenceEntity")));
  registry.register(typeDoc(stub("PackageReference", "org.blockml.bml.type.PackageReference")));
  registry.register(typeDoc(stub("InstanceReference", "org.blockml.bml.type.InstanceReference")));
  registry.register(typeDoc(stub("PropertyReference", "org.blockml.bml.type.PropertyReference")));
  registry.register(typeDoc(stub("Text", "org.blockml.bml.type.Text")));
  registry.register(
    typeDoc(
      stub("Owner", "com.blockml.test.refs.Owner", {
        members: [property("width", "org.blockml.bml.type.Text")],
      }),
    ),
  );
}

function parseSample(
  body: string,
  filePath: string,
  extraXmlns = "",
): { source: string; document: BomDocument } {
  const source = [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:bml="org.blockml.bml.annotation.BmlAnnotation"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:type="org.blockml.bml.type"',
    extraXmlns,
    ' xmlns:test="com.blockml.test.refs">',
    "  <type>test:Sample</type>",
    "  <baseType>core:Block</baseType>",
    "  <is>sample</is>",
    body,
    "</block>",
  ].join("\n");
  const parsed = parse(source, { filePath, continueOnError: true });
  expect(parsed.document).not.toBeNull();
  return { source, document: parsed.document! };
}

describe("validateTypes type-driven reference walk", () => {
  it("reports unknown see type= as BML_UNKNOWN_TYPE at the see element", () => {
    const { source, document } = parseSample(
      [
        "  <references>",
        '    <see type="test:DoesNotExist" />',
        "  </references>",
      ].join("\n"),
      "see-type.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    const diag = diagnostics.find((d) => d.code === "BML_UNKNOWN_TYPE");
    expect(diag).toBeDefined();
    expect(diag!.message).toContain("com.blockml.test.refs.DoesNotExist");
    expect(diag!.source.line).toBe(lineOf(source, 'type="test:DoesNotExist"'));
  });

  it("reports unknown see property= as BML_UNKNOWN_PROPERTY", () => {
    const { document } = parseSample(
      [
        "  <references>",
        '    <see type="test:Owner" property="missing" />',
        "  </references>",
      ].join("\n"),
      "see-property.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    const diag = diagnostics.find((d) => d.code === "BML_UNKNOWN_PROPERTY");
    expect(diag).toBeDefined();
    expect(diag!.message).toMatch(/missing/);
  });

  it("accepts see property= that resolves on the owning type", () => {
    const { document } = parseSample(
      [
        "  <references>",
        '    <see type="test:Owner" property="width" />',
        "  </references>",
      ].join("\n"),
      "see-property-ok.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    expect(diagnostics.some((d) => d.code === "BML_UNKNOWN_PROPERTY")).toBe(false);
  });

  it("reports an unknown TypeReference property default", () => {
    const { document } = parseSample(
      [
        "  <properties>",
        '    <target type="type:TypeReference">',
        "      <value>com.blockml.test.refs.MissingTarget</value>",
        "    </target>",
        "  </properties>",
      ].join("\n"),
      "type-ref-value.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    const unknown = diagnostics.filter(
      (d) =>
        d.code === "BML_UNKNOWN_TYPE" &&
        d.message.includes("com.blockml.test.refs.MissingTarget"),
    );
    expect(unknown).toHaveLength(1);
  });

  it("resolves xmlns QName TypeReference defaults via document bindings", () => {
    const { document } = parseSample(
      [
        "  <properties>",
        '    <definition type="type:TypeReference">',
        "      <value>def:SubBlockDefinition</value>",
        "    </definition>",
        "  </properties>",
      ].join("\n"),
      "type-ref-qname-ok.bml",
      ' xmlns:def="org.blockml.bml.definition"',
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    registry.register(
      typeDoc(stub("SubBlockDefinition", "org.blockml.bml.definition.SubBlockDefinition")),
    );
    const diagnostics = validateTypes(document, registry);
    expect(diagnostics.filter((d) => d.code === "BML_UNKNOWN_TYPE")).toEqual([]);
  });

  it("resolves xmlns QNames before reporting an unknown TypeReference default", () => {
    const { document } = parseSample(
      [
        "  <properties>",
        '    <definition type="type:TypeReference">',
        "      <value>def:MissingDefinition</value>",
        "    </definition>",
        "  </properties>",
      ].join("\n"),
      "type-ref-qname-missing.bml",
      ' xmlns:def="org.blockml.bml.definition"',
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    const unknown = diagnostics.filter((d) => d.code === "BML_UNKNOWN_TYPE");
    expect(unknown).toHaveLength(1);
    expect(unknown[0]!.message).toContain("org.blockml.bml.definition.MissingDefinition");
    expect(unknown[0]!.message).not.toContain("def:MissingDefinition");
  });

  it("resolves a generic TypeExpression QName on a TypeReference default", () => {
    const { document } = parseSample(
      [
        "  <properties>",
        '    <language type="type:TypeReference">',
        "      <value>lang:Markdown(lang:English)</value>",
        "    </language>",
        "  </properties>",
      ].join("\n"),
      "type-ref-qname-generic.bml",
      ' xmlns:lang="org.blockml.bml.language"',
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    expect(diagnostics.filter((d) => d.code === "BML_UNKNOWN_TYPE")).toEqual([]);
  });

  it("does not existence-check a TypeIdentifier property value", () => {
    const { document } = parseSample(
      [
        "  <properties>",
        '    <minted type="type:TypeIdentifier">',
        "      <value>com.blockml.test.refs.DoesNotNeedToExist</value>",
        "    </minted>",
        "  </properties>",
      ].join("\n"),
      "type-ident-value.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    expect(
      diagnostics.some((d) => d.message.includes("com.blockml.test.refs.DoesNotNeedToExist")),
    ).toBe(false);
  });

  it("does not existence-check block.type being minted", () => {
    const { document } = parseSample("", "minted-type.bml");
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    expect(
      diagnostics.some(
        (d) => d.code === "BML_UNKNOWN_TYPE" && d.message.includes("com.blockml.test.refs.Sample"),
      ),
    ).toBe(false);
  });

  it("reports unknown TypeReferenceEntity in groups", () => {
    const { document } = parseSample(
      [
        "  <properties>",
        '    <label type="type:Text">',
        "      <groups>",
        "        <test:MissingGroup />",
        "      </groups>",
        "    </label>",
        "  </properties>",
      ].join("\n"),
      "groups-entity.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    expect(
      diagnostics.some(
        (d) =>
          d.code === "BML_UNKNOWN_TYPE" &&
          d.message.includes("com.blockml.test.refs.MissingGroup"),
      ),
    ).toBe(true);
  });

  it("reports unknown language TypeReferenceEntity", () => {
    const { document } = parseSample(
      "  <language>test:MissingLang</language>",
      "language-entity.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    expect(
      diagnostics.some(
        (d) =>
          d.code === "BML_UNKNOWN_TYPE" &&
          d.message.includes("com.blockml.test.refs.MissingLang"),
      ),
    ).toBe(true);
  });

  it("reports an unknown PackageReference value", () => {
    const { document } = parseSample(
      [
        "  <properties>",
        '    <pkg type="type:PackageReference">',
        "      <value>com.missing.package</value>",
        "    </pkg>",
        "  </properties>",
      ].join("\n"),
      "package-ref.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    expect(
      diagnostics.some((d) => d.code === "BML_UNKNOWN_TYPE" && d.message.includes("Unknown package")),
    ).toBe(true);
  });

  it("accepts a PackageReference for a package that has types in the registry", () => {
    const { document } = parseSample(
      [
        "  <properties>",
        '    <pkg type="type:PackageReference">',
        "      <value>org.blockml.bml.core</value>",
        "    </pkg>",
        "  </properties>",
      ].join("\n"),
      "package-ref-ok.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    expect(diagnostics.some((d) => d.message.includes("Unknown package"))).toBe(false);
  });

  it("treats space-separated association text as one instance token", () => {
    const { document } = parseSample(
      [
        "  <associations>",
        '    <linked type="type:InstanceReference(core:Block)[]" />',
        "  </associations>",
        "  <aggregations>",
        "    <children>",
        "      <composition>",
        '        <test:Sample bml:id="mine" />',
        '        <test:Sample bml:id="other" linked="mine other" />',
        "      </composition>",
        "    </children>",
        "  </aggregations>",
      ].join("\n"),
      "instance-ref-space.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    expect(
      diagnostics.some(
        (d) => d.code === "BML_UNRESOLVABLE_INSTANCE_REF" && d.message.includes("mine other"),
      ),
    ).toBe(true);
  });

  it("resolves compact JSON InstanceReference list items", () => {
    const { document } = parseSample(
      [
        "  <properties>",
        '    <peers type="type:InstanceReference[]" />',
        "  </properties>",
        "  <aggregations>",
        "    <children>",
        "      <composition>",
        '        <test:Sample bml:id="mine" />',
        `        <test:Sample bml:id="other" peers="['mine', 'ghost']" />`,
        "      </composition>",
        "    </children>",
        "  </aggregations>",
      ].join("\n"),
      "instance-ref-list-json.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    expect(
      diagnostics.some((d) => d.code === "BML_UNRESOLVABLE_INSTANCE_REF" && d.message.includes("ghost")),
    ).toBe(true);
    expect(
      diagnostics.some((d) => d.code === "BML_UNRESOLVABLE_INSTANCE_REF" && d.message.includes("mine")),
    ).toBe(false);
  });

  it("resolves repeated InstanceReference tags item-wise", () => {
    const { document } = parseSample(
      [
        "  <associations>",
        '    <linked type="type:InstanceReference(core:Block)[]" />',
        "  </associations>",
        "  <aggregations>",
        "    <children>",
        "      <composition>",
        '        <test:Sample bml:id="mine" />',
        "        <test:Sample bml:id=\"other\">",
        "          <linked>mine</linked>",
        "          <linked>ghost</linked>",
        "        </test:Sample>",
        "      </composition>",
        "    </children>",
        "  </aggregations>",
      ].join("\n"),
      "instance-ref-list-tags.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    expect(
      diagnostics.some((d) => d.code === "BML_UNRESOLVABLE_INSTANCE_REF" && d.message.includes("ghost")),
    ).toBe(true);
    expect(
      diagnostics.some((d) => d.code === "BML_UNRESOLVABLE_INSTANCE_REF" && d.message.includes("mine")),
    ).toBe(false);
  });

  it("resolves a local InstanceReference id when the declared type is InstanceReference", () => {
    const { document } = parseSample(
      [
        "  <properties>",
        '    <other type="type:InstanceReference" />',
        "  </properties>",
        "  <aggregations>",
        "    <children>",
        "      <composition>",
        '        <test:Sample bml:id="mine" other="ghost" />',
        "      </composition>",
        "    </children>",
        "  </aggregations>",
      ].join("\n"),
      "instance-ref-local.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    expect(
      diagnostics.some((d) => d.code === "BML_UNRESOLVABLE_INSTANCE_REF" && d.message.includes("ghost")),
    ).toBe(true);
    expect(
      diagnostics.some((d) => d.code === "BML_UNRESOLVABLE_INSTANCE_REF" && d.message.includes("mine")),
    ).toBe(false);
  });

  it("reports BML_TYPE_BOUND_NOT_SATISFIED when a composition child is not the aggregation payload", () => {
    const { source, document } = parseSample(
      [
        "  <aggregations>",
        '    <sources type="test:SourceSet[]">',
        "      <composition>",
        "        <test:OtherChild />",
        "      </composition>",
        "    </sources>",
        "  </aggregations>",
      ].join("\n"),
      "agg-child-wrong-type.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    registry.register(
      typeDoc(
        stub("SourceSet", "com.blockml.test.refs.SourceSet", {
          baseType: "org.blockml.bml.core.Block",
        }),
      ),
    );
    registry.register(
      typeDoc(
        stub("OtherChild", "com.blockml.test.refs.OtherChild", {
          baseType: "org.blockml.bml.core.Block",
        }),
      ),
    );
    const diagnostics = validateTypes(document, registry);
    const diag = diagnostics.find((d) => d.code === "BML_TYPE_BOUND_NOT_SATISFIED");
    expect(diag).toBeDefined();
    expect(diag!.message).toContain("com.blockml.test.refs.OtherChild");
    expect(diag!.message).toContain("com.blockml.test.refs.SourceSet");
    expect(diag!.source.line).toBe(lineOf(source, "<test:OtherChild />"));
  });

  it("accepts a subtype as a domain-Block aggregation child", () => {
    const { document } = parseSample(
      [
        "  <aggregations>",
        '    <sources type="test:SourceSet[]">',
        "      <composition>",
        "        <test:SourceSetSub />",
        "      </composition>",
        "    </sources>",
        "  </aggregations>",
      ].join("\n"),
      "agg-child-subtype.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    registry.register(
      typeDoc(
        stub("SourceSet", "com.blockml.test.refs.SourceSet", {
          baseType: "org.blockml.bml.core.Block",
        }),
      ),
    );
    registry.register(
      typeDoc(
        stub("SourceSetSub", "com.blockml.test.refs.SourceSetSub", {
          baseType: "com.blockml.test.refs.SourceSet",
        }),
      ),
    );
    const diagnostics = validateTypes(document, registry);
    expect(diagnostics.some((d) => d.code === "BML_TYPE_BOUND_NOT_SATISFIED")).toBe(false);
  });

  it("keeps TypeReferenceEntity QName sugar off the instance-type check", () => {
    const { document } = parseSample(
      [
        "  <aggregations>",
        '    <blocks type="type:TypeReferenceEntity(core:Block)[]">',
        "      <composition>",
        "        <core:Block />",
        "      </composition>",
        "    </blocks>",
        "  </aggregations>",
      ].join("\n"),
      "agg-child-type-ref-sugar.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const diagnostics = validateTypes(document, registry);
    expect(
      diagnostics.some(
        (d) =>
          d.code === "BML_TYPE_BOUND_NOT_SATISFIED" &&
          d.message.includes("org.blockml.bml.core.Block") &&
          d.message.includes("TypeReferenceEntity"),
      ),
    ).toBe(false);
  });

  it("uses the inherited aggregation type when an override fills composition", () => {
    const { document } = parseSample(
      [
        "  <aggregations>",
        '    <sources override="true">',
        "      <composition>",
        "        <test:OtherChild />",
        "      </composition>",
        "    </sources>",
        "  </aggregations>",
      ].join("\n"),
      "agg-child-inherited-type.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    registry.register(
      typeDoc(
        stub("SourceSet", "com.blockml.test.refs.SourceSet", {
          baseType: "org.blockml.bml.core.Block",
        }),
      ),
    );
    registry.register(
      typeDoc(
        stub("OtherChild", "com.blockml.test.refs.OtherChild", {
          baseType: "org.blockml.bml.core.Block",
        }),
      ),
    );
    registry.register(
      typeDoc(
        stub("Parent", "com.blockml.test.refs.Parent", {
          baseType: "org.blockml.bml.core.Block",
          members: [
            {
              kind: "aggregation",
              name: "sources",
              type: {
                kind: "named",
                fqn: "com.blockml.test.refs.SourceSet",
                multiplicity: { min: 0, max: "*" },
              },
            },
          ],
        }),
      ),
    );
    document.block.baseType = "com.blockml.test.refs.Parent";
    const diagnostics = validateTypes(document, registry);
    const diag = diagnostics.find((d) => d.code === "BML_TYPE_BOUND_NOT_SATISFIED");
    expect(diag).toBeDefined();
    expect(diag!.message).toContain("com.blockml.test.refs.OtherChild");
    expect(diag!.message).toContain("com.blockml.test.refs.SourceSet");
  });

  it("does not treat a Text literal containing :: as an instance reference", () => {
    const { document } = parseSample(
      [
        "  <properties>",
        '    <note type="type:Text">',
        "      <value>Owner::notAnId</value>",
        "    </note>",
        "  </properties>",
      ].join("\n"),
      "text-double-colon.bml",
    );
    const registry = new TypeRegistry();
    registerCore(registry);
    const typeDiags = validateTypes(document, registry);
    const instDiags = validateInstances(document, registry);
    expect(typeDiags.some((d) => d.code === "BML_UNRESOLVABLE_INSTANCE_REF")).toBe(false);
    expect(instDiags.some((d) => d.code === "BML_UNRESOLVABLE_INSTANCE_REF")).toBe(false);
  });
});
