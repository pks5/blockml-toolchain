import { bootstrapTypeRegistry, peekLibraryTypeFqn, resolveLibrarySeeds, } from "@blockml/framework";
import { existsSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
const CORE_LIBRARY_REL = "node_modules/@blockml/core/blocks/org/blockml/bml/Library.bml";
function canonicalPath(path) {
    const abs = resolve(path);
    try {
        return realpathSync(abs);
    }
    catch {
        return abs;
    }
}
/** npm @blockml/core Library.bml under the workspace root, if installed. */
export function workspaceCoreLibraryPath(wsRoot) {
    const coreLibrary = join(wsRoot, CORE_LIBRARY_REL);
    return existsSync(coreLibrary) ? coreLibrary : undefined;
}
/**
 * Whether fatblock workspace-core bootstrap should append npm Core as an extra
 * seed. False when the project identity is already that library (same realpath
 * or same Library type FQN) — Core dogfooding against an installed copy.
 */
export function shouldSeedWorkspaceCore(identityPath, corePath) {
    if (!identityPath) {
        return true;
    }
    const identityAbs = canonicalPath(identityPath);
    const coreAbs = canonicalPath(corePath);
    if (identityAbs === coreAbs) {
        return false;
    }
    const identityFqn = peekLibraryTypeFqn(identityAbs);
    const coreFqn = peekLibraryTypeFqn(coreAbs);
    return identityFqn === undefined || identityFqn !== coreFqn;
}
export function projectLibrarySeeds(options) {
    const rootDir = options.rootDir ?? process.cwd();
    const extras = options.librariesOverride ?? options.config.libraries ?? [];
    return resolveLibrarySeeds(rootDir, extras);
}
/** package.json blockml.library path, if declared. */
export function projectIdentityLibraryPath(rootDir) {
    return resolveLibrarySeeds(rootDir)[0];
}
export function bootstrapProjectTypeRegistry(options) {
    const rootDir = options.rootDir ?? process.cwd();
    const srcDir = options.srcDirOverride ?? options.config.srcDir ?? "blocks";
    const libraries = projectLibrarySeeds(options);
    const paths = options.corpusPaths ?? [srcDir];
    const bootstrapOptions = { rootDir, paths };
    if (libraries.length > 0) {
        bootstrapOptions.libraryPaths = libraries;
    }
    return bootstrapTypeRegistry(bootstrapOptions);
}
//# sourceMappingURL=bootstrap-type-registry.js.map