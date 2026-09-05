import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Diagnostic } from "@blockml/bom";
import { TypeRegistry } from "./type-registry.js";
import {
  bootstrapFromCorpusPaths,
  bootstrapFromLibraryPaths,
} from "./library-bootstrap.js";
import {
  blockmlPackageBlocksRoot,
  canonicalPath,
  DEFAULT_SRC_DIR,
  readJson,
} from "./package-paths.js";
import { projectSourceRoots } from "./project-sources.js";

export interface BootstrapOptions {
  /** Corpus roots for flat scan mode. */
  paths?: string[];
  /** Library.bml entry points for library graph mode. */
  libraryPaths?: string[];
  /** Working directory for relative paths. */
  rootDir?: string;
}

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

function resolveBootstrapPath(path: string, rootDir: string): string {
  return path.startsWith("/") || path.includes(":") ? path : join(rootDir, path);
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
  const out: string[] = [];
  if (local) {
    out.push(local);
  }
  for (const root of workspace) {
    if (!out.includes(root)) {
      out.push(root);
    }
  }
  for (const root of npm) {
    if (!out.includes(root)) {
      out.push(root);
    }
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

/**
 * Library graph seeds for this package: package.json blockml.library first,
 * then extras (config.libraries or --libraries). Deduped by realpath.
 */
export function resolveLibrarySeeds(rootDir = process.cwd(), extras: string[] = []): string[] {
  const ordered: string[] = [];
  const pkg = readJson(join(rootDir, "package.json")) as
    | { blockml?: { library?: string } }
    | undefined;
  const identity = pkg?.blockml?.library;
  if (typeof identity === "string" && identity.length > 0) {
    ordered.push(identity);
  }
  for (const extra of extras) {
    if (typeof extra === "string" && extra.trim().length > 0) {
      ordered.push(extra.trim());
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const seed of ordered) {
    const abs = resolveBootstrapPath(seed, rootDir);
    const key = canonicalPath(abs);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(key);
  }
  return out;
}

export interface BootstrapTrace {
  corpusPaths: string[];
  seeds: string[];
  searchRoots: string[];
  librariesVisited: string[];
  skippedCoveredRoots: string[];
}

export interface BootstrapResult {
  registry: TypeRegistry;
  diagnostics: Diagnostic[];
  /** Present when bootstrap used libraryPaths mode. */
  exportsByLibrary?: Map<string, Set<string>>;
  trace?: BootstrapTrace;
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

/**
 * Same corpus as `blockml validate --all`: project source roots plus the
 * resolved library graph (including npm BlockML packages).
 */
export function bootstrapFullProjectRegistry(options: {
  rootDir: string;
  srcDir?: string;
  libraries?: string[];
}): BootstrapResult {
  const srcDir = options.srcDir ?? DEFAULT_SRC_DIR;
  const paths = projectSourceRoots(options.rootDir, srcDir);
  const libraryPaths = resolveLibrarySeeds(options.rootDir, options.libraries ?? []);
  const bootstrapOptions: BootstrapOptions = {
    rootDir: options.rootDir,
    paths,
  };
  if (libraryPaths.length > 0) {
    bootstrapOptions.libraryPaths = libraryPaths;
  }
  return bootstrapTypeRegistry(bootstrapOptions);
}

export function bootstrapTypeRegistry(
  optionsOrPaths?: BootstrapOptions | string[],
  rootDirArg?: string,
): BootstrapResult {
  const options = normalizeOptions(optionsOrPaths, rootDirArg);
  const rootDir = options.rootDir ?? process.cwd();
  const discovered = discoverBlockmlSearchRoots(rootDir).map((p) =>
    resolveBootstrapPath(p, rootDir),
  );
  const searchRoots = [
    ...discovered,
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
    const seeds = options.libraryPaths.map((p) =>
      canonicalPath(resolveBootstrapPath(p, rootDir)),
    );
    return {
      registry: result.registry,
      diagnostics: result.diagnostics,
      exportsByLibrary: result.exportsByLibrary,
      trace: {
        corpusPaths: coveredRoots,
        seeds,
        searchRoots: discovered,
        librariesVisited: result.librariesVisited,
        skippedCoveredRoots: result.skippedCoveredRoots,
      },
    };
  }

  const paths =
    options.paths && options.paths.length > 0 ? options.paths : defaultBootstrapPaths(rootDir);
  const corpus = bootstrapFromCorpusPaths(paths, rootDir);
  return {
    ...corpus,
    trace: {
      corpusPaths: paths.map((p) => resolveBootstrapPath(p, rootDir)),
      seeds: [],
      searchRoots: discovered,
      librariesVisited: [],
      skippedCoveredRoots: [],
    },
  };
}
