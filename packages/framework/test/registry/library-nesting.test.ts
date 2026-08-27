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
  opts: { typePrefix: string; typePkg: string; extraXmlns?: string; aggregations: string },
): void {
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(
    filePath,
    `<block xmlns="http://blockml.org/bml" xmlns:core="org.blockml.bml.core" xmlns:${opts.typePrefix}="${opts.typePkg}"${opts.extraXmlns ?? ""}>
  <name>Library</name>
  <type>${opts.typePrefix}:Library</type>
  <baseType>core:BlockLibrary</baseType>
  <aggregations>
    ${opts.aggregations}
  </aggregations>
</block>
`,
    "utf8",
  );
}

describe("peekLibraryTypeFqn", () => {
  it("returns the root type FQN of a Library.bml", () => {
    const file = join(TMP, "Library.bml");
    writeLibrary(file, {
      typePrefix: "ex",
      typePkg: "org.example.bml",
      aggregations: "",
    });
    expect(peekLibraryTypeFqn(file)).toBe("org.example.bml.Library");
  });

  it("returns undefined for a missing file", () => {
    expect(peekLibraryTypeFqn(join(TMP, "missing", "Library.bml"))).toBeUndefined();
  });
});

describe("library graph identity and nesting", () => {
  it("does not visit a second file with the same library type FQN and emits no nesting errors", () => {
    const first = join(TMP, "a", "Library.bml");
    const second = join(TMP, "b", "Library.bml");
    const aggregations = `<blocks>
      <composition>
        <ex:Foo />
      </composition>
    </blocks>`;
    writeLibrary(first, {
      typePrefix: "ex",
      typePkg: "org.example.bml",
      aggregations,
    });
    writeLibrary(second, {
      typePrefix: "ex",
      typePkg: "org.example.bml",
      aggregations,
    });

    const { diagnostics, trace } = bootstrapTypeRegistry({
      libraryPaths: [first, second],
      paths: [TMP],
      rootDir: TMP,
    });
    const nesting = diagnostics.filter((d) => d.code === "BML_LIBRARY_NESTING_VIOLATION");
    expect(nesting).toEqual([]);
    expect(trace?.librariesVisited).toHaveLength(1);
    expect(trace?.librariesVisited[0]!.replaceAll("\\", "/")).toBe(first.replaceAll("\\", "/"));
  });

  it("emits BML_LIBRARY_NESTING_VIOLATION when an outer library re-exports a subLibrary block", () => {
    const outer = join(TMP, "outer", "Library.bml");
    const inner = join(TMP, "inner", "Library.bml");
    writeLibrary(inner, {
      typePrefix: "inner",
      typePkg: "org.example.bml.inner",
      aggregations: `<blocks>
      <composition>
        <inner:InnerBlock />
      </composition>
    </blocks>`,
    });
    writeLibrary(outer, {
      typePrefix: "outer",
      typePkg: "org.example.bml.outer",
      extraXmlns: ` xmlns:inner="org.example.bml.inner"`,
      aggregations: `<subLibraries>
      <composition>
        <inner:Library />
      </composition>
    </subLibraries>
    <blocks>
      <composition>
        <inner:InnerBlock />
      </composition>
    </blocks>`,
    });

    const { diagnostics } = bootstrapTypeRegistry({
      libraryPaths: [outer],
      paths: [TMP],
      rootDir: TMP,
    });
    const nesting = diagnostics.filter((d) => d.code === "BML_LIBRARY_NESTING_VIOLATION");
    expect(nesting).toHaveLength(1);
    expect(nesting[0]!.message).toContain("org.example.bml.inner.InnerBlock");
  });

  it("does not treat sibling libraries linked only by dependencies as nested", () => {
    const libA = join(TMP, "a", "Library.bml");
    const libB = join(TMP, "b", "Library.bml");
    writeLibrary(libB, {
      typePrefix: "b",
      typePkg: "org.example.bml.b",
      extraXmlns: ` xmlns:shared="org.example.bml"`,
      aggregations: `<blocks>
      <composition>
        <shared:SharedBlock />
      </composition>
    </blocks>`,
    });
    writeLibrary(libA, {
      typePrefix: "a",
      typePkg: "org.example.bml.a",
      extraXmlns: ` xmlns:b="org.example.bml.b" xmlns:shared="org.example.bml"`,
      aggregations: `<dependencies>
      <composition>
        <b:Library />
      </composition>
    </dependencies>
    <blocks>
      <composition>
        <shared:SharedBlock />
      </composition>
    </blocks>`,
    });

    const { diagnostics } = bootstrapTypeRegistry({
      libraryPaths: [libA],
      paths: [TMP],
      rootDir: TMP,
    });
    const nesting = diagnostics.filter((d) => d.code === "BML_LIBRARY_NESTING_VIOLATION");
    expect(nesting).toEqual([]);
  });
});
