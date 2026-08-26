import { bootstrapTypeRegistry, resolveLibrarySeeds, } from "@blockml/framework";
export function projectLibrarySeeds(options) {
    const rootDir = options.rootDir ?? process.cwd();
    const extras = options.librariesOverride ?? options.config.libraries ?? [];
    return resolveLibrarySeeds(rootDir, extras);
}
export function bootstrapProjectTypeRegistry(options) {
    const rootDir = options.rootDir ?? process.cwd();
    const srcDir = options.srcDirOverride ?? options.config.srcDir ?? "blocks";
    const libraries = projectLibrarySeeds(options);
    const bootstrapOptions = { rootDir, paths: [srcDir] };
    if (libraries.length > 0) {
        bootstrapOptions.libraryPaths = libraries;
    }
    return bootstrapTypeRegistry(bootstrapOptions);
}
//# sourceMappingURL=bootstrap-type-registry.js.map