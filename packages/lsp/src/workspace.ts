import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
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
  const srcDir = config.srcDir ?? DEFAULT_CONFIG.srcDir;
  const corpusPaths = [...new Set([srcDir, ...defaultBootstrapPaths(absRoot)])];
  const bootstrapOptions: {
    rootDir: string;
    paths: string[];
    libraryPaths?: string[];
  } = {
    rootDir: absRoot,
    paths: corpusPaths,
  };
  if (config.libraries?.length) {
    bootstrapOptions.libraryPaths = config.libraries;
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
