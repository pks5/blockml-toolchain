import type { TypeRegistry } from "./type-registry.js";
import { CONFIG_FILE, DEFAULT_SRC_DIR } from "./package-paths.js";
/**
 * Project-owned BML roots: this package's srcDir plus local packages/*
 * BlockML modules. Does not walk parent workspaces or node_modules
 * (realpath of a workspace symlink under packages/ still counts).
 */
export declare function projectSourceRoots(rootDir: string, srcDir?: string): string[];
/**
 * Blocks/srcDir roots of this package and local packages/* that declare
 * package.json blockml.library. Stricter than projectSourceRoots: config-only
 * packages are omitted. Does not walk parent workspaces or node_modules.
 */
export declare function projectLibraryPackageRoots(rootDir: string): string[];
/**
 * Package directories (this package and local packages/*) that declare
 * package.json blockml.library. Sorted, canonical, no node_modules walk.
 */
export declare function projectLibraryPackageDirs(rootDir: string): string[];
/** Registry file paths whose realpath lies under any of the given roots. */
export declare function registryFilesUnderRoots(registry: TypeRegistry, roots: string[]): string[];
export { CONFIG_FILE, DEFAULT_SRC_DIR };
//# sourceMappingURL=project-sources.d.ts.map