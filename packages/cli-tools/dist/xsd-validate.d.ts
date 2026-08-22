import type { Diagnostic } from "@blockml/bom";
import type { TypeRegistry } from "@blockml/framework";
/** Parse OASIS catalog uri entries: name (namespace) → uri (relative path). */
export declare function parseCatalogUriEntries(catalogXml: string): Map<string, string>;
export declare function resolveBmlSchemaPath(rootDir: string): string | null;
export declare function collectRegistryFilePaths(registry: TypeRegistry): string[];
export declare function validateFilesAgainstXsd(filePaths: string[], rootDir: string): Diagnostic[];
//# sourceMappingURL=xsd-validate.d.ts.map