import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { BomDocument, Diagnostic } from "@blockml/bom";
import { bootstrapTypeRegistry, defaultBootstrapPaths, resolveLibrarySeeds, TypeRegistry } from "@blockml/framework";
import { parse } from "@blockml/parser";

/** Globs registered with the client for workspace/didChangeWatchedFiles. */
export const WATCH_GLOBS = ["**/*.bml", "**/blockml.config.json", "**/package.json"] as const;

/** True when a disk path should invalidate the cached TypeRegistry. */
export function isWorkspaceRefreshPath(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  if (normalized.split("/").includes("node_modules")) {
    return false;
  }
  const name = basename(normalized);
  return name.endsWith(".bml") || name === "blockml.config.json" || name === "package.json";
}

export interface BomConfig {
  srcDir?: string;
  libraries?: string[];
}

const DEFAULT_CONFIG: Required<Pick<BomConfig, "srcDir">> = {
  srcDir: "blocks",
};

export function loadBomConfig(rootDir: string): BomConfig {
  const configPath = resolve(rootDir, "blockml.config.json");
  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw) as BomConfig;
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
  };
}

/** Walk up from workspace root until node_modules is found (CLI/framework discovery). */
export function resolveBootstrapRoot(fromDir: string): string {
  let dir = resolve(fromDir);
  for (;;) {
    if (existsSync(join(dir, "node_modules"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return resolve(fromDir);
    }
    dir = parent;
  }
}

/** Read package.json → blockml.library when present (e.g. @blockml/core repo layout). */
export function loadPackageBlockmlLibrary(rootDir: string): string | undefined {
  const packagePath = resolve(rootDir, "package.json");
  if (!existsSync(packagePath)) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(readFileSync(packagePath, "utf8")) as {
      blockml?: { library?: string };
    };
    const library = parsed.blockml?.library;
    return typeof library === "string" && library.length > 0 ? library : undefined;
  } catch {
    return undefined;
  }
}

function resolveLibraryPaths(config: BomConfig, rootDir: string): string[] {
  return resolveLibrarySeeds(rootDir, config.libraries ?? []);
}

export interface WorkspaceState {
  rootDir: string;
  config: BomConfig;
  registry: TypeRegistry;
  bootstrapDiagnostics: Diagnostic[];
}

const workspaceCache = new Map<string, WorkspaceState>();

export function invalidateWorkspace(rootDir: string): void {
  workspaceCache.delete(resolve(rootDir));
}

/** Workspace view with the open document overlaid. Does not mutate the cache. */
export function workspaceWithOpenDocument(
  workspace: WorkspaceState,
  document: BomDocument,
): WorkspaceState {
  return {
    ...workspace,
    registry: workspace.registry.withOverlay(document),
  };
}

/** Overlay the open buffer when it parses. Falls back to the cached workspace. */
export function workspaceForOpenText(
  workspace: WorkspaceState,
  text: string,
  filePath: string,
): WorkspaceState {
  const parsed = parse(text, { filePath, continueOnError: true });
  return parsed.document ? workspaceWithOpenDocument(workspace, parsed.document) : workspace;
}

export function createWorkspace(rootDir: string): WorkspaceState {
  const absRoot = resolve(rootDir);
  const cached = workspaceCache.get(absRoot);
  if (cached) {
    return cached;
  }

  const config = loadBomConfig(absRoot);
  const srcDir = config.srcDir ?? DEFAULT_CONFIG.srcDir;
  const libraries = resolveLibraryPaths(config, absRoot);
  const bootstrapOptions: {
    rootDir: string;
    paths: string[];
    libraryPaths?: string[];
  } = {
    rootDir: absRoot,
    paths:
      libraries.length > 0 ? [srcDir] : [...new Set([srcDir, ...defaultBootstrapPaths(absRoot)])],
  };
  if (libraries.length > 0) {
    bootstrapOptions.libraryPaths = libraries;
  }

  const bootstrap = bootstrapTypeRegistry(bootstrapOptions);
  const bootstrapDiagnostics = bootstrap.diagnostics.filter(
    (d) =>
      d.code === "BML_LIBRARY_RESOLVE_ERROR",
  );

  const state: WorkspaceState = {
    rootDir: absRoot,
    config,
    registry: bootstrap.registry,
    bootstrapDiagnostics,
  };
  workspaceCache.set(absRoot, state);
  return state;
}
