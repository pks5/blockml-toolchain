import type { StartedExecution } from "./start.js";
export interface PersistReflectionInput {
    started: StartedExecution;
    changedFiles: readonly string[];
    feedback: string | undefined;
}
export declare function persistReflection(workspaceRoot: string, input: PersistReflectionInput): void;
//# sourceMappingURL=persist.d.ts.map