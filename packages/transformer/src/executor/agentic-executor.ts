import { bootstrapFullProjectRegistry } from "@blockml/framework";
import type { TransformationAgent } from "../agent/transformation-agent.js";
import {
  buildBlockEvaluationScope,
  getOperationTaskInstructions,
} from "../execution/interpolate.js";
import { getOperationInstance } from "../execution/properties.js";
import type {
  OperationExecuteRequest,
  OperationExecuteResult,
  OperationExecutor,
} from "./operation-executor.js";

export class AgenticExecutor implements OperationExecutor {
  constructor(private readonly agent: TransformationAgent) {}

  async execute(request: OperationExecuteRequest): Promise<OperationExecuteResult> {
    const result = await this.agent.execute({
      workspaceRoot: request.workspaceRoot,
      executionFqn: request.executionFqn,
      operationIndex: request.operationIndex,
      ...resolvedInstructions(request),
    });
    if (!result.success) {
      return {
        success: false,
        exitCode: result.exitCode,
        error: result.error,
      };
    }
    return {
      success: true,
      ...(result.stdout !== undefined ? { output: result.stdout } : {}),
    };
  }
}

function resolvedInstructions(
  request: OperationExecuteRequest,
): { instructions?: string } {
  const { registry } = bootstrapFullProjectRegistry({
    rootDir: request.workspaceRoot,
  });
  const document = registry.get(request.executionFqn);
  if (!document) {
    return {};
  }
  const operation = getOperationInstance(
    document.block,
    request.operationIndex,
    registry,
  );
  if (!operation) {
    return {};
  }
  const instructions = getOperationTaskInstructions(
    operation,
    buildBlockEvaluationScope(document.block),
  );
  return instructions !== undefined ? { instructions } : {};
}
