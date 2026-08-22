import type { BomDocument, Diagnostic } from "@blockml/bom";
import { TypeRegistry } from "./type-registry.js";
export declare function bootstrapFromLibraryPaths(libraryPaths: string[], searchRoots: string[], rootDir: string): {
    registry: TypeRegistry;
    diagnostics: Diagnostic[];
    exportsByLibrary: Map<string, Set<string>>;
};
export declare function bootstrapFromCorpusPaths(paths: string[], rootDir: string): {
    registry: TypeRegistry;
    diagnostics: Diagnostic[];
};
export declare function findLibraryFileForType(typeFqn: string, searchRoots: string[]): string | undefined;
export declare function parseLibraryDocument(libraryPath: string): BomDocument | null;
//# sourceMappingURL=library-bootstrap.d.ts.map