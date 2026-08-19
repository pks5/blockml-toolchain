import { bootstrapTypeRegistry, defaultBootstrapPaths, forkBom, validateConstraints, validateTypes, TypeRegistry, } from "@blockml/framework";
export function validate(document, options = {}) {
    const continueOnError = options.continueOnError !== false;
    let registry;
    if (options.typeRegistry instanceof TypeRegistry) {
        registry = options.typeRegistry;
    }
    else {
        const paths = options.bootstrapPaths ?? defaultBootstrapPaths();
        registry = bootstrapTypeRegistry(paths).registry;
    }
    const pragmaticModel = forkBom(document);
    const diagnostics = [
        ...validateTypes(pragmaticModel, registry),
        ...validateConstraints(pragmaticModel, registry),
    ];
    const success = !diagnostics.some((d) => d.severity === "error");
    if (!continueOnError && !success) {
        return { diagnostics, success };
    }
    return { pragmaticModel, diagnostics, success };
}
//# sourceMappingURL=validate.js.map