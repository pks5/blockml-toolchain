import { describe, expect, it } from "vitest";
import { parse } from "@blockml/parser";
import { serialize } from "../src/serialize.js";

describe("empty see emit", () => {
  it("emits self-closing see when context is empty", () => {
    const source = `<block xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:test="com.blockml.test.see">
  <name>Sample</name>
  <type>test:Sample</type>
  <baseType>core:Block</baseType>
  <is>sample</is>
  <references>
    <see type="core:Block" relation="SeeAlso"></see>
  </references>
</block>`;
    const parsed = parse(source, { filePath: "empty-see.bml" });
    expect(parsed.document).not.toBeNull();
    const result = serialize(parsed.document!);
    expect(result.text).toBeTruthy();
    expect(result.text).toMatch(/<see\b[^>]*\/>/);
    expect(result.text).not.toMatch(/<see\b[^>]*>\s*<\/see>/);
  });
});
