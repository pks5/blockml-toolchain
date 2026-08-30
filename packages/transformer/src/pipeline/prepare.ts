import { resolvePendingExecution } from "../execution/resolve.js";
import { startExecution } from "../execution/start.js";
import type { PreparedExecution, StageContext, TransformStage } from "./types.js";

export function createPrepareStage(): TransformStage<string, PreparedExecution> {
  return {
    async run(pendingFqn: string, context: StageContext): Promise<PreparedExecution> {
      const resolved = resolvePendingExecution(pendingFqn, context.workspaceRoot);
      const started = startExecution(resolved, context.now(), context.workspaceRoot);
      return { pendingFqn, started };
    },
  };
}
