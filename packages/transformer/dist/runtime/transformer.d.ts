import type { TransformationAgent } from "../agent/transformation-agent.js";
import { type StartedExecution } from "../execution/start.js";
export interface TransformerOptions {
    workspaceRoot: string;
    agent: TransformationAgent;
    now?: () => Date;
}
export interface TransformRunResult {
    success: true;
    pendingFqn: string;
    runningFqn: string;
    completedFqn: string;
    sequence: number;
    executionId: string | undefined;
}
export declare class Transformer {
    private readonly workspaceRoot;
    private readonly agent;
    private readonly now;
    constructor(options: TransformerOptions);
    run(executionFqn: string): Promise<TransformRunResult>;
}
export interface RunTransformationOptions {
    workspaceRoot: string;
    executionFqn: string;
    agent: TransformationAgent;
    now?: () => Date;
}
export type RunTransformationResult = (TransformRunResult & {
    exitCode: 0;
}) | {
    success: false;
    exitCode: number;
    error: string;
};
export declare function runTransformation(options: RunTransformationOptions): Promise<RunTransformationResult>;
export type { StartedExecution };
//# sourceMappingURL=transformer.d.ts.map