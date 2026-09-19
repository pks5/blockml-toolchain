import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  collectLocationExports,
  findOwningLibraryFile,
} from "../../src/registry/library-membership.js";
import { canonicalPath } from "../../src/registry/package-paths.js";

const TMP = join(import.meta.dirname, ".tmp-library-membership");

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

function writePkg(): void {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(
    join(TMP, "package.json"),
    JSON.stringify({ name: "membership-fixture", blockml: { library: "./blocks/org/example/bml/Library.bml" } }),
  );
}

function writeLibrary(rel: string): void {
  const file = join(TMP, rel);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, "<lib:Library xmlns=\"http://blockml.org/bml\" xmlns:lib=\"org.example.bml\" />\n");
}

function writeBlock(rel: string): string {
  const file = join(TMP, rel);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, "<ex:Block xmlns=\"http://blockml.org/bml\" xmlns:ex=\"org.example.bml\" />\n");
  return file;
}

describe("findOwningLibraryFile", () => {
  it("owns a block in the same directory as Library.bml", () => {
    writePkg();
    writeLibrary("blocks/org/example/bml/Library.bml");
    const block = writeBlock("blocks/org/example/bml/Foo.bml");
    expect(findOwningLibraryFile(block)).toBe(
      canonicalPath(join(TMP, "blocks/org/example/bml/Library.bml")),
    );
  });

  it("walks up to a parent Library and stops at the first match", () => {
    writePkg();
    writeLibrary("blocks/org/example/bml/Library.bml");
    writeLibrary("blocks/org/example/bml/inner/Library.bml");
    const inner = writeBlock("blocks/org/example/bml/inner/Nested.bml");
    const outer = writeBlock("blocks/org/example/bml/Outer.bml");
    expect(findOwningLibraryFile(inner)).toBe(
      canonicalPath(join(TMP, "blocks/org/example/bml/inner/Library.bml")),
    );
    expect(findOwningLibraryFile(outer)).toBe(
      canonicalPath(join(TMP, "blocks/org/example/bml/Library.bml")),
    );
  });

  it("does not search the source folder itself", () => {
    writePkg();
    writeLibrary("blocks/Library.bml");
    const block = writeBlock("blocks/org/example/bml/Foo.bml");
    expect(findOwningLibraryFile(block)).toBeUndefined();
  });
});

describe("collectLocationExports", () => {
  it("assigns files to the nearest Library and skips Library.bml itself", () => {
    writePkg();
    writeLibrary("blocks/org/example/bml/Library.bml");
    writeLibrary("blocks/org/example/bml/inner/Library.bml");
    const outer = writeBlock("blocks/org/example/bml/Outer.bml");
    const inner = writeBlock("blocks/org/example/bml/inner/Nested.bml");
    const exports = collectLocationExports([
      { filePath: join(TMP, "blocks/org/example/bml/Library.bml"), typeFqn: "org.example.bml.Library" },
      { filePath: outer, typeFqn: "org.example.bml.Outer" },
      { filePath: join(TMP, "blocks/org/example/bml/inner/Library.bml"), typeFqn: "org.example.bml.inner.Library" },
      { filePath: inner, typeFqn: "org.example.bml.inner.Nested" },
    ]);
    const outerLib = canonicalPath(join(TMP, "blocks/org/example/bml/Library.bml"));
    const innerLib = canonicalPath(join(TMP, "blocks/org/example/bml/inner/Library.bml"));
    expect(exports.get(outerLib)).toEqual(new Set(["org.example.bml.Outer"]));
    expect(exports.get(innerLib)).toEqual(new Set(["org.example.bml.inner.Nested"]));
  });
});
