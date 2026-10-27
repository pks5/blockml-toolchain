import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { parse } from "@blockml/parser";
import { isNodeModulesPath } from "./package-paths.js";
import { collectLocationExports } from "./library-membership.js";
import { rootFqnByFilePath } from "./root-fqn.js";
import { TypeRegistry } from "./type-registry.js";
import { evaluateParseValue } from "../validate/evaluate-parse-value.js";
import { normalizeParsedMemberValues, resolveInstanceMemberType, } from "../validate/member-literals.js";
function collectBmlFiles(dir, out = []) {
    let entries;
    try {
        entries = readdirSync(dir);
    }
    catch {
        return out;
    }
    for (const entry of entries) {
        const full = join(dir, entry);
        try {
            const st = statSync(full);
            if (st.isDirectory()) {
                collectBmlFiles(full, out);
            }
            else if (entry.endsWith(".bml")) {
                out.push(full);
            }
        }
        catch {
            continue;
        }
    }
    return out;
}
const CONFIG_FILE = "blockml.config.json";
const DEFAULT_SRC_DIR = "blocks";
function packageSrcDir(packageDir) {
    const configPath = join(packageDir, CONFIG_FILE);
    if (existsSync(configPath)) {
        try {
            const cfg = JSON.parse(readFileSync(configPath, "utf8"));
            if (typeof cfg.srcDir === "string" && cfg.srcDir.length > 0) {
                return resolve(packageDir, cfg.srcDir);
            }
        }
        catch {
            // fall through to default
        }
    }
    return resolve(packageDir, DEFAULT_SRC_DIR);
}
function blocksRootFromLibraryPath(libraryPath) {
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
function aggregationInstances(block, name) {
    const agg = block.members.find((m) => m.kind === "aggregation" && m.name === name);
    if (!agg || agg.kind !== "aggregation" || !agg.composition) {
        return [];
    }
    return agg.composition.children
        .filter((child) => child.kind === "blockInstance")
        .map((child) => child.instance);
}
function canonicalPath(path) {
    const abs = resolve(path);
    try {
        return realpathSync(abs);
    }
    catch {
        return abs;
    }
}
function indexLibraryFiles(searchRoots) {
    const index = new Map();
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
            }
            catch {
                continue;
            }
        }
    }
    return index;
}
/** Root type FQN of a Library.bml, or undefined if the file cannot be parsed. */
export function peekLibraryTypeFqn(libraryPath) {
    const abs = resolve(libraryPath);
    if (!existsSync(abs)) {
        return undefined;
    }
    try {
        const source = readFileSync(abs, "utf8");
        const parsed = parse(source, { filePath: abs, continueOnError: true });
        return parsed.document?.block.type;
    }
    catch {
        return undefined;
    }
}
function preferWorkspaceLibrary(a, b) {
    return Number(isNodeModulesPath(a)) - Number(isNodeModulesPath(b));
}
function resolveDepCandidate(libraryIndex, typeFqn, selfPath) {
    const candidates = (libraryIndex.get(typeFqn) ?? []).filter((file) => canonicalPath(file) !== selfPath);
    if (candidates.length === 0) {
        return undefined;
    }
    return [...candidates].sort(preferWorkspaceLibrary)[0];
}
function resolveLibraryGraph(seedPaths, searchRoots, rootDir, diagnostics) {
    const libraryIndex = indexLibraryFiles(searchRoots);
    const ordered = [];
    const visited = new Set();
    const visitedTypes = new Set();
    const subLibraryEdges = new Map();
    const libTypeByPath = new Map();
    const visit = (libraryPath) => {
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
        let source;
        try {
            source = readFileSync(abs, "utf8");
        }
        catch (e) {
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
        libTypeByPath.set(abs, libType);
        const nestedPaths = [];
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
    return { orderedPaths: ordered, subLibraryEdges, libTypeByPath };
}
function registerFiles(registry, files, diagnostics) {
    for (const filePath of files) {
        let source;
        try {
            source = readFileSync(filePath, "utf8");
        }
        catch (e) {
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
function isPathInsideOrEqual(inner, outer) {
    const a = canonicalPath(inner);
    const b = canonicalPath(outer);
    const rel = relative(b, a);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
export function bootstrapFromLibraryPaths(libraryPaths, searchRoots, rootDir, coveredRoots = []) {
    const registry = new TypeRegistry();
    const diagnostics = [];
    const { orderedPaths } = resolveLibraryGraph(libraryPaths, searchRoots, rootDir, diagnostics);
    const absCovered = coveredRoots.map((root) => resolve(rootDir, root));
    const seenFiles = new Set();
    const skippedCoveredRoots = [];
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
    reparseMemberValues(registry);
    const locationFiles = [];
    for (const [filePath, typeFqn] of rootFqnByFilePath(registry)) {
        locationFiles.push({ filePath, typeFqn });
    }
    const exportsByLibrary = collectLocationExports(locationFiles);
    for (const libraryPath of orderedPaths) {
        const abs = canonicalPath(libraryPath);
        if (!exportsByLibrary.has(abs)) {
            exportsByLibrary.set(abs, new Set());
        }
    }
    return {
        registry,
        diagnostics,
        exportsByLibrary,
        librariesVisited: orderedPaths,
        skippedCoveredRoots,
    };
}
export function bootstrapFromCorpusPaths(paths, rootDir) {
    const registry = new TypeRegistry();
    const diagnostics = [];
    const files = new Set();
    const resolvedPaths = paths.length > 0 ? paths : [];
    for (const base of resolvedPaths) {
        const resolved = resolve(rootDir, base);
        for (const file of collectBmlFiles(resolved)) {
            files.add(file);
        }
    }
    registerFiles(registry, [...files], diagnostics);
    reparseMemberValues(registry);
    return { registry, diagnostics };
}
export function findLibraryFileForType(typeFqn, searchRoots) {
    const files = indexLibraryFiles(searchRoots).get(typeFqn) ?? [];
    if (files.length === 0) {
        return undefined;
    }
    return [...files].sort(preferWorkspaceLibrary)[0];
}
export function parseLibraryDocument(libraryPath) {
    const source = readFileSync(libraryPath, "utf8");
    const parsed = parse(source, { filePath: libraryPath, continueOnError: true });
    return parsed.document;
}
function heuristicScalar(raw) {
    const trimmed = raw.trim();
    const lower = trimmed.toLowerCase();
    if (lower === "true") {
        return true;
    }
    if (lower === "false") {
        return false;
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return Number(trimmed);
    }
    return undefined;
}
/**
 * First pass tokenizes without a registry. Re-parse once every type is registered
 * so instance literals use the member type's parseValue, not the block FQN.
 * A type FQN that is not in the registry still uses the Boolean/number heuristic.
 * Diagnostics stay from the first pass; validate reports value errors.
 */
function reparseMemberValues(registry) {
    const files = new Set();
    for (const fqn of registry.keys()) {
        const filePath = registry.get(fqn)?.source?.filePath;
        if (filePath && existsSync(filePath)) {
            files.add(filePath);
        }
    }
    const parseValue = (typeFqn, raw) => {
        const result = evaluateParseValue(typeFqn, raw, registry);
        // A declared type that is not loaded has no parseValue to skip to. Keep the
        // Boolean/number heuristic so inherited scalars such as sequence stay numbers.
        if (result.ok && !("value" in result) && !registry.has(typeFqn)) {
            const guessed = heuristicScalar(raw);
            if (guessed !== undefined) {
                return { ok: true, value: guessed };
            }
        }
        return result;
    };
    const resolveMemberType = (ownerTypeFqn, memberName) => resolveInstanceMemberType(ownerTypeFqn, memberName, registry);
    for (const filePath of files) {
        let source;
        try {
            source = readFileSync(filePath, "utf8");
        }
        catch {
            continue;
        }
        const result = parse(source, {
            filePath,
            continueOnError: true,
            parseValue,
            resolveMemberType,
        });
        if (!result.document?.block.type) {
            continue;
        }
        normalizeParsedMemberValues(result.document, registry);
        registry.register(result.document);
    }
}
//# sourceMappingURL=library-bootstrap.js.map