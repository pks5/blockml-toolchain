import { finalizeExecution } from "../execution/complete.js";
export function createFinalizeStage() {
    return {
        async run(persisted, context) {
            const stage = persisted.outcome === "failed" ? "failed" : "succeeded";
            const finalized = finalizeExecution(context.workspaceRoot, persisted.started, context.now(), stage);
            return {
                success: persisted.outcome !== "failed",
                pendingFqn: persisted.pendingFqn,
                runningFqn: persisted.started.runningFqn,
                terminalFqn: finalized.terminalFqn,
                status: stage === "succeeded" ? "Succeeded" : "Failed",
                sequence: persisted.started.sequence,
                executionId: persisted.started.executionId,
                ...(persisted.exceptionMessage !== undefined
                    ? { error: persisted.exceptionMessage }
                    : {}),
            };
        },
    };
}
//# sourceMappingURL=finalize.js.map