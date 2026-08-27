import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { BlockDefinition, BlockInstance, BomDocument, Diagnostic } from "@blockml/bom";
import { parse } from "@blockml/parser";
import { TypeRegistry } from "./type-registry.js";

function collectBmlFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      const st = statSync(full);
      if (st.isDirectory()) {
        collectBmlFiles(full, out);
      } else if (entry.endsWith(".bml")) {
        out.push(full);
      }
    } catch {
      continue;
    }
  }
  return out;
}

const CONFIG_FILE = "blockml.config.json";
const DEFAULT_SRC_DIR = "blocks";

function packageSrcDir(packageDir: string): string {
  const configPath = join(packageDir, CONFIG_FILE);
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, "utf8")) as { srcDir?: string };
      if (typeof cfg.srcDir === "string" && cfg.srcDir.length > 0) {
        return resolve(packageDir, cfg.srcDir);
      }
    } catch {
      // fall through to default
    }
  }
  return resolve(packageDir, DEFAULT_SRC_DIR);
}

function blocksRootFromLibraryPath(libraryPath: string): string {
  let dir = dirname(canonicalPath(libraryPath));
  for (;;) {
    if (existsSync(join(dir, "package.json"))) {
      return packageSrcDir(dir);
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  const normalized = libraryPath.replace(/\\/g, "/");
  const marker = `/${DEFAULT_SRC_DIR}/`;
  const idx = normalized.indexOf(marker);
  if (idx >= 0) {
    return normalized.slice(0, idx + `/${DEFAULT_SRC_DIR}`.length);
  }
  return dirname(libraryPath);
}

function aggregationInstances(block: BlockDefinition, name: string): BlockInstance[] {
  const agg = block.members.find((m) => m.kind === "aggregation" && m.name === name);
  if (!agg || agg.kind !== "aggregation" || !agg.composition) {
    return [];
  }
  return agg.composition.children
    .filter((child) => child.kind === "blockInstance")
    .map((child) => child.instance);
}

function canonicalPath(path: string): string {
  const abs = resolve(path);
  try {
    return realpathSync(abs);
  } catch {
    return abs;
  }
}

function indexLibraryFiles(searchRoots: string[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const root of searchRoots) {
    for (const file of collectBmlFiles(root)) {
      if (!file.endsWith("Library.bml")) {
        continue;
      }
      try {
        const source = readFileSync(file, "utf8");
        const parsed = parse(source, { filePath: file, continueOnError: true });
        const type = parsed.document?.block.type;
        if (type) {
          const files = index.get(type) ?? [];
          if (!files.includes(file)) {
            files.push(file);
            index.set(type, files);
          }
        }
      } catch {
        continue;
      }
    }
  }
  return index;
}

function exportedBlockFqns(libraryBlock: BlockDefinition): Set<string> {
  const fqns = new Set<string>();
  for (const inst of aggregationInstances(libraryBlock, "blocks")) {
    fqns.add(inst.typeFqn);
  }
  return fqns;
}

/** Root type FQN of a Library.bml, or undefined if the file cannot be parsed. */
export function peekLibraryTypeFqn(libraryPath: string): string | undefined {
  const abs = resolve(libraryPath);
  if (!existsSync(abs)) {
    return undefined;
  }
  try {
    const source = readFileSync(abs, "utf8");
    const parsed = parse(source, { filePath: abs, continueOnError: true });
    return parsed.document?.block.type;
  } catch {
    return undefined;
  }
}

function resolveDepCandidate(
  libraryIndex: Map<string, string[]>,
  typeFqn: string,
  selfPath: string,
): string | undefined {
  const candidates = libraryIndex.get(typeFqn) ?? [];
  return candidates.find((file) => canonicalPath(file) !== selfPath);
}

function transitiveNestedPaths(
  outerPath: string,
  subLibraryEdges: Map<string, string[]>,
): string[] {
  const nested: string[] = [];
  const seen = new Set<string>([outerPath]);
  const stack = [...(subLibraryEdges.get(outerPath) ?? [])];
  while (stack.length > 0) {
    const inner = stack.pop()!;
    if (seen.has(inner)) {
      continue;
    }
    seen.add(inner);
    nested.push(inner);
    stack.push(...(subLibraryEdges.get(inner) ?? []));
  }
  return nested;
}

function resolveLibraryGraph(
  seedPaths: string[],
  searchRoots: string[],
  rootDir: string,
  diagnostics: Diagnostic[],
): {
  orderedPaths: string[];
  exportsByLibrary: Map<string, Set<string>>;
  subLibraryEdges: Map<string, string[]>;
  libTypeByPath: Map<string, string>;
} {
  const libraryIndex = indexLibraryFiles(searchRoots);
  const ordered: string[] = [];
  const visited = new Set<string>();
  const visitedTypes = new Set<string>();
  const exportsByLibrary = new Map<string, Set<string>>();
  const subLibraryEdges = new Map<string, string[]>();
  const libTypeByPath = new Map<string, string>();

  const visit = (libraryPath: string) => {
    const abs = canonicalPath(resolve(rootDir, libraryPath));
    if (visited.has(abs)) {
      return;
    }
    visited.add(abs);

    if (!existsSync(abs)) {
      diagnostics.push({
        severity: "error",
        code: "BML_LIBRARY_RESOLVE_ERROR",
        message: `Library not found: ${abs}`,
        source: { file: abs, line: 1, column: 1 },
      });
      return;
    }

    let source: string;
    try {
      source = readFileSync(abs, "utf8");
    } catch (e) {
      diagnostics.push({
        severity: "error",
        code: "BML_LIBRARY_RESOLVE_ERROR",
        message: e instanceof Error ? e.message : String(e),
        source: { file: abs, line: 1, column: 1 },
      });
      return;
    }

    const parsed = parse(source, { filePath: abs, continueOnError: true });
    for (const d of parsed.diagnostics) {
      diagnostics.push(d);
    }
    if (!parsed.document?.block.type) {
      diagnostics.push({
        severity: "error",
        code: "BML_LIBRARY_RESOLVE_ERROR",
        message: `Invalid Library.bml (no root type): ${abs}`,
        source: { file: abs, line: 1, column: 1 },
      });
      return;
    }

    const libType = parsed.document.block.type;
    if (visitedTypes.has(libType)) {
      return;
    }
    visitedTypes.add(libType);

    const indexed = libraryIndex.get(libType) ?? [];
    if (!indexed.includes(abs)) {
      indexed.push(abs);
      libraryIndex.set(libType, indexed);
    }
    exportsByLibrary.set(abs, exportedBlockFqns(parsed.document.block));
    libTypeByPath.set(abs, libType);

    const nestedPaths: string[] = [];
    for (const sub of aggregationInstances(parsed.document.block, "subLibraries")) {
      const depPath = resolveDepCandidate(libraryIndex, sub.typeFqn, abs);
      if (!depPath) {
        diagnostics.push({
          severity: "error",
          code: "BML_LIBRARY_RESOLVE_ERROR",
          message: `Unresolved library dependency: ${sub.typeFqn}`,
          source: { file: abs, line: sub.source?.line ?? 1, column: sub.source?.column ?? 1 },
        });
        continue;
      }
      nestedPaths.push(canonicalPath(resolve(rootDir, depPath)));
      visit(depPath);
    }
    subLibraryEdges.set(abs, nestedPaths);

    for (const dep of aggregationInstances(parsed.document.block, "dependencies")) {
      const depPath = resolveDepCandidate(libraryIndex, dep.typeFqn, abs);
      if (!depPath) {
        diagnostics.push({
          severity: "error",
          code: "BML_LIBRARY_RESOLVE_ERROR",
          message: `Unresolved library dependency: ${dep.typeFqn}`,
          source: { file: abs, line: dep.source?.line ?? 1, column: dep.source?.column ?? 1 },
        });
        continue;
      }
      visit(depPath);
    }

    ordered.push(abs);
  };

  for (const seed of seedPaths) {
    visit(seed);
  }

  return { orderedPaths: ordered, exportsByLibrary, subLibraryEdges, libTypeByPath };
}

function checkNestingViolations(
  exportsByLibrary: Map<string, Set<string>>,
  subLibraryEdges: Map<string, string[]>,
  libTypeByPath: Map<string, string>,
  diagnostics: Diagnostic[],
): void {
  for (const outerPath of exportsByLibrary.keys()) {
    const outerExports = exportsByLibrary.get(outerPath)!;
    const outerType = libTypeByPath.get(outerPath);
    for (const innerPath of transitiveNestedPaths(outerPath, subLibraryEdges)) {
      const innerExports = exportsByLibrary.get(innerPath);
      if (!innerExports) {
        continue;
      }
      const innerType = libTypeByPath.get(innerPath);
      if (outerType !== undefined && outerType === innerType) {
        continue;
      }
      for (const fqn of outerExports) {
        if (innerExports.has(fqn)) {
          diagnostics.push({
            severity: "error",
            code: "BML_LIBRARY_NESTING_VIOLATION",
            message: `Library ${outerPath} re-exports block ${fqn} also exported by nested library ${innerPath}`,
            source: { file: outerPath, line: 1, column: 1 },
          });
        }
      }
    }
  }
}

function registerFiles(
  registry: TypeRegistry,
  files: string[],
  diagnostics: Diagnostic[],
): void {
  for (const filePath of files) {
    let source: string;
    try {
      source = readFileSync(filePath, "utf8");
    } catch (e) {
      diagnostics.push({
        severity: "warning",
        code: "BML_BOOTSTRAP_READ_ERROR",
        message: e instanceof Error ? e.message : String(e),
        source: { file: filePath, line: 1, column: 1 },
      });
      continue;
    }
    const result = parse(source, { filePath, continueOnError: true });
    for (const d of result.diagnostics) {
      diagnostics.push(d);
    }
    if (result.document?.block.type) {
      registry.register(result.document);
    }
  }
}

function isPathInsideOrEqual(inner: string, outer: string): boolean {
  const a = canonicalPath(inner);
  const b = canonicalPath(outer);
  const rel = relative(b, a);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export function bootstrapFromLibraryPaths(
  libraryPaths: string[],
  searchRoots: string[],
  rootDir: string,
  coveredRoots: string[] = [],
): {
  registry: TypeRegistry;
  diagnostics: Diagnostic[];
  exportsByLibrary: Map<string, Set<string>>;
  librariesVisited: string[];
  skippedCoveredRoots: string[];
} {
  const registry = new TypeRegistry();
  const diagnostics: Diagnostic[] = [];
  const { orderedPaths, exportsByLibrary, subLibraryEdges, libTypeByPath } =
    resolveLibraryGraph(libraryPaths, searchRoots, rootDir, diagnostics);
  checkNestingViolations(exportsByLibrary, subLibraryEdges, libTypeByPath, diagnostics);

  const absCovered = coveredRoots.map((root) => resolve(rootDir, root));
  const seenFiles = new Set<string>();
  const skippedCoveredRoots: string[] = [];
  for (const libraryPath of orderedPaths) {
    const blocksRoot = blocksRootFromLibraryPath(libraryPath);
    if (absCovered.some((root) => isPathInsideOrEqual(blocksRoot, root))) {
      skippedCoveredRoots.push(blocksRoot);
      continue;
    }
    for (const file of collectBmlFiles(blocksRoot)) {
      seenFiles.add(file);
    }
  }

  registerFiles(registry, [...seenFiles], diagnostics);
  return {
    registry,
    diagnostics,
    exportsByLibrary,
    librariesVisited: orderedPaths,
    skippedCoveredRoots,
  };
}

export function bootstrapFromCorpusPaths(
  paths: string[],
  rootDir: string,
): { registry: TypeRegistry; diagnostics: Diagnostic[] } {
  const registry = new TypeRegistry();
  const diagnostics: Diagnostic[] = [];
  const files = new Set<string>();
  const resolvedPaths = paths.length > 0 ? paths : [];

  for (const base of resolvedPaths) {
    const resolved = resolve(rootDir, base);
    for (const file of collectBmlFiles(resolved)) {
      files.add(file);
    }
  }

  registerFiles(registry, [...files], diagnostics);
  return { registry, diagnostics };
}

export function findLibraryFileForType(
  typeFqn: string,
  searchRoots: string[],
): string | undefined {
  return indexLibraryFiles(searchRoots).get(typeFqn)?.[0];
}

export function parseLibraryDocument(libraryPath: string): BomDocument | null {
  const source = readFileSync(libraryPath, "utf8");
  const parsed = parse(source, { filePath: libraryPath, continueOnError: true });
  return parsed.document;
}
