import { TransformError } from "../execution/errors.js";
import { completeExecution } from "../execution/complete.js";
import { resolvePendingExecution } from "../execution/resolve.js";
import { startExecution } from "../execution/start.js";
import { acquireWorktreeLock } from "./worktree-lock.js";
export class Transformer {
    workspaceRoot;
    agent;
    now;
    constructor(options) {
        this.workspaceRoot = options.workspaceRoot;
        this.agent = options.agent;
        this.now = options.now ?? (() => new Date());
    }
    async run(executionFqn) {
        const lock = await acquireWorktreeLock(this.workspaceRoot, executionFqn);
        try {
            const resolved = resolvePendingExecution(executionFqn, this.workspaceRoot);
            const started = startExecution(resolved, this.now());
            const agentResult = await this.agent.execute({
                workspaceRoot: this.workspaceRoot,
                executionFqn: started.runningFqn,
            });
            if (!agentResult.success) {
                throw new TransformError("execution", agentResult.error || "Transformation agent failed");
            }
            const completed = completeExecution(this.workspaceRoot, started, this.now());
            return {
                success: true,
                pendingFqn: executionFqn,
                runningFqn: started.runningFqn,
                completedFqn: completed.completedFqn,
                sequence: started.sequence,
                executionId: started.executionId,
            };
        }
        finally {
            await lock.release();
        }
    }
}
export async function runTransformation(options) {
    const transformerOptions = {
        workspaceRoot: options.workspaceRoot,
        agent: options.agent,
    };
    if (options.now) {
        transformerOptions.now = options.now;
    }
    const transformer = new Transformer(transformerOptions);
    try {
        const result = await transformer.run(options.executionFqn);
        return { ...result, exitCode: 0 };
    }
    catch (error) {
        if (error instanceof TransformError) {
            return {
                success: false,
                exitCode: error.exitCode,
                error: error.message,
            };
        }
        return {
            success: false,
            exitCode: 2,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
//# sourceMappingURL=transformer.js.map