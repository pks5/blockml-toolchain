import { bootstrapFullProjectRegistry } from "@blockml/framework";
import type { TransformationAgent } from "../agent/transformation-agent.js";
import { closeOperationTask } from "../execution/close-task.js";
import { TransformError } from "../execution/errors.js";
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
      taskSnippet: closedTaskSnippet(request),
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

function closedTaskSnippet(request: OperationExecuteRequest): string {
  const { registry } = bootstrapFullProjectRegistry({
    rootDir: request.workspaceRoot,
  });
  const document = registry.get(request.executionFqn);
  if (!document) {
    throw new TransformError(
      "execution",
      `Running ModelTransformation ${request.executionFqn} was not found`,
    );
  }
  const operation = getOperationInstance(
    document.block,
    request.operationIndex,
    registry,
  );
  if (!operation) {
    throw new TransformError(
      "execution",
      `Running ModelTransformation has no ModelOperation at index ${request.operationIndex}`,
    );
  }
  return closeOperationTask(operation, document.block);
}
