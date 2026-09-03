import { bootstrapFullProjectRegistry, } from "@blockml/framework";
import { MODEL_TRANSFORMATION_FQN } from "./constants.js";
import { TransformError } from "./errors.js";
import { parseExecutionFqn } from "./lifecycle.js";
import { getOperationInstances, getOperationStatus, getPropertyLiteral, getStatus, hasAggregationComposition, hasOperationProperty, hasPropertyValue, isModelTransformation, operationHasAggregation, operationHasTask, } from "./properties.js";
const REQUIRED_PRESENT = ["createdAt"];
const FORBIDDEN_PROPERTIES = [
    "executionId",
    "startedAt",
    "baseCommit",
    "completedAt",
    "sequence",
    "output",
    "result",
];
const FORBIDDEN_AGGREGATIONS = ["task", "changedFiles", "exception"];
const OPERATION_FORBIDDEN_PROPERTIES = [
    "startedAt",
    "baseCommit",
    "completedAt",
    "output",
];
const OPERATION_FORBIDDEN_AGGREGATIONS = ["changedFiles", "exception"];
export function resolvePendingExecution(executionFqn, workspaceRoot) {
    const { registry } = bootstrapFullProjectRegistry({ rootDir: workspaceRoot });
    return resolvePendingExecutionInRegistry(executionFqn, registry);
}
export function resolvePendingExecutionInRegistry(executionFqn, registry) {
    const parsed = parseExecutionFqn(executionFqn);
    if (!parsed || parsed.stage !== "pending") {
        throw new TransformError("resolve", `Execution FQN must be a ModelTransformation under <library>._meta.transform.pending, got ${executionFqn}`);
    }
    const document = registry.get(executionFqn);
    if (!document) {
        throw new TransformError("resolve", `No block found for FQN ${executionFqn}`);
    }
    if (!isModelTransformation(document.block, registry)) {
        throw new TransformError("resolve", `${executionFqn} is not a ${MODEL_TRANSFORMATION_FQN}`);
    }
    assertPendingContract(executionFqn, document.block);
    return {
        fqn: executionFqn,
        libraryFqn: parsed.libraryFqn,
        originalName: parsed.name,
        document,
        registry,
    };
}
function assertPendingContract(fqn, block) {
    const operations = getOperationInstances(block);
    if (operations.length === 0) {
        throw new TransformError("resolve", `${fqn} has no configured operations aggregation`);
    }
    for (let index = 0; index < operations.length; index++) {
        const operation = operations[index];
        if (!operationHasTask(operation)) {
            throw new TransformError("resolve", `${fqn} ModelOperation ${index + 1} has no configured task aggregation`);
        }
        const operationStatus = getOperationStatus(operation);
        if (operationStatus !== undefined && operationStatus !== "Pending") {
            throw new TransformError("resolve", `${fqn} ModelOperation ${index + 1} must have status=Pending before it can be started`);
        }
        for (const name of OPERATION_FORBIDDEN_PROPERTIES) {
            if (hasOperationProperty(operation, name)) {
                throw new TransformError("resolve", `${fqn} ModelOperation ${index + 1} must not have ${name} set while pending`);
            }
        }
        for (const name of OPERATION_FORBIDDEN_AGGREGATIONS) {
            if (operationHasAggregation(operation, name)) {
                throw new TransformError("resolve", `${fqn} ModelOperation ${index + 1} must not have ${name} set while pending`);
            }
        }
    }
    if (getStatus(block) !== "Pending") {
        throw new TransformError("resolve", `${fqn} must have status=Pending before it can be started`);
    }
    const createdAt = getPropertyLiteral(block, "createdAt");
    if (typeof createdAt !== "string" || createdAt.length === 0) {
        throw new TransformError("resolve", `${fqn} must have createdAt set before it can be started`);
    }
    for (const name of REQUIRED_PRESENT) {
        if (!hasPropertyValue(block, name)) {
            throw new TransformError("resolve", `${fqn} must have ${name} set before it can be started`);
        }
    }
    for (const name of FORBIDDEN_PROPERTIES) {
        if (hasPropertyValue(block, name)) {
            throw new TransformError("resolve", `${fqn} must not have ${name} set while pending`);
        }
    }
    for (const name of FORBIDDEN_AGGREGATIONS) {
        if (hasAggregationComposition(block, name)) {
            throw new TransformError("resolve", `${fqn} must not have ${name} set while pending`);
        }
    }
}
//# sourceMappingURL=resolve.js.map