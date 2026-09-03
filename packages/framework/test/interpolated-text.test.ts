import { describe, expect, it } from "vitest";
import {
  evaluateInterpolatedText,
  parseInterpolatedText,
} from "../src/index.js";

describe("parseInterpolatedText", () => {
  it("splits literal and property holes", () => {
    const result = parseInterpolatedText("Hello this is ${ this.label } bla bla");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.result.ast.kind).toBe("interpolated");
    if (result.result.ast.kind !== "interpolated") {
      return;
    }
    expect(result.result.ast.parts).toHaveLength(3);
    expect(result.result.ast.parts[0]).toEqual({ kind: "literal", value: "Hello this is " });
    expect(result.result.ast.parts[1]).toEqual({ kind: "property", path: ["this.label"] });
    expect(result.result.ast.parts[2]).toEqual({ kind: "literal", value: " bla bla" });
  });

  it("rejects @model in a hole", () => {
    const result = parseInterpolatedText("Hello ${ @myModel:/title }");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toContain("not allowed");
  });

  it("rejects unclosed interpolation", () => {
    const result = parseInterpolatedText("Hello ${ this.label");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toBe("Unclosed interpolation");
  });
});

describe("evaluateInterpolatedText", () => {
  it("resolves this.parameters.author", () => {
    const text = evaluateInterpolatedText("by ${ this.parameters.author }", {
      parameters: { author: "John Doe" },
    });
    expect(text).toBe("by John Doe");
  });

  it("resolves unqualified and #this paths the same way", () => {
    const scope = { label: "Tree" };
    expect(evaluateInterpolatedText("${ label }", scope)).toBe("Tree");
    expect(evaluateInterpolatedText("${ #this.label }", scope)).toBe("Tree");
    expect(evaluateInterpolatedText("${ this.label }", scope)).toBe("Tree");
  });
});
