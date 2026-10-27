import { describe, expect, it } from "vitest";
import { createMapContext } from "../src/map/context.js";
import { parseMemberValue } from "../src/map/member-value.js";

describe("parseMemberValue interpolation", () => {
  it("classifies a whole ${ } value as ExpressionValue", () => {
    const val = parseMemberValue("${ this.label }", "type:Text", "t.bml");
    expect(val).toMatchObject({ kind: "expression", raw: "this.label" });
  });

  it("classifies mixed text with ${ } as InterpolatedTextValue", () => {
    const raw = "Hello this is ${ #this.label } bla bla";
    const val = parseMemberValue(raw, "type:Text", "t.bml", 1, 1, "attribute");
    expect(val).toMatchObject({
      kind: "interpolated",
      raw,
      authoredPlacement: "attribute",
    });
  });

  it("unescapes \\${ into a literal ${", () => {
    const val = parseMemberValue("Cost is \\${ amount }", "type:Text", "t.bml");
    expect(val).toMatchObject({ kind: "literal", value: "Cost is ${ amount }" });
  });

  it("treats a whole \\${ } value as a literal delimiter pair", () => {
    const val = parseMemberValue("\\${ }", "type:Text", "t.bml");
    expect(val).toMatchObject({ kind: "literal", value: "${ }" });
  });

  it("classifies \\\\${ as interpolation after a literal backslash", () => {
    const raw = "Show \\\\${ #this.label }";
    const val = parseMemberValue(raw, "type:Text", "t.bml");
    expect(val).toMatchObject({ kind: "interpolated", raw });
  });

  it("keeps a JSON array with ${ inside string elements as a literal", () => {
    const raw = '["validate", "${ #this.parameters.mode }"]';
    const val = parseMemberValue(raw, "type:Text[]", "t.bml");
    expect(val?.kind).toBe("literal");
    if (val?.kind !== "literal") {
      return;
    }
    expect(val.value).toEqual(["validate", "${ #this.parameters.mode }"]);
  });

  it("classifies mixed escaped and unescaped ${ as interpolated", () => {
    const raw = "Show \\${ and ${ #this.label }";
    const val = parseMemberValue(raw, "type:Text", "t.bml");
    expect(val).toMatchObject({ kind: "interpolated", raw });
  });
});

describe("parseMemberValue host hook", () => {
  it("uses the hook instead of the number heuristic and reports BML_INVALID_VALUE", () => {
    const ctx = createMapContext("t.bml", "", {}, { diagnostics: [] });
    ctx.parseValue = (typeFqn, raw) => {
      expect(typeFqn).toBe("org.blockml.bml.type.Integer");
      if (raw === "1.5") {
        return { ok: false, message: "not a whole number: 1.5" };
      }
      return { ok: true, value: Number(raw) };
    };

    const val = parseMemberValue(
      "1.5",
      "org.blockml.bml.type.Integer",
      "t.bml",
      2,
      4,
      "attribute",
      ctx,
    );
    expect(val).toMatchObject({
      kind: "literal",
      value: "1.5",
      typeFqn: "org.blockml.bml.type.Integer",
    });
    expect(ctx.diagnostics).toEqual([
      expect.objectContaining({
        code: "BML_INVALID_VALUE",
        message: "not a whole number: 1.5",
        source: expect.objectContaining({ file: "t.bml", line: 2, column: 4 }),
      }),
    ]);
  });

  it("stores the host value when the hook succeeds", () => {
    const ctx = createMapContext("t.bml", "", {}, { diagnostics: [] });
    ctx.parseValue = (_typeFqn, raw) => ({ ok: true, value: Number(raw) });
    const val = parseMemberValue("42", "org.blockml.bml.type.Integer", "t.bml", 1, 1, undefined, ctx);
    expect(val).toMatchObject({ kind: "literal", value: 42 });
    expect(ctx.diagnostics).toEqual([]);
  });

  it("keeps number and boolean heuristics when the type FQN is empty", () => {
    const ctx = createMapContext("t.bml", "", {}, { diagnostics: [] });
    ctx.parseValue = () => ({ ok: true, skipped: true });
    const numberVal = parseMemberValue("7", "", "t.bml", 1, 1, undefined, ctx);
    const boolVal = parseMemberValue("true", "", "t.bml", 1, 1, undefined, ctx);
    expect(numberVal).toMatchObject({ kind: "literal", value: 7 });
    expect(boolVal).toMatchObject({ kind: "literal", value: true });
  });

  it("keeps authored text when the hook skips — no boolean or number heuristic", () => {
    const ctx = createMapContext("t.bml", "", {}, { diagnostics: [] });
    ctx.parseValue = () => ({ ok: true, skipped: true });
    const numberVal = parseMemberValue("42", "org.blockml.bml.type.Integer", "t.bml", 1, 1, undefined, ctx);
    const boolVal = parseMemberValue("true", "org.blockml.bml.type.Boolean", "t.bml", 1, 1, undefined, ctx);
    expect(numberVal).toMatchObject({ kind: "literal", value: "42" });
    expect(boolVal).toMatchObject({ kind: "literal", value: "true" });
    expect(ctx.diagnostics).toEqual([]);
  });
});
