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
export declare function persistReflection(workspaceRoot: string, input: PersistReflectionInput): void;
//# sourceMappingURL=persist.d.ts.map