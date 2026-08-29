import type { BomDocument } from "@blockml/bom";
import { type TypeRegistry } from "@blockml/framework";
export interface ResolvedExecution {
    fqn: string;
    libraryFqn: string;
    originalName: string;
    document: BomDocument;
    registry: TypeRegistry;
}
export declare function resolvePendingExecution(executionFqn: string, workspaceRoot: string): ResolvedExecution;
export declare function resolvePendingExecutionInRegistry(executionFqn: string, registry: TypeRegistry): ResolvedExecution;
//# sourceMappingURL=resolve.d.ts.map