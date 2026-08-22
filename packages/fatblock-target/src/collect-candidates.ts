import { resolve, sep } from "node:path";
import type { TypeRegistry } from "@blockml/framework";
import { rootFqnByFilePath } from "@blockml/framework";
import { filterByIncludes } from "./filter-includes.js";

function normalizePath(p: string): string {
  return p.split(sep).join("/");
}

function isPathUnderDir(filePath: string, dirPath: string): boolean {
  const file = normalizePath(resolve(filePath));
  const dir = normalizePath(resolve(dirPath));
  return file === dir || file.startsWith(`${dir}/`);
}

/** Root FQN per file: the registry key not prefixed by another key from the same file. */
export function rootFqnsByFilePath(registry: TypeRegistry): Map<string, string> {
  return rootFqnByFilePath(registry);
}

export function collectCandidateFqns(
  registry: TypeRegistry,
  srcDir: string,
  rootDir: string,
  hostFqn: string,
  includePatterns?: string[],
): { fqns: string[]; hostFilePath?: string } {
  const absSrc = resolve(rootDir, srcDir);
  const roots = rootFqnsByFilePath(registry);
  const candidates: string[] = [];
  let hostFilePath: string | undefined;

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

  const result: { fqns: string[]; hostFilePath?: string } = { fqns };
  if (hostFilePath !== undefined) {
    result.hostFilePath = hostFilePath;
  }
  return result;
}
