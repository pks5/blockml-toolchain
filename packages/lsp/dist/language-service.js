import { parse } from "@blockml/parser";
import { validate } from "@blockml/validator";
export function analyzeDocument(text, filePath, workspace) {
    const parseResult = parse(text, { filePath, continueOnError: true });
    const diagnostics = [...parseResult.diagnostics];
    if (!parseResult.document) {
        return { diagnostics, document: null };
    }
    const validateResult = validate(parseResult.document, {
        typeRegistry: workspace.registry,
        continueOnError: true,
    });
    diagnostics.push(...validateResult.diagnostics);
    return {
        diagnostics,
        document: parseResult.document,
    };
}
//# sourceMappingURL=language-service.js.map