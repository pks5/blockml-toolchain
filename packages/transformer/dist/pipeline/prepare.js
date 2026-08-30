import { resolvePendingExecution } from "../execution/resolve.js";
import { startExecution } from "../execution/start.js";
import { getStageInstances } from "../execution/properties.js";
export function createPrepareStage() {
    return {
        async run(pendingFqn, context) {
            const resolved = resolvePendingExecution(pendingFqn, context.workspaceRoot);
            const started = startExecution(resolved, context.now(), context.workspaceRoot);
            const stageCount = getStageInstances(resolved.document.block).length;
            return { pendingFqn, started, stageCount };
        },
    };
}
//# sourceMappingURL=prepare.js.map