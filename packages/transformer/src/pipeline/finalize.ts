import { completeExecution } from "../execution/complete.js";
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
      const completed = completeExecution(
        context.workspaceRoot,
        persisted.started,
        context.now(),
      );
      return {
        success: true,
        pendingFqn: persisted.pendingFqn,
        runningFqn: persisted.started.runningFqn,
        completedFqn: completed.completedFqn,
        sequence: persisted.started.sequence,
        executionId: persisted.started.executionId,
      };
    },
  };
}
