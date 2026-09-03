import type { ExecutionTrace } from "../pipeline/types.js";
import { type ClaudeTransformPermissions } from "./claude-permissions.js";
import { type ClaudeProcessRunner } from "./claude-code-agent.js";
import type { ReflectRequest, ReflectResult, ReflectionAgent } from "./reflection-agent.js";
export interface ClaudeReflectAgentOptions {
    command?: string;
    runProcess?: ClaudeProcessRunner;
    verbose?: boolean;
    permissions?: ClaudeTransformPermissions;
}
export declare function buildClaudeReflectPrompt(executionFqn: string, operationIndex: number, trace: ExecutionTrace): string;
export declare function parseReflectionOutput(stdout: string): {
    changedFiles: string[];
    output: string;
};
export declare class ClaudeReflectAgent implements ReflectionAgent {
    private readonly command;
    private readonly runProcess;
    private readonly verbose;
    private readonly permissions;
    constructor(options?: ClaudeReflectAgentOptions);
    reflect(request: ReflectRequest): Promise<ReflectResult>;
}
//# sourceMappingURL=claude-reflect-agent.d.ts.map