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
});
