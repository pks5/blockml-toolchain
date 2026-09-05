import type { StartedExecution } from "./start.js";
export interface PersistReflectionInput {
    started: StartedExecution;
    operationIndex: number;
    changedFiles: readonly string[];
    output: string | undefined;
    exceptionMessage?: string;
    outcome: "succeeded" | "failed";
    completedAtIso: string;
}
export interface PersistReflectionResult {
    outcome: "succeeded" | "failed";
    exceptionMessage?: string;
}
export declare function persistReflection(workspaceRoot: string, input: PersistReflectionInput): PersistReflectionResult;
//# sourceMappingURL=persist.d.ts.map