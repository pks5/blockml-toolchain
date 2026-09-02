import type { StartedExecution } from "../execution/start.js";
import type { TerminalExecutionStatus } from "../execution/constants.js";
import type { TransformLifecycleListener } from "../execution/lifecycle-events.js";
export interface StageContext {
    workspaceRoot: string;
    now: () => Date;
    onLifecycle?: TransformLifecycleListener;
    parameters?: Record<string, unknown>;
}
export interface TransformStage<Input, Output> {
    run(input: Input, context: StageContext): Promise<Output>;
}
export interface PreparedExecution {
    pendingFqn: string;
    started: StartedExecution;
    stageCount: number;
}
export interface StageBoundExecution extends PreparedExecution {
    stageIndex: number;
}
export interface ExecutionTrace {
    stdout: string;
    stderr: string;
    diff: string;
    changedFiles: readonly string[];
}
export interface ExecutedWork extends StageBoundExecution {
    trace: ExecutionTrace;
}
export type ExecutionOutcome = "succeeded" | "failed";
export interface Reflection extends ExecutedWork {
    changedFiles: readonly string[];
    feedback: string | undefined;
    result?: unknown;
    resultTypeFqn?: string;
    outcome: ExecutionOutcome;
    exceptionMessage?: string;
}
export interface PersistedExecution extends Reflection {
}
export interface TransformRunResult {
    success: boolean;
    pendingFqn: string;
    runningFqn: string;
    terminalFqn: string;
    status: TerminalExecutionStatus;
    sequence: number;
    executionId: string;
    error?: string;
}
export interface TransformPipeline {
    prepare: TransformStage<string, PreparedExecution>;
    execute: TransformStage<StageBoundExecution, ExecutedWork>;
    reflect: TransformStage<ExecutedWork, Reflection>;
    persist: TransformStage<Reflection, PersistedExecution>;
    finalize: TransformStage<PersistedExecution, TransformRunResult>;
}
//# sourceMappingURL=types.d.ts.map