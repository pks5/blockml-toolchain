import { TransformError } from "../execution/errors.js";
import { createDefaultPipeline } from "../pipeline/default-pipeline.js";
import { collectWorktreeTrace, modelChangedFiles } from "../pipeline/worktree-trace.js";
import { acquireWorktreeLock } from "./worktree-lock.js";
export class Transformer {
    workspaceRoot;
    pipeline;
    now;
    constructor(options) {
        this.workspaceRoot = options.workspaceRoot;
        this.pipeline = resolvePipeline(options);
        this.now = options.now ?? (() => new Date());
    }
    async run(executionFqn) {
        const lock = await acquireWorktreeLock(this.workspaceRoot, executionFqn);
        const context = {
            workspaceRoot: this.workspaceRoot,
            now: this.now,
        };
        try {
            const prepared = await this.pipeline.prepare.run(executionFqn, context);
            return await this.runAfterPrepare(prepared, context);
        }
        finally {
            await lock.release();
        }
    }
    async runAfterPrepare(prepared, context) {
        let executed;
        try {
            executed = await this.pipeline.execute.run(prepared, context);
            const reflected = await this.pipeline.reflect.run(executed, context);
            const persisted = await this.pipeline.persist.run(reflected, context);
            return await this.pipeline.finalize.run(persisted, context);
        }
        catch (error) {
            const failed = failedReflection(prepared, executed, context, error);
            const persisted = await this.pipeline.persist.run(failed, context);
            return await this.pipeline.finalize.run(persisted, context);
        }
    }
}
function failedReflection(prepared, executed, context, error) {
    const exceptionMessage = errorMessage(error);
    const changedFiles = executed?.trace.changedFiles ??
        modelChangedFiles(collectWorktreeTrace(context.workspaceRoot).changedFiles);
    return {
        ...prepared,
        trace: executed?.trace ?? {
            stdout: "",
            stderr: "",
            diff: "",
            changedFiles,
        },
        changedFiles,
        feedback: undefined,
        outcome: "failed",
        exceptionMessage,
    };
}
function errorMessage(error) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return String(error);
}
export async function runTransformation(options) {
    const transformerOptions = {
        workspaceRoot: options.workspaceRoot,
    };
    if (options.agent) {
        transformerOptions.agent = options.agent;
    }
    if (options.reflectAgent) {
        transformerOptions.reflectAgent = options.reflectAgent;
    }
    if (options.pipeline) {
        transformerOptions.pipeline = options.pipeline;
    }
    if (options.now) {
        transformerOptions.now = options.now;
    }
    const transformer = new Transformer(transformerOptions);
    try {
        const result = await transformer.run(options.executionFqn);
        if (result.success) {
            return { ...result, success: true, exitCode: 0 };
        }
        return {
            success: false,
            exitCode: 1,
            error: result.error ?? "Execution failed",
            terminalFqn: result.terminalFqn,
            status: result.status,
        };
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
function resolvePipeline(options) {
    if (options.agent) {
        return {
            ...createDefaultPipeline(options.agent, options.reflectAgent),
            ...options.pipeline,
        };
    }
    const pipeline = options.pipeline;
    if (pipeline?.prepare &&
        pipeline.execute &&
        pipeline.reflect &&
        pipeline.persist &&
        pipeline.finalize) {
        return {
            prepare: pipeline.prepare,
            execute: pipeline.execute,
            reflect: pipeline.reflect,
            persist: pipeline.persist,
            finalize: pipeline.finalize,
        };
    }
    throw new TransformError("resolve", "Transformer requires an agent or a complete pipeline");
}
//# sourceMappingURL=transformer.js.map