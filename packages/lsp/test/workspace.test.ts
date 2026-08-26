import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveLibrarySeeds } from "@blockml/framework";
import {
  createWorkspace,
  invalidateWorkspace,
  isWorkspaceRefreshPath,
  loadPackageBlockmlLibrary,
  resolveBootstrapRoot,
} from "../src/workspace.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const MEMBER_DEFINITION = "org.blockml.bml.definition.MemberDefinition";
const CORE_PACKAGE = join(ROOT, "node_modules/@blockml/core");
const BOM_PACKAGE = join(ROOT, "packages/bom");

describe("resolveBootstrapRoot", () => {
  it("finds monorepo root from a nested package directory", () => {
    expect(resolveBootstrapRoot(BOM_PACKAGE)).toBe(ROOT);
  });
});

describe("loadPackageBlockmlLibrary", () => {
  it("reads blockml.library from @blockml/core package.json", () => {
    expect(loadPackageBlockmlLibrary(CORE_PACKAGE)).toBe(
      "./blocks/org/blockml/bml/Library.bml",
    );
  });

  it("reads blockml.library from workspace packages", () => {
    expect(loadPackageBlockmlLibrary(BOM_PACKAGE)).toBe(
      "./blocks/org/blockml/bml/bom/Library.bml",
    );
  });
});

describe("library seeds", () => {
  it("keeps package identity when extras are also given", () => {
    const coreLib = join(CORE_PACKAGE, "blocks/org/blockml/bml/Library.bml");
    const seeds = resolveLibrarySeeds(BOM_PACKAGE, [coreLib]);
    expect(seeds.some((p) => p.replaceAll("\\", "/").endsWith("/bom/Library.bml"))).toBe(
      true,
    );
    expect(seeds.some((p) => p.replaceAll("\\", "/").endsWith("/bml/Library.bml"))).toBe(
      true,
    );
    expect(seeds.length).toBeGreaterThanOrEqual(2);
  });
});

describe("createWorkspace", () => {
  it("defaults srcDir to blocks when blockml.config.json is absent", () => {
    const workspace = createWorkspace(BOM_PACKAGE);
    expect(workspace.config.srcDir).toBe("blocks");
  });

  it("bootstraps @blockml/core types when the core package is the workspace root", () => {
    const workspace = createWorkspace(CORE_PACKAGE);
    expect(workspace.registry.has(MEMBER_DEFINITION)).toBe(true);
    expect(workspace.bootstrapDiagnostics).toEqual([]);
  });

  it("bootstraps core types from a nested package via dependency walk-up", () => {
    const workspace = createWorkspace(BOM_PACKAGE);
    expect(workspace.registry.has(MEMBER_DEFINITION)).toBe(true);
    expect(workspace.bootstrapDiagnostics).toEqual([]);
  });

  it("bootstraps local BOM blocks from the monorepo package workspace", () => {
    const workspace = createWorkspace(BOM_PACKAGE);
    expect(workspace.registry.has("org.blockml.bml.bom.member.MemberDefinition")).toBe(
      true,
    );
  });

  it("bootstraps workspace library deps when the monorepo root is the workspace", () => {
    const workspace = createWorkspace(ROOT);
    expect(workspace.registry.has("org.blockml.bml.bom.member.MemberDefinition")).toBe(
      true,
    );
    expect(workspace.registry.has(MEMBER_DEFINITION)).toBe(true);
  });
});

describe("isWorkspaceRefreshPath", () => {
  it("accepts BML files, blockml.config.json, and package.json", () => {
    expect(isWorkspaceRefreshPath("/proj/blocks/Foo.bml")).toBe(true);
    expect(isWorkspaceRefreshPath("/proj/blockml.config.json")).toBe(true);
    expect(isWorkspaceRefreshPath("/proj/package.json")).toBe(true);
  });

  it("rejects unrelated files and node_modules paths", () => {
    expect(isWorkspaceRefreshPath("/proj/src/index.ts")).toBe(false);
    expect(
      isWorkspaceRefreshPath("/proj/node_modules/@blockml/core/blocks/Foo.bml"),
    ).toBe(false);
  });
});

describe("invalidateWorkspace", () => {
  it("drops the cached workspace so createWorkspace rebuilds", () => {
    const first = createWorkspace(BOM_PACKAGE);
    const cached = createWorkspace(BOM_PACKAGE);
    expect(cached).toBe(first);
    invalidateWorkspace(BOM_PACKAGE);
    const rebuilt = createWorkspace(BOM_PACKAGE);
    expect(rebuilt).not.toBe(first);
    expect(rebuilt.registry.has("org.blockml.bml.bom.member.MemberDefinition")).toBe(
      true,
    );
  });
});
