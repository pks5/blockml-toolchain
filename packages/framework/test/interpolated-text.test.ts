import { describe, expect, it } from "vitest";
import {
  evaluateInterpolatedText,
  parseInterpolatedText,
} from "../src/index.js";

describe("parseInterpolatedText", () => {
  it("splits literal and property holes", () => {
    const result = parseInterpolatedText("Hello this is ${ #this.label } bla bla");
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
    expect(result.result.ast.parts[1]).toEqual({ kind: "property", path: ["#this.label"] });
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

  it("accepts unqualified members as #this shorthand", () => {
    const result = parseInterpolatedText("Hello ${ label }");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.result.ast.kind).toBe("interpolated");
    if (result.result.ast.kind !== "interpolated") {
      return;
    }
    expect(result.result.ast.parts[1]).toEqual({ kind: "property", path: ["label"] });
  });

  it("treats \\${ as a literal ${", () => {
    const result = parseInterpolatedText("Cost is \\${ amount }");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.result.ast).toEqual({
      kind: "interpolated",
      parts: [{ kind: "literal", value: "Cost is ${ amount }" }],
    });
  });

  it("treats \\\\${ as a backslash plus a hole", () => {
    const result = parseInterpolatedText("Show \\\\${ #this.label }");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.result.ast.kind).toBe("interpolated");
    if (result.result.ast.kind !== "interpolated") {
      return;
    }
    expect(result.result.ast.parts).toEqual([
      { kind: "literal", value: "Show \\" },
      { kind: "property", path: ["#this.label"] },
    ]);
  });

  it("rejects unclosed interpolation", () => {
    const result = parseInterpolatedText("Hello ${ #this.label");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.message).toBe("Unclosed interpolation");
  });
});

describe("evaluateInterpolatedText", () => {
  it("resolves #this.parameters.author", () => {
    const text = evaluateInterpolatedText("by ${ #this.parameters.author }", {
      parameters: { author: "John Doe" },
    });
    expect(text).toBe("by John Doe");
  });

  it("treats this as the property #this.this", () => {
    const text = evaluateInterpolatedText("${ this.author }", {
      this: { author: "Ada" },
    });
    expect(text).toBe("Ada");
    expect(evaluateInterpolatedText("${ #this.this.author }", {
      this: { author: "Ada" },
    })).toBe("Ada");
  });

  it("uses the same #this lookup as full expressions", () => {
    const scope = { size: 8, params: { z: 3 }, this: { x: 1 } };
    expect(evaluateInterpolatedText("${ size }", scope)).toBe("8");
    expect(evaluateInterpolatedText("${ #this.size }", scope)).toBe("8");
    expect(evaluateInterpolatedText("${ this }", scope)).toBe(JSON.stringify({ x: 1 }));
    expect(evaluateInterpolatedText("${ this.x }", scope)).toBe("1");
    expect(evaluateInterpolatedText("${ #this.this.x }", scope)).toBe("1");
    expect(evaluateInterpolatedText("${ params.z }", scope)).toBe("3");
    expect(() => evaluateInterpolatedText("${ this.size }", scope)).toThrow(/Unknown property/);
  });

  it("unescapes \\${ at evaluation time", () => {
    expect(evaluateInterpolatedText("delimiters \\${ }", {})).toBe("delimiters ${ }");
  });

  it("evaluates a hole after an even backslash pair", () => {
    expect(evaluateInterpolatedText("Show \\\\${ label }", { label: "X" })).toBe("Show \\X");
  });
});
