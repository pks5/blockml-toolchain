import { describe, expect, it } from "vitest";
import { parseTypeExpression, typeExpressionToString } from "../src/map/type-expression.js";

const BINDINGS = {
  lang: "org.blockml.bml.language",
  type: "org.blockml.bml.type",
  core: "org.blockml.bml.core",
};

describe("parseTypeExpression", () => {
  it("parses TypeReference with a nested union argument", () => {
    const expr = parseTypeExpression(
      "TypeReference(lang:Markdown(lang:NaturalLanguage) | lang:NaturalLanguage)",
      BINDINGS,
    );
    expect(expr.kind).toBe("named");
    if (expr.kind !== "named") {
      return;
    }
    expect(expr.fqn).toBe("org.blockml.bml.type.TypeReference");
    expect(expr.typeArguments).toHaveLength(1);
    const arg = expr.typeArguments![0]!;
    expect(arg.kind).toBe("union");
    if (arg.kind !== "union") {
      return;
    }
    expect(arg.alternatives).toHaveLength(2);
    expect(arg.alternatives[0]?.kind).toBe("named");
    expect(arg.alternatives[1]?.kind).toBe("named");
    if (arg.alternatives[0]?.kind === "named") {
      expect(arg.alternatives[0].fqn).toBe("org.blockml.bml.language.Markdown");
      expect(arg.alternatives[0].typeArguments?.[0]?.kind).toBe("named");
    }
    if (arg.alternatives[1]?.kind === "named") {
      expect(arg.alternatives[1].fqn).toBe("org.blockml.bml.language.NaturalLanguage");
    }
  });

  it("parses grouped nested multiplicity (core:ValueType[])[]", () => {
    const expr = parseTypeExpression("(core:ValueType[])[]", BINDINGS);
    expect(expr.kind).toBe("grouped");
    if (expr.kind !== "grouped") {
      return;
    }
    expect(expr.multiplicity).toEqual({ min: 0, max: "*" });
    expect(expr.expression.kind).toBe("named");
    if (expr.expression.kind !== "named") {
      return;
    }
    expect(expr.expression.fqn).toBe("org.blockml.bml.core.ValueType");
    expect(expr.expression.multiplicity).toEqual({ min: 0, max: "*" });
  });

  it("parses qualified types inside anonymous structs", () => {
    const expr = parseTypeExpression(
      "{ list: core:ValueType[], index: Integer }",
      BINDINGS,
    );
    expect(expr.kind).toBe("anonymousStruct");
    if (expr.kind !== "anonymousStruct") {
      return;
    }
    expect(expr.fields).toHaveLength(2);
    expect(expr.fields[0]?.name).toBe("list");
    expect(expr.fields[0]?.type.kind).toBe("named");
    if (expr.fields[0]?.type.kind === "named") {
      expect(expr.fields[0].type.fqn).toBe("org.blockml.bml.core.ValueType");
      expect(expr.fields[0].type.multiplicity).toEqual({ min: 0, max: "*" });
    }
    expect(expr.fields[1]?.name).toBe("index");
    if (expr.fields[1]?.type.kind === "named") {
      expect(expr.fields[1].type.fqn).toBe("org.blockml.bml.type.Integer");
    }
  });

  it("rejects ungrouped stacked multiplicity Integer[][]", () => {
    expect(() => parseTypeExpression("Integer[][]", BINDINGS)).toThrow(
      /BML_INVALID_TYPE_REFERENCE/,
    );
  });

  it("binds postfix tighter than union in Integer | Text[]", () => {
    const expr = parseTypeExpression("Integer | Text[]", BINDINGS);
    expect(expr.kind).toBe("union");
    if (expr.kind !== "union") {
      return;
    }
    expect(expr.alternatives).toHaveLength(2);
    expect(expr.alternatives[0]?.kind).toBe("named");
    if (expr.alternatives[0]?.kind === "named") {
      expect(expr.alternatives[0].fqn).toBe("org.blockml.bml.type.Integer");
      expect(expr.alternatives[0].multiplicity).toBeUndefined();
    }
    expect(expr.alternatives[1]?.kind).toBe("named");
    if (expr.alternatives[1]?.kind === "named") {
      expect(expr.alternatives[1].fqn).toBe("org.blockml.bml.type.Text");
      expect(expr.alternatives[1].multiplicity).toEqual({ min: 0, max: "*" });
    }
  });

  it("stringifies grouped nested multiplicity with parentheses", () => {
    const expr = parseTypeExpression("(core:ValueType[])[]", BINDINGS);
    expect(typeExpressionToString(expr)).toBe(
      "(org.blockml.bml.core.ValueType[])[]",
    );
  });

  it("does not treat Boolean.False as a raw FQN", () => {
    const expr = parseTypeExpression("Boolean.False | core:Block[]", BINDINGS);
    expect(expr.kind).toBe("union");
    if (expr.kind !== "union") {
      return;
    }
    expect(expr.alternatives[0]?.kind).toBe("named");
    if (expr.alternatives[0]?.kind === "named") {
      expect(expr.alternatives[0].fqn).toBe("org.blockml.bml.type.Boolean");
    }
  });

  it("resolves unqualified names via subBlockIndex and currentTypeFqn", () => {
    const nested = parseTypeExpression("Utils", BINDINGS, "type", {
      subBlockIndex: new Map([
        ["Utils", "com.machineblocks.bml.calibration.Calibrator.Utils"],
      ]),
    });
    expect(nested.kind).toBe("named");
    if (nested.kind === "named") {
      expect(nested.fqn).toBe("com.machineblocks.bml.calibration.Calibrator.Utils");
    }

    const self = parseTypeExpression("NativeBlock[]", BINDINGS, "type", {
      currentTypeFqn: "com.machineblocks.bml.core.NativeBlock",
    });
    expect(self.kind).toBe("named");
    if (self.kind === "named") {
      expect(self.fqn).toBe("com.machineblocks.bml.core.NativeBlock");
      expect(self.multiplicity).toEqual({ min: 0, max: "*" });
    }
  });
});
