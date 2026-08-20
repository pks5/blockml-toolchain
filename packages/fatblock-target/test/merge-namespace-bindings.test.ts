import { describe, expect, it } from "vitest";
import { mergeNamespaceBindings } from "../src/merge-namespace-bindings.js";

describe("mergeNamespaceBindings", () => {
  it("unions non-conflicting bindings", () => {
    const result = mergeNamespaceBindings([
      { file: "a.bml", bindings: { "": "http://blockml.org/bml", foo: "urn:foo" } },
      { file: "b.bml", bindings: { "": "http://blockml.org/bml", bar: "urn:bar" } },
    ]);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.bindings).toEqual({
      "": "http://blockml.org/bml",
      foo: "urn:foo",
      bar: "urn:bar",
    });
  });

  it("reports prefix collision", () => {
    const result = mergeNamespaceBindings([
      { file: "a.bml", bindings: { foo: "urn:a" } },
      { file: "b.bml", bindings: { foo: "urn:b" } },
    ]);
    expect(result.diagnostics.some((d) => d.code === "BML_NAMESPACE_PREFIX_COLLISION")).toBe(
      true,
    );
  });
});
