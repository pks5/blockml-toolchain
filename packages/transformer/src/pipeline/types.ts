import type { StartedExecution } from "../execution/start.js";

export interface StageContext {
  workspaceRoot: string;
  now: () => Date;
}

export interface TransformStage<Input, Output> {
  run(input: Input, context: StageContext): Promise<Output>;
}

export interface PreparedExecution {
  pendingFqn: string;
  started: StartedExecution;
}

export interface ExecutionTrace {
  stdout: string;
  stderr: string;
  diff: string;
  changedFiles: readonly string[];
}

export interface ExecutedWork extends PreparedExecution {
  trace: ExecutionTrace;
}

export interface Reflection extends ExecutedWork {
  changedFiles: readonly string[];
  feedback: string | undefined;
}

export interface PersistedExecution extends Reflection {}

export interface TransformRunResult {
  success: true;
  pendingFqn: string;
  runningFqn: string;
  completedFqn: string;
  sequence: number;
  executionId: string | undefined;
}

export interface TransformPipeline {
  prepare: TransformStage<string, PreparedExecution>;
  execute: TransformStage<PreparedExecution, ExecutedWork>;
  reflect: TransformStage<ExecutedWork, Reflection>;
  persist: TransformStage<Reflection, PersistedExecution>;
  finalize: TransformStage<PersistedExecution, TransformRunResult>;
}
