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
        const result = bootstrapFromLibraryPaths(options.libraryPaths, searchRoots, rootDir);
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
    const paths = options.paths && options.paths.length > 0 ? options.paths : defaultBootstrapPaths(rootDir);
    return bootstrapFromCorpusPaths(paths, rootDir);
}
//# sourceMappingURL=bootstrap.js.map