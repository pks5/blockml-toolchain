import { resolvePendingExecution } from "../execution/resolve.js";
import { startExecution } from "../execution/start.js";
export function createPrepareStage() {
    return {
        async run(pendingFqn, context) {
            const resolved = resolvePendingExecution(pendingFqn, context.workspaceRoot);
            const started = startExecution(resolved, context.now(), context.workspaceRoot);
            return { pendingFqn, started };
        },
    };
}
//# sourceMappingURL=prepare.js.map