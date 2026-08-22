/** Root FQN per file: registry key not prefixed by another key from the same file. */
export function rootFqnByFilePath(registry) {
    const byFile = new Map();
    for (const fqn of registry.keys()) {
        const doc = registry.get(fqn);
        const filePath = doc?.source?.filePath;
        if (!filePath || filePath.startsWith("<")) {
            continue;
        }
        const list = byFile.get(filePath) ?? [];
        list.push(fqn);
        byFile.set(filePath, list);
    }
    const roots = new Map();
    for (const [filePath, fqns] of byFile) {
        const root = fqns.find((candidate) => !fqns.some((other) => other !== candidate && candidate.startsWith(`${other}.`)));
        if (root) {
            roots.set(filePath, root);
        }
    }
    return roots;
}
export function rootFqns(registry) {
    return [...rootFqnByFilePath(registry).values()].sort();
}
//# sourceMappingURL=root-fqn.js.map