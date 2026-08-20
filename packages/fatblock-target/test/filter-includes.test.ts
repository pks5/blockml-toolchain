import { describe, expect, it } from "vitest";
import { matchesIncludePattern, filterByIncludes } from "../src/filter-includes.js";

describe("matchesIncludePattern", () => {
  it("matches exact FQN", () => {
    expect(matchesIncludePattern("com.foo.Bar", "com.foo.Bar")).toBe(true);
    expect(matchesIncludePattern("com.foo.Bar", "com.foo.Baz")).toBe(false);
  });

  it("matches prefix glob", () => {
    expect(matchesIncludePattern("com.foo.Bar", "com.foo.*")).toBe(true);
    expect(matchesIncludePattern("com.bar.Baz", "com.foo.*")).toBe(false);
  });
});

describe("filterByIncludes", () => {
  it("returns all when patterns omitted", () => {
    expect(filterByIncludes(["a", "b"], undefined)).toEqual(["a", "b"]);
  });

  it("filters by multiple patterns", () => {
    expect(
      filterByIncludes(["com.foo.A", "com.foo.B", "com.bar.C"], ["com.foo.*"]),
    ).toEqual(["com.foo.A", "com.foo.B"]);
  });
});
