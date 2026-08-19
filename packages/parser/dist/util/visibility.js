export function parseVisibilityFromName(localName) {
    if (localName.startsWith("__")) {
        return { name: localName.slice(2), visibility: "private" };
    }
    if (localName.startsWith("_")) {
        return { name: localName.slice(1), visibility: "protected" };
    }
    return { name: localName, visibility: "public" };
}
export function visibilityPrefix(visibility) {
    switch (visibility) {
        case "private":
            return "__";
        case "protected":
            return "_";
        default:
            return "";
    }
}
//# sourceMappingURL=visibility.js.map