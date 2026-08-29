import type { StartedExecution } from "./start.js";
export interface CompletedExecution {
    completedFqn: string;
    completedFilePath: string;
    completedAtIso: string;
}
export declare function completeExecution(workspaceRoot: string, started: StartedExecution, now: Date): CompletedExecution;
//# sourceMappingURL=complete.d.ts.map