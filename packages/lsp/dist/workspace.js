import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { bootstrapTypeRegistry, defaultBootstrapPaths, TypeRegistry } from "@blockml/framework";
const DEFAULT_CONFIG = {
    srcDir: "src",
};
export function loadBomConfig(rootDir) {
    const configPath = resolve(rootDir, "bom.config.json");
    if (!existsSync(configPath)) {
        return { ...DEFAULT_CONFIG };
    }
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
        ...DEFAULT_CONFIG,
        ...parsed,
    };
}
const workspaceCache = new Map();
export function invalidateWorkspace(rootDir) {
    workspaceCache.delete(resolve(rootDir));
}
export function createWorkspace(rootDir) {
    const absRoot = resolve(rootDir);
    const cached = workspaceCache.get(absRoot);
    if (cached) {
        return cached;
    }
    const config = loadBomConfig(absRoot);
    const srcDir = config.srcDir ?? DEFAULT_CONFIG.srcDir;
    const corpusPaths = [...new Set([srcDir, ...defaultBootstrapPaths(absRoot)])];
    const bootstrapOptions = {
        rootDir: absRoot,
        paths: corpusPaths,
    };
    if (config.libraries?.length) {
        bootstrapOptions.libraryPaths = config.libraries;
    }
    const bootstrap = bootstrapTypeRegistry(bootstrapOptions);
    const bootstrapDiagnostics = bootstrap.diagnostics.filter((d) => d.code === "BML_LIBRARY_RESOLVE_ERROR" ||
        d.code === "BML_LIBRARY_NESTING_VIOLATION");
    const state = {
        rootDir: absRoot,
        config,
        registry: bootstrap.registry,
        bootstrapDiagnostics,
    };
    workspaceCache.set(absRoot, state);
    return state;
}
//# sourceMappingURL=workspace.js.map