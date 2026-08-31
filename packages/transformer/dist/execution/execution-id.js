import { randomUUID } from "node:crypto";
import { TransformError } from "./errors.js";
import { parseExecutionFqn } from "./lifecycle.js";
import { getExecutionId } from "./properties.js";
const MAX_ALLOCATE_ATTEMPTS = 32;
/**
 * Execution IDs already present on ModelTransformations under `_meta.transform`.
 * Pending executions are included if they wrongly carry an id.
 */
export function usedExecutionIds(registry) {
    const used = new Set();
    for (const fqn of registry.keys()) {
        if (!parseExecutionFqn(fqn)) {
            continue;
        }
        const document = registry.get(fqn);
        if (!document) {
            continue;
        }
        const id = getExecutionId(document.block);
        if (id) {
            used.add(id);
        }
    }
    return used;
}
export function allocateUniqueExecutionId(registry, generate = randomUUID) {
    const used = usedExecutionIds(registry);
    for (let attempt = 0; attempt < MAX_ALLOCATE_ATTEMPTS; attempt++) {
        const id = generate();
        if (!used.has(id)) {
            return id;
        }
    }
    throw new TransformError("execution", "Failed to allocate a unique executionId");
}
//# sourceMappingURL=execution-id.js.map