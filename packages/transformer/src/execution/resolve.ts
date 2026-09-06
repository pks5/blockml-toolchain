import type { BomDocument, BlockDefinition } from "@blockml/bom";
import {
  bootstrapFullProjectRegistry,
  type TypeRegistry,
} from "@blockml/framework";
import {
  AVAILABLE_SEGMENT,
  MODEL_OPERATION_FQN,
  MODEL_TRANSFORMATION_FQN,
} from "./constants.js";
import { TransformError } from "./errors.js";
import { parseTransformLocation } from "./lifecycle.js";
import type { TargetLibrary } from "./target-library.js";
import {
  getOperationInstances,
  getOperationStatus,
  getPropertyLiteral,
  getStatus,
  hasAggregationComposition,
  hasOperationProperty,
  hasPropertyValue,
  isAgenticOperationType,
  isModelTransformation,
  isTemplate,
  isToolOperationType,
  operationHasAggregation,
  operationHasTask,
} from "./properties.js";

export interface ResolvedExecution {
  fqn: string;
  libraryFqn: string;
  libraryRoot: string;
  originalName: string;
  document: BomDocument;
  registry: TypeRegistry;
}

const REQUIRED_PRESENT = ["createdAt"] as const;
const FORBIDDEN_PROPERTIES = [
  "executionId",
  "startedAt",
  "baseCommit",
  "completedAt",
  "sequence",
  "output",
  "result",
] as const;
const FORBIDDEN_AGGREGATIONS = ["task", "changedFiles", "exception"] as const;
const OPERATION_FORBIDDEN_PROPERTIES = [
  "startedAt",
  "baseCommit",
  "completedAt",
  "output",
] as const;
const OPERATION_FORBIDDEN_AGGREGATIONS = ["changedFiles", "exception"] as const;

export function resolvePendingExecution(
  executionFqn: string,
  workspaceRoot: string,
  targetLibrary: TargetLibrary,
): ResolvedExecution {
  const { registry } = bootstrapFullProjectRegistry({ rootDir: workspaceRoot });
  return resolvePendingExecutionInRegistry(executionFqn, registry, targetLibrary);
}

export function resolvePendingExecutionInRegistry(
  executionFqn: string,
  registry: TypeRegistry,
  targetLibrary: TargetLibrary,
): ResolvedExecution {
  const location = parseTransformLocation(executionFqn);
  if (location && location.segment !== "pending" && location.segment !== AVAILABLE_SEGMENT) {
    throw new TransformError(
      "resolve",
      `Execution FQN under _meta.transform must be pending or available, got ${executionFqn}`,
    );
  }

  const document = registry.get(executionFqn);
  if (!document) {
    throw new TransformError(
      "resolve",
      `No block found for FQN ${executionFqn}`,
    );
  }

  if (!isModelTransformation(document.block, registry)) {
    throw new TransformError(
      "resolve",
      `${executionFqn} is not a ${MODEL_TRANSFORMATION_FQN}`,
    );
  }

  assertApplyLocationContract(executionFqn, document.block, location);
  assertPendingContract(executionFqn, document.block, registry);

  return {
    fqn: executionFqn,
    libraryFqn: targetLibrary.packageFqn,
    libraryRoot: targetLibrary.libraryRoot,
    originalName: location?.name ?? lastFqnSegment(executionFqn),
    document,
    registry,
  };
}

function lastFqnSegment(fqn: string): string {
  const name = fqn.split(".").pop();
  return name && name.length > 0 ? name : fqn;
}

function assertApplyLocationContract(
  fqn: string,
  block: BlockDefinition,
  location: ReturnType<typeof parseTransformLocation>,
): void {
  const template = isTemplate(block);
  if (!location) {
    if (!template) {
      throw new TransformError(
        "resolve",
        `${fqn} is outside _meta.transform and must have template=true`,
      );
    }
    return;
  }
  if (location.segment === "pending" && template) {
    throw new TransformError(
      "resolve",
      `${fqn} is in _meta.transform.pending and must have template=false`,
    );
  }
  if (location.segment === AVAILABLE_SEGMENT && !template) {
    throw new TransformError(
      "resolve",
      `${fqn} is in _meta.transform.available and must have template=true`,
    );
  }
}

function assertPendingContract(
  fqn: string,
  block: BlockDefinition,
  registry: TypeRegistry,
): void {
  const operations = getOperationInstances(block, registry);
  if (operations.length === 0) {
    throw new TransformError(
      "resolve",
      `${fqn} has no configured operations aggregation`,
    );
  }
  for (let index = 0; index < operations.length; index++) {
    const operation = operations[index]!;
    if (operation.typeFqn === MODEL_OPERATION_FQN) {
      throw new TransformError(
        "resolve",
        `${fqn} ModelOperation ${index + 1} must be a concrete subtype of ${MODEL_OPERATION_FQN}`,
      );
    }
    if (isAgenticOperationType(operation.typeFqn, registry) && !operationHasTask(operation)) {
      throw new TransformError(
        "resolve",
        `${fqn} AgenticOperation ${index + 1} has no configured task aggregation`,
      );
    }
    if (isToolOperationType(operation.typeFqn, registry) && !hasOperationProperty(operation, "command")) {
      throw new TransformError(
        "resolve",
        `${fqn} ToolOperation ${index + 1} must have command set`,
      );
    }
    const operationStatus = getOperationStatus(operation);
    if (operationStatus !== undefined && operationStatus !== "Pending") {
      throw new TransformError(
        "resolve",
        `${fqn} ModelOperation ${index + 1} must have status=Pending before it can be started`,
      );
    }
    for (const name of OPERATION_FORBIDDEN_PROPERTIES) {
      if (hasOperationProperty(operation, name)) {
        throw new TransformError(
          "resolve",
          `${fqn} ModelOperation ${index + 1} must not have ${name} set while pending`,
        );
      }
    }
    for (const name of OPERATION_FORBIDDEN_AGGREGATIONS) {
      if (operationHasAggregation(operation, name)) {
        throw new TransformError(
          "resolve",
          `${fqn} ModelOperation ${index + 1} must not have ${name} set while pending`,
        );
      }
    }
  }
  if (getStatus(block) !== "Pending") {
    throw new TransformError(
      "resolve",
      `${fqn} must have status=Pending before it can be started`,
    );
  }
  const createdAt = getPropertyLiteral(block, "createdAt");
  if (typeof createdAt !== "string" || createdAt.length === 0) {
    throw new TransformError(
      "resolve",
      `${fqn} must have createdAt set before it can be started`,
    );
  }
  for (const name of REQUIRED_PRESENT) {
    if (!hasPropertyValue(block, name)) {
      throw new TransformError(
        "resolve",
        `${fqn} must have ${name} set before it can be started`,
      );
    }
  }
  for (const name of FORBIDDEN_PROPERTIES) {
    if (hasPropertyValue(block, name)) {
      throw new TransformError(
        "resolve",
        `${fqn} must not have ${name} set while pending`,
      );
    }
  }
  for (const name of FORBIDDEN_AGGREGATIONS) {
    if (hasAggregationComposition(block, name)) {
      throw new TransformError(
        "resolve",
        `${fqn} must not have ${name} set while pending`,
      );
    }
  }
}
