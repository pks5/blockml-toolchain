import { validateStyle } from "./validate-style.js";
import { bootstrapTypeRegistry, forkBom, validateConstraints, validateEmbeddedBlocks, validateInstances, validateGenerics, validatePresets, validateReadOnly, validateTypes, validateVersions, validateVisibility, TypeRegistry, } from "@blockml/framework";
/** Bootstrap scan diagnostics apply to the corpus, not the document under validation. */
function libraryBootstrapDiagnostics(bootstrap, options) {
    if (!options.libraryPaths?.length) {
        return [];
    }
    return bootstrap.diagnostics.filter((d) => d.code === "BML_LIBRARY_RESOLVE_ERROR");
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
        ...validateEmbeddedBlocks(pragmaticModel),
        ...validateVersions(pragmaticModel, registry),
        ...validateInstances(pragmaticModel, registry),
        ...validateGenerics(pragmaticModel, registry),
        ...validatePresets(pragmaticModel, registry),
        ...validateVisibility(pragmaticModel, registry),
        ...validateReadOnly(pragmaticModel, registry),
        ...validateConstraints(pragmaticModel, registry),
        ...validateStyle(pragmaticModel),
    ];
    const success = !diagnostics.some((d) => d.severity === "error");
    if (!continueOnError && !success) {
        return { diagnostics, success };
    }
    return { pragmaticModel, diagnostics, success };
}
//# sourceMappingURL=validate.js.map