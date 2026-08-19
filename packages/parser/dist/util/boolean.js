export function normalizeBooleanValue(raw) {
    const v = raw.trim().toLowerCase();
    if (v === "true") {
        return true;
    }
    if (v === "false") {
        return false;
    }
    throw new Error(`Invalid boolean literal: ${raw}`);
}
export function isBooleanLiteral(raw) {
    const v = raw.trim().toLowerCase();
    return v === "true" || v === "false";
}
export function parseBooleanAttribute(raw) {
    return normalizeBooleanValue(raw);
}
//# sourceMappingURL=boolean.js.map