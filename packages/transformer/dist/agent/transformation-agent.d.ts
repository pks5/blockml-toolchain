export interface AgentExecutionRequest {
    workspaceRoot: string;
    executionFqn: string;
}
export type AgentExecutionResult = {
    success: true;
} | {
    success: false;
    exitCode: number;
    error: string;
};
export interface TransformationAgent {
    execute(request: AgentExecutionRequest): Promise<AgentExecutionResult>;
}
//# sourceMappingURL=transformation-agent.d.ts.map