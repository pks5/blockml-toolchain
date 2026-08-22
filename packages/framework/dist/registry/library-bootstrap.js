import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "@blockml/parser";
import { TypeRegistry } from "./type-registry.js";
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
function blocksRootFromLibraryPath(libraryPath) {
    const normalized = libraryPath.replace(/\\/g, "/");
    const marker = "/blocks/";
    const idx = normalized.indexOf(marker);
    if (idx >= 0) {
        return normalized.slice(0, idx + "/blocks".length);
    }
    return dirname(dirname(libraryPath));
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
                    index.set(type, file);
                }
            }
            catch {
                continue;
            }
        }
    }
    return index;
}
function exportedBlockFqns(libraryBlock) {
    const fqns = new Set();
    for (const inst of aggregationInstances(libraryBlock, "blocks")) {
        fqns.add(inst.typeFqn);
    }
    return fqns;
}
function resolveLibraryGraph(seedPaths, searchRoots, rootDir, diagnostics) {
    const libraryIndex = indexLibraryFiles(searchRoots);
    const ordered = [];
    const visited = new Set();
    const exportsByLibrary = new Map();
    const visit = (libraryPath) => {
        const abs = resolve(rootDir, libraryPath);
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
        libraryIndex.set(libType, abs);
        exportsByLibrary.set(abs, exportedBlockFqns(parsed.document.block));
        for (const dep of [
            ...aggregationInstances(parsed.document.block, "dependencies"),
            ...aggregationInstances(parsed.document.block, "subLibraries"),
        ]) {
            const depPath = libraryIndex.get(dep.typeFqn);
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
    return { orderedPaths: ordered, exportsByLibrary };
}
function checkNestingViolations(exportsByLibrary, diagnostics) {
    const paths = [...exportsByLibrary.keys()];
    for (let i = 0; i < paths.length; i++) {
        const outerPath = paths[i];
        const outerExports = exportsByLibrary.get(outerPath);
        for (let j = i + 1; j < paths.length; j++) {
            const innerPath = paths[j];
            const innerExports = exportsByLibrary.get(innerPath);
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
export function bootstrapFromLibraryPaths(libraryPaths, searchRoots, rootDir) {
    const registry = new TypeRegistry();
    const diagnostics = [];
    const { orderedPaths, exportsByLibrary } = resolveLibraryGraph(libraryPaths, searchRoots, rootDir, diagnostics);
    checkNestingViolations(exportsByLibrary, diagnostics);
    const seenFiles = new Set();
    for (const libraryPath of orderedPaths) {
        const blocksRoot = blocksRootFromLibraryPath(libraryPath);
        for (const file of collectBmlFiles(blocksRoot)) {
            seenFiles.add(file);
        }
    }
    registerFiles(registry, [...seenFiles], diagnostics);
    return { registry, diagnostics, exportsByLibrary };
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
    return { registry, diagnostics };
}
export function findLibraryFileForType(typeFqn, searchRoots) {
    return indexLibraryFiles(searchRoots).get(typeFqn);
}
export function parseLibraryDocument(libraryPath) {
    const source = readFileSync(libraryPath, "utf8");
    const parsed = parse(source, { filePath: libraryPath, continueOnError: true });
    return parsed.document;
}
//# sourceMappingURL=library-bootstrap.js.map