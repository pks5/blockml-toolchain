import type { Diagnostic } from "@blockml/bom";
import { TypeRegistry } from "./type-registry.js";
export interface BootstrapOptions {
    /** Corpus roots for flat scan mode. */
    paths?: string[];
    /** Library.bml entry points for library graph mode. */
    libraryPaths?: string[];
    /** Working directory for relative paths. */
    rootDir?: string;
}
/**
 * Corpus fallback: BlockML packages among the nearest package.json production
 * dependencies (dependencies + optionalDependencies), resolved via node_modules.
 */
export declare function defaultBootstrapPaths(rootDir?: string): string[];
/**
 * Library graph seeds for this package: package.json blockml.library first,
 * then extras (config.libraries or --libraries). Deduped by realpath.
 */
export declare function resolveLibrarySeeds(rootDir?: string, extras?: string[]): string[];
export interface BootstrapTrace {
    corpusPaths: string[];
    seeds: string[];
    searchRoots: string[];
    librariesVisited: string[];
    skippedCoveredRoots: string[];
}
export interface BootstrapResult {
    registry: TypeRegistry;
    diagnostics: Diagnostic[];
    /** Present when bootstrap used libraryPaths mode. */
    exportsByLibrary?: Map<string, Set<string>>;
    trace?: BootstrapTrace;
}
export declare function bootstrapTypeRegistry(optionsOrPaths?: BootstrapOptions | string[], rootDirArg?: string): BootstrapResult;
//# sourceMappingURL=bootstrap.d.ts.map