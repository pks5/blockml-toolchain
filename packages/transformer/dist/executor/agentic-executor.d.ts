import type { TransformationAgent } from "../agent/transformation-agent.js";
import type { OperationExecuteRequest, OperationExecuteResult, OperationExecutor } from "./operation-executor.js";
export declare class AgenticExecutor implements OperationExecutor {
    private readonly agent;
    constructor(agent: TransformationAgent);
    execute(request: OperationExecuteRequest): Promise<OperationExecuteResult>;
}
//# sourceMappingURL=agentic-executor.d.ts.map