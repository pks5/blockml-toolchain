import { TransformError } from "../execution/errors.js";
import { loadRunningExecution } from "../execution/load-running.js";
import { getOperationInstance, getOperationPropertyLiteral, } from "../execution/properties.js";
export function createReflectStage() {
    return {
        async run(executed, context) {
            const output = operationCapturesOutput(context.workspaceRoot, executed.started, executed.operationIndex)
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
                operationIndex: executed.operationIndex,
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
function operationCapturesOutput(workspaceRoot, started, operationIndex) {
    const { document } = loadRunningExecution(workspaceRoot, started);
    const operation = getOperationInstance(document.block, operationIndex);
    if (!operation) {
        return false;
    }
    const value = getOperationPropertyLiteral(operation, "captureOutput");
    if (value === true) {
        return true;
    }
    return typeof value === "string" && value.toLowerCase() === "true";
}
function agentOutput(stdout) {
    return stdout.length > 0 ? stdout : undefined;
}
//# sourceMappingURL=reflect.js.map