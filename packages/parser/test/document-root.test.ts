import { describe, expect, it } from "vitest";
import { isDocumentRootLocalName } from "../src/pipeline/root-type.js";
import { parse } from "../src/parse.js";

const NS = [
  'xmlns="http://blockml.org/bml"',
  'xmlns:core="org.blockml.bml.core"',
  'xmlns:type="org.blockml.bml.type"',
  'xmlns:test="com.blockml.test.root"',
].join(" ");

function legacy(body = ""): string {
  return [
    `<block ${NS}>`,
    "  <name>Sample</name>",
    "  <type>test:Sample</type>",
    "  <baseType>core:Block</baseType>",
    "  <is>sample</is>",
    body,
    "</block>",
  ].join("\n");
}

describe("isDocumentRootLocalName", () => {
  it("accepts legacy block and PascalCase type tags", () => {
    expect(isDocumentRootLocalName("block")).toBe(true);
    expect(isDocumentRootLocalName("MyLatestStory")).toBe(true);
    expect(isDocumentRootLocalName("_Helper")).toBe(true);
    expect(isDocumentRootLocalName("notBlock")).toBe(false);
    expect(isDocumentRootLocalName("properties")).toBe(false);
  });
});

describe("document root dual format", () => {
  it("keeps legacy <block> plus <type> identity", () => {
    const result = parse(legacy(), { filePath: "legacy.bml" });
    expect(result.success).toBe(true);
    expect(result.document).not.toBeNull();
    expect(result.document!.block.name).toBe("Sample");
    expect(result.document!.block.type).toBe("com.blockml.test.root.Sample");
    expect(result.document!.block.baseType).toBe("org.blockml.bml.core.Block");
    expect(result.document!.source.rootForm).toBe("block");
  });

  it("maps a qualified type-as-root tag without <type>", () => {
    const source = [
      `<test:Sample ${NS}>`,
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "</test:Sample>",
    ].join("\n");
    const result = parse(source, { filePath: "qualified.bml" });
    expect(result.success).toBe(true);
    expect(result.document!.block.name).toBe("Sample");
    expect(result.document!.block.type).toBe("com.blockml.test.root.Sample");
    expect(result.document!.block.baseType).toBe("org.blockml.bml.core.Block");
    expect(result.document!.source.rootForm).toBe("type");
  });

  it("accepts optional <name> on a qualified root when it matches lastSegment", () => {
    const source = [
      `<test:Sample ${NS}>`,
      "  <name>Sample</name>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "</test:Sample>",
    ].join("\n");
    const result = parse(source, { filePath: "qualified-name.bml" });
    expect(result.success).toBe(true);
    expect(result.document!.block.name).toBe("Sample");
    expect(result.document!.block.type).toBe("com.blockml.test.root.Sample");
  });

  it("maps an unqualified type-as-root tag as the TypeIdentifier", () => {
    const source = [
      `<Sample ${NS}>`,
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "</Sample>",
    ].join("\n");
    const result = parse(source, { filePath: "unqualified.bml" });
    expect(result.success).toBe(true);
    expect(result.document!.block.name).toBe("Sample");
    expect(result.document!.block.type).toBe("Sample");
    expect(result.document!.source.rootForm).toBe("type");
  });

  it("promotes an unqualified root to the child <type> FQN when last segments match", () => {
    const source = [
      `<Sample ${NS}>`,
      "  <type>test:Sample</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "</Sample>",
    ].join("\n");
    const result = parse(source, { filePath: "unqualified-plus-type.bml" });
    expect(result.success).toBe(true);
    expect(result.document!.block.type).toBe("com.blockml.test.root.Sample");
    expect(result.document!.block.name).toBe("Sample");
  });

  it("accepts a repeating <type> that resolves to the same FQN as the root tag", () => {
    const source = [
      `<test:Sample ${NS}>`,
      "  <type>test:Sample</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "</test:Sample>",
    ].join("\n");
    const result = parse(source, { filePath: "qualified-plus-type.bml" });
    expect(result.success).toBe(true);
    expect(result.document!.block.type).toBe("com.blockml.test.root.Sample");
  });

  it("reports when root tag type and child <type> resolve differently", () => {
    const source = [
      `<test:Sample ${NS}>`,
      "  <type>test:Other</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "</test:Sample>",
    ].join("\n");
    const result = parse(source, { filePath: "type-conflict.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.success).toBe(false);
    const diag = result.diagnostics.find((d) => d.code === "BML_MAP_ERROR");
    expect(diag).toBeDefined();
    expect(diag!.message).toContain("disagrees");
    expect(result.document!.block.type).toBe("com.blockml.test.root.Sample");
  });

  it("reports BML_MISSING_BLOCK_TYPE for legacy <block> without <type>", () => {
    const source = [
      `<block ${NS}>`,
      "  <name>Sample</name>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "</block>",
    ].join("\n");
    const result = parse(source, { filePath: "missing-type.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "BML_MISSING_BLOCK_TYPE")).toBe(true);
    expect(result.document!.block.name).toBe("Sample");
    expect(result.document!.block.type).toBe("");
  });

  it("still rejects a non-type camelCase root", () => {
    const source = `<notBlock ${NS}></notBlock>`;
    const result = parse(source, { filePath: "invalid-root.bml" });
    expect(result.document).toBeNull();
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "BML_INVALID_ROOT")).toBe(true);
  });

  it("rejects an undeclared XML prefix on a qualified root", () => {
    const source = [
      `<nope:Sample ${NS}>`,
      "  <baseType>core:Block</baseType>",
      "</nope:Sample>",
    ].join("\n");
    const result = parse(source, { filePath: "unknown-prefix-root.bml", continueOnError: true });
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "BML_MALFORMED_XML")).toBe(true);
  });

  it("maps members on a qualified root the same as on legacy <block>", () => {
    const members = [
      "  <properties>",
      '    <count type="type:Integer" />',
      "  </properties>",
    ].join("\n");
    const legacyResult = parse(legacy(members), { filePath: "legacy-members.bml" });
    const typed = [
      `<test:Sample ${NS}>`,
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      members,
      "</test:Sample>",
    ].join("\n");
    const typedResult = parse(typed, { filePath: "typed-members.bml" });
    expect(legacyResult.success).toBe(true);
    expect(typedResult.success).toBe(true);
    expect(typedResult.document!.block.members).toHaveLength(1);
    expect(typedResult.document!.block.members[0]?.name).toBe("count");
    expect(typedResult.document!.block.type).toBe(legacyResult.document!.block.type);
    expect(typedResult.document!.block.name).toBe(legacyResult.document!.block.name);
  });
});

describe("nested definition wrappers", () => {
  it("maps an unqualified Sub-Block tag as the name and derives type", () => {
    const source = [
      `<test:Sample ${NS}>`,
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <subBlocks>",
      "    <Inner>",
      "      <baseType>core:Block</baseType>",
      "      <is>inner</is>",
      "    </Inner>",
      "  </subBlocks>",
      "</test:Sample>",
    ].join("\n");
    const result = parse(source, { filePath: "sub-tag.bml" });
    expect(result.success).toBe(true);
    const inner = result.document!.block.subBlocks[0];
    expect(inner?.name).toBe("Inner");
    expect(inner?.type).toBe("com.blockml.test.root.Sample.Inner");
    expect(inner?.wrapperForm).toBe("type");
  });

  it("maps a visibility-prefixed Sub-Block tag", () => {
    const source = [
      `<test:Sample ${NS}>`,
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <subBlocks>",
      "    <_Utils>",
      "      <baseType>core:Entity</baseType>",
      "      <is>helpers</is>",
      "    </_Utils>",
      "  </subBlocks>",
      "</test:Sample>",
    ].join("\n");
    const result = parse(source, { filePath: "sub-vis.bml" });
    expect(result.success).toBe(true);
    expect(result.document!.block.subBlocks[0]?.name).toBe("_Utils");
    expect(result.document!.block.subBlocks[0]?.type).toBe(
      "com.blockml.test.root.Sample._Utils",
    );
  });

  it("maps a qualified embed tag as the type", () => {
    const source = [
      `<test:Sample ${NS}>`,
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <embeddedBlocks>",
      "    <test:Helper>",
      "      <baseType>core:Block</baseType>",
      "      <is>embed</is>",
      "    </test:Helper>",
      "  </embeddedBlocks>",
      "</test:Sample>",
    ].join("\n");
    const result = parse(source, { filePath: "embed-tag.bml" });
    expect(result.success).toBe(true);
    const embed = result.document!.block.embeddedBlocks[0];
    expect(embed?.name).toBe("Helper");
    expect(embed?.type).toBe("com.blockml.test.root.Helper");
    expect(embed?.wrapperForm).toBe("type");
  });

  it("keeps legacy nested <block> wrappers", () => {
    const source = [
      `<test:Sample ${NS}>`,
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <subBlocks>",
      "    <block>",
      "      <name>Inner</name>",
      "      <baseType>core:Block</baseType>",
      "      <is>inner</is>",
      "    </block>",
      "  </subBlocks>",
      "</test:Sample>",
    ].join("\n");
    const result = parse(source, { filePath: "sub-legacy.bml" });
    expect(result.success).toBe(true);
    expect(result.document!.block.subBlocks[0]?.wrapperForm).toBe("block");
    expect(result.document!.block.subBlocks[0]?.name).toBe("Inner");
    expect(result.document!.block.subBlocks[0]?.type).toBe(
      "com.blockml.test.root.Sample.Inner",
    );
  });

  it("reports BML_MISSING_SUBBLOCK_NAME for legacy <block> without <name>", () => {
    const source = [
      `<test:Sample ${NS}>`,
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <subBlocks>",
      "    <block>",
      "      <baseType>core:Block</baseType>",
      "    </block>",
      "  </subBlocks>",
      "</test:Sample>",
    ].join("\n");
    const result = parse(source, { filePath: "sub-missing-name.bml", continueOnError: true });
    expect(result.success).toBe(false);
    expect(result.diagnostics.some((d) => d.code === "BML_MISSING_SUBBLOCK_NAME")).toBe(true);
  });
});
