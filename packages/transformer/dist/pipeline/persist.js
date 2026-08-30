import { persistReflection } from "../execution/persist.js";
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
            persistReflection(context.workspaceRoot, {
                started: reflected.started,
                changedFiles: reflected.changedFiles,
                feedback: reflected.feedback,
                ...(reflected.exceptionMessage !== undefined
                    ? { exceptionMessage: reflected.exceptionMessage }
                    : {}),
            });
            return { ...reflected };
        },
    };
}
//# sourceMappingURL=persist.js.map