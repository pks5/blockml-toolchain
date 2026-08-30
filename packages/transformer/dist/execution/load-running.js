import { bootstrapFullProjectRegistry } from "@blockml/framework";
import { TransformError } from "./errors.js";
import { parseExecutionFqn } from "./lifecycle.js";
import { getExecutionId } from "./properties.js";
export function loadRunningExecution(workspaceRoot, started) {
    const { registry } = bootstrapFullProjectRegistry({ rootDir: workspaceRoot });
    const document = registry.get(started.runningFqn) ??
        findRunningByExecutionId(registry, started.libraryFqn, started.executionId);
    if (!document) {
        throw new TransformError("execution", `Running ModelTransformation ${started.runningFqn} was not found`);
    }
    return { document, registry };
}
function findRunningByExecutionId(registry, libraryFqn, executionId) {
    if (!executionId) {
        return undefined;
    }
    for (const fqn of registry.keys()) {
        const parsed = parseExecutionFqn(fqn);
        if (!parsed || parsed.libraryFqn !== libraryFqn || parsed.stage !== "running") {
            continue;
        }
        const found = registry.get(fqn);
        if (found && getExecutionId(found.block) === executionId) {
            return found;
        }
    }
    return undefined;
}
//# sourceMappingURL=load-running.js.map