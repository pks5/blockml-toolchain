import { TransformError } from "../execution/errors.js";
export function createNoopReflectStage() {
    return {
        async run(executed) {
            return {
                ...executed,
                changedFiles: [],
                feedback: undefined,
                outcome: "succeeded",
            };
        },
    };
}
export function createReflectStage(agent) {
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
                feedback: result.feedback,
                outcome: "succeeded",
            };
        },
    };
}
//# sourceMappingURL=reflect.js.map