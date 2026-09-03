export interface OperationExecuteRequest {
  workspaceRoot: string;
  executionFqn: string;
  operationIndex: number;
  operationTypeFqn: string;
}

export type OperationExecuteResult =
  | { success: true; output?: string }
  | { success: false; exitCode: number; error: string };

export interface OperationExecutor {
  execute(request: OperationExecuteRequest): Promise<OperationExecuteResult>;
}
