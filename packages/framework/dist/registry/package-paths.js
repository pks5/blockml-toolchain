import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
export const CONFIG_FILE = "blockml.config.json";
export const DEFAULT_SRC_DIR = "blocks";
export function readJson(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        return undefined;
    }
}
/** True when a disk path is inside a node_modules tree (npm / dependency copy). */
export function isNodeModulesPath(filePath) {
    if (!filePath) {
        return false;
    }
    return filePath.replaceAll("\\", "/").split("/").includes("node_modules");
}
export function canonicalPath(path) {
    const abs = resolve(path);
    try {
        return realpathSync(abs);
    }
    catch {
        return abs;
    }
}
/** srcDir for a package: blockml.config.json override, else default "blocks". */
export function packageSrcDir(packageDir) {
    const configPath = join(packageDir, CONFIG_FILE);
    if (existsSync(configPath)) {
        const cfg = readJson(configPath);
        if (typeof cfg?.srcDir === "string" && cfg.srcDir.length > 0) {
            return resolve(packageDir, cfg.srcDir);
        }
    }
    return resolve(packageDir, DEFAULT_SRC_DIR);
}
export function packageDeclaresLibrary(packageDir) {
    const pkg = readJson(join(packageDir, "package.json"));
    const library = pkg?.blockml?.library;
    return typeof library === "string" && library.length > 0;
}
/** Blocks/srcDir root when the package is a BlockML module; otherwise undefined. */
export function blockmlPackageBlocksRoot(packageDir) {
    const hasLibrary = packageDeclaresLibrary(packageDir);
    const hasConfig = existsSync(join(packageDir, CONFIG_FILE));
    if (!hasLibrary && !hasConfig) {
        return undefined;
    }
    return packageSrcDir(packageDir);
}
//# sourceMappingURL=package-paths.js.map