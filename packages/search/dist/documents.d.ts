import type { BlockDefinition } from "@blockml/bom";
import type { TypeRegistry } from "@blockml/framework";
import type { SearchDocument } from "./types.js";
export declare function fqnToPackagePrefix(fqn: string): string;
export declare function blockToSearchDocument(block: BlockDefinition, filePath: string): SearchDocument | undefined;
export declare function documentsFromRegistry(registry: TypeRegistry): SearchDocument[];
//# sourceMappingURL=documents.d.ts.map