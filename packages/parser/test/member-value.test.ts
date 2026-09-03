import { describe, expect, it } from "vitest";
import { parseMemberValue } from "../src/map/member-value.js";

describe("parseMemberValue interpolation", () => {
  it("classifies a whole ${ } value as ExpressionValue", () => {
    const val = parseMemberValue("${ this.label }", "type:Text", "t.bml");
    expect(val).toMatchObject({ kind: "expression", raw: "this.label" });
  });

  it("classifies mixed text with ${ } as InterpolatedTextValue", () => {
    const raw = "Hello this is ${ this.label } bla bla";
    const val = parseMemberValue(raw, "type:Text", "t.bml", 1, 1, "attribute");
    expect(val).toMatchObject({
      kind: "interpolated",
      raw,
      authoredPlacement: "attribute",
    });
  });

  it("keeps escaped \\${ as a literal", () => {
    const raw = "Cost is \\${ amount }";
    const val = parseMemberValue(raw, "type:Text", "t.bml");
    expect(val).toMatchObject({ kind: "literal", value: raw });
  });

  it("keeps a JSON array with ${ inside string elements as a literal", () => {
    const raw = '["validate", "${ this.parameters.mode }"]';
    const val = parseMemberValue(raw, "type:Text[]", "t.bml");
    expect(val?.kind).toBe("literal");
    if (val?.kind !== "literal") {
      return;
    }
    expect(val.value).toEqual(["validate", "${ this.parameters.mode }"]);
  });

  it("classifies mixed escaped and unescaped ${ as interpolated", () => {
    const raw = "Show \\${ and ${ this.label }";
    const val = parseMemberValue(raw, "type:Text", "t.bml");
    expect(val).toMatchObject({ kind: "interpolated", raw });
  });
});
