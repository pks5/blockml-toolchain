import type { TransformationAgent } from "../agent/transformation-agent.js";
import { TransformError } from "../execution/errors.js";
import type {
  ExecutedWork,
  PreparedExecution,
  StageContext,
  TransformStage,
} from "./types.js";
import { collectWorktreeTrace } from "./worktree-trace.js";

function isTransformLifecyclePath(path: string): boolean {
  return path.includes("/_transform/") || path.startsWith("_transform/");
}

export function createExecuteStage(
  agent: TransformationAgent,
): TransformStage<PreparedExecution, ExecutedWork> {
  return {
    async run(
      prepared: PreparedExecution,
      context: StageContext,
    ): Promise<ExecutedWork> {
      const agentResult = await agent.execute({
        workspaceRoot: context.workspaceRoot,
        executionFqn: prepared.started.runningFqn,
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
          changedFiles: worktree.changedFiles.filter((path) => !isTransformLifecyclePath(path)),
        },
      };
    },
  };
}
