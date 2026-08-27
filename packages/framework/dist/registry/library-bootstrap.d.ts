import type { BomDocument, Diagnostic } from "@blockml/bom";
import { TypeRegistry } from "./type-registry.js";
/** Root type FQN of a Library.bml, or undefined if the file cannot be parsed. */
export declare function peekLibraryTypeFqn(libraryPath: string): string | undefined;
export declare function bootstrapFromLibraryPaths(libraryPaths: string[], searchRoots: string[], rootDir: string, coveredRoots?: string[]): {
    registry: TypeRegistry;
    diagnostics: Diagnostic[];
    exportsByLibrary: Map<string, Set<string>>;
    librariesVisited: string[];
    skippedCoveredRoots: string[];
};
export declare function bootstrapFromCorpusPaths(paths: string[], rootDir: string): {
    registry: TypeRegistry;
    diagnostics: Diagnostic[];
};
export declare function findLibraryFileForType(typeFqn: string, searchRoots: string[]): string | undefined;
export declare function parseLibraryDocument(libraryPath: string): BomDocument | null;
//# sourceMappingURL=library-bootstrap.d.ts.map