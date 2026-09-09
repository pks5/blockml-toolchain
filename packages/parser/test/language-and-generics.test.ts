import { describe, expect, it } from "vitest";
import { parse } from "../src/parse.js";

describe("language TypeReferenceEntity sugar", () => {
  it("resolves unqualified English to the language namespace, not Parent.English", () => {
    const source = [
      '<block xmlns="http://blockml.org/bml"',
      ' xmlns:core="org.blockml.bml.core"',
      ' xmlns:test="com.blockml.test.lang">',
      "  <name>Sample</name>",
      "  <type>test:Sample</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <language>",
      "    <English />",
      "  </language>",
      "</block>",
    ].join("\n");
    const result = parse(source, { filePath: "language-english.bml" });
    expect(result.document).not.toBeNull();
    expect(result.document!.block.languageFqn).toBe("org.blockml.bml.language.English");
    expect(result.document!.block.language?.value).toBe("org.blockml.bml.language.English");
  });
});

describe("genericTypes defaultType", () => {
  it("resolves defaultType QNames like baseType", () => {
    const source = [
      '<block xmlns="http://blockml.org/bml"',
      ' xmlns:core="org.blockml.bml.core"',
      ' xmlns:type="org.blockml.bml.type"',
      ' xmlns:test="com.blockml.test.generics">',
      "  <name>Host</name>",
      "  <type>test:Host</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <genericTypes>",
      '    <T baseType="core:ValueType" defaultType="type:Text" />',
      '    <R baseType="core:ValueType" defaultType="T" />',
      "  </genericTypes>",
      "</block>",
    ].join("\n");
    const result = parse(source, { filePath: "generic-default.bml" });
    expect(result.document).not.toBeNull();
    const generics = result.document!.block.genericTypes ?? [];
    expect(generics[0]?.defaultType).toBe("org.blockml.bml.type.Text");
    expect(generics[1]?.defaultType).toBe("T");
  });

  it("maps documentation children onto GenericType.documentations", () => {
    const source = [
      '<block xmlns="http://blockml.org/bml"',
      ' xmlns:core="org.blockml.bml.core"',
      ' xmlns:test="com.blockml.test.generics">',
      "  <name>Host</name>",
      "  <type>test:Host</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <genericTypes>",
      '    <T baseType="core:ValueType">',
      "      <documentation>Payload type for this host.</documentation>",
      "    </T>",
      '    <R baseType="core:Block" />',
      "  </genericTypes>",
      "</block>",
    ].join("\n");
    const result = parse(source, { filePath: "generic-docs.bml" });
    expect(result.document).not.toBeNull();
    const generics = result.document!.block.genericTypes ?? [];
    expect(generics[0]?.documentations).toEqual([
      expect.objectContaining({
        namespace: "",
        text: "Payload type for this host.",
        languageFqn: "org.blockml.bml.language.English",
      }),
    ]);
    expect(generics[1]?.documentations).toBeUndefined();
    expect(result.document!.block.documentations).toBeUndefined();
  });
});
