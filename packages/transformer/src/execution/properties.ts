import type {
  AggregationDefinition,
  BlockDefinition,
  LiteralValue,
  PropertyDefinition,
} from "@blockml/bom";
import { collectBaseTypeChain, type TypeRegistry } from "@blockml/framework";
import {
  DATETIME_TYPE_FQN,
  INTEGER_TYPE_FQN,
  TASK_EXECUTION_FQN,
} from "./constants.js";

export function isTaskExecution(
  block: BlockDefinition,
  registry: TypeRegistry,
): boolean {
  if (block.type === TASK_EXECUTION_FQN || block.baseType === TASK_EXECUTION_FQN) {
    return true;
  }
  return collectBaseTypeChain(block, registry).some(
    (entry) => entry.type === TASK_EXECUTION_FQN,
  );
}

export function hasTaskComposition(block: BlockDefinition): boolean {
  const task = block.members.find(
    (member): member is AggregationDefinition =>
      member.kind === "aggregation" && member.name === "task",
  );
  return (task?.composition?.children.length ?? 0) > 0;
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
  const existing = block.members.findIndex(
    (member) => member.kind === "property" && member.name === name,
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

export function setSequence(block: BlockDefinition, sequence: number): void {
  setOverrideProperty(block, "sequence", INTEGER_TYPE_FQN, sequence);
}

export function setStartedAt(block: BlockDefinition, iso: string): void {
  setOverrideProperty(block, "startedAt", DATETIME_TYPE_FQN, iso);
}

export function setCompletedAt(block: BlockDefinition, iso: string): void {
  setOverrideProperty(block, "completedAt", DATETIME_TYPE_FQN, iso);
}

export function taskExecutionHasCompletedAt(registry: TypeRegistry): boolean {
  const type = registry.get(TASK_EXECUTION_FQN)?.block;
  if (!type) {
    return true;
  }
  return type.members.some(
    (member) => member.kind === "property" && member.name === "completedAt",
  );
}
