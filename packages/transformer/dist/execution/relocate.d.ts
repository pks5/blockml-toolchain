import type { BomDocument } from "@blockml/bom";
import { type TypeRegistry } from "@blockml/framework";
import { type LifecycleStage } from "./constants.js";
export interface RelocateIdentity {
    libraryFqn: string;
    stage: LifecycleStage;
    name: string;
    retainStages?: readonly LifecycleStage[];
}
export declare function applyExecutionIdentity(document: BomDocument, identity: RelocateIdentity): string;
export declare function rewriteInboundReferences(registry: TypeRegistry, oldFqn: string, newFqn: string, exceptFilePath: string): void;
export declare function persistDocument(document: BomDocument): void;
export declare function removeFile(filePath: string): void;
//# sourceMappingURL=relocate.d.ts.map