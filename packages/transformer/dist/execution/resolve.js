import { bootstrapFullProjectRegistry, } from "@blockml/framework";
import { TASK_EXECUTION_FQN } from "./constants.js";
import { TransformError } from "./errors.js";
import { parseExecutionFqn } from "./lifecycle.js";
import { hasTaskComposition, isTaskExecution } from "./properties.js";
export function resolvePendingExecution(executionFqn, workspaceRoot) {
    const { registry } = bootstrapFullProjectRegistry({ rootDir: workspaceRoot });
    return resolvePendingExecutionInRegistry(executionFqn, registry);
}
export function resolvePendingExecutionInRegistry(executionFqn, registry) {
    const parsed = parseExecutionFqn(executionFqn);
    if (!parsed || parsed.stage !== "pending") {
        throw new TransformError("resolve", `Execution FQN must be a TaskExecution under <library>._transform.pending, got ${executionFqn}`);
    }
    const document = registry.get(executionFqn);
    if (!document) {
        throw new TransformError("resolve", `No block found for FQN ${executionFqn}`);
    }
    if (!isTaskExecution(document.block, registry)) {
        throw new TransformError("resolve", `${executionFqn} is not a ${TASK_EXECUTION_FQN}`);
    }
    if (!hasTaskComposition(document.block)) {
        throw new TransformError("resolve", `${executionFqn} has no configured task aggregation`);
    }
    return {
        fqn: executionFqn,
        libraryFqn: parsed.libraryFqn,
        originalName: parsed.name,
        document,
        registry,
    };
}
//# sourceMappingURL=resolve.js.map