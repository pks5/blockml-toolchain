import { completeExecution } from "../execution/complete.js";
export function createFinalizeStage() {
    return {
        async run(persisted, context) {
            const completed = completeExecution(context.workspaceRoot, persisted.started, context.now());
            return {
                success: true,
                pendingFqn: persisted.pendingFqn,
                runningFqn: persisted.started.runningFqn,
                completedFqn: completed.completedFqn,
                sequence: persisted.started.sequence,
                executionId: persisted.started.executionId,
            };
        },
    };
}
//# sourceMappingURL=finalize.js.map