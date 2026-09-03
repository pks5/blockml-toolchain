import { TransformError } from "../execution/errors.js";
import { emitLifecycle, } from "../execution/lifecycle-events.js";
import { startWorkflowStage } from "../execution/start-stage.js";
import { createDefaultPipeline } from "../pipeline/default-pipeline.js";
import { collectWorktreeTrace, modelChangedFiles } from "../pipeline/worktree-trace.js";
import { acquireWorktreeLock } from "./worktree-lock.js";
export class Transformer {
    workspaceRoot;
    pipeline;
    now;
    onLifecycle;
    parameters;
    constructor(options) {
        this.workspaceRoot = options.workspaceRoot;
        this.pipeline = resolvePipeline(options);
        this.now = options.now ?? (() => new Date());
        this.onLifecycle = options.onLifecycle;
        this.parameters = options.parameters ?? {};
    }
    async run(executionFqn) {
        const lock = await acquireWorktreeLock(this.workspaceRoot, executionFqn);
        const context = {
            workspaceRoot: this.workspaceRoot,
            now: this.now,
            parameters: this.parameters,
            ...(this.onLifecycle ? { onLifecycle: this.onLifecycle } : {}),
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
        emitLifecycle(this.onLifecycle, {
            kind: "transformationStatus",
            status: "Running",
            fqn: prepared.started.runningFqn,
        });
        let last;
        for (let stageIndex = 0; stageIndex < prepared.stageCount; stageIndex++) {
            const scoped = { ...prepared, stageIndex };
            last = await this.runStage(scoped, context);
            if (last.outcome === "failed") {
                break;
            }
        }
        if (!last) {
            throw new TransformError("execution", "ModelTransformation has no Stages to execute");
        }
        const result = await this.pipeline.finalize.run(last, context);
        emitLifecycle(this.onLifecycle, {
            kind: "transformationStatus",
            status: result.status,
            fqn: result.terminalFqn,
        });
        emitLifecycle(this.onLifecycle, {
            kind: "transformationComplete",
            status: result.status,
            terminalFqn: result.terminalFqn,
        });
        return result;
    }
    async runStage(prepared, context) {
        const { stageIndex, stageCount } = prepared;
        const fqn = prepared.started.runningFqn;
        startWorkflowStage(context.workspaceRoot, prepared.started, stageIndex, context.now());
        emitLifecycle(this.onLifecycle, {
            kind: "stageStatus",
            stageIndex,
            stageCount,
            status: "Running",
            fqn,
        });
        let executed;
        let executeEnded = false;
        let reflectStarted = false;
        let reflectEnded = false;
        try {
            emitLifecycle(this.onLifecycle, {
                kind: "stageExecuteStart",
                stageIndex,
                stageCount,
                fqn,
            });
            executed = await this.pipeline.execute.run(prepared, context);
            executeEnded = true;
            emitLifecycle(this.onLifecycle, {
                kind: "stageExecuteEnd",
                stageIndex,
                stageCount,
                fqn,
            });
            emitLifecycle(this.onLifecycle, {
                kind: "stageReflectStart",
                stageIndex,
                stageCount,
                fqn,
            });
            reflectStarted = true;
            const reflected = await this.pipeline.reflect.run(executed, context);
            reflectEnded = true;
            emitLifecycle(this.onLifecycle, {
                kind: "stageReflectEnd",
                stageIndex,
                stageCount,
                fqn,
            });
            const persisted = await this.pipeline.persist.run(reflected, context);
            emitLifecycle(this.onLifecycle, {
                kind: "stageStatus",
                stageIndex,
                stageCount,
                status: persisted.outcome === "failed" ? "Failed" : "Succeeded",
                fqn,
            });
            return persisted;
        }
        catch (error) {
            if (!executeEnded) {
                emitLifecycle(this.onLifecycle, {
                    kind: "stageExecuteEnd",
                    stageIndex,
                    stageCount,
                    fqn,
                });
            }
            if (reflectStarted && !reflectEnded) {
                emitLifecycle(this.onLifecycle, {
                    kind: "stageReflectEnd",
                    stageIndex,
                    stageCount,
                    fqn,
                });
            }
            const failed = failedReflection(prepared, executed, context, error);
            const persisted = await this.pipeline.persist.run(failed, context);
            emitLifecycle(this.onLifecycle, {
                kind: "stageStatus",
                stageIndex,
                stageCount,
                status: "Failed",
                fqn,
            });
            return persisted;
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
        output: undefined,
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
    if (options.onLifecycle) {
        transformerOptions.onLifecycle = options.onLifecycle;
    }
    if (options.parameters) {
        transformerOptions.parameters = options.parameters;
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