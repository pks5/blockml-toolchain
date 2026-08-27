import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  shouldSeedWorkspaceCore,
  workspaceCoreLibraryPath,
} from "../src/bootstrap-type-registry.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const TMP = join(import.meta.dirname, ".tmp-workspace-core-seed");
const CORE_LIBRARY = join(
  ROOT,
  "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml",
);
const BOM_LIBRARY = join(
  ROOT,
  "packages/bom/blocks/org/blockml/bml/bom/Library.bml",
);

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("workspace-core extra seed", () => {
  it("resolves the npm core Library.bml under the workspace root", () => {
    expect(workspaceCoreLibraryPath(ROOT)?.replaceAll("\\", "/")).toBe(
      CORE_LIBRARY.replaceAll("\\", "/"),
    );
  });

  it("does not seed when identity is the same realpath as npm core", () => {
    expect(shouldSeedWorkspaceCore(CORE_LIBRARY, CORE_LIBRARY)).toBe(false);
  });

  it("does not seed when identity has the same Library type FQN as npm core", () => {
    mkdirSync(TMP, { recursive: true });
    const identity = join(TMP, "Library.bml");
    writeFileSync(
      identity,
      `<block xmlns="http://blockml.org/bml" xmlns:core="org.blockml.bml.core" xmlns:blockml="org.blockml.bml">
  <name>Library</name>
  <type>blockml:Library</type>
  <baseType>core:BlockLibrary</baseType>
</block>
`,
      "utf8",
    );
    expect(shouldSeedWorkspaceCore(identity, CORE_LIBRARY)).toBe(false);
  });

  it("seeds for a domain identity library", () => {
    expect(shouldSeedWorkspaceCore(BOM_LIBRARY, CORE_LIBRARY)).toBe(true);
  });

  it("seeds when there is no package identity library", () => {
    expect(shouldSeedWorkspaceCore(undefined, CORE_LIBRARY)).toBe(true);
  });
});
