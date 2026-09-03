import type { TerminalLifecycleStage } from "./constants.js";
import type { StartedExecution } from "./start.js";
export interface FinalizedExecution {
    terminalFqn: string;
    terminalFilePath: string;
    completedAtIso: string;
    stage: TerminalLifecycleStage;
    error?: string;
}
export declare function finalizeExecution(workspaceRoot: string, started: StartedExecution, now: Date): FinalizedExecution;
//# sourceMappingURL=complete.d.ts.map