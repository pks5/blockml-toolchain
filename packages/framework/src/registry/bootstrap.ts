import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Diagnostic } from "@blockml/bom";
import { TypeRegistry } from "./type-registry.js";
import {
  bootstrapFromCorpusPaths,
  bootstrapFromLibraryPaths,
} from "./library-bootstrap.js";

export interface BootstrapOptions {
  /** Corpus roots for flat scan mode. */
  paths?: string[];
  /** Library.bml entry points for library graph mode. */
  libraryPaths?: string[];
  /** Working directory for relative paths. */
  rootDir?: string;
}

const CONFIG_FILE = "blockml.config.json";
const DEFAULT_SRC_DIR = "blocks";

function ancestorDirs(fromDir: string): string[] {
  const dirs: string[] = [];
  let dir = resolve(fromDir);
  for (;;) {
    dirs.push(dir);
    const parent = dirname(dir);
    if (parent === dir) {
      return dirs;
    }
    dir = parent;
  }
}

function nearestPackageJsonDir(fromDir: string): string | undefined {
  for (const dir of ancestorDirs(fromDir)) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
  }
  return undefined;
}

function resolveInstalledPackageDir(packageName: string, fromDir: string): string | undefined {
  for (const dir of ancestorDirs(fromDir)) {
    const candidate = join(dir, "node_modules", packageName);
    if (existsSync(join(candidate, "package.json"))) {
      return candidate;
    }
  }
  return undefined;
}

function readJson(path: string): unknown | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function blocksRootFromLibraryFile(packageDir: string, library: string): string {
  const absLib = resolve(packageDir, library);
  const normalized = absLib.replace(/\\/g, "/");
  const marker = "/blocks/";
  const idx = normalized.indexOf(marker);
  if (idx >= 0) {
    return normalized.slice(0, idx + "/blocks".length);
  }
  return dirname(dirname(absLib));
}

/** Blocks/srcDir root when the package is a BlockML module; otherwise undefined. */
function blockmlPackageBlocksRoot(packageDir: string): string | undefined {
  const pkg = readJson(join(packageDir, "package.json")) as
    | { blockml?: { library?: string } }
    | undefined;
  const library = pkg?.blockml?.library;
  if (typeof library === "string" && library.length > 0) {
    return blocksRootFromLibraryFile(packageDir, library);
  }
  const configPath = join(packageDir, CONFIG_FILE);
  if (existsSync(configPath)) {
    const cfg = readJson(configPath) as { srcDir?: string } | undefined;
    const srcDir =
      typeof cfg?.srcDir === "string" && cfg.srcDir.length > 0 ? cfg.srcDir : DEFAULT_SRC_DIR;
    return resolve(packageDir, srcDir);
  }
  return undefined;
}

function scanNodeModulesForBlockml(nodeModulesDir: string, out: Set<string>): void {
  let entries: string[];
  try {
    entries = readdirSync(nodeModulesDir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.startsWith(".")) {
      continue;
    }
    const full = join(nodeModulesDir, entry);
    if (entry.startsWith("@")) {
      let scoped: string[];
      try {
        scoped = readdirSync(full);
      } catch {
        continue;
      }
      for (const name of scoped) {
        const root = blockmlPackageBlocksRoot(join(full, name));
        if (root) {
          out.add(root);
        }
      }
      continue;
    }
    const root = blockmlPackageBlocksRoot(full);
    if (root) {
      out.add(root);
    }
  }
}

function scanWorkspacePackages(packagesDir: string, out: Set<string>): void {
  let entries: string[];
  try {
    entries = readdirSync(packagesDir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const pkgDir = join(packagesDir, entry);
    try {
      if (!statSync(pkgDir).isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }
    const root = blockmlPackageBlocksRoot(pkgDir);
    if (root) {
      out.add(root);
    }
  }
}

/**
 * Library.bml FQN index roots: every BlockML package under node_modules and
 * workspace packages/ along the directory walk (not a corpus dump).
 * Stops at the first ancestor that has node_modules (same idea as LSP resolveBootstrapRoot).
 */
function discoverBlockmlSearchRoots(rootDir: string): string[] {
  const npm = new Set<string>();
  const workspace = new Set<string>();
  for (const dir of ancestorDirs(rootDir)) {
    scanWorkspacePackages(join(dir, "packages"), workspace);
    const nodeModulesDir = join(dir, "node_modules");
    if (existsSync(nodeModulesDir)) {
      scanNodeModulesForBlockml(nodeModulesDir, npm);
      break;
    }
  }
  const local = blockmlPackageBlocksRoot(resolve(rootDir));
  const out = [...npm, ...workspace];
  if (local && !out.includes(local)) {
    out.push(local);
  }
  return out;
}

/**
 * Corpus fallback: BlockML packages among the nearest package.json production
 * dependencies (dependencies + optionalDependencies), resolved via node_modules.
 */
export function defaultBootstrapPaths(rootDir = process.cwd()): string[] {
  const pkgDir = nearestPackageJsonDir(rootDir) ?? resolve(rootDir);
  const pkg = readJson(join(pkgDir, "package.json")) as
    | {
        dependencies?: Record<string, string>;
        optionalDependencies?: Record<string, string>;
      }
    | undefined;
  const names = [
    ...Object.keys(pkg?.dependencies ?? {}),
    ...Object.keys(pkg?.optionalDependencies ?? {}),
  ];
  const out = new Set<string>();
  for (const name of names) {
    const installed = resolveInstalledPackageDir(name, rootDir);
    if (!installed) {
      continue;
    }
    const blocksRoot = blockmlPackageBlocksRoot(installed);
    if (blocksRoot) {
      out.add(blocksRoot);
    }
  }
  return [...out];
}

export interface BootstrapResult {
  registry: TypeRegistry;
  diagnostics: Diagnostic[];
  /** Present when bootstrap used libraryPaths mode. */
  exportsByLibrary?: Map<string, Set<string>>;
}

function normalizeOptions(
  optionsOrPaths?: BootstrapOptions | string[],
  rootDirArg?: string,
): BootstrapOptions {
  if (Array.isArray(optionsOrPaths)) {
    return { paths: optionsOrPaths, rootDir: rootDirArg ?? process.cwd() };
  }
  if (optionsOrPaths) {
    return { ...optionsOrPaths, rootDir: optionsOrPaths.rootDir ?? rootDirArg ?? process.cwd() };
  }
  return { rootDir: rootDirArg ?? process.cwd() };
}

function resolveBootstrapPath(path: string, rootDir: string): string {
  return path.startsWith("/") || path.includes(":") ? path : join(rootDir, path);
}

export function bootstrapTypeRegistry(
  optionsOrPaths?: BootstrapOptions | string[],
  rootDirArg?: string,
): BootstrapResult {
  const options = normalizeOptions(optionsOrPaths, rootDirArg);
  const rootDir = options.rootDir ?? process.cwd();
  const searchRoots = [
    ...discoverBlockmlSearchRoots(rootDir),
    ...(options.paths ?? []),
    ...(options.libraryPaths ?? []),
  ].map((p) => resolveBootstrapPath(p, rootDir));

  if (options.libraryPaths && options.libraryPaths.length > 0) {
    const coveredRoots = (options.paths ?? []).map((p) => resolveBootstrapPath(p, rootDir));
    const result = bootstrapFromLibraryPaths(
      options.libraryPaths,
      searchRoots,
      rootDir,
      coveredRoots,
    );
    if (options.paths && options.paths.length > 0) {
      const corpus = bootstrapFromCorpusPaths(options.paths, rootDir);
      for (const fqn of corpus.registry.keys()) {
        const doc = corpus.registry.get(fqn);
        if (doc) {
          result.registry.register(doc);
        }
      }
      result.diagnostics.push(...corpus.diagnostics);
    }
    return {
      registry: result.registry,
      diagnostics: result.diagnostics,
      exportsByLibrary: result.exportsByLibrary,
    };
  }

  const paths =
    options.paths && options.paths.length > 0 ? options.paths : defaultBootstrapPaths(rootDir);
  return bootstrapFromCorpusPaths(paths, rootDir);
}
