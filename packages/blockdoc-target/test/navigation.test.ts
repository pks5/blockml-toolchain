import { describe, expect, it } from "vitest";
import { DEFAULT_BLOCKDOC_OPTIONS } from "../src/options.js";
import {
  collectPackagePrefixes,
  collectLibraryPrefixes,
  libraryGroupLabel,
  owningLibraryPrefix,
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

  it("collects library prefixes from *.Library roots", () => {
    expect(
      collectLibraryPrefixes([
        "org.blockml.bml.bom.Library",
        "org.blockml.bml.cli.Library",
        "org.blockml.bml.bom.api.ParseOptions",
      ]),
    ).toEqual(["org.blockml.bml.bom", "org.blockml.bml.cli"]);
  });

  it("assigns FQNs to the longest owning library prefix", () => {
    const prefixes = ["org.blockml.bml", "org.blockml.bml.bom"];
    expect(owningLibraryPrefix("org.blockml.bml.bom.api.ParseOptions", prefixes)).toBe(
      "org.blockml.bml.bom",
    );
    expect(owningLibraryPrefix("org.blockml.bml.core.Block", prefixes)).toBe("org.blockml.bml");
    expect(owningLibraryPrefix("com.example.Alpha", prefixes)).toBeUndefined();
  });

  it("uses a unique last segment as the library group label", () => {
    const prefixes = ["org.blockml.bml.bom", "org.blockml.bml.cli"];
    expect(libraryGroupLabel("org.blockml.bml.bom", prefixes)).toBe("bom");
    expect(libraryGroupLabel("org.blockml.bml.cli", prefixes)).toBe("cli");
  });

  it("disambiguates colliding library last segments", () => {
    const prefixes = ["com.foo.core", "com.bar.core"];
    expect(libraryGroupLabel("com.foo.core", prefixes)).toBe("foo.core");
    expect(libraryGroupLabel("com.bar.core", prefixes)).toBe("bar.core");
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
