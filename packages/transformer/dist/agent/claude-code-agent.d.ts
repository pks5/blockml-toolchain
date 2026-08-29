import type { AgentExecutionRequest, AgentExecutionResult, TransformationAgent } from "./transformation-agent.js";
export interface ClaudeProcessResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}
export interface ClaudeProcessRequest {
    command: string;
    args: string[];
    cwd: string;
}
export type ClaudeProcessRunner = (request: ClaudeProcessRequest) => Promise<ClaudeProcessResult>;
export interface ClaudeCodeAgentOptions {
    command?: string;
    runProcess?: ClaudeProcessRunner;
}
export declare function buildClaudeExecutionPrompt(executionFqn: string): string;
export declare function ensureAgentsMarkdown(workspaceRoot: string): string;
export declare class ClaudeCodeAgent implements TransformationAgent {
    private readonly command;
    private readonly runProcess;
    constructor(options?: ClaudeCodeAgentOptions);
    execute(request: AgentExecutionRequest): Promise<AgentExecutionResult>;
}
//# sourceMappingURL=claude-code-agent.d.ts.map