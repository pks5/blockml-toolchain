import type { ExecutionTrace } from "../pipeline/types.js";

export interface ReflectRequest {
  workspaceRoot: string;
  executionFqn: string;
  operationIndex: number;
  trace: ExecutionTrace;
}

export type ReflectResult =
  | {
      success: true;
      changedFiles: readonly string[];
      output: string | undefined;
    }
  | { success: false; exitCode: number; error: string };

export interface ReflectionAgent {
  reflect(request: ReflectRequest): Promise<ReflectResult>;
}
