import { join } from "node:path";
import { describe, expect, it } from "vitest";
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

describe("createWorkspace", () => {
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
});

describe("isWorkspaceRefreshPath", () => {
  it("accepts BML files, bom.config.json, and package.json", () => {
    expect(isWorkspaceRefreshPath("/proj/blocks/Foo.bml")).toBe(true);
    expect(isWorkspaceRefreshPath("/proj/bom.config.json")).toBe(true);
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
