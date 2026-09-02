import { TransformError } from "../execution/errors.js";
import { assertStageResultValue, loadStageResultProducer, } from "../execution/result-producer.js";
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
            const producer = loadStageResultProducer(context.workspaceRoot, executed.started, executed.stageIndex);
            const result = await agent.reflect({
                workspaceRoot: context.workspaceRoot,
                executionFqn: executed.started.runningFqn,
                stageIndex: executed.stageIndex,
                trace: executed.trace,
                ...(producer ? { resultProducer: producer.spec } : {}),
            });
            if (!result.success) {
                throw new TransformError("execution", result.error || "Reflection agent failed");
            }
            if (producer) {
                if (result.result === undefined) {
                    throw new TransformError("execution", "ResultProducer.produce did not return a result");
                }
                assertStageResultValue(result.result, producer.resultTypeFqn, producer.registry);
            }
            const changedFiles = result.changedFiles.length > 0
                ? result.changedFiles
                : executed.trace.changedFiles;
            return {
                ...executed,
                changedFiles,
                feedback: result.feedback,
                outcome: "succeeded",
                ...(producer && result.result !== undefined
                    ? { result: result.result, resultTypeFqn: producer.resultTypeFqn }
                    : {}),
            };
        },
    };
}
//# sourceMappingURL=reflect.js.map