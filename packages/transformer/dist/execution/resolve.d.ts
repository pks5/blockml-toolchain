import type { BomDocument } from "@blockml/bom";
import { type TypeRegistry } from "@blockml/framework";
import type { TargetLibrary } from "./target-library.js";
export interface ResolvedExecution {
    fqn: string;
    libraryFqn: string;
    libraryRoot: string;
    originalName: string;
    document: BomDocument;
    registry: TypeRegistry;
}
export declare function resolvePendingExecution(executionFqn: string, workspaceRoot: string, targetLibrary: TargetLibrary): ResolvedExecution;
export declare function resolvePendingExecutionInRegistry(executionFqn: string, registry: TypeRegistry, targetLibrary: TargetLibrary): ResolvedExecution;
//# sourceMappingURL=resolve.d.ts.map