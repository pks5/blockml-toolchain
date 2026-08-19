import { bootstrapTypeRegistry, forkBom, validateConstraints, validateTypes, validateVersions, TypeRegistry, } from "@blockml/framework";
/** Bootstrap scan diagnostics apply to the corpus, not the document under validation. */
function libraryBootstrapDiagnostics(bootstrap, options) {
    if (!options.libraryPaths?.length) {
        return [];
    }
    return bootstrap.diagnostics.filter((d) => d.code === "BML_LIBRARY_RESOLVE_ERROR" ||
        d.code === "BML_LIBRARY_NESTING_VIOLATION");
}
export function validate(document, options = {}) {
    const continueOnError = options.continueOnError !== false;
    let registry;
    let bootstrapDiagnostics = [];
    if (options.typeRegistry instanceof TypeRegistry) {
        registry = options.typeRegistry;
    }
    else {
        const bootstrapOptions = { rootDir: process.cwd() };
        if (options.bootstrapPaths) {
            bootstrapOptions.paths = options.bootstrapPaths;
        }
        if (options.libraryPaths) {
            bootstrapOptions.libraryPaths = options.libraryPaths;
        }
        const bootstrap = bootstrapTypeRegistry(bootstrapOptions);
        registry = bootstrap.registry;
        bootstrapDiagnostics = libraryBootstrapDiagnostics(bootstrap, options);
    }
    const pragmaticModel = forkBom(document);
    const diagnostics = [
        ...bootstrapDiagnostics,
        ...validateTypes(pragmaticModel, registry),
        ...validateVersions(pragmaticModel, registry),
        ...validateConstraints(pragmaticModel, registry),
    ];
    const success = !diagnostics.some((d) => d.severity === "error");
    if (!continueOnError && !success) {
        return { diagnostics, success };
    }
    return { pragmaticModel, diagnostics, success };
}
//# sourceMappingURL=validate.js.map