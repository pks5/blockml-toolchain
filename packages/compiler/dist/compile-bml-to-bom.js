import { parse } from "@blockml/parser";
import { validate } from "@blockml/validator";
import { evaluateParseValue } from "@blockml/framework";
export function compileBmlToBom(input, options = {}) {
    const parseOptions = { filePath: input.filePath };
    if (options.typeRegistry) {
        const registry = options.typeRegistry;
        parseOptions.parseValue = (fqn, raw) => evaluateParseValue(fqn, raw, registry);
    }
    const parseResult = parse(input.source, parseOptions);
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
export function validateRegistryDocuments(registry, filePaths) {
    const seen = new Set();
    const diagnostics = [];
    const pathFilter = filePaths !== undefined ? new Set(filePaths) : undefined;
    let blocksWithErrors = 0;
    for (const fqn of registry.keys()) {
        const doc = registry.get(fqn);
        if (!doc) {
            continue;
        }
        const filePath = doc.source?.filePath ?? fqn;
        if (pathFilter && !pathFilter.has(filePath)) {
            continue;
        }
        if (seen.has(filePath)) {
            continue;
        }
        seen.add(filePath);
        const result = validate(doc, {
            typeRegistry: registry,
            continueOnError: true,
        });
        diagnostics.push(...result.diagnostics);
        if (!result.success) {
            blocksWithErrors += 1;
        }
    }
    return {
        diagnostics,
        blocksTested: seen.size,
        blocksWithErrors,
    };
}
//# sourceMappingURL=compile-bml-to-bom.js.map