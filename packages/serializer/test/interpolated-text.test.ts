import { describe, expect, it } from "vitest";
import type { InterpolatedTextValue } from "@blockml/bom";
import { parseMemberValue } from "../../parser/src/map/member-value.js";
import { serialize } from "../src/serialize.js";
import { parse } from "@blockml/parser";

describe("interpolated text emit", () => {
  it("round-trips an interpolated attribute", () => {
    const raw = "Hello this is ${ #this.label } bla bla";
    const source = [
      `<block xmlns="http://blockml.org/bml"`,
      ` xmlns:core="org.blockml.bml.core"`,
      ` xmlns:type="org.blockml.bml.type"`,
      ` xmlns:test="com.blockml.test.interp">`,
      `  <name>Sample</name>`,
      `  <type>test:Sample</type>`,
      `  <baseType>core:Block</baseType>`,
      `  <is>sample</is>`,
      `  <properties>`,
      `    <title type="type:Text">`,
      `      <value>${raw}</value>`,
      `    </title>`,
      `  </properties>`,
      `</block>`,
    ].join("\n");
    const parsed = parse(source, { filePath: "interp.bml" });
    expect(parsed.document).not.toBeNull();
    const title = parsed.document!.block.members.find((m) => m.name === "title");
    expect(title?.kind).toBe("property");
    if (title?.kind !== "property") {
      return;
    }
    expect(title.value).toMatchObject({ kind: "interpolated", raw });
    const emitted = serialize(parsed.document!);
    expect(emitted.text).toContain(raw);
    expect(emitted.text).not.toContain("${ ${");
  });
});

describe("literal ${ emit", () => {
  it("re-escapes a stored literal ${ so parse stays a literal", () => {
    const source = [
      '<block xmlns="http://blockml.org/bml"',
      ' xmlns:core="org.blockml.bml.core"',
      ' xmlns:type="org.blockml.bml.type"',
      ' xmlns:test="com.blockml.test.interp">',
      "  <name>Sample</name>",
      "  <type>test:Sample</type>",
      "  <baseType>core:Block</baseType>",
      "  <is>sample</is>",
      "  <properties>",
      '    <title type="type:Text">',
      "      <value>\\${ }</value>",
      "    </title>",
      "  </properties>",
      "</block>",
    ].join("\n");
    const parsed = parse(source, { filePath: "literal-dollar.bml" });
    expect(parsed.document).not.toBeNull();
    const title = parsed.document!.block.members.find((m) => m.name === "title");
    expect(title?.kind).toBe("property");
    if (title?.kind !== "property") {
      return;
    }
    expect(title.value).toMatchObject({ kind: "literal", value: "${ }" });
    const emitted = serialize(parsed.document!);
    expect(emitted.text).toContain("\\${ }");
    const again = parse(emitted.text, { filePath: "literal-dollar.bml" });
    const title2 = again.document!.block.members.find((m) => m.name === "title");
    if (title2?.kind !== "property") {
      return;
    }
    expect(title2.value).toMatchObject({ kind: "literal", value: "${ }" });
  });
});

describe("parseMemberValue used by serializer emit helpers", () => {
  it("keeps interpolated raw for attribute emission", () => {
    const val = parseMemberValue(
      "Hello ${ #this.label }",
      "org.blockml.bml.type.Text",
      "t.bml",
      1,
      1,
      "attribute",
    ) as InterpolatedTextValue;
    expect(val.kind).toBe("interpolated");
    expect(val.raw).toBe("Hello ${ #this.label }");
  });
});
