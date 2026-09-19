import { resolve } from "node:path";
import { canonicalPath } from "./package-paths.js";
/** Location-based member FQNs for a library path from a library-mode bootstrap. */
export function getExportedFqns(libraryPath, bootstrap, rootDir = process.cwd()) {
    if (!bootstrap.exportsByLibrary) {
        return undefined;
    }
    const abs = canonicalPath(resolve(rootDir, libraryPath));
    return bootstrap.exportsByLibrary.get(abs);
}
//# sourceMappingURL=library-exports.js.map