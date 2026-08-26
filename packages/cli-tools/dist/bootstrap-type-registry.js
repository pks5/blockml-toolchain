import { bootstrapTypeRegistry, resolveLibrarySeeds, } from "@blockml/framework";
export function projectLibrarySeeds(options) {
    const rootDir = options.rootDir ?? process.cwd();
    const extras = options.librariesOverride ?? options.config.libraries ?? [];
    return resolveLibrarySeeds(rootDir, extras);
}
/** package.json blockml.library path, if declared. */
export function projectIdentityLibraryPath(rootDir) {
    return resolveLibrarySeeds(rootDir)[0];
}
export function bootstrapProjectTypeRegistry(options) {
    const rootDir = options.rootDir ?? process.cwd();
    const srcDir = options.srcDirOverride ?? options.config.srcDir ?? "blocks";
    const libraries = projectLibrarySeeds(options);
    const paths = options.corpusPaths ?? [srcDir];
    const bootstrapOptions = { rootDir, paths };
    if (libraries.length > 0) {
        bootstrapOptions.libraryPaths = libraries;
    }
    return bootstrapTypeRegistry(bootstrapOptions);
}
//# sourceMappingURL=bootstrap-type-registry.js.map