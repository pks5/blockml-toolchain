import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { validate, validateStyle } from "../src/index.js";

function sample(body: string): string {
  return [
    `<block xmlns="http://blockml.org/bml"`,
    `  xmlns:core="org.blockml.bml.core"`,
    `  xmlns:test="com.blockml.test.style">`,
    `  <name>Sample</name>`,
    `  <type>test:Sample</type>`,
    `  <baseType>core:Block</baseType>`,
    `  <is>sample</is>`,
    `  <version>1.0.0</version>`,
    body,
    `</block>`,
  ].join("\n");
}

function preferred(body = ""): string {
  return [
    `<test:Sample xmlns="http://blockml.org/bml"`,
    `  xmlns:core="org.blockml.bml.core"`,
    `  xmlns:test="com.blockml.test.style">`,
    `  <baseType>core:Block</baseType>`,
    `  <is>sample</is>`,
    `  <version>1.0.0</version>`,
    body,
    `</test:Sample>`,
  ].join("\n");
}

const LONG_UNSTRUCTURED =
  "This is a long documentation paragraph that keeps going without any markdown heading, list, or blank line so the style catalog should recommend structure. ".repeat(4);

describe("validateStyle catalog", () => {
  it("recommends CDATA when documentation uses entity escaping", () => {
    const parsed = parse(
      sample("  <documentation>Use &lt;see&gt; for links.</documentation>"),
      { filePath: "style-cdata.bml" },
    );
    expect(parsed.document).not.toBeNull();
    const diags = validateStyle(parsed.document!);
    const hit = diags.find((d) => d.code === "BML_STYLE_PREFER_CDATA");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("recommendation");
    expect(diags.some((d) => d.severity === "error")).toBe(false);
  });

  it("does not recommend CDATA when documentation already uses CDATA", () => {
    const parsed = parse(
      sample("  <documentation><![CDATA[Use <see> for links.]]></documentation>"),
      { filePath: "style-cdata-ok.bml" },
    );
    expect(parsed.document).not.toBeNull();
    const diags = validateStyle(parsed.document!);
    expect(diags.some((d) => d.code === "BML_STYLE_PREFER_CDATA")).toBe(false);
  });

  it("recommends markdown structure for a long unstructured documentation block", () => {
    const parsed = parse(
      sample(`  <documentation>${LONG_UNSTRUCTURED}</documentation>`),
      { filePath: "style-markdown.bml" },
    );
    expect(parsed.document).not.toBeNull();
    const diags = validateStyle(parsed.document!);
    const hit = diags.find((d) => d.code === "BML_STYLE_PREFER_MARKDOWN");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("recommendation");
  });

  it("does not recommend markdown for short or structured documentation", () => {
    const short = parse(sample("  <documentation>Short note.</documentation>"), {
      filePath: "style-markdown-short.bml",
    });
    expect(validateStyle(short.document!).some((d) => d.code === "BML_STYLE_PREFER_MARKDOWN")).toBe(
      false,
    );

    const structured = parse(
      sample(
        "  <documentation># Heading\n\n- item one\n- item two\n\nMore prose after a blank line.</documentation>",
      ),
      { filePath: "style-markdown-ok.bml" },
    );
    expect(
      validateStyle(structured.document!).some((d) => d.code === "BML_STYLE_PREFER_MARKDOWN"),
    ).toBe(false);
  });

  it("warns on paired empty see tags and stays successful", () => {
    const parsed = parse(
      sample(
        `  <references>
    <see type="core:Block" relation="SeeAlso"></see>
  </references>`,
      ),
      { filePath: "style-see-paired.bml" },
    );
    expect(parsed.document).not.toBeNull();
    const diags = validateStyle(parsed.document!);
    const hit = diags.find((d) => d.code === "BML_STYLE_EMPTY_ELEMENT_SELF_CLOSE");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("warning");

    const result = validate(parsed.document!);
    expect(result.diagnostics.some((d) => d.code === "BML_STYLE_EMPTY_ELEMENT_SELF_CLOSE")).toBe(
      true,
    );
    expect(result.diagnostics.some((d) => d.code.startsWith("BML_STYLE_") && d.severity === "error")).toBe(
      false,
    );
  });

  it("does not warn on self-closing empty see tags", () => {
    const parsed = parse(
      sample(
        `  <references>
    <see type="core:Block" relation="SeeAlso" />
  </references>`,
      ),
      { filePath: "style-see-self.bml" },
    );
    expect(parsed.document).not.toBeNull();
    const diags = validateStyle(parsed.document!);
    expect(diags.some((d) => d.code === "BML_STYLE_EMPTY_ELEMENT_SELF_CLOSE")).toBe(false);
  });

  it("loads rule codes from the BML catalog", () => {
    const parsed = parse(sample("  <documentation>ok</documentation>"), {
      filePath: "style-catalog.bml",
    });
    const codes = new Set(validateStyle(parsed.document!).map((d) => d.code));
    expect(codes.has("BML_STYLE_UNKNOWN_CHECK")).toBe(false);
  });

  it("warns on the legacy block wrapper", () => {
    const parsed = parse(sample("  <documentation>ok</documentation>"), {
      filePath: "style-legacy-root.bml",
    });
    const hit = validateStyle(parsed.document!).find(
      (d) => d.code === "BML_STYLE_LEGACY_BLOCK_WRAPPER",
    );
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("warning");
  });

  it("does not warn about the wrapper when the preferred type tag is used", () => {
    const parsed = parse(preferred(), { filePath: "style-type-tag.bml" });
    const diags = validateStyle(parsed.document!);
    expect(diags.some((d) => d.code === "BML_STYLE_LEGACY_BLOCK_WRAPPER")).toBe(false);
    expect(diags.some((d) => d.code === "BML_STYLE_REDUNDANT_TYPE")).toBe(false);
    expect(diags.some((d) => d.code === "BML_STYLE_REDUNDANT_NAME")).toBe(false);
  });

  it("warns when a preferred-form Block still declares type", () => {
    const parsed = parse(
      [
        `<test:Sample xmlns="http://blockml.org/bml"`,
        `  xmlns:core="org.blockml.bml.core"`,
        `  xmlns:test="com.blockml.test.style">`,
        `  <type>test:Sample</type>`,
        `  <baseType>core:Block</baseType>`,
        `  <is>sample</is>`,
        `</test:Sample>`,
      ].join("\n"),
      { filePath: "style-redundant-type.bml" },
    );
    const hit = validateStyle(parsed.document!).find((d) => d.code === "BML_STYLE_REDUNDANT_TYPE");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("warning");
  });

  it("warns when a preferred-form embed still declares type", () => {
    const parsed = parse(
      preferred(
        [
          "  <embeddedBlocks>",
          "    <test:Helper>",
          "      <type>test:Helper</type>",
          "      <baseType>core:Block</baseType>",
          "      <is>embed</is>",
          "    </test:Helper>",
          "  </embeddedBlocks>",
        ].join("\n"),
      ),
      { filePath: "style-redundant-embed-type.bml" },
    );
    const diags = validateStyle(parsed.document!);
    expect(diags.some((d) => d.code === "BML_STYLE_REDUNDANT_TYPE")).toBe(true);
    expect(diags.some((d) => d.code === "BML_STYLE_REDUNDANT_NAME")).toBe(false);
  });

  it("warns when a preferred-form Block still declares name", () => {
    const parsed = parse(
      [
        `<test:Sample xmlns="http://blockml.org/bml"`,
        `  xmlns:core="org.blockml.bml.core"`,
        `  xmlns:test="com.blockml.test.style">`,
        `  <name>Sample</name>`,
        `  <baseType>core:Block</baseType>`,
        `  <is>sample</is>`,
        `</test:Sample>`,
      ].join("\n"),
      { filePath: "style-redundant-name.bml" },
    );
    const hit = validateStyle(parsed.document!).find((d) => d.code === "BML_STYLE_REDUNDANT_NAME");
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe("warning");
  });

  it("warns when a preferred-form Sub-Block still declares name or type", () => {
    const withName = parse(
      preferred(
        [
          "  <subBlocks>",
          "    <Inner>",
          "      <name>Inner</name>",
          "      <baseType>core:Block</baseType>",
          "      <is>inner</is>",
          "    </Inner>",
          "  </subBlocks>",
        ].join("\n"),
      ),
      { filePath: "style-sub-name.bml" },
    );
    expect(
      validateStyle(withName.document!).some((d) => d.code === "BML_STYLE_REDUNDANT_NAME"),
    ).toBe(true);

    const withType = parse(
      preferred(
        [
          "  <subBlocks>",
          "    <Inner>",
          "      <type>test:Sample.Inner</type>",
          "      <baseType>core:Block</baseType>",
          "      <is>inner</is>",
          "    </Inner>",
          "  </subBlocks>",
        ].join("\n"),
      ),
      { filePath: "style-sub-type.bml" },
    );
    const typeDiags = validateStyle(withType.document!);
    expect(typeDiags.some((d) => d.code === "BML_STYLE_REDUNDANT_TYPE")).toBe(true);
    expect(typeDiags.some((d) => d.code === "BML_STYLE_REDUNDANT_NAME")).toBe(false);
  });

  it("does not warn on a preferred-form Sub-Block without name or type", () => {
    const parsed = parse(
      preferred(
        [
          "  <subBlocks>",
          "    <Inner>",
          "      <baseType>core:Block</baseType>",
          "      <is>inner</is>",
          "    </Inner>",
          "  </subBlocks>",
        ].join("\n"),
      ),
      { filePath: "style-sub-ok.bml" },
    );
    const diags = validateStyle(parsed.document!);
    expect(diags.some((d) => d.code === "BML_STYLE_REDUNDANT_NAME")).toBe(false);
    expect(diags.some((d) => d.code === "BML_STYLE_REDUNDANT_TYPE")).toBe(false);
    expect(diags.some((d) => d.code === "BML_STYLE_LEGACY_BLOCK_WRAPPER")).toBe(false);
  });

  it("warns on a nested legacy block wrapper and stays successful", () => {
    const parsed = parse(
      preferred(
        [
          "  <subBlocks>",
          "    <block>",
          "      <name>Inner</name>",
          "      <baseType>core:Block</baseType>",
          "      <is>inner</is>",
          "    </block>",
          "  </subBlocks>",
        ].join("\n"),
      ),
      { filePath: "style-sub-legacy.bml" },
    );
    const diags = validateStyle(parsed.document!);
    expect(diags.some((d) => d.code === "BML_STYLE_LEGACY_BLOCK_WRAPPER")).toBe(true);
    expect(diags.some((d) => d.code === "BML_STYLE_REDUNDANT_NAME")).toBe(false);

    const result = validate(parsed.document!);
    expect(result.success).toBe(true);
    expect(result.diagnostics.some((d) => d.code === "BML_STYLE_LEGACY_BLOCK_WRAPPER")).toBe(true);
  });

  it("warns on unused root xmlns prefixes and stays successful", () => {
    const parsed = parse(
      [
        `<test:Sample xmlns="http://blockml.org/bml"`,
        `  xmlns:core="org.blockml.bml.core"`,
        `  xmlns:idle="org.blockml.bml.idle"`,
        `  xmlns:test="com.blockml.test.style">`,
        `  <baseType>core:Block</baseType>`,
        `  <is>sample</is>`,
        `  <version>1.0.0</version>`,
        `</test:Sample>`,
      ].join("\n"),
      { filePath: "style-unused-xmlns.bml" },
    );
    expect(parsed.document).not.toBeNull();
    const diags = validateStyle(parsed.document!);
    const unused = diags.filter((d) => d.code === "BML_STYLE_UNUSED_NAMESPACE");
    expect(unused).toHaveLength(1);
    expect(unused[0]?.severity).toBe("warning");
    expect(unused[0]?.message).toContain("'idle'");
    expect(unused[0]?.source.line).toBe(1);
    expect(unused[0]?.source.column).toBe(1);
    expect(unused[0]?.source.endLine).toBeUndefined();
    expect(unused[0]?.source.endColumn).toBeUndefined();

    const result = validate(parsed.document!);
    expect(result.success).toBe(true);
    expect(result.diagnostics.some((d) => d.code === "BML_STYLE_UNUSED_NAMESPACE")).toBe(true);
  });

  it("does not warn when every xmlns prefix is used", () => {
    const parsed = parse(preferred(), { filePath: "style-used-xmlns.bml" });
    expect(
      validateStyle(parsed.document!).some((d) => d.code === "BML_STYLE_UNUSED_NAMESPACE"),
    ).toBe(false);
  });

  it("does not treat implicit see relation or default documentation language as prefix use", () => {
    const parsed = parse(
      [
        `<test:Sample xmlns="http://blockml.org/bml"`,
        `  xmlns:blockml="org.blockml.bml"`,
        `  xmlns:core="org.blockml.bml.core"`,
        `  xmlns:test="com.blockml.test.style">`,
        `  <baseType>core:Block</baseType>`,
        `  <is>sample</is>`,
        `  <version>1.0.0</version>`,
        `  <documentation>A short note.</documentation>`,
        `  <references>`,
        `    <see type="core:Block" relation="SeeAlso" />`,
        `  </references>`,
        `</test:Sample>`,
      ].join("\n"),
      { filePath: "style-implicit-blockml-xmlns.bml" },
    );
    expect(parsed.document).not.toBeNull();
    const unused = validateStyle(parsed.document!).filter(
      (d) => d.code === "BML_STYLE_UNUSED_NAMESPACE",
    );
    expect(unused.map((d) => d.message)).toEqual(["Unused xmlns prefix 'blockml'."]);
  });

  it("keeps blockml used when a language element is written with that prefix", () => {
    const parsed = parse(
      [
        `<test:Sample xmlns="http://blockml.org/bml"`,
        `  xmlns:blockml="org.blockml.bml"`,
        `  xmlns:core="org.blockml.bml.core"`,
        `  xmlns:test="com.blockml.test.style">`,
        `  <baseType>core:Block</baseType>`,
        `  <is>sample</is>`,
        `  <version>1.0.0</version>`,
        `  <language>`,
        `    <blockml:language.English />`,
        `  </language>`,
        `</test:Sample>`,
      ].join("\n"),
      { filePath: "style-blockml-language-used.bml" },
    );
    expect(parsed.document).not.toBeNull();
    const unused = validateStyle(parsed.document!).filter(
      (d) => d.code === "BML_STYLE_UNUSED_NAMESPACE",
    );
    expect(unused.some((d) => d.message.includes("'blockml'"))).toBe(false);
  });

  it("credits ann:BmlAnnotation to ann, not the nested bml type binding", () => {
    const parsed = parse(
      [
        `<blockml:Library xmlns="http://blockml.org/bml"`,
        `  xmlns:blockml="org.blockml.bml"`,
        `  xmlns:ann="org.blockml.bml.annotation"`,
        `  xmlns:bml="org.blockml.bml.annotation.BmlAnnotation"`,
        `  xmlns:core="org.blockml.bml.core">`,
        `  <baseType>core:BlockLibrary</baseType>`,
        `  <is>catalog</is>`,
        `  <version>1.0.0</version>`,
        `  <aggregations>`,
        `    <blocks override="true">`,
        `      <composition>`,
        `        <core:Block />`,
        `        <ann:BmlAnnotation />`,
        `      </composition>`,
        `    </blocks>`,
        `  </aggregations>`,
        `</blockml:Library>`,
      ].join("\n"),
      { filePath: "style-ann-not-bml-xmlns.bml" },
    );
    expect(parsed.document).not.toBeNull();
    const unused = validateStyle(parsed.document!).filter(
      (d) => d.code === "BML_STYLE_UNUSED_NAMESPACE",
    );
    expect(unused.map((d) => d.message)).toEqual(["Unused xmlns prefix 'bml'."]);
  });

  it("keeps bml used when a bml:* attribute is authored beside ann:BmlAnnotation", () => {
    const parsed = parse(
      [
        `<blockml:Library xmlns="http://blockml.org/bml"`,
        `  xmlns:blockml="org.blockml.bml"`,
        `  xmlns:ann="org.blockml.bml.annotation"`,
        `  xmlns:bml="org.blockml.bml.annotation.BmlAnnotation"`,
        `  xmlns:core="org.blockml.bml.core">`,
        `  <baseType>core:BlockLibrary</baseType>`,
        `  <is>catalog</is>`,
        `  <version>1.0.0</version>`,
        `  <aggregations>`,
        `    <blocks override="true">`,
        `      <composition>`,
        `        <core:Block bml:version="1.0.0" />`,
        `        <ann:BmlAnnotation />`,
        `      </composition>`,
        `    </blocks>`,
        `  </aggregations>`,
        `</blockml:Library>`,
      ].join("\n"),
      { filePath: "style-ann-and-bml-xmlns.bml" },
    );
    expect(parsed.document).not.toBeNull();
    const unused = validateStyle(parsed.document!).filter(
      (d) => d.code === "BML_STYLE_UNUSED_NAMESPACE",
    );
    expect(unused).toEqual([]);
  });

  it("keeps a prefix used as a TypeIdentifier property value", () => {
    const parsed = parse(
      [
        `<test:Sample xmlns="http://blockml.org/bml"`,
        `  xmlns:core="org.blockml.bml.core"`,
        `  xmlns:type="org.blockml.bml.type"`,
        `  xmlns:test="com.blockml.test.style">`,
        `  <baseType>core:Block</baseType>`,
        `  <is>sample</is>`,
        `  <version>1.0.0</version>`,
        `  <properties>`,
        `    <minted type="type:TypeIdentifier">`,
        `      <value>core:Block</value>`,
        `    </minted>`,
        `  </properties>`,
        `</test:Sample>`,
      ].join("\n"),
      { filePath: "style-type-identifier-property.bml" },
    );
    expect(parsed.document).not.toBeNull();
    const unused = validateStyle(parsed.document!).filter(
      (d) => d.code === "BML_STYLE_UNUSED_NAMESPACE",
    );
    expect(unused).toEqual([]);
  });

  it("keeps a prefix used as a TypeReference property value", () => {
    const parsed = parse(
      [
        `<test:Sample xmlns="http://blockml.org/bml"`,
        `  xmlns:core="org.blockml.bml.core"`,
        `  xmlns:type="org.blockml.bml.type"`,
        `  xmlns:test="com.blockml.test.style">`,
        `  <baseType>core:Block</baseType>`,
        `  <is>sample</is>`,
        `  <version>1.0.0</version>`,
        `  <properties>`,
        `    <target type="type:TypeReference">`,
        `      <value>core:Documentation</value>`,
        `    </target>`,
        `  </properties>`,
        `</test:Sample>`,
      ].join("\n"),
      { filePath: "style-type-reference-property.bml" },
    );
    expect(parsed.document).not.toBeNull();
    const unused = validateStyle(parsed.document!).filter(
      (d) => d.code === "BML_STYLE_UNUSED_NAMESPACE",
    );
    expect(unused).toEqual([]);
  });

  it("keeps nested prefixes inside a TypeReference TypeExpression value", () => {
    const parsed = parse(
      [
        `<test:Sample xmlns="http://blockml.org/bml"`,
        `  xmlns:core="org.blockml.bml.core"`,
        `  xmlns:type="org.blockml.bml.type"`,
        `  xmlns:test="com.blockml.test.style">`,
        `  <baseType>core:Block</baseType>`,
        `  <is>sample</is>`,
        `  <version>1.0.0</version>`,
        `  <properties>`,
        `    <target type="type:TypeReference">`,
        `      <value>type:TypeReference(core:Block)</value>`,
        `    </target>`,
        `  </properties>`,
        `</test:Sample>`,
      ].join("\n"),
      { filePath: "style-type-reference-nested.bml" },
    );
    expect(parsed.document).not.toBeNull();
    const unused = validateStyle(parsed.document!).filter(
      (d) => d.code === "BML_STYLE_UNUSED_NAMESPACE",
    );
    expect(unused).toEqual([]);
  });

  it("keeps a prefix used as a TypeSelectorEntity instance value", () => {
    const parsed = parse(
      [
        `<test:Sample xmlns="http://blockml.org/bml"`,
        `  xmlns:core="org.blockml.bml.core"`,
        `  xmlns:type="org.blockml.bml.type"`,
        `  xmlns:test="com.blockml.test.style">`,
        `  <baseType>core:Block</baseType>`,
        `  <is>sample</is>`,
        `  <version>1.0.0</version>`,
        `  <aggregations>`,
        `    <includedTypes type="type:TypeSelectorEntity[]">`,
        `      <composition>`,
        `        <type:TypeSelectorEntity value="core:Block" />`,
        `      </composition>`,
        `    </includedTypes>`,
        `  </aggregations>`,
        `</test:Sample>`,
      ].join("\n"),
      { filePath: "style-type-selector-entity.bml" },
    );
    expect(parsed.document).not.toBeNull();
    const unused = validateStyle(parsed.document!).filter(
      (d) => d.code === "BML_STYLE_UNUSED_NAMESPACE",
    );
    expect(unused).toEqual([]);
  });

  it("does not treat a QName mentioned only in documentation prose as prefix use", () => {
    const parsed = parse(
      [
        `<test:Sample xmlns="http://blockml.org/bml"`,
        `  xmlns:core="org.blockml.bml.core"`,
        `  xmlns:idle="org.blockml.bml.idle"`,
        `  xmlns:test="com.blockml.test.style">`,
        `  <baseType>core:Block</baseType>`,
        `  <is>sample</is>`,
        `  <version>1.0.0</version>`,
        `  <documentation>See idle:Unused as an example of unused prefix.</documentation>`,
        `</test:Sample>`,
      ].join("\n"),
      { filePath: "style-qname-in-docs.bml" },
    );
    expect(parsed.document).not.toBeNull();
    const unused = validateStyle(parsed.document!).filter(
      (d) => d.code === "BML_STYLE_UNUSED_NAMESPACE",
    );
    expect(unused.map((d) => d.message)).toEqual(["Unused xmlns prefix 'idle'."]);
  });

  it("does not treat the default xmlns as unused", () => {
    const parsed = parse(
      [
        `<block xmlns="http://blockml.org/bml"`,
        `  xmlns:core="org.blockml.bml.core"`,
        `  xmlns:test="com.blockml.test.style">`,
        `  <name>Sample</name>`,
        `  <type>test:Sample</type>`,
        `  <baseType>core:Block</baseType>`,
        `  <is>sample</is>`,
        `  <version>1.0.0</version>`,
        `</block>`,
      ].join("\n"),
      { filePath: "style-default-xmlns.bml" },
    );
    const unused = validateStyle(parsed.document!).filter(
      (d) => d.code === "BML_STYLE_UNUSED_NAMESPACE",
    );
    expect(unused).toEqual([]);
  });
});
