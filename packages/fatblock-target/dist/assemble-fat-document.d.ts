import type { BomDocument, Diagnostic } from "@blockml/bom";
import type { TypeRegistry } from "@blockml/framework";
import type { FatBlockOptions } from "./options.js";
export interface AssembleFatDocumentResult {
    document: BomDocument | null;
    diagnostics: Diagnostic[];
}
export declare function assembleFatDocument(registry: TypeRegistry, hostFilePath: string, options: FatBlockOptions, rootDir: string): AssembleFatDocumentResult;
export declare function serializeFatDocument(document: BomDocument): {
    text: string | null;
    diagnostics: Diagnostic[];
};
//# sourceMappingURL=assemble-fat-document.d.ts.map