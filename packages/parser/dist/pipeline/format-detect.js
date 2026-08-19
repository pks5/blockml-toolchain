export function detectFormat(source) {
    const trimmed = source.trimStart();
    if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) {
        return "xml";
    }
    return null;
}
//# sourceMappingURL=format-detect.js.map