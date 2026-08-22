import { resolve } from "node:path";
/** Exported block FQNs for a library path from a library-mode bootstrap. */
export function getExportedFqns(libraryPath, bootstrap, rootDir = process.cwd()) {
    if (!bootstrap.exportsByLibrary) {
        return undefined;
    }
    const abs = resolve(rootDir, libraryPath);
    return bootstrap.exportsByLibrary.get(abs);
}
//# sourceMappingURL=library-exports.js.map