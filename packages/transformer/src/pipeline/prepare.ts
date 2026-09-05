import { resolvePendingExecution } from "../execution/resolve.js";
import { startExecution } from "../execution/start.js";
import { SequenceAllocator } from "../execution/sequence.js";
import { getOperationInstances } from "../execution/properties.js";
import type { PreparedExecution, StageContext, TransformStage } from "./types.js";

export function createPrepareStage(): TransformStage<string, PreparedExecution> {
  return {
    async run(pendingFqn: string, context: StageContext): Promise<PreparedExecution> {
      const resolved = resolvePendingExecution(pendingFqn, context.workspaceRoot);
      const started = startExecution(
        resolved,
        context.now(),
        context.workspaceRoot,
        new SequenceAllocator(),
        {
          ...(context.parameters !== undefined
            ? { parameters: context.parameters }
            : {}),
          ...(context.parameterMappings !== undefined
            ? { parameterMappings: context.parameterMappings }
            : {}),
        },
      );
      const operationCount = getOperationInstances(
        resolved.document.block,
        resolved.registry,
      ).length;
      return { pendingFqn, started, operationCount };
    },
  };
}
