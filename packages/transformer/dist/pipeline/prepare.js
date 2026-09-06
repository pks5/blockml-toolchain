import { resolvePendingExecution } from "../execution/resolve.js";
import { startExecution } from "../execution/start.js";
import { SequenceAllocator } from "../execution/sequence.js";
import { getOperationInstances } from "../execution/properties.js";
export function createPrepareStage() {
    return {
        async run(pendingFqn, context) {
            const resolved = resolvePendingExecution(pendingFqn, context.workspaceRoot, context.targetLibrary);
            const started = startExecution(resolved, context.now(), context.workspaceRoot, new SequenceAllocator(), {
                ...(context.parameters !== undefined
                    ? { parameters: context.parameters }
                    : {}),
                ...(context.parameterMappings !== undefined
                    ? { parameterMappings: context.parameterMappings }
                    : {}),
            });
            const operationCount = getOperationInstances(resolved.document.block, resolved.registry).length;
            return { pendingFqn, started, operationCount };
        },
    };
}
//# sourceMappingURL=prepare.js.map