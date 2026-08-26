import { type TypeRegistry } from "@blockml/framework";
/**
 * Project-owned BML roots: this package's srcDir plus local packages/*
 * BlockML modules. Does not walk parent workspaces or node_modules
 * (realpath of a workspace symlink under packages/ still counts).
 */
export declare function projectSourceRoots(rootDir: string, srcDir?: string): string[];
/** Registry file paths whose realpath lies under any of the given roots. */
export declare function registryFilesUnderRoots(registry: TypeRegistry, roots: string[]): string[];
//# sourceMappingURL=project-sources.d.ts.map