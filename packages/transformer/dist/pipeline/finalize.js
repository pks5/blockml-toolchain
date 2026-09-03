import { finalizeExecution } from "../execution/complete.js";
export function createFinalizeStage() {
    return {
        async run(persisted, context) {
            const finalized = finalizeExecution(context.workspaceRoot, persisted.started, context.now());
            return {
                success: finalized.stage !== "failed",
                pendingFqn: persisted.pendingFqn,
                runningFqn: persisted.started.runningFqn,
                terminalFqn: finalized.terminalFqn,
                status: finalized.stage === "succeeded" ? "Succeeded" : "Failed",
                sequence: persisted.started.sequence,
                executionId: persisted.started.executionId,
                ...(finalized.error !== undefined
                    ? { error: finalized.error }
                    : persisted.exceptionMessage !== undefined
                        ? { error: persisted.exceptionMessage }
                        : {}),
            };
        },
    };
}
//# sourceMappingURL=finalize.js.map