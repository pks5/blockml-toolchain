import { TransformError } from "../execution/errors.js";
import { loadRunningExecution } from "../execution/load-running.js";
import { getOperationInstance } from "../execution/properties.js";
import type { ExecutorRegistry } from "../executor/registry.js";
import type {
  ExecutedWork,
  OperationBoundExecution,
  StageContext,
  TransformStage,
} from "./types.js";
import { collectWorktreeTrace, modelChangedFiles } from "./worktree-trace.js";

export function createExecuteStage(
  executors: ExecutorRegistry,
): TransformStage<OperationBoundExecution, ExecutedWork> {
  return {
    async run(
      prepared: OperationBoundExecution,
      context: StageContext,
    ): Promise<ExecutedWork> {
      const { document, registry } = loadRunningExecution(
        context.workspaceRoot,
        prepared.started,
      );
      const operation = getOperationInstance(
        document.block,
        prepared.operationIndex,
        registry,
      );
      if (!operation) {
        throw new TransformError(
          "execution",
          `Running ModelTransformation has no ModelOperation at index ${prepared.operationIndex}`,
        );
      }
      const executor = executors.resolve(operation.typeFqn, registry);
      const result = await executor.execute({
        workspaceRoot: context.workspaceRoot,
        executionFqn: prepared.started.runningFqn,
        operationIndex: prepared.operationIndex,
        operationTypeFqn: operation.typeFqn,
      });
      if (!result.success) {
        throw new TransformError(
          "execution",
          result.error || "Operation executor failed",
        );
      }
      const worktree = collectWorktreeTrace(context.workspaceRoot);
      return {
        ...prepared,
        trace: {
          stdout: result.output ?? "",
          stderr: "",
          diff: worktree.diff,
          changedFiles: modelChangedFiles(worktree.changedFiles),
        },
      };
    },
  };
}
