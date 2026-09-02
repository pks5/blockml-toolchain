import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { TypeRegistry, validateGenerics } from "../src/index.js";

function parseBlock(source: string, filePath: string) {
  const parsed = parse(source, { filePath, continueOnError: true });
  expect(parsed.document, JSON.stringify(parsed.diagnostics)).not.toBeNull();
  return parsed.document!;
}

const NS = [
  'xmlns="http://blockml.org/bml"',
  'xmlns:bml="org.blockml.bml.annotation.BmlAnnotation"',
  'xmlns:core="org.blockml.bml.core"',
  'xmlns:type="org.blockml.bml.type"',
  'xmlns:test="com.blockml.test.generics"',
].join(" ");

function block(typeLocal: string, body: string, filePath: string) {
  return parseBlock(
    [
      `<block ${NS}>`,
      `  <name>${typeLocal}</name>`,
      `  <type>test:${typeLocal}</type>`,
      "  <baseType>core:Block</baseType>",
      `  <is>${typeLocal}</is>`,
      body,
      "</block>",
    ].join("\n"),
    filePath,
  );
}

function registryWithBasics() {
  const registry = new TypeRegistry();
  registry.register(block("Bound", "", "bound.bml"));
  registry.register(
    parseBlock(
      [
        `<block ${NS}>`,
        "  <name>Other</name>",
        "  <type>test:Other</type>",
        "  <baseType>test:Bound</baseType>",
        "  <is>other</is>",
        "</block>",
      ].join("\n"),
      "other.bml",
    ),
  );
  registry.register(block("Unrelated", "", "unrelated.bml"));
  registry.register(
    parseBlock(
      [
        `<block ${NS}>`,
        "  <name>MyBlock</name>",
        "  <type>test:MyBlock</type>",
        "  <baseType>core:Block</baseType>",
        "  <is>generic box</is>",
        "  <genericTypes>",
        '    <T baseType="test:Bound" />',
        "  </genericTypes>",
        "</block>",
      ].join("\n"),
      "my-block.bml",
    ),
  );
  registry.register(
    parseBlock(
      [
        `<block ${NS}>`,
        "  <name>Pair</name>",
        "  <type>test:Pair</type>",
        "  <baseType>core:Block</baseType>",
        "  <is>two params</is>",
        "  <genericTypes>",
        '    <A baseType="core:Block" />',
        '    <B baseType="core:Block" />',
        "  </genericTypes>",
        "</block>",
      ].join("\n"),
      "pair.bml",
    ),
  );
  registry.register(
    parseBlock(
      [
        `<block ${NS}>`,
        "  <name>Defaulted</name>",
        "  <type>test:Defaulted</type>",
        "  <baseType>core:Block</baseType>",
        "  <is>defaulted generic</is>",
        "  <genericTypes>",
        '    <T baseType="test:Bound" defaultType="test:Other" />',
        "  </genericTypes>",
        "</block>",
      ].join("\n"),
      "defaulted.bml",
    ),
  );
  registry.register(
    parseBlock(
      [
        `<block ${NS}>`,
        "  <name>Wrapper</name>",
        "  <type>test:Wrapper</type>",
        "  <baseType>core:Block</baseType>",
        "  <is>wrapper</is>",
        "  <aggregations>",
        "    <items />",
        "  </aggregations>",
        "</block>",
      ].join("\n"),
      "wrapper.bml",
    ),
  );
  return registry;
}

function hostWithChild(childXml: string, filePath: string) {
  return parseBlock(
    [
      `<block ${NS}>`,
      "  <name>Host</name>",
      "  <type>test:Host</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>host</is>",
      "  <aggregations>",
      "    <children>",
      "      <composition>",
      `        ${childXml}`,
      "      </composition>",
      "    </children>",
      "  </aggregations>",
      "</block>",
    ].join("\n"),
    filePath,
  );
}

describe("validateGenerics", () => {
  it("reports BML_OPEN_GENERIC_INSTANCE for a composition child without bml:generics", () => {
    const registry = registryWithBasics();
    const host = hostWithChild('<test:MyBlock />', "open-composition.bml");
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    expect(diagnostics.some((d) => d.code === "BML_OPEN_GENERIC_INSTANCE")).toBe(true);
  });

  it("reports BML_OPEN_GENERIC_INSTANCE for instance aggregation fill without bml:generics", () => {
    const registry = registryWithBasics();
    const host = hostWithChild(
      "<test:Wrapper><items><test:MyBlock /></items></test:Wrapper>",
      "open-fill.bml",
    );
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    expect(diagnostics.some((d) => d.code === "BML_OPEN_GENERIC_INSTANCE")).toBe(true);
  });

  it("accepts bml:generics attribute form that closes MyBlock<T>", () => {
    const registry = registryWithBasics();
    const host = hostWithChild(
      '<test:MyBlock bml:generics="(test:Other)" />',
      "attr-ok.bml",
    );
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    expect(diagnostics.map((d) => d.code)).toEqual([]);
    const child = host.block.compositions[0]?.children[0];
    expect(child?.kind).toBe("blockInstance");
    if (child?.kind === "blockInstance") {
      expect(child.instance.generics?.raw).toBe("(test:Other)");
      expect(child.instance.generics?.authoredPlacement).toBe("attribute");
      expect(child.instance.memberValues.generics).toBeUndefined();
    }
  });

  it("accepts bml:generics element form that closes MyBlock<T>", () => {
    const registry = registryWithBasics();
    const host = hostWithChild(
      "<test:MyBlock><bml:generics>(test:Other)</bml:generics></test:MyBlock>",
      "element-ok.bml",
    );
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    expect(diagnostics.map((d) => d.code)).toEqual([]);
    const child = host.block.compositions[0]?.children[0];
    expect(child?.kind).toBe("blockInstance");
    if (child?.kind === "blockInstance") {
      expect(child.instance.generics?.raw).toBe("(test:Other)");
      expect(child.instance.generics?.authoredPlacement).toBe("element");
      expect(child.instance.memberValues.generics).toBeUndefined();
    }
  });

  it("accepts two positional arguments", () => {
    const registry = registryWithBasics();
    const host = hostWithChild(
      '<test:Pair bml:generics="(test:Bound, test:Unrelated)" />',
      "pair-ok.bml",
    );
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    expect(diagnostics.map((d) => d.code)).toEqual([]);
  });

  it("reports BML_GENERICS_DIRECTIVE_NOT_ALLOWED on a Block definition", () => {
    const registry = registryWithBasics();
    const doc = parseBlock(
      [
        `<block ${NS} bml:generics="(test:Other)">`,
        "  <name>Def</name>",
        "  <type>test:Def</type>",
        "  <baseType>core:Block</baseType>",
        "  <is>def</is>",
        "</block>",
      ].join("\n"),
      "def-generics.bml",
    );
    registry.register(doc);
    const diagnostics = validateGenerics(doc, registry);
    expect(diagnostics.some((d) => d.code === "BML_GENERICS_DIRECTIVE_NOT_ALLOWED")).toBe(
      true,
    );
  });

  it("reports BML_GENERICS_DIRECTIVE_NOT_ALLOWED on composition and bml:container", () => {
    const registry = registryWithBasics();
    const host = parseBlock(
      [
        `<block ${NS}>`,
        "  <name>Host</name>",
        "  <type>test:Host</type>",
        "  <baseType>core:Block</baseType>",
        "  <is>host</is>",
        "  <aggregations>",
        "    <children>",
        '      <composition bml:generics="(test:Other)">',
        '        <bml:container bml:generics="(test:Other)">',
        '          <test:MyBlock bml:generics="(test:Other)" />',
        "        </bml:container>",
        "      </composition>",
        "    </children>",
        "  </aggregations>",
        "</block>",
      ].join("\n"),
      "misplaced-hosts.bml",
    );
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    const notAllowed = diagnostics.filter(
      (d) => d.code === "BML_GENERICS_DIRECTIVE_NOT_ALLOWED",
    );
    expect(notAllowed.length).toBeGreaterThanOrEqual(2);
  });

  it("reports BML_GENERICS_ARGUMENT_MISMATCH on a non-generic instance", () => {
    const registry = registryWithBasics();
    const host = hostWithChild(
      '<test:Bound bml:generics="(test:Other)" />',
      "nongeneric.bml",
    );
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    expect(diagnostics.some((d) => d.code === "BML_GENERICS_ARGUMENT_MISMATCH")).toBe(
      true,
    );
  });

  it("reports BML_GENERICS_ARGUMENT_MISMATCH for extra arguments", () => {
    const registry = registryWithBasics();
    const host = hostWithChild(
      '<test:MyBlock bml:generics="(test:Other, test:Bound)" />',
      "extra-args.bml",
    );
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    expect(diagnostics.some((d) => d.code === "BML_GENERICS_ARGUMENT_MISMATCH")).toBe(
      true,
    );
  });

  it("reports BML_GENERIC_CONSTRAINT_VIOLATION when the argument fails the bound", () => {
    const registry = registryWithBasics();
    const host = hostWithChild(
      '<test:MyBlock bml:generics="(test:Unrelated)" />',
      "bound-fail.bml",
    );
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    expect(diagnostics.some((d) => d.code === "BML_GENERIC_CONSTRAINT_VIOLATION")).toBe(
      true,
    );
  });

  it("allows a defaultType-only generic without bml:generics", () => {
    const registry = registryWithBasics();
    const host = hostWithChild("<test:Defaulted />", "defaulted-ok.bml");
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    expect(diagnostics.map((d) => d.code)).toEqual([]);
  });

  it("allows bml:generics to restate a defaultType-only generic", () => {
    const registry = registryWithBasics();
    const host = hostWithChild(
      '<test:Defaulted bml:generics="(test:Other)" />',
      "defaulted-restate.bml",
    );
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    expect(diagnostics.map((d) => d.code)).toEqual([]);
  });

  it("allows bml:generics to override a defaultType-only generic", () => {
    const registry = registryWithBasics();
    const host = hostWithChild(
      '<test:Defaulted bml:generics="(test:Bound)" />',
      "defaulted-override.bml",
    );
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    expect(diagnostics.map((d) => d.code)).toEqual([]);
  });

  it("reports BML_GENERIC_CONSTRAINT_VIOLATION when a defaultType override fails the bound", () => {
    const registry = registryWithBasics();
    const host = hostWithChild(
      '<test:Defaulted bml:generics="(test:Unrelated)" />',
      "defaulted-bound-fail.bml",
    );
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    expect(diagnostics.some((d) => d.code === "BML_GENERIC_CONSTRAINT_VIOLATION")).toBe(
      true,
    );
  });

  it("reports BML_GENERICS_ARGUMENT_MISMATCH when parentheses are missing", () => {
    const registry = registryWithBasics();
    const host = hostWithChild(
      '<test:MyBlock bml:generics="test:Other" />',
      "no-parens.bml",
    );
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    expect(diagnostics.some((d) => d.code === "BML_GENERICS_ARGUMENT_MISMATCH")).toBe(
      true,
    );
  });

  it("reports BML_MISSING_GENERIC_TYPE_ARGUMENT when the directive omits a required arg", () => {
    const registry = registryWithBasics();
    const host = hostWithChild(
      '<test:Pair bml:generics="(test:Bound)" />',
      "missing-arg.bml",
    );
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    expect(
      diagnostics.some((d) => d.code === "BML_MISSING_GENERIC_TYPE_ARGUMENT"),
    ).toBe(true);
    expect(diagnostics.some((d) => d.code === "BML_OPEN_GENERIC_INSTANCE")).toBe(false);
  });

  it("does not treat TypeReferenceEntity QName sugar as an open generic instance", () => {
    const registry = registryWithBasics();
    const catalog = parseBlock(
      [
        `<block ${NS}>`,
        "  <name>Catalog</name>",
        "  <type>test:Catalog</type>",
        "  <baseType>core:Block</baseType>",
        "  <is>catalog</is>",
        "  <aggregations>",
        '    <blocks type="type:TypeReferenceEntity(core:Block)[]">',
        "      <composition>",
        "        <test:MyBlock />",
        "      </composition>",
        "    </blocks>",
        "  </aggregations>",
        "</block>",
      ].join("\n"),
      "tre-sugar.bml",
    );
    registry.register(catalog);
    const diagnostics = validateGenerics(catalog, registry);
    expect(diagnostics.map((d) => d.code)).toEqual([]);
  });

  it("does not treat inherited TypeReferenceEntity catalog fills as instances", () => {
    const registry = registryWithBasics();
    registry.register(
      parseBlock(
        [
          `<block ${NS}>`,
          "  <name>CatalogBase</name>",
          "  <type>test:CatalogBase</type>",
          "  <baseType>core:Block</baseType>",
          "  <is>catalog base</is>",
          "  <aggregations>",
          '    <blocks type="type:TypeReferenceEntity(core:Block)[]" />',
          "  </aggregations>",
          "</block>",
        ].join("\n"),
        "catalog-base.bml",
      ),
    );
    const catalog = parseBlock(
      [
        `<block ${NS}>`,
        "  <name>Catalog</name>",
        "  <type>test:Catalog</type>",
        "  <baseType>test:CatalogBase</baseType>",
        "  <is>catalog</is>",
        "  <aggregations>",
        "    <blocks>",
        "      <composition>",
        "        <test:MyBlock />",
        "      </composition>",
        "    </blocks>",
        "  </aggregations>",
        "</block>",
      ].join("\n"),
      "catalog-fill.bml",
    );
    registry.register(catalog);
    const diagnostics = validateGenerics(catalog, registry);
    expect(diagnostics.map((d) => d.code)).toEqual([]);
  });

  it("reports BML_GENERICS_DIRECTIVE_NOT_ALLOWED on TypeReferenceEntity sugar", () => {
    const registry = registryWithBasics();
    const catalog = parseBlock(
      [
        `<block ${NS}>`,
        "  <name>Catalog</name>",
        "  <type>test:Catalog</type>",
        "  <baseType>core:Block</baseType>",
        "  <is>catalog</is>",
        "  <aggregations>",
        '    <blocks type="type:TypeReferenceEntity(core:Block)[]">',
        "      <composition>",
        '        <test:MyBlock bml:generics="(test:Other)" />',
        "      </composition>",
        "    </blocks>",
        "  </aggregations>",
        "</block>",
      ].join("\n"),
      "tre-generics.bml",
    );
    registry.register(catalog);
    const diagnostics = validateGenerics(catalog, registry);
    expect(diagnostics.some((d) => d.code === "BML_GENERICS_DIRECTIVE_NOT_ALLOWED")).toBe(
      true,
    );
    expect(diagnostics.some((d) => d.code === "BML_OPEN_GENERIC_INSTANCE")).toBe(false);
  });

  it("does not treat instance-fill TypeReferenceEntity sugar as an open generic instance", () => {
    const registry = registryWithBasics();
    registry.register(
      parseBlock(
        [
          `<block ${NS}>`,
          "  <name>Catalog</name>",
          "  <type>test:Catalog</type>",
          "  <baseType>core:Block</baseType>",
          "  <is>catalog</is>",
          "  <aggregations>",
          '    <blocks type="type:TypeReferenceEntity(core:Block)[]" />',
          "  </aggregations>",
          "</block>",
        ].join("\n"),
        "catalog-type.bml",
      ),
    );
    const host = hostWithChild(
      "<test:Catalog><blocks><test:MyBlock /></blocks></test:Catalog>",
      "tre-instance-fill.bml",
    );
    registry.register(host);
    const diagnostics = validateGenerics(host, registry);
    expect(diagnostics.map((d) => d.code)).toEqual([]);
  });
});
