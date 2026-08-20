import { describe, expect, it } from "vitest";
import { DEFAULT_BLOCKDOC_OPTIONS } from "../src/options.js";
import {
  collectPackagePrefixes,
  packageSegmentLabel,
  renderDottedPackagePath,
} from "../src/navigation.js";

describe("navigation", () => {
  it("collects package prefixes from root fqns only", () => {
    const prefixes = collectPackagePrefixes([
      "com.example.pkg.Alpha",
      "com.example.other.Beta",
    ]);
    expect(prefixes).toEqual(["com", "com.example", "com.example.other", "com.example.pkg"]);
  });

  it("labels package segments by last segment", () => {
    expect(packageSegmentLabel("org.blockml.bml.definition")).toBe("definition");
  });

  it("joins package segments with dots and no spaces", () => {
    const html = renderDottedPackagePath(
      "org.blockml.bml.documentation",
      "org/blockml/bml/documentation/LibrarySystem.html",
      DEFAULT_BLOCKDOC_OPTIONS,
      new Set(),
    );
    expect(html).toBe(
      '<a href="../../../index.html">org</a>.<a href="../../index.html">blockml</a>.<a href="../index.html">bml</a>.<a href="./index.html">documentation</a>',
    );
    expect(html).not.toContain(". ");
    expect(html).not.toContain(" / ");
  });
});
