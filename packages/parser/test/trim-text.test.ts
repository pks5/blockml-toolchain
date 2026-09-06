import { describe, expect, it } from "vitest";
import { parse } from "../src/parse.js";
import { serialize } from "../../serializer/src/serialize.js";
import { trimText } from "../src/util/xml.js";

function sample(documentation: string): string {
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
    ' xmlns:type="org.blockml.bml.type"',
    ' xmlns:test="com.blockml.test.struct">',
    "  <name>Sample</name>",
    "  <type>test:Sample</type>",
    "  <baseType>core:Block</baseType>",
    "  <is>sample</is>",
    documentation,
    "</block>",
  ].join("\n");
}

describe("trimText", () => {
  it("strips the common leading indent from every non-empty line", () => {
    expect(
      trimText("\n    Hello,\n    this is a test.\n        - but this is intended\n"),
    ).toBe("Hello,\nthis is a test.\n    - but this is intended");
  });

  it("excludes a first line glued to the opening tag from the prefix", () => {
    expect(trimText("Hello,\n    indented")).toBe("Hello,\nindented");
  });

  it("counts the first line when it has leading whitespace on the same line", () => {
    expect(trimText("    Hello,\n    indented")).toBe("Hello,\nindented");
    expect(trimText("    Hello,\n        list")).toBe("Hello,\n    list");
  });

  it("ignores a whitespace-only first line like any blank line", () => {
    expect(trimText("   \n    Hello,\n    world")).toBe("Hello,\nworld");
  });

  it("ignores blank lines when computing the common prefix", () => {
    expect(trimText("    a\n\n    b")).toBe("a\n\nb");
  });

  it("trims a single-line value", () => {
    expect(trimText("  hello  ")).toBe("hello");
  });
});

describe("documentation prose indent", () => {
  it("stores dedented documentation on the BOM", () => {
    const source = sample(
      [
        "  <documentation>",
        "    Hello,",
        "    this is a test.",
        "        - but this is intended",
        "  </documentation>",
      ].join("\n"),
    );
    const result = parse(source, { filePath: "doc-indent.bml", continueOnError: true });
    expect(result.document).not.toBeNull();
    expect(result.document!.block.documentations?.[0]?.text).toBe(
      "Hello,\nthis is a test.\n    - but this is intended",
    );
  });

  it("round-trips dedented documentation through serialize", () => {
    const source = sample(
      [
        "  <documentation>",
        "    Hello,",
        "    this is a test.",
        "        - but this is intended",
        "  </documentation>",
      ].join("\n"),
    );
    const first = parse(source, { filePath: "doc-indent-roundtrip.bml", continueOnError: true });
    expect(first.document).not.toBeNull();
    const ser = serialize(first.document!);
    expect(ser.success).toBe(true);
    expect(ser.text).toContain("    Hello,");
    expect(ser.text).toContain("    this is a test.");
    expect(ser.text).toContain("        - but this is intended");
    const second = parse(ser.text!, {
      filePath: "doc-indent-roundtrip.bml",
      continueOnError: true,
    });
    expect(second.document!.block.documentations?.[0]?.text).toBe(
      first.document!.block.documentations?.[0]?.text,
    );
  });

  it("dedents member documentation glued to the opening tag", () => {
    const source = sample(
      [
        "  <properties>",
        '    <label type="type:Text">',
        "      <documentation>Human-readable summary. Public readOnly —",
        "        inspectable from foreign Blocks.</documentation>",
        "    </label>",
        "  </properties>",
      ].join("\n"),
    );
    const result = parse(source, { filePath: "member-doc-indent.bml", continueOnError: true });
    const label = result.document!.block.members.find((m) => m.name === "label");
    expect(label?.documentations?.[0]?.text).toBe(
      "Human-readable summary. Public readOnly —\ninspectable from foreign Blocks.",
    );
  });
});
