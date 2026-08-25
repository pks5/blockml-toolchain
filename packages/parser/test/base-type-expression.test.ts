import { describe, expect, it } from "vitest";
import { parse } from "../src/parse.js";
import { serialize } from "@blockml/serializer";

const SOURCE = [
  '<block xmlns="http://blockml.org/bml"',
  ' xmlns:core="org.blockml.bml.core"',
  ' xmlns:type="org.blockml.bml.type"',
  ' xmlns:test="com.blockml.test.basetype">',
  "  <name>Flag</name>",
  "  <type>test:Flag</type>",
  "  <baseType>type:Constant(type:Boolean){true}</baseType>",
  "  <is>a bound constant</is>",
  "</block>",
].join("\n");

describe("baseType type expression", () => {
  it("keeps generic arguments and instance configuration on baseTypeExpression", () => {
    const result = parse(SOURCE, { filePath: "flag.bml" });
    expect(result.success, JSON.stringify(result.diagnostics)).toBe(true);
    expect(result.document).not.toBeNull();
    const block = result.document!.block;
    expect(block.baseType).toBe("org.blockml.bml.type.Constant");
    expect(block.baseTypeExpression?.kind).toBe("named");
    if (block.baseTypeExpression?.kind !== "named") {
      return;
    }
    expect(block.baseTypeExpression.typeArguments).toHaveLength(1);
    const arg = block.baseTypeExpression.typeArguments![0];
    expect(arg?.kind).toBe("named");
    if (arg?.kind === "named") {
      expect(arg.fqn).toBe("org.blockml.bml.type.Boolean");
    }
    expect(block.baseTypeExpression.instanceConfiguration?.positional?.[0]).toMatchObject({
      kind: "literal",
      value: true,
    });
  });

  it("round-trips baseType instance configuration", () => {
    const parsed = parse(SOURCE, { filePath: "flag.bml" });
    expect(parsed.document).not.toBeNull();
    const ser = serialize(parsed.document!);
    expect(ser.success, JSON.stringify(ser.diagnostics)).toBe(true);
    expect(ser.text).toContain("{");
    expect(ser.text).toMatch(/true/);
    const second = parse(ser.text!, { filePath: "flag.bml" });
    expect(second.document).not.toBeNull();
    const expr = second.document!.block.baseTypeExpression;
    expect(expr?.kind).toBe("named");
    if (expr?.kind === "named") {
      expect(expr.instanceConfiguration?.positional?.[0]).toMatchObject({
        kind: "literal",
        value: true,
      });
    }
  });
});
