import { finalizeExecution } from "../execution/complete.js";
import type {
  PersistedExecution,
  StageContext,
  TransformRunResult,
  TransformStage,
} from "./types.js";

export function createFinalizeStage(): TransformStage<
  PersistedExecution,
  TransformRunResult
> {
  return {
    async run(
      persisted: PersistedExecution,
      context: StageContext,
    ): Promise<TransformRunResult> {
      const finalized = finalizeExecution(
        context.workspaceRoot,
        persisted.started,
        context.now(),
      );
      return {
        success: finalized.stage !== "failed",
        pendingFqn: persisted.pendingFqn,
        runningFqn: persisted.started.runningFqn,
        terminalFqn: finalized.terminalFqn,
        status: finalized.stage === "succeeded" ? "Succeeded" : "Failed",
        sequence: persisted.started.sequence,
        executionId: persisted.started.executionId,
        ...(finalized.error !== undefined
          ? { error: finalized.error }
          : persisted.exceptionMessage !== undefined
            ? { error: persisted.exceptionMessage }
            : {}),
      };
    },
  };
}
