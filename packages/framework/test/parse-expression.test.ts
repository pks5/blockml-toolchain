import { describe, expect, it } from "vitest";
import { parseExpression } from "../src/index.js";

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
