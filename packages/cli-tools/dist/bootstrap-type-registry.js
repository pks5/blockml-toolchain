import { bootstrapTypeRegistry } from "@blockml/framework";
export function bootstrapProjectTypeRegistry(options) {
    const rootDir = options.rootDir ?? process.cwd();
    const srcDir = options.srcDirOverride ?? options.config.srcDir ?? "blocks";
    const libraries = options.librariesOverride ?? options.config.libraries ?? [];
    const bootstrapOptions = { rootDir, paths: [srcDir] };
    if (libraries.length > 0) {
        bootstrapOptions.libraryPaths = libraries;
    }
    return bootstrapTypeRegistry(bootstrapOptions);
}
//# sourceMappingURL=bootstrap-type-registry.js.map