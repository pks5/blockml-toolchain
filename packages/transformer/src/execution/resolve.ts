import type { BomDocument, BlockDefinition } from "@blockml/bom";
import {
  bootstrapFullProjectRegistry,
  type TypeRegistry,
} from "@blockml/framework";
import { MODEL_TRANSFORMATION_FQN } from "./constants.js";
import { TransformError } from "./errors.js";
import { parseExecutionFqn } from "./lifecycle.js";
import {
  getExecutionId,
  getPropertyLiteral,
  getStageInstances,
  getStageStatus,
  getStatus,
  hasAggregationComposition,
  hasPropertyValue,
  hasStageProperty,
  isModelTransformation,
  stageHasAggregation,
  stageHasTask,
} from "./properties.js";

export interface ResolvedExecution {
  fqn: string;
  libraryFqn: string;
  originalName: string;
  document: BomDocument;
  registry: TypeRegistry;
}

const REQUIRED_PRESENT = ["executionId", "createdAt"] as const;
const FORBIDDEN_PROPERTIES = [
  "startedAt",
  "baseCommit",
  "completedAt",
  "sequence",
  "feedback",
] as const;
const FORBIDDEN_AGGREGATIONS = ["task", "changedFiles", "exception"] as const;
const STAGE_FORBIDDEN_PROPERTIES = [
  "startedAt",
  "baseCommit",
  "completedAt",
  "feedback",
] as const;
const STAGE_FORBIDDEN_AGGREGATIONS = ["changedFiles", "exception"] as const;

export function resolvePendingExecution(
  executionFqn: string,
  workspaceRoot: string,
): ResolvedExecution {
  const { registry } = bootstrapFullProjectRegistry({ rootDir: workspaceRoot });
  return resolvePendingExecutionInRegistry(executionFqn, registry);
}

export function resolvePendingExecutionInRegistry(
  executionFqn: string,
  registry: TypeRegistry,
): ResolvedExecution {
  const parsed = parseExecutionFqn(executionFqn);
  if (!parsed || parsed.stage !== "pending") {
    throw new TransformError(
      "resolve",
      `Execution FQN must be a ModelTransformation under <library>._meta.transform.pending, got ${executionFqn}`,
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

  assertPendingContract(executionFqn, document.block);

  return {
    fqn: executionFqn,
    libraryFqn: parsed.libraryFqn,
    originalName: parsed.name,
    document,
    registry,
  };
}

function assertPendingContract(fqn: string, block: BlockDefinition): void {
  const stages = getStageInstances(block);
  if (stages.length === 0) {
    throw new TransformError(
      "resolve",
      `${fqn} has no configured stages aggregation`,
    );
  }
  for (let index = 0; index < stages.length; index++) {
    const stage = stages[index]!;
    if (!stageHasTask(stage)) {
      throw new TransformError(
        "resolve",
        `${fqn} Stage ${index + 1} has no configured task aggregation`,
      );
    }
    const stageStatus = getStageStatus(stage);
    if (stageStatus !== undefined && stageStatus !== "Pending") {
      throw new TransformError(
        "resolve",
        `${fqn} Stage ${index + 1} must have status=Pending before it can be started`,
      );
    }
    for (const name of STAGE_FORBIDDEN_PROPERTIES) {
      if (hasStageProperty(stage, name)) {
        throw new TransformError(
          "resolve",
          `${fqn} Stage ${index + 1} must not have ${name} set while pending`,
        );
      }
    }
    for (const name of STAGE_FORBIDDEN_AGGREGATIONS) {
      if (stageHasAggregation(stage, name)) {
        throw new TransformError(
          "resolve",
          `${fqn} Stage ${index + 1} must not have ${name} set while pending`,
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
  if (!getExecutionId(block)) {
    throw new TransformError(
      "resolve",
      `${fqn} must have executionId set before it can be started`,
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
