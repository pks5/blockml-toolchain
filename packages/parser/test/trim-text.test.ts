import { describe, expect, it } from "vitest";
import { parse } from "../src/parse.js";
import { serialize } from "../../serializer/src/serialize.js";
import { trimText } from "../src/util/xml.js";

function sample(documentation: string): string {
  return [
    '<block xmlns="http://blockml.org/bml"',
    ' xmlns:core="org.blockml.bml.core"',
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

  it("does not strip when any non-empty line has no indent", () => {
    expect(trimText("Hello,\n    indented")).toBe("Hello,\n    indented");
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
});
