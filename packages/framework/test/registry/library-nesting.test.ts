import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { bootstrapTypeRegistry, peekLibraryTypeFqn } from "../../src/index.js";

const TMP = join(import.meta.dirname, ".tmp-library-nesting");

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

function writeLibrary(
  filePath: string,
  opts: { prefix: string; pkg: string; extraXmlns?: string; aggregations?: string },
): void {
  mkdirSync(join(filePath, ".."), { recursive: true });
  const aggregations = opts.aggregations
    ? `
  <aggregations>
    ${opts.aggregations}
  </aggregations>`
    : "";
  writeFileSync(
    filePath,
    `<${opts.prefix}:Library xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:${opts.prefix}="${opts.pkg}"${opts.extraXmlns ?? ""}>
  <baseType>
    core:BlockLibrary
  </baseType>
  <is>
    ${opts.pkg} library
  </is>
  <version>
    1.0.0
  </version>${aggregations}
</${opts.prefix}:Library>
`,
    "utf8",
  );
}

function writeBlock(filePath: string, prefix: string, pkg: string, name: string): void {
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(
    filePath,
    `<${prefix}:${name} xmlns="http://blockml.org/bml"
  xmlns:core="org.blockml.bml.core"
  xmlns:${prefix}="${pkg}">
  <baseType>
    core:Block
  </baseType>
  <is>
    ${name}
  </is>
</${prefix}:${name}>
`,
    "utf8",
  );
}

describe("peekLibraryTypeFqn", () => {
  it("returns the root type FQN of a Library.bml", () => {
    const file = join(TMP, "Library.bml");
    writeLibrary(file, { prefix: "ex", pkg: "org.example.bml" });
    expect(peekLibraryTypeFqn(file)).toBe("org.example.bml.Library");
  });

  it("returns undefined for a missing file", () => {
    expect(peekLibraryTypeFqn(join(TMP, "missing", "Library.bml"))).toBeUndefined();
  });
});

describe("library graph identity and nested membership", () => {
  it("does not visit a second file with the same library type FQN", () => {
    mkdirSync(join(TMP, "a"), { recursive: true });
    mkdirSync(join(TMP, "b"), { recursive: true });
    const first = join(TMP, "a", "Library.bml");
    const second = join(TMP, "b", "Library.bml");
    writeLibrary(first, { prefix: "ex", pkg: "org.example.bml" });
    writeLibrary(second, { prefix: "ex", pkg: "org.example.bml" });

    const { diagnostics, trace } = bootstrapTypeRegistry({
      libraryPaths: [first, second],
      paths: [TMP],
      rootDir: TMP,
    });
    expect(diagnostics.filter((d) => d.code === "BML_LIBRARY_RESOLVE_ERROR")).toEqual([]);
    expect(trace?.librariesVisited).toHaveLength(1);
    expect(trace?.librariesVisited[0]!.replaceAll("\\", "/")).toBe(first.replaceAll("\\", "/"));
  });

  it("assigns nested-directory blocks to the inner Library", () => {
    mkdirSync(TMP, { recursive: true });
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({
        name: "nested-lib-fixture",
        blockml: { library: "./blocks/org/example/bml/Library.bml" },
      }),
    );
    const outer = join(TMP, "blocks", "org", "example", "bml", "Library.bml");
    const inner = join(TMP, "blocks", "org", "example", "bml", "inner", "Library.bml");
    writeLibrary(inner, { prefix: "inner", pkg: "org.example.bml.inner" });
    writeLibrary(outer, {
      prefix: "outer",
      pkg: "org.example.bml",
      extraXmlns: `\n  xmlns:inner="org.example.bml.inner"`,
      aggregations: `<subLibraries>
      <composition>
        <inner:Library />
      </composition>
    </subLibraries>`,
    });
    writeBlock(
      join(TMP, "blocks", "org", "example", "bml", "OuterBlock.bml"),
      "outer",
      "org.example.bml",
      "OuterBlock",
    );
    writeBlock(
      join(TMP, "blocks", "org", "example", "bml", "inner", "InnerBlock.bml"),
      "inner",
      "org.example.bml.inner",
      "InnerBlock",
    );

    const { diagnostics, exportsByLibrary } = bootstrapTypeRegistry({
      libraryPaths: [outer],
      rootDir: TMP,
    });
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(exportsByLibrary?.get(outer)?.has("org.example.bml.OuterBlock")).toBe(true);
    expect(exportsByLibrary?.get(outer)?.has("org.example.bml.inner.InnerBlock")).toBe(false);
    expect(exportsByLibrary?.get(inner)?.has("org.example.bml.inner.InnerBlock")).toBe(true);
    expect(exportsByLibrary?.get(inner)?.has("org.example.bml.OuterBlock")).toBe(false);
  });

  it("does not treat sibling libraries linked only by dependencies as nested", () => {
    mkdirSync(TMP, { recursive: true });
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({
        name: "sibling-lib-fixture",
        blockml: { library: "./blocks/org/example/bml/a/Library.bml" },
      }),
    );
    const libA = join(TMP, "blocks", "org", "example", "bml", "a", "Library.bml");
    const libB = join(TMP, "blocks", "org", "example", "bml", "b", "Library.bml");
    writeLibrary(libB, { prefix: "b", pkg: "org.example.bml.b" });
    writeLibrary(libA, {
      prefix: "a",
      pkg: "org.example.bml.a",
      extraXmlns: `\n  xmlns:b="org.example.bml.b"`,
      aggregations: `<dependencies>
      <composition>
        <b:Library />
      </composition>
    </dependencies>`,
    });
    writeBlock(
      join(TMP, "blocks", "org", "example", "bml", "a", "ABlock.bml"),
      "a",
      "org.example.bml.a",
      "ABlock",
    );
    writeBlock(
      join(TMP, "blocks", "org", "example", "bml", "b", "BBlock.bml"),
      "b",
      "org.example.bml.b",
      "BBlock",
    );

    const { diagnostics, exportsByLibrary } = bootstrapTypeRegistry({
      libraryPaths: [libA],
      rootDir: TMP,
    });
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(exportsByLibrary?.get(libA)?.has("org.example.bml.a.ABlock")).toBe(true);
    expect(exportsByLibrary?.get(libB)?.has("org.example.bml.b.BBlock")).toBe(true);
    expect(exportsByLibrary?.get(libA)?.has("org.example.bml.b.BBlock")).toBe(false);
  });
});
