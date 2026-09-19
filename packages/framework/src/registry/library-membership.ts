import { existsSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import type { BomDocument } from "@blockml/bom";
import { canonicalPath, packageSrcDir } from "./package-paths.js";
import type { TypeRegistry } from "./type-registry.js";

export const LIBRARY_FILENAME = "Library.bml";

export function isLibraryDescriptorPath(filePath: string): boolean {
  return basename(filePath) === LIBRARY_FILENAME;
}

function isPathInside(inner: string, outer: string): boolean {
  const a = canonicalPath(inner);
  const b = canonicalPath(outer);
  const rel = relative(b, a);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function isStrictlyInside(inner: string, outer: string): boolean {
  const a = canonicalPath(inner);
  const b = canonicalPath(outer);
  const rel = relative(b, a);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/** Source folder (package srcDir) containing this file, if the file sits inside it. */
export function sourceRootForFile(filePath: string): string | undefined {
  if (!filePath || filePath.startsWith("<")) {
    return undefined;
  }
  const abs = canonicalPath(filePath);
  let dir = dirname(abs);
  for (;;) {
    if (existsSync(join(dir, "package.json"))) {
      const src = packageSrcDir(dir);
      if (isPathInside(abs, src)) {
        return src;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return undefined;
}

/**
 * Nearest Library.bml at the same directory or above.
 * Search stops one level below the source folder (srcDir is not searched).
 * The first Library found walking up wins, so nested libraries own their subtree.
 */
export function findOwningLibraryFile(
  blockFilePath: string,
  ownerByDir?: Map<string, string | undefined>,
): string | undefined {
  if (!blockFilePath || blockFilePath.startsWith("<")) {
    return undefined;
  }
  const abs = canonicalPath(blockFilePath);
  const sourceRoot = sourceRootForFile(abs);
  if (!sourceRoot) {
    return undefined;
  }
  let dir = dirname(abs);
  const walked: string[] = [];
  while (isStrictlyInside(dir, sourceRoot)) {
    if (ownerByDir?.has(dir)) {
      const owner = ownerByDir.get(dir);
      for (const seen of walked) {
        ownerByDir.set(seen, owner);
      }
      return owner;
    }
    walked.push(dir);
    const candidate = join(dir, LIBRARY_FILENAME);
    if (existsSync(candidate)) {
      const owner = canonicalPath(candidate);
      if (ownerByDir) {
        for (const seen of walked) {
          ownerByDir.set(seen, owner);
        }
      }
      return owner;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  if (ownerByDir) {
    for (const seen of walked) {
      ownerByDir.set(seen, undefined);
    }
  }
  return undefined;
}

export function locateOwningLibrary(
  registry: TypeRegistry,
  fqn: string,
): { libraryFqn: string; libraryFile: string; packageFqn: string } | undefined {
  const parts = fqn.split(".");
  parts.pop();
  while (parts.length > 0) {
    const packageFqn = parts.join(".");
    const libraryFqn = `${packageFqn}.Library`;
    const doc = registry.get(libraryFqn);
    const libraryFile = doc?.source.filePath;
    if (libraryFile && !libraryFile.startsWith("<")) {
      return { libraryFqn, libraryFile, packageFqn };
    }
    parts.pop();
  }
  return undefined;
}

const libraryDocsByRegistry = new WeakMap<TypeRegistry, Map<string, BomDocument>>();

function libraryDocumentsByFile(registry: TypeRegistry): Map<string, BomDocument> {
  const cached = libraryDocsByRegistry.get(registry);
  if (cached) {
    return cached;
  }
  const map = new Map<string, BomDocument>();
  for (const fqn of registry.keys()) {
    const doc = registry.get(fqn);
    const file = doc?.source.filePath;
    if (file && !file.startsWith("<") && isLibraryDescriptorPath(file)) {
      map.set(canonicalPath(file), doc);
    }
  }
  libraryDocsByRegistry.set(registry, map);
  return map;
}

function libraryDocumentForFile(
  registry: TypeRegistry,
  libraryFile: string,
): BomDocument | undefined {
  return libraryDocumentsByFile(registry).get(canonicalPath(libraryFile));
}

/** Owning library document for a block, by file location then FQN prefix. */
export function findOwningLibraryDocument(
  registry: TypeRegistry,
  typeFqn: string | undefined,
  filePath: string | undefined,
): BomDocument | undefined {
  if (filePath) {
    const ownerFile = findOwningLibraryFile(filePath);
    if (ownerFile) {
      const byFile = libraryDocumentForFile(registry, ownerFile);
      if (byFile) {
        return byFile;
      }
    }
  }
  if (typeFqn) {
    const byFqn = locateOwningLibrary(registry, typeFqn);
    if (byFqn) {
      return registry.get(byFqn.libraryFqn);
    }
  }
  return undefined;
}

export function collectLocationExports(
  files: { filePath: string; typeFqn: string }[],
): Map<string, Set<string>> {
  const exports = new Map<string, Set<string>>();
  const ownerByDir = new Map<string, string | undefined>();
  for (const { filePath, typeFqn } of files) {
    if (!typeFqn || isLibraryDescriptorPath(filePath)) {
      continue;
    }
    const owner = findOwningLibraryFile(filePath, ownerByDir);
    if (!owner) {
      continue;
    }
    const set = exports.get(owner) ?? new Set<string>();
    set.add(typeFqn);
    exports.set(owner, set);
  }
  return exports;
}
