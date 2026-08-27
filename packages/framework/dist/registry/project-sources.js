import { existsSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { rootFqnByFilePath } from "./root-fqn.js";
import { blockmlPackageBlocksRoot, canonicalPath, CONFIG_FILE, DEFAULT_SRC_DIR, packageDeclaresLibrary, packageSrcDir, } from "./package-paths.js";
function isPathInsideOrEqual(inner, outer) {
    const a = canonicalPath(inner);
    const b = canonicalPath(outer);
    const rel = relative(b, a);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
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
/**
 * Package directories (this package and local packages/*) that declare
 * package.json blockml.library. Sorted, canonical, no node_modules walk.
 */
export function projectLibraryPackageDirs(rootDir) {
    const dirs = new Set();
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
export function registryFilesUnderRoots(registry, roots) {
    const files = [];
    for (const filePath of rootFqnByFilePath(registry).keys()) {
        if (roots.some((root) => isPathInsideOrEqual(filePath, root))) {
            files.push(filePath);
        }
    }
    return files.sort();
}
export { CONFIG_FILE, DEFAULT_SRC_DIR };
//# sourceMappingURL=project-sources.js.map