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
export function diagnosticToLsp(diagnostic, documentText) {
    return {
        severity: bomSeverityToLsp(diagnostic.severity),
        code: diagnostic.code,
        message: diagnostic.message,
        range: bomLocationToRange(diagnostic.source, documentText),
        source: "blockml",
    };
}
//# sourceMappingURL=positions.js.map