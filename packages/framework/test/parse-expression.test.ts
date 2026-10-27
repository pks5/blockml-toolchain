import { describe, expect, it } from "vitest";
import {
  evaluateExpression,
  evaluateInterpolatedText,
  parseExpression,
  type ExpressionNode,
} from "../src/index.js";

describe("parseExpression V1 subset", () => {
  const cases: Array<{ raw: string; kind: string }> = [
    { raw: "true", kind: "literal" },
    { raw: "42", kind: "literal" },
    { raw: '"hello"', kind: "literal" },
    { raw: "size.y", kind: "property" },
    { raw: "brick1SizeY", kind: "property" },
    { raw: "[1, 2, 3]", kind: "array" },
    {
      raw: "[#math.max(2 * numberOfSamples + 1, labelSize), 12, 2]",
      kind: "array",
    },
    { raw: "#math.min(a, b)", kind: "call" },
    { raw: "#math.floor(x)", kind: "call" },
    { raw: "@utils.formatValue(v)", kind: "call" },
    { raw: "@bean.render()", kind: "call" },
    { raw: '{ key: "value" }', kind: "object" },
  ];

  it.each(cases)("parses $raw as $kind", ({ raw, kind }) => {
    const result = parseExpression(raw);
    expect(result.ok, result.ok ? "" : JSON.stringify(result)).toBe(true);
    if (result.ok) {
      expect(result.result.ast.kind).toBe(kind);
    }
  });

  it("reports error on empty input", () => {
    const result = parseExpression("   ");
    expect(result.ok).toBe(false);
  });

  it("reports error on trailing garbage", () => {
    const result = parseExpression("1 +");
    expect(result.ok).toBe(false);
  });
});

function parsed(raw: string): ExpressionNode {
  const result = parseExpression(raw);
  expect(result.ok, result.ok ? "" : JSON.stringify(result)).toBe(true);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.result.ast;
}

function prop(name: string): ExpressionNode {
  return { kind: "property", path: [name] };
}

describe("comparison operators", () => {
  it("parses capSize.z > 0 as a comparison with no remainder", () => {
    expect(parsed("capSize.z > 0")).toEqual({
      kind: "binary",
      operator: ">",
      left: prop("capSize.z"),
      right: { kind: "literal", value: 0 },
    });
  });

  it("parses showCap as a property access", () => {
    expect(parsed("showCap")).toEqual(prop("showCap"));
  });

  it("parses #math.min(size.x, size.y) as a call with two arguments", () => {
    expect(parsed("#math.min(size.x, size.y)")).toEqual({
      kind: "call",
      callee: "#math.min",
      args: [prop("size.x"), prop("size.y")],
    });
  });

  it("keeps * and / above + and -, and comparisons below both", () => {
    expect(parsed("a + b * c > d - e")).toEqual({
      kind: "binary",
      operator: ">",
      left: {
        kind: "binary",
        operator: "+",
        left: prop("a"),
        right: {
          kind: "binary",
          operator: "*",
          left: prop("b"),
          right: prop("c"),
        },
      },
      right: {
        kind: "binary",
        operator: "-",
        left: prop("d"),
        right: prop("e"),
      },
    });
    expect(parsed("a + b > c")).toMatchObject({
      operator: ">",
      left: { operator: "+" },
      right: prop("c"),
    });
    expect(parsed("a > b + c")).toMatchObject({
      operator: ">",
      left: prop("a"),
      right: { operator: "+" },
    });
  });

  it("treats >=, <=, ==, and != as one operator each", () => {
    for (const operator of [">=", "<=", "==", "!="] as const) {
      expect(parsed(`a ${operator} b`)).toEqual({
        kind: "binary",
        operator,
        left: prop("a"),
        right: prop("b"),
      });
    }
    expect(parseExpression("a > = b").ok).toBe(false);
  });

  it("is left-associative and rejects logical operators", () => {
    expect(parsed("a < b < c")).toMatchObject({
      operator: "<",
      left: { operator: "<", left: prop("a"), right: prop("b") },
      right: prop("c"),
    });
    expect(parseExpression("a > 0 && b").ok).toBe(false);
    expect(parseExpression("!showCap").ok).toBe(false);
  });

  it("evaluates a comparison in a pure expression", () => {
    const scope = {
      capSize: { z: 2 },
      a: 2,
      b: 3,
      c: 4,
      d: 20,
      e: 5,
      showCap: true,
    };
    const value = (raw: string) => {
      const node = parsed(raw);
      return evaluateExpression(node, scope);
    };
    expect(value("capSize.z > 0")).toBe(true);
    expect(value("capSize.z > 3")).toBe(false);
    expect(value("a + b * c > d - e")).toBe(false);
    expect(value("a + b * c < d - e")).toBe(true);
    expect(value("1 >= 1")).toBe(true);
    expect(value("1 <= 0")).toBe(false);
    expect(value("1 == 1")).toBe(true);
    expect(value("1 != 2")).toBe(true);
    expect(value("showCap")).toBe(true);
    expect(evaluateInterpolatedText("${ 1 + 2 }", {})).toBe("3");
    expect(() => evaluateInterpolatedText("${ capSize.z > 0 }", scope)).toThrow(
      /not allowed in interpolated text/,
    );
    expect(() => evaluateInterpolatedText("${ 2 * 3 }", {})).toThrow(
      /not allowed in interpolated text/,
    );
  });
});
