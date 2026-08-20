import { escapeHtml, fqnToHtmlPath, fqnToPackagePrefix, packageIndexPath, relativePath } from "./fqn-path.js";
export function collectRootFqns(registry) {
    const byFile = new Map();
    for (const fqn of registry.keys()) {
        const doc = registry.get(fqn);
        const filePath = doc?.source?.filePath;
        if (!filePath) {
            continue;
        }
        const existing = byFile.get(filePath);
        if (!existing || fqn.split(".").length < existing.split(".").length) {
            byFile.set(filePath, fqn);
        }
    }
    return [...byFile.values()].sort();
}
export function rootFqnForBlock(fqn, rootFqns) {
    const match = rootFqns
        .filter((root) => fqn === root || fqn.startsWith(`${root}.`))
        .sort((a, b) => b.length - a.length)[0];
    return match;
}
export function packageSegmentLabel(packagePrefix) {
    const segments = packagePrefix.split(".");
    return segments[segments.length - 1] ?? packagePrefix;
}
export function blockPathSegments(fqn, rootFqn) {
    const rootPackage = fqnToPackagePrefix(rootFqn);
    if (fqn === rootFqn) {
        return [fqn.split(".").pop() ?? fqn];
    }
    if (!fqn.startsWith(`${rootPackage}.`)) {
        return [fqn.split(".").pop() ?? fqn];
    }
    return fqn.slice(rootPackage.length + 1).split(".");
}
export function collectPackagePrefixes(rootFqns) {
    const prefixes = new Set();
    for (const fqn of rootFqns) {
        const pkg = fqnToPackagePrefix(fqn);
        const segments = pkg.split(".");
        for (let i = 1; i <= segments.length; i++) {
            prefixes.add(segments.slice(0, i).join("."));
        }
    }
    return [...prefixes].sort();
}
export function renderNavigationBreadcrumb(fqn, rootFqn, pagePath, options, rootIndexPath) {
    const parts = [`<a href="${relativePath(pagePath, rootIndexPath)}">Index</a>`];
    if (options.outLayout === "fqn") {
        const rootPackage = fqnToPackagePrefix(rootFqn);
        const segments = rootPackage.split(".");
        for (let i = 1; i <= segments.length; i++) {
            const prefix = segments.slice(0, i).join(".");
            const href = relativePath(pagePath, packageIndexPath(prefix));
            parts.push(`<a href="${href}">${escapeHtml(packageSegmentLabel(prefix))}</a>`);
        }
        const blockSegments = blockPathSegments(fqn, rootFqn);
        for (let i = 0; i < blockSegments.length; i++) {
            const segment = blockSegments[i];
            if (i < blockSegments.length - 1) {
                const segmentFqn = `${rootPackage}.${blockSegments.slice(0, i + 1).join(".")}`;
                const href = relativePath(pagePath, fqnToHtmlPath(segmentFqn, options.outLayout));
                parts.push(`<a href="${href}">${escapeHtml(segment)}</a>`);
            }
            else {
                parts.push(escapeHtml(segment));
            }
        }
    }
    else {
        parts.push(escapeHtml(fqn));
    }
    return parts.join(" / ");
}
//# sourceMappingURL=navigation.js.map