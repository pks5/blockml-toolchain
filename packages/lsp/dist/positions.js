import { offsetRangeToLsp, positionToOffset } from "./xml-token.js";
export function bomSeverityToLsp(severity) {
    switch (severity) {
        case "warning":
            return 2;
        case "info":
            return 3;
        case "recommendation":
            return 4;
        default:
            return 1;
    }
}
function lineEndColumn(text, line) {
    const lines = text.split("\n");
    const idx = line - 1;
    if (idx < 0 || idx >= lines.length) {
        return 1;
    }
    return (lines[idx]?.length ?? 0) + 1;
}
export function bomLocationToRange(loc, documentText) {
    const startLine = Math.max(0, loc.line - 1);
    const startCharacter = Math.max(0, loc.column - 1);
    let endLine = startLine;
    let endCharacter = startCharacter + 1;
    if (loc.endLine !== undefined && loc.endColumn !== undefined) {
        endLine = Math.max(0, loc.endLine - 1);
        endCharacter = Math.max(0, loc.endColumn - 1);
    }
    else if (documentText !== undefined) {
        endCharacter = lineEndColumn(documentText, loc.line);
    }
    if (endLine < startLine || (endLine === startLine && endCharacter <= startCharacter)) {
        endCharacter = startCharacter + 1;
    }
    return {
        start: { line: startLine, character: startCharacter },
        end: { line: endLine, character: endCharacter },
    };
}
function isNameStart(ch) {
    return ch !== undefined && /[A-Za-z_]/.test(ch);
}
function isNameChar(ch) {
    return ch !== undefined && /[A-Za-z0-9_.:-]/.test(ch);
}
function bomOffset(text, loc) {
    return positionToOffset(text, {
        line: Math.max(0, loc.line - 1),
        character: Math.max(0, loc.column - 1),
    });
}
/** Opening tag name at `loc` (`<prefix:Local`), or undefined when loc is not `<Name`. */
function openingTagNameRange(text, loc) {
    const start = bomOffset(text, loc);
    if (text[start] !== "<") {
        return undefined;
    }
    const next = text[start + 1];
    if (next === "/" || next === "!" || next === "?" || !isNameStart(next)) {
        return undefined;
    }
    let end = start + 2;
    while (end < text.length && isNameChar(text[end])) {
        end++;
    }
    return offsetRangeToLsp(text, start, end);
}
function rangeStartsAtAndExtendsPast(full, inner) {
    if (full.start.line !== inner.start.line || full.start.character !== inner.start.character) {
        return false;
    }
    if (full.end.line > inner.end.line) {
        return true;
    }
    return full.end.line === inner.end.line && full.end.character > inner.end.character;
}
export function diagnosticToLsp(diagnostic, documentText) {
    let range = bomLocationToRange(diagnostic.source, documentText);
    if (documentText !== undefined && diagnostic.severity === "warning") {
        const tagRange = openingTagNameRange(documentText, diagnostic.source);
        if (tagRange && rangeStartsAtAndExtendsPast(range, tagRange)) {
            range = tagRange;
        }
    }
    return {
        severity: bomSeverityToLsp(diagnostic.severity),
        code: diagnostic.code,
        message: diagnostic.message,
        range,
        source: "blockml",
    };
}
//# sourceMappingURL=positions.js.map