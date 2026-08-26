import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { rootFqnByFilePath, type TypeRegistry } from "@blockml/framework";

const CONFIG_FILE = "blockml.config.json";
const DEFAULT_SRC_DIR = "blocks";

function canonicalPath(path: string): string {
  const abs = resolve(path);
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}

function isPathInsideOrEqual(inner: string, outer: string): boolean {
  const a = canonicalPath(inner);
  const b = canonicalPath(outer);
  const rel = relative(b, a);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function readJson(path: string): unknown | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function packageSrcDir(packageDir: string): string {
  const configPath = join(packageDir, CONFIG_FILE);
  if (existsSync(configPath)) {
    const cfg = readJson(configPath) as { srcDir?: string } | undefined;
    if (typeof cfg?.srcDir === "string" && cfg.srcDir.length > 0) {
      return resolve(packageDir, cfg.srcDir);
    }
  }
  return resolve(packageDir, DEFAULT_SRC_DIR);
}

function packageDeclaresLibrary(packageDir: string): boolean {
  const pkg = readJson(join(packageDir, "package.json")) as
    | { blockml?: { library?: string } }
    | undefined;
  const library = pkg?.blockml?.library;
  return typeof library === "string" && library.length > 0;
}

function blockmlPackageBlocksRoot(packageDir: string): string | undefined {
  const hasLibrary = packageDeclaresLibrary(packageDir);
  const hasConfig = existsSync(join(packageDir, CONFIG_FILE));
  if (!hasLibrary && !hasConfig) {
    return undefined;
  }
  return packageSrcDir(packageDir);
}

function libraryDeclaredBlocksRoot(packageDir: string): string | undefined {
  if (!packageDeclaresLibrary(packageDir)) {
    return undefined;
  }
  return packageSrcDir(packageDir);
}

function forEachLocalPackage(rootDir: string, visit: (pkgDir: string) => void): void {
  let entries: string[];
  try {
    entries = readdirSync(join(rootDir, "packages"));
  } catch {
    return;
  }
  for (const entry of entries) {
    const pkgDir = join(rootDir, "packages", entry);
    try {
      if (!statSync(pkgDir).isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }
    visit(pkgDir);
  }
}

/**
 * Project-owned BML roots: this package's srcDir plus local packages/*
 * BlockML modules. Does not walk parent workspaces or node_modules
 * (realpath of a workspace symlink under packages/ still counts).
 */
export function projectSourceRoots(rootDir: string, srcDir = DEFAULT_SRC_DIR): string[] {
  const roots = new Set<string>();
  roots.add(resolve(rootDir, srcDir));
  forEachLocalPackage(rootDir, (pkgDir) => {
    const blocksRoot = blockmlPackageBlocksRoot(pkgDir);
    if (blocksRoot) {
      roots.add(blocksRoot);
    }
  });
  return [...roots];
}

/**
 * Blocks/srcDir roots of this package and local packages/* that declare
 * package.json blockml.library. Stricter than projectSourceRoots: config-only
 * packages are omitted. Does not walk parent workspaces or node_modules.
 */
export function projectLibraryPackageRoots(rootDir: string): string[] {
  const roots = new Set<string>();
  const local = libraryDeclaredBlocksRoot(rootDir);
  if (local) {
    roots.add(local);
  }
  forEachLocalPackage(rootDir, (pkgDir) => {
    const blocksRoot = libraryDeclaredBlocksRoot(pkgDir);
    if (blocksRoot) {
      roots.add(blocksRoot);
    }
  });
  return [...roots];
}

/**
 * Package directories (this package and local packages/*) that declare
 * package.json blockml.library. Sorted, canonical, no node_modules walk.
 */
export function projectLibraryPackageDirs(rootDir: string): string[] {
  const dirs = new Set<string>();
  if (packageDeclaresLibrary(rootDir)) {
    dirs.add(canonicalPath(rootDir));
  }
  forEachLocalPackage(rootDir, (pkgDir) => {
    if (packageDeclaresLibrary(pkgDir)) {
      dirs.add(canonicalPath(pkgDir));
    }
  });
  return [...dirs].sort();
}

/** Registry file paths whose realpath lies under any of the given roots. */
export function registryFilesUnderRoots(registry: TypeRegistry, roots: string[]): string[] {
  const files: string[] = [];
  for (const filePath of rootFqnByFilePath(registry).keys()) {
    if (roots.some((root) => isPathInsideOrEqual(filePath, root))) {
      files.push(filePath);
    }
  }
  return files.sort();
}
