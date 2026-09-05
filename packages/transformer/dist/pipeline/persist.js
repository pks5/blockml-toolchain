import { persistReflection } from "../execution/persist.js";
import { formatDateTimeProperty } from "../execution/lifecycle.js";
export function createNoopPersistStage() {
    return {
        async run(reflected) {
            return { ...reflected };
        },
    };
}
export function createPersistStage() {
    return {
        async run(reflected, context) {
            const persisted = persistReflection(context.workspaceRoot, {
                started: reflected.started,
                operationIndex: reflected.operationIndex,
                changedFiles: reflected.changedFiles,
                output: reflected.output,
                outcome: reflected.outcome,
                completedAtIso: formatDateTimeProperty(context.now()),
                ...(reflected.exceptionMessage !== undefined
                    ? { exceptionMessage: reflected.exceptionMessage }
                    : {}),
            });
            return {
                ...reflected,
                outcome: persisted.outcome,
                ...(persisted.exceptionMessage !== undefined
                    ? { exceptionMessage: persisted.exceptionMessage }
                    : {}),
            };
        },
    };
}
//# sourceMappingURL=persist.js.map