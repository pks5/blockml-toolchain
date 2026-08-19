import { join } from "node:path";
import { TypeRegistry } from "./type-registry.js";
import { bootstrapFromCorpusPaths, bootstrapFromLibraryPaths, } from "./library-bootstrap.js";
export function defaultBootstrapPaths(rootDir = process.cwd()) {
    return [
        join(rootDir, "node_modules/@blockml/core/blocks"),
        join(rootDir, "node_modules/@machineblocks/core/blocks"),
    ];
}
function normalizeOptions(optionsOrPaths, rootDirArg) {
    if (Array.isArray(optionsOrPaths)) {
        return { paths: optionsOrPaths, rootDir: rootDirArg ?? process.cwd() };
    }
    if (optionsOrPaths) {
        return { ...optionsOrPaths, rootDir: optionsOrPaths.rootDir ?? rootDirArg ?? process.cwd() };
    }
    return { rootDir: rootDirArg ?? process.cwd() };
}
export function bootstrapTypeRegistry(optionsOrPaths, rootDirArg) {
    const options = normalizeOptions(optionsOrPaths, rootDirArg);
    const rootDir = options.rootDir ?? process.cwd();
    const searchRoots = [
        ...(options.paths ?? []),
        ...(options.libraryPaths ?? []),
        ...defaultBootstrapPaths(rootDir),
        join(rootDir, "packages"),
    ].map((p) => (p.startsWith("/") || p.includes(":") ? p : join(rootDir, p)));
    if (options.libraryPaths && options.libraryPaths.length > 0) {
        return bootstrapFromLibraryPaths(options.libraryPaths, searchRoots, rootDir);
    }
    const paths = options.paths && options.paths.length > 0 ? options.paths : defaultBootstrapPaths(rootDir);
    return bootstrapFromCorpusPaths(paths, rootDir);
}
//# sourceMappingURL=bootstrap.js.map