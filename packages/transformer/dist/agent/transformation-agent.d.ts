export interface AgentExecutionRequest {
    workspaceRoot: string;
    executionFqn: string;
}
export type AgentExecutionResult = {
    success: true;
    stdout?: string;
    stderr?: string;
} | {
    success: false;
    exitCode: number;
    error: string;
};
export interface TransformationAgent {
    execute(request: AgentExecutionRequest): Promise<AgentExecutionResult>;
}
//# sourceMappingURL=transformation-agent.d.ts.map