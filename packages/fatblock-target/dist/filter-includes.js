export function matchesIncludePattern(fqn, pattern) {
    if (pattern.endsWith("*")) {
        const prefix = pattern.slice(0, -1);
        return fqn.startsWith(prefix);
    }
    return fqn === pattern;
}
export function filterByIncludes(fqns, patterns) {
    if (!patterns?.length) {
        return fqns;
    }
    return fqns.filter((fqn) => patterns.some((pattern) => matchesIncludePattern(fqn, pattern.trim())));
}
//# sourceMappingURL=filter-includes.js.map