export interface AgentExecutionRequest {
  workspaceRoot: string;
  taskSnippet: string;
  /** AgenticOperation.metaPrompt. Empty: snippet only. */
  metaPrompt?: string;
}

export type AgentExecutionResult =
  | { success: true; stdout?: string; stderr?: string }
  | { success: false; exitCode: number; error: string };

export interface TransformationAgent {
  execute(request: AgentExecutionRequest): Promise<AgentExecutionResult>;
}
