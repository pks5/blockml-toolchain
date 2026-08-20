import { describe, expect, it } from "vitest";
import { DEFAULT_BLOCKDOC_OPTIONS } from "../src/options.js";
import { renderTypeExpression, renderTypeRef } from "../src/type-links.js";

const KNOWN = new Set([
  "org.blockml.bml.core.Block",
  "org.blockml.bml.core.ValueType",
]);

describe("renderTypeRef", () => {
  it("links known FQNs", () => {
    const html = renderTypeRef(
      "org.blockml.bml.core.Block",
      "org/blockml/bml/core/ValueType.html",
      DEFAULT_BLOCKDOC_OPTIONS,
      KNOWN,
    );
    expect(html).toContain('<a href="./Block.html">');
    expect(html).toContain("org.blockml.bml.core.Block");
  });

  it("escapes unknown FQNs as plain text", () => {
    const html = renderTypeRef(
      "com.example.Unknown",
      "org/blockml/bml/core/Block.html",
      DEFAULT_BLOCKDOC_OPTIONS,
      KNOWN,
    );
    expect(html).not.toContain("<a ");
    expect(html).toBe("com.example.Unknown");
  });
});

describe("renderTypeExpression", () => {
  it("links named type expressions", () => {
    const html = renderTypeExpression(
      { kind: "named", fqn: "org.blockml.bml.core.Block" },
      "org/blockml/bml/core/ValueType.html",
      DEFAULT_BLOCKDOC_OPTIONS,
      KNOWN,
    );
    expect(html).toContain('<a href="./Block.html">');
  });

  it("renders union types as plain text", () => {
    const html = renderTypeExpression(
      {
        kind: "union",
        alternatives: [
          { kind: "named", fqn: "org.blockml.bml.core.Block" },
          { kind: "self" },
        ],
      },
      "org/blockml/bml/core/Block.html",
      DEFAULT_BLOCKDOC_OPTIONS,
      KNOWN,
    );
    expect(html).toContain("org.blockml.bml.core.Block");
    expect(html).toContain("Self");
  });
});
