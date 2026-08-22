import { detectFormat } from "./pipeline/format-detect.js";
import { documentElement, getParseErrors, parseXmlDom } from "./pipeline/xml-dom.js";
import { assertBlockRoot } from "./pipeline/root-type.js";
import { extractNamespaceBindings, mergeSourceInfo, } from "./pipeline/namespaces.js";
import { mapDocumentBlock } from "./map/map-block.js";
function diagnostic(code, message, filePath) {
    return {
        severity: "error",
        code,
        message,
        source: { file: filePath, line: 1, column: 1 },
    };
}
export function parse(source, options = {}) {
    const filePath = options.filePath ?? "<memory>";
    const continueOnError = options.continueOnError ?? true;
    const diagnostics = [];
    const format = detectFormat(source);
    if (format !== "xml") {
        diagnostics.push(diagnostic("BML_UNSUPPORTED_FORMAT", "Unsupported or undetected format", filePath));
        return { document: null, diagnostics, success: false };
    }
    let doc;
    try {
        doc = parseXmlDom(source);
    }
    catch (e) {
        diagnostics.push(diagnostic("BML_MALFORMED_XML", e instanceof Error ? e.message : String(e), filePath));
        return { document: null, diagnostics, success: false };
    }
    const parseErrors = getParseErrors(doc);
    if (parseErrors.length > 0) {
        for (const err of parseErrors) {
            diagnostics.push(diagnostic("BML_MALFORMED_XML", err, filePath));
        }
        if (!continueOnError) {
            return { document: null, diagnostics, success: false };
        }
    }
    const root = documentElement(doc);
    if (!root) {
        diagnostics.push(diagnostic("BML_MISSING_ROOT", "No document element", filePath));
        return { document: null, diagnostics, success: false };
    }
    try {
        assertBlockRoot(root);
    }
    catch (e) {
        diagnostics.push(diagnostic("BML_INVALID_ROOT", e instanceof Error ? e.message : String(e), filePath));
        return { document: null, diagnostics, success: false };
    }
    const partialSource = extractNamespaceBindings(root);
    const sourceInfo = mergeSourceInfo(partialSource, filePath);
    const bindings = sourceInfo.namespaceBindings ?? {};
    let block;
    try {
        block = mapDocumentBlock(root, filePath, source, bindings);
    }
    catch (e) {
        diagnostics.push(diagnostic("BML_MAP_ERROR", e instanceof Error ? e.message : String(e), filePath));
        if (!continueOnError) {
            return { document: null, diagnostics, success: false };
        }
        return {
            document: null,
            diagnostics,
            success: diagnostics.every((d) => d.severity !== "error"),
        };
    }
    const document = {
        kind: "block",
        source: sourceInfo,
        block,
    };
    const success = diagnostics.every((d) => d.severity !== "error");
    return { document, diagnostics, success };
}
//# sourceMappingURL=parse.js.map