import { TransformError } from "../execution/errors.js";
import { emitLifecycle, } from "../execution/lifecycle-events.js";
import { startWorkflowOperation } from "../execution/start-operation.js";
import { createDefaultPipeline } from "../pipeline/default-pipeline.js";
import { collectWorktreeTrace, modelChangedFiles } from "../pipeline/worktree-trace.js";
import { acquireWorktreeLock } from "./worktree-lock.js";
export class Transformer {
    workspaceRoot;
    pipeline;
    now;
    onLifecycle;
    parameters;
    parametersSource;
    constructor(options) {
        this.workspaceRoot = options.workspaceRoot;
        this.pipeline = resolvePipeline(options);
        this.now = options.now ?? (() => new Date());
        this.onLifecycle = options.onLifecycle;
        this.parameters = options.parameters;
        this.parametersSource = options.parametersSource;
    }
    async run(executionFqn) {
        const lock = await acquireWorktreeLock(this.workspaceRoot, executionFqn);
        const context = {
            workspaceRoot: this.workspaceRoot,
            now: this.now,
            ...(this.parameters !== undefined ? { parameters: this.parameters } : {}),
            ...(this.parametersSource !== undefined
                ? { parametersSource: this.parametersSource }
                : {}),
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
        if (prepared.started.parameterError) {
            const result = await this.pipeline.finalize.run({
                ...prepared,
                operationIndex: 0,
                trace: { stdout: "", stderr: "", diff: "", changedFiles: [] },
                changedFiles: [],
                output: undefined,
                outcome: "failed",
                exceptionMessage: prepared.started.parameterError,
            }, context);
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
        let last;
        for (let operationIndex = 0; operationIndex < prepared.operationCount; operationIndex++) {
            const scoped = { ...prepared, operationIndex };
            last = await this.runOperation(scoped, context);
            if (last.outcome === "failed") {
                break;
            }
        }
        if (!last) {
            throw new TransformError("execution", "ModelTransformation has no ModelOperations to execute");
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
    async runOperation(prepared, context) {
        const { operationIndex, operationCount } = prepared;
        const fqn = prepared.started.runningFqn;
        startWorkflowOperation(context.workspaceRoot, prepared.started, operationIndex, context.now());
        emitLifecycle(this.onLifecycle, {
            kind: "operationStatus",
            operationIndex,
            operationCount,
            status: "Running",
            fqn,
        });
        let executed;
        let executeEnded = false;
        let reflectStarted = false;
        let reflectEnded = false;
        try {
            emitLifecycle(this.onLifecycle, {
                kind: "operationExecuteStart",
                operationIndex,
                operationCount,
                fqn,
            });
            executed = await this.pipeline.execute.run(prepared, context);
            executeEnded = true;
            emitLifecycle(this.onLifecycle, {
                kind: "operationExecuteEnd",
                operationIndex,
                operationCount,
                fqn,
            });
            emitLifecycle(this.onLifecycle, {
                kind: "operationReflectStart",
                operationIndex,
                operationCount,
                fqn,
            });
            reflectStarted = true;
            const reflected = await this.pipeline.reflect.run(executed, context);
            reflectEnded = true;
            emitLifecycle(this.onLifecycle, {
                kind: "operationReflectEnd",
                operationIndex,
                operationCount,
                fqn,
            });
            const persisted = await this.pipeline.persist.run(reflected, context);
            emitLifecycle(this.onLifecycle, {
                kind: "operationStatus",
                operationIndex,
                operationCount,
                status: persisted.outcome === "failed" ? "Failed" : "Succeeded",
                fqn,
            });
            return persisted;
        }
        catch (error) {
            if (!executeEnded) {
                emitLifecycle(this.onLifecycle, {
                    kind: "operationExecuteEnd",
                    operationIndex,
                    operationCount,
                    fqn,
                });
            }
            if (reflectStarted && !reflectEnded) {
                emitLifecycle(this.onLifecycle, {
                    kind: "operationReflectEnd",
                    operationIndex,
                    operationCount,
                    fqn,
                });
            }
            const failed = failedReflection(prepared, executed, context, error);
            const persisted = await this.pipeline.persist.run(failed, context);
            emitLifecycle(this.onLifecycle, {
                kind: "operationStatus",
                operationIndex,
                operationCount,
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
    if (options.parameters !== undefined) {
        transformerOptions.parameters = options.parameters;
    }
    if (options.parametersSource !== undefined) {
        transformerOptions.parametersSource = options.parametersSource;
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