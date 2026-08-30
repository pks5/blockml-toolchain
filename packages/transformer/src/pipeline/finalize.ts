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
      const stage = persisted.outcome === "failed" ? "failed" : "succeeded";
      const finalized = finalizeExecution(
        context.workspaceRoot,
        persisted.started,
        context.now(),
        stage,
      );
      return {
        success: persisted.outcome !== "failed",
        pendingFqn: persisted.pendingFqn,
        runningFqn: persisted.started.runningFqn,
        terminalFqn: finalized.terminalFqn,
        status: stage === "succeeded" ? "Succeeded" : "Failed",
        sequence: persisted.started.sequence,
        executionId: persisted.started.executionId,
        ...(persisted.exceptionMessage !== undefined
          ? { error: persisted.exceptionMessage }
          : {}),
      };
    },
  };
}
