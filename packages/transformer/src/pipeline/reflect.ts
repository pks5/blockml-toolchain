import type { ReflectionAgent } from "../agent/reflection-agent.js";
import { TransformError } from "../execution/errors.js";
import type {
  ExecutedWork,
  Reflection,
  StageContext,
  TransformStage,
} from "./types.js";

export function createNoopReflectStage(): TransformStage<ExecutedWork, Reflection> {
  return {
    async run(executed: ExecutedWork): Promise<Reflection> {
      return {
        ...executed,
        changedFiles: [],
        feedback: undefined,
        outcome: "succeeded",
      };
    },
  };
}

export function createReflectStage(
  agent: ReflectionAgent,
): TransformStage<ExecutedWork, Reflection> {
  return {
    async run(executed: ExecutedWork, context: StageContext): Promise<Reflection> {
      const result = await agent.reflect({
        workspaceRoot: context.workspaceRoot,
        executionFqn: executed.started.runningFqn,
        stageIndex: executed.stageIndex,
        trace: executed.trace,
      });
      if (!result.success) {
        throw new TransformError(
          "execution",
          result.error || "Reflection agent failed",
        );
      }
      const changedFiles =
        result.changedFiles.length > 0
          ? result.changedFiles
          : executed.trace.changedFiles;
      return {
        ...executed,
        changedFiles,
        feedback: result.feedback,
        outcome: "succeeded",
      };
    },
  };
}
