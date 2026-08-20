import { resolve, sep } from "node:path";
import { filterByIncludes } from "./filter-includes.js";
function normalizePath(p) {
    return p.split(sep).join("/");
}
function isPathUnderDir(filePath, dirPath) {
    const file = normalizePath(resolve(filePath));
    const dir = normalizePath(resolve(dirPath));
    return file === dir || file.startsWith(`${dir}/`);
}
/** Root FQN per file: the registry key not prefixed by another key from the same file. */
export function rootFqnsByFilePath(registry) {
    const byFile = new Map();
    for (const fqn of registry.keys()) {
        const doc = registry.get(fqn);
        const filePath = doc?.source.filePath;
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
export function collectCandidateFqns(registry, srcDir, rootDir, hostFqn, includePatterns) {
    const absSrc = resolve(rootDir, srcDir);
    const roots = rootFqnsByFilePath(registry);
    const candidates = [];
    let hostFilePath;
    for (const [filePath, fqn] of roots) {
        if (!isPathUnderDir(filePath, absSrc)) {
            continue;
        }
        if (fqn === hostFqn) {
            hostFilePath = filePath;
            continue;
        }
        candidates.push(fqn);
    }
    let fqns = candidates.sort();
    if (includePatterns?.length) {
        fqns = filterByIncludes(fqns, includePatterns);
    }
    const result = { fqns };
    if (hostFilePath !== undefined) {
        result.hostFilePath = hostFilePath;
    }
    return result;
}
//# sourceMappingURL=collect-candidates.js.map