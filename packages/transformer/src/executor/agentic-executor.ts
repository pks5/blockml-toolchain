import type { TransformationAgent } from "../agent/transformation-agent.js";
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
