import { describe, expect, it } from "vitest";
import { collectPackagePrefixes, packageSegmentLabel } from "../src/navigation.js";

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
});
