import { TransformError } from "../execution/errors.js";
import { loadRunningExecution } from "../execution/load-running.js";
import { getStageInstance, getStagePropertyLiteral, } from "../execution/properties.js";
export function createReflectStage() {
    return {
        async run(executed, context) {
            const output = stageCapturesOutput(context.workspaceRoot, executed.started, executed.stageIndex)
                ? agentOutput(executed.trace.stdout)
                : undefined;
            return {
                ...executed,
                changedFiles: executed.trace.changedFiles,
                output,
                outcome: "succeeded",
            };
        },
    };
}
export function createNoopReflectStage() {
    return createReflectStage();
}
export function createAgentReflectStage(agent) {
    return {
        async run(executed, context) {
            const result = await agent.reflect({
                workspaceRoot: context.workspaceRoot,
                executionFqn: executed.started.runningFqn,
                stageIndex: executed.stageIndex,
                trace: executed.trace,
            });
            if (!result.success) {
                throw new TransformError("execution", result.error || "Reflection agent failed");
            }
            const changedFiles = result.changedFiles.length > 0
                ? result.changedFiles
                : executed.trace.changedFiles;
            return {
                ...executed,
                changedFiles,
                output: result.output,
                outcome: "succeeded",
            };
        },
    };
}
function stageCapturesOutput(workspaceRoot, started, stageIndex) {
    const { document } = loadRunningExecution(workspaceRoot, started);
    const stage = getStageInstance(document.block, stageIndex);
    if (!stage) {
        return false;
    }
    const value = getStagePropertyLiteral(stage, "captureOutput");
    if (value === true) {
        return true;
    }
    return typeof value === "string" && value.toLowerCase() === "true";
}
function agentOutput(stdout) {
    return stdout.length > 0 ? stdout : undefined;
}
//# sourceMappingURL=reflect.js.map