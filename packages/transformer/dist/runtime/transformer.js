import { TransformError } from "../execution/errors.js";
import { createDefaultPipeline } from "../pipeline/default-pipeline.js";
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
            const executed = await this.pipeline.execute.run(prepared, context);
            const reflected = await this.pipeline.reflect.run(executed, context);
            const persisted = await this.pipeline.persist.run(reflected, context);
            return await this.pipeline.finalize.run(persisted, context);
        }
        finally {
            await lock.release();
        }
    }
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