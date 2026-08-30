import { persistReflection } from "../execution/persist.js";
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
        changedFiles: reflected.changedFiles,
        feedback: reflected.feedback,
        ...(reflected.exceptionMessage !== undefined
          ? { exceptionMessage: reflected.exceptionMessage }
          : {}),
      });
      return { ...reflected };
    },
  };
}
