import type { TransformationAgent } from "../agent/transformation-agent.js";
import type { ReflectionAgent } from "../agent/reflection-agent.js";
import type { ExecutorRegistry } from "../executor/registry.js";
import type { ParameterMappingSpec } from "../execution/parameters.js";
import { type TransformLifecycleListener } from "../execution/lifecycle-events.js";
import type { TransformPipeline, TransformRunResult } from "../pipeline/types.js";
export type { TransformRunResult };
export interface TransformerOptions {
    workspaceRoot: string;
    agent?: TransformationAgent;
    reflectAgent?: ReflectionAgent;
    executors?: ExecutorRegistry;
    pipeline?: Partial<TransformPipeline>;
    now?: () => Date;
    onLifecycle?: TransformLifecycleListener;
    parameters?: unknown;
    parameterMappings?: readonly ParameterMappingSpec[];
}
export declare class Transformer {
    private readonly workspaceRoot;
    private readonly pipeline;
    private readonly now;
    private readonly onLifecycle;
    private readonly parameters;
    private readonly parameterMappings;
    constructor(options: TransformerOptions);
    run(executionFqn: string): Promise<TransformRunResult>;
    private runAfterPrepare;
    private runOperation;
}
export interface RunTransformationOptions {
    workspaceRoot: string;
    executionFqn: string;
    agent?: TransformationAgent;
    reflectAgent?: ReflectionAgent;
    executors?: ExecutorRegistry;
    pipeline?: Partial<TransformPipeline>;
    now?: () => Date;
    onLifecycle?: TransformLifecycleListener;
    parameters?: unknown;
    parameterMappings?: readonly ParameterMappingSpec[];
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