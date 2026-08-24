import { describe, expect, it } from "vitest";
import { parseTypeExpression } from "../../parser/src/map/type-expression.js";
import { emitTypeExpression } from "../src/emit/type-expression.js";

const BINDINGS = {
  core: "org.blockml.bml.core",
  type: "org.blockml.bml.type",
};

describe("emitTypeExpression grouped", () => {
  it("round-trips (core:ValueType[])[]", () => {
    const parsed = parseTypeExpression("(core:ValueType[])[]", BINDINGS);
    expect(parsed.kind).toBe("grouped");
    const emitted = emitTypeExpression(parsed, BINDINGS, true);
    expect(emitted).toBe("(core:ValueType[])[]");
    const reparsed = parseTypeExpression(emitted, BINDINGS);
    expect(reparsed).toEqual(parsed);
  });

  it("emits parentheses around a union with outer multiplicity", () => {
    const parsed = parseTypeExpression("(Integer | Text)[]", BINDINGS);
    expect(parsed.kind).toBe("grouped");
    const emitted = emitTypeExpression(parsed, BINDINGS, true);
    expect(emitted).toBe("(type:Integer | type:Text)[]");
  });
});
