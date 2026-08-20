export function fqnToHtmlPath(fqn, outLayout) {
    const segments = fqn.split(".");
    if (outLayout === "package") {
        const packageSegments = segments.length > 1 ? segments.slice(0, -1) : segments;
        return `${packageSegments.join("/")}/index.html`;
    }
    return `${segments.join("/")}.html`;
}
export function fqnToPackagePrefix(fqn) {
    const segments = fqn.split(".");
    return segments.length > 1 ? segments.slice(0, -1).join(".") : fqn;
}
export function packageIndexPath(packagePrefix) {
    return `${packagePrefix.split(".").join("/")}/index.html`;
}
export function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
export function relativePath(from, to) {
    const fromParts = from.split("/").filter(Boolean);
    const toParts = to.split("/").filter(Boolean);
    fromParts.pop();
    let common = 0;
    while (common < fromParts.length &&
        common < toParts.length &&
        fromParts[common] === toParts[common]) {
        common++;
    }
    const ups = fromParts.length - common;
    const prefix = ups === 0 ? "./" : "../".repeat(ups);
    return prefix + toParts.slice(common).join("/");
}
//# sourceMappingURL=fqn-path.js.map