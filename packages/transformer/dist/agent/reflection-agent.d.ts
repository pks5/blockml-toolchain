import type { ExecutionTrace } from "../pipeline/types.js";
export interface ResultProducerSpec {
    typeFqn: string;
    resultTypeFqn: string;
    produceImplementation: string;
}
export interface ReflectRequest {
    workspaceRoot: string;
    executionFqn: string;
    stageIndex: number;
    trace: ExecutionTrace;
    resultProducer?: ResultProducerSpec;
}
export type ReflectResult = {
    success: true;
    changedFiles: readonly string[];
    feedback: string | undefined;
    result?: unknown;
} | {
    success: false;
    exitCode: number;
    error: string;
};
export interface ReflectionAgent {
    reflect(request: ReflectRequest): Promise<ReflectResult>;
}
//# sourceMappingURL=reflection-agent.d.ts.map