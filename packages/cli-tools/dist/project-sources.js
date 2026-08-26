import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { rootFqnByFilePath } from "@blockml/framework";
const CONFIG_FILE = "blockml.config.json";
const DEFAULT_SRC_DIR = "blocks";
function canonicalPath(path) {
    const abs = resolve(path);
    try {
        return realpathSync(abs);
    }
    catch {
        return abs;
    }
}
function isPathInsideOrEqual(inner, outer) {
    const a = canonicalPath(inner);
    const b = canonicalPath(outer);
    const rel = relative(b, a);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        return undefined;
    }
}
function packageSrcDir(packageDir) {
    const configPath = join(packageDir, CONFIG_FILE);
    if (existsSync(configPath)) {
        const cfg = readJson(configPath);
        if (typeof cfg?.srcDir === "string" && cfg.srcDir.length > 0) {
            return resolve(packageDir, cfg.srcDir);
        }
    }
    return resolve(packageDir, DEFAULT_SRC_DIR);
}
function packageDeclaresLibrary(packageDir) {
    const pkg = readJson(join(packageDir, "package.json"));
    const library = pkg?.blockml?.library;
    return typeof library === "string" && library.length > 0;
}
function blockmlPackageBlocksRoot(packageDir) {
    const hasLibrary = packageDeclaresLibrary(packageDir);
    const hasConfig = existsSync(join(packageDir, CONFIG_FILE));
    if (!hasLibrary && !hasConfig) {
        return undefined;
    }
    return packageSrcDir(packageDir);
}
function libraryDeclaredBlocksRoot(packageDir) {
    if (!packageDeclaresLibrary(packageDir)) {
        return undefined;
    }
    return packageSrcDir(packageDir);
}
function forEachLocalPackage(rootDir, visit) {
    let entries;
    try {
        entries = readdirSync(join(rootDir, "packages"));
    }
    catch {
        return;
    }
    for (const entry of entries) {
        const pkgDir = join(rootDir, "packages", entry);
        try {
            if (!statSync(pkgDir).isDirectory()) {
                continue;
            }
        }
        catch {
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
export function projectSourceRoots(rootDir, srcDir = DEFAULT_SRC_DIR) {
    const roots = new Set();
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
export function projectLibraryPackageRoots(rootDir) {
    const roots = new Set();
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
/** Registry file paths whose realpath lies under any of the given roots. */
export function registryFilesUnderRoots(registry, roots) {
    const files = [];
    for (const filePath of rootFqnByFilePath(registry).keys()) {
        if (roots.some((root) => isPathInsideOrEqual(filePath, root))) {
            files.push(filePath);
        }
    }
    return files.sort();
}
//# sourceMappingURL=project-sources.js.map