import type { TransformationAgent } from "../agent/transformation-agent.js";
import { TransformError } from "../execution/errors.js";
import type {
  ExecutedWork,
  OperationBoundExecution,
  StageContext,
  TransformStage,
} from "./types.js";
import { collectWorktreeTrace, modelChangedFiles } from "./worktree-trace.js";

export function createExecuteStage(
  agent: TransformationAgent,
): TransformStage<OperationBoundExecution, ExecutedWork> {
  return {
    async run(
      prepared: OperationBoundExecution,
      context: StageContext,
    ): Promise<ExecutedWork> {
      const agentResult = await agent.execute({
        workspaceRoot: context.workspaceRoot,
        executionFqn: prepared.started.runningFqn,
        operationIndex: prepared.operationIndex,
      });
      if (!agentResult.success) {
        throw new TransformError(
          "execution",
          agentResult.error || "Transformation agent failed",
        );
      }
      const worktree = collectWorktreeTrace(context.workspaceRoot);
      return {
        ...prepared,
        trace: {
          stdout: agentResult.stdout ?? "",
          stderr: agentResult.stderr ?? "",
          diff: worktree.diff,
          changedFiles: modelChangedFiles(worktree.changedFiles),
        },
      };
    },
  };
}
