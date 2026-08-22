import type { TypeRegistry } from "./type-registry.js";

/** Root FQN per file: registry key not prefixed by another key from the same file. */
export function rootFqnByFilePath(registry: TypeRegistry): Map<string, string> {
  const byFile = new Map<string, string[]>();

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

  const roots = new Map<string, string>();
  for (const [filePath, fqns] of byFile) {
    const root = fqns.find(
      (candidate) =>
        !fqns.some(
          (other) => other !== candidate && candidate.startsWith(`${other}.`),
        ),
    );
    if (root) {
      roots.set(filePath, root);
    }
  }
  return roots;
}

export function rootFqns(registry: TypeRegistry): string[] {
  return [...rootFqnByFilePath(registry).values()].sort();
}
