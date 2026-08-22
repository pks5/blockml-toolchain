import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Diagnostic } from "@blockml/bom";
import { bootstrapTypeRegistry, defaultBootstrapPaths, TypeRegistry } from "@blockml/framework";

export interface BomConfig {
  srcDir?: string;
  libraries?: string[];
}

const DEFAULT_CONFIG: Required<Pick<BomConfig, "srcDir">> = {
  srcDir: "src",
};

export function loadBomConfig(rootDir: string): BomConfig {
  const configPath = resolve(rootDir, "bom.config.json");
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

/** Walk up from workspace root until node_modules/@blockml/core is found (CLI parity). */
export function resolveBootstrapRoot(fromDir: string): string {
  let dir = resolve(fromDir);
  for (;;) {
    if (existsSync(join(dir, "node_modules/@blockml/core"))) {
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
  if (config.libraries?.length) {
    return config.libraries;
  }
  const fromPackage = loadPackageBlockmlLibrary(rootDir);
  return fromPackage ? [fromPackage] : [];
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

export function createWorkspace(rootDir: string): WorkspaceState {
  const absRoot = resolve(rootDir);
  const cached = workspaceCache.get(absRoot);
  if (cached) {
    return cached;
  }

  const config = loadBomConfig(absRoot);
  const bootstrapRoot = resolveBootstrapRoot(absRoot);
  const srcDir = config.srcDir ?? DEFAULT_CONFIG.srcDir;
  const corpusPaths = [...new Set([srcDir, ...defaultBootstrapPaths(bootstrapRoot)])];
  const libraries = resolveLibraryPaths(config, absRoot);
  const bootstrapOptions: {
    rootDir: string;
    paths: string[];
    libraryPaths?: string[];
  } = {
    rootDir: absRoot,
    paths: corpusPaths,
  };
  if (libraries.length > 0) {
    bootstrapOptions.libraryPaths = libraries;
  }

  const bootstrap = bootstrapTypeRegistry(bootstrapOptions);
  const bootstrapDiagnostics = bootstrap.diagnostics.filter(
    (d) =>
      d.code === "BML_LIBRARY_RESOLVE_ERROR" ||
      d.code === "BML_LIBRARY_NESTING_VIOLATION",
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
