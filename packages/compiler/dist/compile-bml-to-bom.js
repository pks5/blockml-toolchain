import { parse } from "@blockml/parser";
import { validate } from "@blockml/validator";
export function compileBmlToBom(input, options = {}) {
    const parseResult = parse(input.source, { filePath: input.filePath });
    const diagnostics = [...parseResult.diagnostics];
    if (!parseResult.document) {
        return {
            output: null,
            diagnostics,
            success: diagnostics.some((d) => d.severity === "error") ? false : !parseResult.success,
        };
    }
    const validateOptions = { continueOnError: true };
    if (options.typeRegistry) {
        validateOptions.typeRegistry = options.typeRegistry;
    }
    const validateResult = validate(parseResult.document, validateOptions);
    diagnostics.push(...validateResult.diagnostics);
    const success = !diagnostics.some((d) => d.severity === "error");
    return {
        output: parseResult.document,
        diagnostics,
        success,
    };
}
export function validateRegistryDocuments(registry) {
    const seen = new Set();
    const diagnostics = [];
    for (const fqn of registry.keys()) {
        const doc = registry.get(fqn);
        if (!doc) {
            continue;
        }
        const filePath = doc.source?.filePath ?? fqn;
        if (seen.has(filePath)) {
            continue;
        }
        seen.add(filePath);
        const result = validate(doc, {
            typeRegistry: registry,
            continueOnError: true,
        });
        diagnostics.push(...result.diagnostics);
    }
    return diagnostics;
}
//# sourceMappingURL=compile-bml-to-bom.js.map