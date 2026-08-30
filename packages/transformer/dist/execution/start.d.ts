import type { ResolvedExecution } from "./resolve.js";
import { SequenceAllocator } from "./sequence.js";
export interface StartedExecution {
    executionId: string | undefined;
    libraryFqn: string;
    originalName: string;
    sequence: number;
    startedAt: Date;
    startedAtIso: string;
    baseCommit: string;
    generatedName: string;
    runningFqn: string;
    runningFilePath: string;
    pendingFilePath: string;
}
export declare function startExecution(resolved: ResolvedExecution, now: Date, workspaceRoot: string, allocator?: SequenceAllocator): StartedExecution;
//# sourceMappingURL=start.d.ts.map