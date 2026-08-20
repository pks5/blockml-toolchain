import { describe, expect, it } from "vitest";
import { fqnToHtmlPath, escapeHtml } from "../src/fqn-path.js";

describe("fqnToHtmlPath", () => {
  it("maps FQN to path segments", () => {
    expect(fqnToHtmlPath("org.blockml.bml.core.Block", "fqn")).toBe(
      "org/blockml/bml/core/Block.html",
    );
  });

  it("maps package layout to index under package", () => {
    expect(fqnToHtmlPath("org.blockml.bml.core.Block", "package")).toBe(
      "org/blockml/bml/core/index.html",
    );
  });
});

describe("escapeHtml", () => {
  it("escapes special characters", () => {
    expect(escapeHtml(`a & b < c`)).toBe("a &amp; b &lt; c");
  });
});
