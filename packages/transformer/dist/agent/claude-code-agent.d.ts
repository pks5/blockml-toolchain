import { type ClaudeTransformPermissions } from "./claude-permissions.js";
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
    live?: boolean;
}
export type ClaudeProcessRunner = (request: ClaudeProcessRequest) => Promise<ClaudeProcessResult>;
export interface ClaudeCodeAgentOptions {
    command?: string;
    runProcess?: ClaudeProcessRunner;
    verbose?: boolean;
    permissions?: ClaudeTransformPermissions;
}
export declare function composeAgentPrompt(metaPrompt: string | undefined, taskSnippet: string): string;
export declare class ClaudeCodeAgent implements TransformationAgent {
    private readonly command;
    private readonly runProcess;
    private readonly verbose;
    private readonly permissions;
    constructor(options?: ClaudeCodeAgentOptions);
    execute(request: AgentExecutionRequest): Promise<AgentExecutionResult>;
}
export declare function runClaudeProcess(request: ClaudeProcessRequest): Promise<ClaudeProcessResult>;
//# sourceMappingURL=claude-code-agent.d.ts.map