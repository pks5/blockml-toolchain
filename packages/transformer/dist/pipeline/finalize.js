import { finalizeExecution } from "../execution/complete.js";
import { formatIsoDuration } from "../execution/duration.js";
export function createFinalizeStage() {
    return {
        async run(persisted, context) {
            const durationMs = Math.max(0, performance.now() - (context.runStartedAtMs ?? performance.now()));
            const duration = formatIsoDuration(durationMs);
            const finalized = finalizeExecution(context.workspaceRoot, persisted.started, context.now(), duration);
            return {
                success: finalized.stage !== "failed",
                pendingFqn: persisted.pendingFqn,
                runningFqn: persisted.started.runningFqn,
                terminalFqn: finalized.terminalFqn,
                status: finalized.stage === "succeeded" ? "Succeeded" : "Failed",
                sequence: persisted.started.sequence,
                executionId: persisted.started.executionId,
                duration,
                durationMs,
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