import type { TransformationAgent } from "../agent/transformation-agent.js";
import type { ReflectionAgent } from "../agent/reflection-agent.js";
import type { TransformPipeline, TransformRunResult } from "../pipeline/types.js";
export type { TransformRunResult };
export interface TransformerOptions {
    workspaceRoot: string;
    agent?: TransformationAgent;
    reflectAgent?: ReflectionAgent;
    pipeline?: Partial<TransformPipeline>;
    now?: () => Date;
}
export declare class Transformer {
    private readonly workspaceRoot;
    private readonly pipeline;
    private readonly now;
    constructor(options: TransformerOptions);
    run(executionFqn: string): Promise<TransformRunResult>;
    private runAfterPrepare;
}
export interface RunTransformationOptions {
    workspaceRoot: string;
    executionFqn: string;
    agent?: TransformationAgent;
    reflectAgent?: ReflectionAgent;
    pipeline?: Partial<TransformPipeline>;
    now?: () => Date;
}
export type RunTransformationResult = (TransformRunResult & {
    success: true;
    exitCode: 0;
}) | {
    success: false;
    exitCode: number;
    error: string;
    terminalFqn?: string;
    status?: TransformRunResult["status"];
};
export declare function runTransformation(options: RunTransformationOptions): Promise<RunTransformationResult>;
export type { StartedExecution } from "../execution/start.js";
//# sourceMappingURL=transformer.d.ts.map