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
export function directBlocks(packagePrefix, rootFqns) {
    return rootFqns.filter((fqn) => fqnToPackagePrefix(fqn) === packagePrefix).sort();
}
export function directSubPackages(packagePrefix, rootFqns) {
    const subs = new Set();
    if (!packagePrefix) {
        for (const fqn of rootFqns) {
            const first = fqnToPackagePrefix(fqn).split(".")[0];
            if (first) {
                subs.add(first);
            }
        }
        return [...subs].sort();
    }
    const prefixDot = `${packagePrefix}.`;
    for (const fqn of rootFqns) {
        const pkg = fqnToPackagePrefix(fqn);
        if (!pkg.startsWith(prefixDot)) {
            continue;
        }
        const firstSegment = pkg.slice(prefixDot.length).split(".")[0];
        if (firstSegment) {
            subs.add(`${prefixDot}${firstSegment}`);
        }
    }
    return [...subs].sort();
}
/**
 * Deepest package prefix reached by skipping levels that have exactly one
 * sub-package and no direct blocks. Empty string = site root is interesting.
 */
export function firstInterestingPackagePrefix(rootFqns) {
    let current = "";
    for (;;) {
        const blocks = directBlocks(current, rootFqns);
        const subs = directSubPackages(current, rootFqns);
        if (blocks.length > 0 || subs.length !== 1) {
            return current;
        }
        current = subs[0];
    }
}
export const ALL_BLOCKS_FILE = "all-blocks.html";
export function resolveSiteNav(rootFqns, options, libraryPrefix) {
    const allBlocksPath = libraryPrefix
        ? `${libraryPrefix.split(".").join("/")}/${ALL_BLOCKS_FILE}`
        : ALL_BLOCKS_FILE;
    const fallbackHome = libraryPrefix
        ? `${libraryPrefix.split(".").join("/")}/index.html`
        : "index.html";
    if (options.outLayout !== "fqn") {
        return { rootIndexPath: fallbackHome, allBlocksPath };
    }
    const scoped = libraryPrefix
        ? rootFqns.filter((fqn) => fqn === libraryPrefix || fqn.startsWith(`${libraryPrefix}.`))
        : rootFqns;
    const interesting = firstInterestingPackagePrefix(scoped);
    return {
        rootIndexPath: interesting ? packageIndexPath(interesting) : fallbackHome,
        allBlocksPath,
    };
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