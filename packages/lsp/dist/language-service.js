import { parse } from "@blockml/parser";
import { serialize } from "@blockml/serializer";
import { validate } from "@blockml/validator";
import { workspaceWithOpenDocument } from "./workspace.js";
export function analyzeDocument(text, filePath, workspace) {
    const parseResult = parse(text, { filePath, continueOnError: true });
    const diagnostics = [...parseResult.diagnostics];
    if (!parseResult.document) {
        return { diagnostics, document: null };
    }
    const scoped = workspaceWithOpenDocument(workspace, parseResult.document);
    const validateResult = validate(parseResult.document, {
        typeRegistry: scoped.registry,
        continueOnError: true,
    });
    diagnostics.push(...validateResult.diagnostics);
    return {
        diagnostics,
        document: parseResult.document,
    };
}
function hasXmlDeclaration(text) {
    return /^\s*<\?xml\b/.test(text);
}
export function formatDocument(text, options = {}) {
    const parseResult = parse(text, { continueOnError: true });
    if (!parseResult.document) {
        return null;
    }
    const serializeOptions = {
        xmlDeclaration: options.xmlDeclaration ?? hasXmlDeclaration(text),
    };
    if (options.indent !== undefined) {
        serializeOptions.indent = options.indent;
    }
    const result = serialize(parseResult.document, serializeOptions);
    return result.text;
}
//# sourceMappingURL=language-service.js.map