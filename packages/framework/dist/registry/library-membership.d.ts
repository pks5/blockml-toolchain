import type { BomDocument } from "@blockml/bom";
import type { TypeRegistry } from "./type-registry.js";
export declare const LIBRARY_FILENAME = "Library.bml";
export declare function isLibraryDescriptorPath(filePath: string): boolean;
/** Source folder (package srcDir) containing this file, if the file sits inside it. */
export declare function sourceRootForFile(filePath: string): string | undefined;
/**
 * Nearest Library.bml at the same directory or above.
 * Search stops one level below the source folder (srcDir is not searched).
 * The first Library found walking up wins, so nested libraries own their subtree.
 */
export declare function findOwningLibraryFile(blockFilePath: string, ownerByDir?: Map<string, string | undefined>): string | undefined;
export declare function locateOwningLibrary(registry: TypeRegistry, fqn: string): {
    libraryFqn: string;
    libraryFile: string;
    packageFqn: string;
} | undefined;
/** Owning library document for a block, by file location then FQN prefix. */
export declare function findOwningLibraryDocument(registry: TypeRegistry, typeFqn: string | undefined, filePath: string | undefined): BomDocument | undefined;
export declare function collectLocationExports(files: {
    filePath: string;
    typeFqn: string;
}[]): Map<string, Set<string>>;
//# sourceMappingURL=library-membership.d.ts.map