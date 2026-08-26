import { describe, expect, it } from "vitest";
import { parse } from "../src/parse.js";

function sample(body: string): string {
  return [
    `<block xmlns="http://blockml.org/bml"`,
    `  xmlns:core="org.blockml.bml.core"`,
    `  xmlns:test="com.blockml.test.see">`,
    `  <name>Sample</name>`,
    `  <type>test:Sample</type>`,
    `  <baseType>core:Block</baseType>`,
    `  <is>sample</is>`,
    body,
    `</block>`,
  ].join("\n");
}

describe("authoredEmptyElementForm on see references", () => {
  it("records paired vs self-closing empty see tags", () => {
    const source = sample(`  <references>
    <see type="core:Block" relation="SeeAlso"></see>
    <see type="core:Entity" relation="SeeAlso" />
  </references>`);
    const result = parse(source, { filePath: "see-form.bml" });
    expect(result.document).not.toBeNull();
    const refs = result.document!.block.references ?? [];
    expect(refs).toHaveLength(2);
    expect(refs[0]!.context).toBe("");
    expect(refs[0]!.authoredEmptyElementForm).toBe("paired");
    expect(refs[1]!.authoredEmptyElementForm).toBe("selfClosing");
  });
});
