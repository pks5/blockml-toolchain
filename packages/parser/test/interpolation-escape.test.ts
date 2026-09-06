import { describe, expect, it } from "vitest";
import {
  containsUnescapedInterpolation,
  escapeInterpolationDelimiters,
  unescapeInterpolationDelimiters,
} from "../src/map/interpolation-escape.js";

describe("interpolation escape", () => {
  it("detects an unescaped opener", () => {
    expect(containsUnescapedInterpolation("Hello ${ x }")).toBe(true);
    expect(containsUnescapedInterpolation("${}")).toBe(true);
  });

  it("treats odd backslashes as escaped", () => {
    expect(containsUnescapedInterpolation("Hello \\${ x }")).toBe(false);
    expect(containsUnescapedInterpolation("Hello \\\\\\${ x }")).toBe(false);
  });

  it("treats even backslashes as a hole", () => {
    expect(containsUnescapedInterpolation("Hello \\\\${ x }")).toBe(true);
  });

  it("unescapes odd backslashes to literal ${", () => {
    expect(unescapeInterpolationDelimiters("\\${ }")).toBe("${ }");
    expect(unescapeInterpolationDelimiters("\\\\\\${ }")).toBe("\\${ }");
  });

  it("round-trips literal ${ through escape then unescape", () => {
    for (const value of ["${ }", "Cost is ${ amount }", "\\${ already }", "\\\\${ pair }"]) {
      expect(unescapeInterpolationDelimiters(escapeInterpolationDelimiters(value))).toBe(value);
      expect(containsUnescapedInterpolation(escapeInterpolationDelimiters(value))).toBe(false);
    }
  });
});
