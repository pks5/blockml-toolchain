import { resolvePendingExecution } from "../execution/resolve.js";
import { startExecution } from "../execution/start.js";
import { SequenceAllocator } from "../execution/sequence.js";
import { getStageInstances } from "../execution/properties.js";
export function createPrepareStage() {
    return {
        async run(pendingFqn, context) {
            const resolved = resolvePendingExecution(pendingFqn, context.workspaceRoot);
            const started = startExecution(resolved, context.now(), context.workspaceRoot, new SequenceAllocator(), {
                ...(context.parameters !== undefined
                    ? { parameters: context.parameters }
                    : {}),
                ...(context.parametersSource !== undefined
                    ? { parametersSource: context.parametersSource }
                    : {}),
            });
            const stageCount = getStageInstances(resolved.document.block).length;
            return { pendingFqn, started, stageCount };
        },
    };
}
//# sourceMappingURL=prepare.js.map