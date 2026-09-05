import type {
  AggregationDefinition,
  BlockDefinition,
  BlockInstance,
  BlockInstanceNode,
  CompositionNode,
  LiteralValue,
  PropertyDefinition,
} from "@blockml/bom";
import { collectBaseTypeChain, type TypeRegistry } from "@blockml/framework";
import {
  BOOLEAN_TYPE_FQN,
  DATETIME_TYPE_FQN,
  EXECUTION_EXCEPTION_FQN,
  EXECUTION_STATUS_FQN,
  FILE_PATH_ENTITY_FQN,
  FILE_PATH_TYPE_FQN,
  INTEGER_TYPE_FQN,
  AGENTIC_OPERATION_FQN,
  MODEL_OPERATION_FQN,
  TOOL_OPERATION_FQN,
  MODEL_TRANSFORMATION_FQN,
  RESULT_MAPPING_FQN,
  TEXT_TYPE_FQN,
  UUID_TYPE_FQN,
  type ExecutionStatusId,
} from "./constants.js";

export function isModelTransformation(
  block: BlockDefinition,
  registry: TypeRegistry,
): boolean {
  if (block.type === MODEL_TRANSFORMATION_FQN || block.baseType === MODEL_TRANSFORMATION_FQN) {
    return true;
  }
  return collectBaseTypeChain(block, registry).some(
    (entry) => entry.type === MODEL_TRANSFORMATION_FQN,
  );
}

export function hasTaskComposition(block: BlockDefinition): boolean {
  return hasAggregationComposition(block, "task");
}

export function isAssignableToType(
  typeFqn: string,
  boundFqn: string,
  registry: TypeRegistry,
): boolean {
  if (typeFqn === boundFqn) {
    return true;
  }
  const start = registry.get(typeFqn)?.block;
  if (!start) {
    return false;
  }
  if (start.baseType === boundFqn) {
    return true;
  }
  return collectBaseTypeChain(start, registry).some(
    (entry) => entry.type === boundFqn,
  );
}

export function getOperationInstances(
  block: BlockDefinition,
  registry: TypeRegistry,
): BlockInstance[] {
  const aggregation = block.members.find(
    (member): member is AggregationDefinition =>
      member.kind === "aggregation" && member.name === "operations",
  );
  if (!aggregation?.composition) {
    return [];
  }
  return aggregation.composition.children
    .filter((child): child is BlockInstanceNode => child.kind === "blockInstance")
    .map((child) => child.instance)
    .filter((instance) => isModelOperationInstance(instance.typeFqn, registry));
}

export function isModelOperationInstance(
  typeFqn: string,
  registry: TypeRegistry,
): boolean {
  return (
    typeFqn === MODEL_OPERATION_FQN ||
    typeFqn === AGENTIC_OPERATION_FQN ||
    typeFqn === TOOL_OPERATION_FQN ||
    isAssignableToType(typeFqn, MODEL_OPERATION_FQN, registry)
  );
}

export function getOperationInstance(
  block: BlockDefinition,
  operationIndex: number,
  registry: TypeRegistry,
): BlockInstance | undefined {
  return getOperationInstances(block, registry)[operationIndex];
}

export function isAgenticOperationType(
  typeFqn: string,
  registry: TypeRegistry,
): boolean {
  return (
    typeFqn === AGENTIC_OPERATION_FQN ||
    isAssignableToType(typeFqn, AGENTIC_OPERATION_FQN, registry)
  );
}

export function isToolOperationType(
  typeFqn: string,
  registry: TypeRegistry,
): boolean {
  return (
    typeFqn === TOOL_OPERATION_FQN ||
    isAssignableToType(typeFqn, TOOL_OPERATION_FQN, registry)
  );
}

export function operationHasTask(instance: BlockInstance): boolean {
  return operationHasAggregation(instance, "task");
}

export function operationHasAggregation(
  instance: BlockInstance,
  name: string,
): boolean {
  const aggregation = instance.aggregationCompositions?.find(
    (entry) => entry.aggregationName === name,
  );
  return (aggregation?.composition.children.length ?? 0) > 0;
}

export function hasOperationProperty(instance: BlockInstance, name: string): boolean {
  const value = instance.memberValues[name];
  if (!value) {
    return false;
  }
  if (value.kind === "literal") {
    return value.value !== undefined && value.value !== "";
  }
  return true;
}

export function getOperationPropertyLiteral(
  instance: BlockInstance,
  name: string,
): unknown | undefined {
  const value = instance.memberValues[name];
  if (value?.kind === "literal") {
    return value.value;
  }
  return undefined;
}

export function getOperationStringList(
  instance: BlockInstance,
  name: string,
): string[] | undefined {
  const value = getOperationPropertyLiteral(instance, name);
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    return value === "" ? [] : [value];
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value;
  }
  return undefined;
}

export function getOperationStatus(instance: BlockInstance): string | undefined {
  const value = getOperationPropertyLiteral(instance, "status");
  if (typeof value !== "string") {
    return undefined;
  }
  const separator = value.lastIndexOf("::");
  return separator >= 0 ? value.slice(separator + 2) : value;
}

export function allOperationsSucceeded(
  block: BlockDefinition,
  registry: TypeRegistry,
): boolean {
  const operations = getOperationInstances(block, registry);
  if (operations.length === 0) {
    return false;
  }
  return operations.every((operation) => getOperationStatus(operation) === "Succeeded");
}

function setOperationMember(
  instance: BlockInstance,
  name: string,
  typeFqn: string,
  value: unknown,
  authoredPlacement: "element" | "attribute" = "element",
): void {
  instance.memberValues[name] = {
    kind: "literal",
    value,
    typeFqn,
    authoredPlacement,
  };
}

export function setOperationStatus(
  instance: BlockInstance,
  status: ExecutionStatusId,
): void {
  // `status` is a reserved metadata element name on composition instances;
  // persist it as an attribute so it round-trips through parse.
  setOperationMember(instance, "status", EXECUTION_STATUS_FQN, status, "attribute");
}

function upsertInstanceAggregation(
  instance: BlockInstance,
  aggregationName: string,
  children: CompositionNode[],
): void {
  const next = {
    aggregationName,
    composition: { aggregationName, children },
  };
  const existing = [...(instance.aggregationCompositions ?? [])];
  const index = existing.findIndex((entry) => entry.aggregationName === aggregationName);
  if (index >= 0) {
    existing[index] = next;
  } else {
    existing.push(next);
  }
  instance.aggregationCompositions = existing;
}

export function setOperationStartedAt(instance: BlockInstance, iso: string): void {
  setOperationMember(instance, "startedAt", DATETIME_TYPE_FQN, iso);
}

export function setOperationBaseCommit(instance: BlockInstance, commit: string): void {
  setOperationMember(instance, "baseCommit", TEXT_TYPE_FQN, commit);
}

export function setOperationCompletedAt(instance: BlockInstance, iso: string): void {
  setOperationMember(instance, "completedAt", DATETIME_TYPE_FQN, iso);
}

export function setOperationOutput(instance: BlockInstance, output: string): void {
  setOperationMember(instance, "output", TEXT_TYPE_FQN, output);
}

export function setOperationChangedFiles(
  instance: BlockInstance,
  paths: readonly string[],
): void {
  upsertInstanceAggregation(
    instance,
    "changedFiles",
    paths.map((path) => ({
      kind: "blockInstance" as const,
      instance: {
        typeFqn: FILE_PATH_ENTITY_FQN,
        memberValues: {
          value: {
            kind: "literal" as const,
            value: path,
            typeFqn: FILE_PATH_TYPE_FQN,
            authoredPlacement: "attribute" as const,
          },
        },
      },
    })),
  );
}

export function getOperationResultMappings(instance: BlockInstance): BlockInstance[] {
  const aggregation = instance.aggregationCompositions?.find(
    (entry) => entry.aggregationName === "resultMappings",
  );
  if (!aggregation) {
    return [];
  }
  return aggregation.composition.children
    .filter((child): child is BlockInstanceNode => child.kind === "blockInstance")
    .map((child) => child.instance)
    .filter(
      (mapping) =>
        mapping.typeFqn === RESULT_MAPPING_FQN ||
        mapping.typeFqn.endsWith(".ResultMapping"),
    );
}

export function setOperationException(
  instance: BlockInstance,
  message: string,
  typeFqn: string = EXECUTION_EXCEPTION_FQN,
): void {
  upsertInstanceAggregation(instance, "exception", [
    {
      kind: "blockInstance",
      instance: {
        typeFqn,
        memberValues: {
          message: {
            kind: "literal",
            value: message,
            typeFqn: TEXT_TYPE_FQN,
            authoredPlacement: "element",
          },
        },
      },
    },
  ]);
}

export function hasAggregationComposition(
  block: BlockDefinition,
  name: string,
): boolean {
  const aggregation = block.members.find(
    (member): member is AggregationDefinition =>
      member.kind === "aggregation" && member.name === name,
  );
  return (aggregation?.composition?.children.length ?? 0) > 0;
}

export function hasPropertyValue(block: BlockDefinition, name: string): boolean {
  const member = block.members.find(
    (entry): entry is PropertyDefinition =>
      entry.kind === "property" && entry.name === name,
  );
  if (!member) {
    return false;
  }
  if (member.value !== undefined) {
    return true;
  }
  return (member.values?.length ?? 0) > 0;
}

export function getPropertyLiteral(
  block: BlockDefinition,
  name: string,
): unknown | undefined {
  const member = block.members.find(
    (entry): entry is PropertyDefinition =>
      entry.kind === "property" && entry.name === name,
  );
  if (!member) {
    return undefined;
  }
  const value = member.value ?? member.values?.[0]?.value;
  if (value?.kind === "literal") {
    return value.value;
  }
  return undefined;
}

export function getExecutionId(block: BlockDefinition): string | undefined {
  const value = getPropertyLiteral(block, "executionId");
  return typeof value === "string" ? value : undefined;
}

export function getSequence(block: BlockDefinition): number | undefined {
  const value = getPropertyLiteral(block, "sequence");
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function getStatus(block: BlockDefinition): string | undefined {
  const value = getPropertyLiteral(block, "status");
  if (typeof value !== "string") {
    return undefined;
  }
  const separator = value.lastIndexOf("::");
  return separator >= 0 ? value.slice(separator + 2) : value;
}

export function isTemplate(block: BlockDefinition): boolean {
  const value = getPropertyLiteral(block, "template");
  if (value === true) {
    return true;
  }
  return typeof value === "string" && value.toLowerCase() === "true";
}

export function setTemplate(block: BlockDefinition, template: boolean): void {
  setOverrideProperty(block, "template", BOOLEAN_TYPE_FQN, template);
}

export function setOverrideProperty(
  block: BlockDefinition,
  name: string,
  typeFqn: string,
  value: unknown,
): void {
  const literal: LiteralValue = {
    kind: "literal",
    value,
    typeFqn,
    authoredPlacement: "element",
  };
  const property: PropertyDefinition = {
    kind: "property",
    name,
    override: true,
    typeFqn,
    value: literal,
    values: [{ namespace: "", value: literal }],
  };
  upsertProperty(block, property);
}

export function setOverridePropertyList(
  block: BlockDefinition,
  name: string,
  typeFqn: string,
  values: readonly unknown[],
): void {
  const entries = values.map((value) => {
    const literal: LiteralValue = {
      kind: "literal",
      value,
      typeFqn,
      authoredPlacement: "element",
    };
    return { namespace: "", value: literal };
  });
  const property: PropertyDefinition = {
    kind: "property",
    name,
    override: true,
    typeFqn,
    values: [...entries],
  };
  if (entries[0]) {
    property.value = entries[0].value;
  }
  upsertProperty(block, property);
}

function upsertProperty(block: BlockDefinition, property: PropertyDefinition): void {
  const existing = block.members.findIndex(
    (member) => member.kind === "property" && member.name === property.name,
  );
  if (existing >= 0) {
    block.members[existing] = property;
    return;
  }
  let insertAt = 0;
  for (let i = 0; i < block.members.length; i++) {
    if (block.members[i]?.kind === "property") {
      insertAt = i + 1;
    }
  }
  block.members.splice(insertAt, 0, property);
}

function upsertAggregation(
  block: BlockDefinition,
  aggregation: AggregationDefinition,
): void {
  const existing = block.members.findIndex(
    (member) => member.kind === "aggregation" && member.name === aggregation.name,
  );
  if (existing >= 0) {
    block.members[existing] = aggregation;
    return;
  }
  block.members.push(aggregation);
}

export function setSequence(block: BlockDefinition, sequence: number): void {
  setOverrideProperty(block, "sequence", INTEGER_TYPE_FQN, sequence);
}

export function setExecutionId(block: BlockDefinition, executionId: string): void {
  setOverrideProperty(block, "executionId", UUID_TYPE_FQN, executionId);
}

export function setStatus(block: BlockDefinition, status: ExecutionStatusId): void {
  setOverrideProperty(block, "status", EXECUTION_STATUS_FQN, status);
}

export function setStartedAt(block: BlockDefinition, iso: string): void {
  setOverrideProperty(block, "startedAt", DATETIME_TYPE_FQN, iso);
}

export function setBaseCommit(block: BlockDefinition, commit: string): void {
  setOverrideProperty(block, "baseCommit", TEXT_TYPE_FQN, commit);
}

export function setCompletedAt(block: BlockDefinition, iso: string): void {
  setOverrideProperty(block, "completedAt", DATETIME_TYPE_FQN, iso);
}

export function setFeedback(block: BlockDefinition, feedback: string): void {
  setOverrideProperty(block, "feedback", TEXT_TYPE_FQN, feedback);
}

export function setChangedFiles(
  block: BlockDefinition,
  paths: readonly string[],
): void {
  const aggregation: AggregationDefinition = {
    kind: "aggregation",
    name: "changedFiles",
    override: true,
    authoredInAggregationsSection: true,
    composition: {
      aggregationName: "changedFiles",
      children: paths.map((path) => ({
        kind: "blockInstance" as const,
        instance: {
          typeFqn: FILE_PATH_ENTITY_FQN,
          memberValues: {
            value: {
              kind: "literal" as const,
              value: path,
              typeFqn: FILE_PATH_TYPE_FQN,
              authoredPlacement: "attribute" as const,
            },
          },
        },
      })),
    },
  };
  upsertAggregation(block, aggregation);
}

export function setException(
  block: BlockDefinition,
  typeFqn: string,
  message: string,
): void {
  const aggregation: AggregationDefinition = {
    kind: "aggregation",
    name: "exception",
    override: true,
    authoredInAggregationsSection: true,
    composition: {
      aggregationName: "exception",
      children: [
        {
          kind: "blockInstance",
          instance: {
            typeFqn,
            memberValues: {
              message: {
                kind: "literal",
                value: message,
                typeFqn: TEXT_TYPE_FQN,
                authoredPlacement: "element",
              },
            },
          },
        },
      ],
    },
  };
  upsertAggregation(block, aggregation);
}

export function setResult(
  block: BlockDefinition,
  typeFqn: string,
  value: unknown,
): void {
  setOverrideProperty(block, "result", typeFqn, value);
}

export function clearProperty(block: BlockDefinition, name: string): void {
  const member = block.members.find(
    (entry): entry is PropertyDefinition =>
      entry.kind === "property" && entry.name === name,
  );
  if (!member) {
    return;
  }
  delete member.value;
  delete member.values;
}

export function modelTransformationHasCompletedAt(registry: TypeRegistry): boolean {
  const type = registry.get(MODEL_TRANSFORMATION_FQN)?.block;
  if (!type) {
    return true;
  }
  return type.members.some(
    (member) => member.kind === "property" && member.name === "completedAt",
  );
}
