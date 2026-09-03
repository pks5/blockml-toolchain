import { persistReflection } from "../execution/persist.js";
import { formatDateTimeProperty } from "../execution/lifecycle.js";
import type {
  PersistedExecution,
  Reflection,
  StageContext,
  TransformStage,
} from "./types.js";

export function createNoopPersistStage(): TransformStage<
  Reflection,
  PersistedExecution
> {
  return {
    async run(reflected: Reflection): Promise<PersistedExecution> {
      return { ...reflected };
    },
  };
}

export function createPersistStage(): TransformStage<Reflection, PersistedExecution> {
  return {
    async run(
      reflected: Reflection,
      context: StageContext,
    ): Promise<PersistedExecution> {
      persistReflection(context.workspaceRoot, {
        started: reflected.started,
        stageIndex: reflected.stageIndex,
        changedFiles: reflected.changedFiles,
        output: reflected.output,
        outcome: reflected.outcome,
        completedAtIso: formatDateTimeProperty(context.now()),
        ...(reflected.exceptionMessage !== undefined
          ? { exceptionMessage: reflected.exceptionMessage }
          : {}),
      });
      return { ...reflected };
    },
  };
}
