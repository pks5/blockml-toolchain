import type { TransformationAgent } from "../agent/transformation-agent.js";
import { TransformError } from "../execution/errors.js";
import type {
  ExecutedWork,
  StageBoundExecution,
  StageContext,
  TransformStage,
} from "./types.js";
import { collectWorktreeTrace, modelChangedFiles } from "./worktree-trace.js";

export function createExecuteStage(
  agent: TransformationAgent,
): TransformStage<StageBoundExecution, ExecutedWork> {
  return {
    async run(
      prepared: StageBoundExecution,
      context: StageContext,
    ): Promise<ExecutedWork> {
      const agentResult = await agent.execute({
        workspaceRoot: context.workspaceRoot,
        executionFqn: prepared.started.runningFqn,
        stageIndex: prepared.stageIndex,
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
