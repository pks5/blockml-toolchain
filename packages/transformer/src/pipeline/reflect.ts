import type { ReflectionAgent } from "../agent/reflection-agent.js";
import { TransformError } from "../execution/errors.js";
import {
  assertStageResultValue,
  loadStageResultProducer,
} from "../execution/result-producer.js";
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
      const producer = loadStageResultProducer(
        context.workspaceRoot,
        executed.started,
        executed.stageIndex,
      );
      const result = await agent.reflect({
        workspaceRoot: context.workspaceRoot,
        executionFqn: executed.started.runningFqn,
        stageIndex: executed.stageIndex,
        trace: executed.trace,
        ...(producer ? { resultProducer: producer.spec } : {}),
      });
      if (!result.success) {
        throw new TransformError(
          "execution",
          result.error || "Reflection agent failed",
        );
      }
      if (producer) {
        if (result.result === undefined) {
          throw new TransformError(
            "execution",
            "ResultProducer.produce did not return a result",
          );
        }
        assertStageResultValue(result.result, producer.resultTypeFqn, producer.registry);
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
        ...(producer && result.result !== undefined
          ? { result: result.result, resultTypeFqn: producer.resultTypeFqn }
          : {}),
      };
    },
  };
}
