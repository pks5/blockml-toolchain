import type { OperationExecuteRequest, OperationExecuteResult, OperationExecutor } from "./operation-executor.js";
export interface ToolProcessRequest {
    cwd: string;
    command: string;
    args: string[];
}
export interface ToolProcessResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}
export type ToolProcessRunner = (request: ToolProcessRequest) => Promise<ToolProcessResult>;
export declare class ToolExecutor implements OperationExecutor {
    private readonly runProcess;
    constructor(runProcess?: ToolProcessRunner);
    execute(request: OperationExecuteRequest): Promise<OperationExecuteResult>;
}
//# sourceMappingURL=tool-executor.d.ts.map