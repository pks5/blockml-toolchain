import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TransformError } from "../src/execution/errors.js";
import {
  packageFqnFromLibraryType,
  resolveTargetLibrary,
} from "../src/execution/target-library.js";
import { fixtureLibraryXml, fixtureTempDir, writeProject } from "./fixture.js";

const TMP = fixtureTempDir("transformer-target-library");

describe("resolveTargetLibrary", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("uses package.json blockml.library when --library is omitted", () => {
    writeProject(TMP, {});
    const target = resolveTargetLibrary(TMP);
    expect(target.packageFqn).toBe("com.example.model");
    expect(target.libraryFqn).toBe("com.example.model.Library");
    expect(target.libraryRoot.replaceAll("\\", "/")).toMatch(
      /blocks\/com\/example\/model$/,
    );
  });

  it("uses --library over package.json blockml.library", () => {
    writeProject(TMP, {
      "blocks/com/other/target/Library.bml": fixtureLibraryXml("com.other.target"),
    });
    const target = resolveTargetLibrary(TMP, "blocks/com/other/target/Library.bml");
    expect(target.packageFqn).toBe("com.other.target");
    expect(target.libraryRoot.replaceAll("\\", "/")).toMatch(
      /blocks\/com\/other\/target$/,
    );
  });

  it("fails when neither --library nor blockml.library is present", () => {
    writeFileSync(
      join(TMP, "package.json"),
      JSON.stringify({ name: "no-library", private: true }),
    );
    expect(() => resolveTargetLibrary(TMP)).toThrow(TransformError);
    try {
      resolveTargetLibrary(TMP);
    } catch (error) {
      expect(error).toBeInstanceOf(TransformError);
      expect((error as TransformError).kind).toBe("resolve");
      expect((error as TransformError).message).toMatch(/blockml\.library/);
    }
  });

  it("fails when --library path does not exist", () => {
    writeProject(TMP, {});
    expect(() => resolveTargetLibrary(TMP, "missing/Library.bml")).toThrow(
      /Library not found/,
    );
  });
});

describe("packageFqnFromLibraryType", () => {
  it("strips the trailing .Library segment", () => {
    expect(packageFqnFromLibraryType("org.blockml.bml.workspace.Library")).toBe(
      "org.blockml.bml.workspace",
    );
  });

  it("rejects a non-Library type FQN", () => {
    expect(packageFqnFromLibraryType("com.example.model.Poem")).toBeUndefined();
  });
});
