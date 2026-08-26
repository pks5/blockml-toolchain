import { rootFqns as frameworkRootFqns } from "@blockml/framework";
import { escapeHtml, fqnToHtmlPath, fqnToPackagePrefix, packageIndexPath, relativePath } from "./fqn-path.js";
export function collectRootFqns(registry) {
    return frameworkRootFqns(registry);
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
/** Library prefixes from root FQNs named *.Library (strip the trailing .Library). */
export function collectLibraryPrefixes(rootFqns) {
    const prefixes = new Set();
    for (const fqn of rootFqns) {
        if (fqn.endsWith(".Library") && fqn.length > ".Library".length) {
            prefixes.add(fqn.slice(0, -".Library".length));
        }
    }
    return [...prefixes].sort();
}
/** Longest library prefix that owns this FQN, or undefined. */
export function owningLibraryPrefix(fqn, libraryPrefixes) {
    return libraryPrefixes
        .filter((prefix) => fqn === prefix || fqn.startsWith(`${prefix}.`))
        .sort((a, b) => b.length - a.length)[0];
}
function commonPrefixSegmentCount(prefixes) {
    if (prefixes.length === 0) {
        return 0;
    }
    const split = prefixes.map((p) => p.split("."));
    const first = split[0];
    let i = 0;
    while (i < first.length && split.every((s) => s[i] === first[i])) {
        i += 1;
    }
    return i;
}
/** Short unique heading for a library prefix among a set of prefixes. */
export function libraryGroupLabel(prefix, allPrefixes) {
    const last = packageSegmentLabel(prefix);
    const lastCollides = allPrefixes.filter((p) => packageSegmentLabel(p) === last).length > 1;
    if (!lastCollides) {
        return last;
    }
    const commonLen = commonPrefixSegmentCount(allPrefixes);
    if (commonLen === 0) {
        return prefix;
    }
    const stripped = prefix.split(".").slice(commonLen).join(".");
    return stripped || last;
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
export function renderDottedPackagePath(packageFqn, pagePath, options, knownFqns) {
    const segments = packageFqn.split(".").filter(Boolean);
    return segments
        .map((segment, index) => {
        const prefix = segments.slice(0, index + 1).join(".");
        const href = knownFqns.has(prefix)
            ? relativePath(pagePath, fqnToHtmlPath(prefix, options.outLayout))
            : relativePath(pagePath, packageIndexPath(prefix));
        return `<a href="${href}">${escapeHtml(segment)}</a>`;
    })
        .join(".");
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