import type {
  BlockInstance,
  BlockInstanceNode,
  CapabilityDefinition,
  TypeExpression,
} from "@blockml/bom";
import {
  resolveEffectiveMembers,
  type TypeRegistry,
} from "@blockml/framework";
import type { ResultProducerSpec } from "../agent/reflection-agent.js";
import { TEXT_TYPE_FQN } from "./constants.js";
import { TransformError } from "./errors.js";
import { loadRunningExecution } from "./load-running.js";
import { assertCompatibleValue } from "./parameters.js";
import { getStageInstance } from "./properties.js";
import type { StartedExecution } from "./start.js";

export interface StageResultProducer {
  spec: ResultProducerSpec;
  resultTypeFqn: string;
  registry: TypeRegistry;
}

export function loadStageResultProducer(
  workspaceRoot: string,
  started: StartedExecution,
  stageIndex: number,
): StageResultProducer | undefined {
  const { document, registry } = loadRunningExecution(workspaceRoot, started);
  const stage = getStageInstance(document.block, stageIndex);
  if (!stage) {
    throw new TransformError(
      "execution",
      `Running ModelTransformation has no Stage at index ${stageIndex}`,
    );
  }
  const producer = getStageResultProducerInstance(stage);
  if (!producer) {
    return undefined;
  }
  const resultTypeFqn = resolveStageResultTypeFqn(stage, registry);
  return {
    spec: {
      typeFqn: producer.typeFqn,
      resultTypeFqn,
      produceImplementation: produceImplementationSource(producer.typeFqn, registry),
    },
    resultTypeFqn,
    registry,
  };
}

export function getStageResultProducerInstance(
  instance: BlockInstance,
): BlockInstance | undefined {
  const aggregation = instance.aggregationCompositions?.find(
    (entry) => entry.aggregationName === "resultProducer",
  );
  const child = aggregation?.composition.children.find(
    (node): node is BlockInstanceNode => node.kind === "blockInstance",
  );
  return child?.instance;
}

export function resolveStageResultTypeFqn(
  instance: BlockInstance,
  registry: TypeRegistry,
): string {
  const authored = namedTypeFqn(instance.generics?.arguments?.[0]);
  if (authored) {
    return authored;
  }
  const typeDoc = registry.get(instance.typeFqn);
  const param = typeDoc?.block.genericTypes?.find((entry) => entry.name === "T");
  const fromDefault = resolveAuthoredType(
    param?.defaultType,
    typeDoc?.source.namespaceBindings ?? {},
  );
  return fromDefault ?? TEXT_TYPE_FQN;
}

export function assertStageResultValue(
  value: unknown,
  typeFqn: string,
  registry: TypeRegistry,
): void {
  try {
    assertCompatibleValue(value, typeFqn, registry, "result");
  } catch (error) {
    if (error instanceof TransformError) {
      throw new TransformError("execution", error.message);
    }
    throw error;
  }
}

function produceImplementationSource(
  typeFqn: string,
  registry: TypeRegistry,
): string {
  const typeBlock = registry.get(typeFqn)?.block;
  if (!typeBlock) {
    return "";
  }
  const produce = resolveEffectiveMembers(typeBlock, registry).find(
    (member): member is CapabilityDefinition =>
      member.kind === "capability" && member.name === "produce",
  );
  return produce?.implementation?.source.trim() ?? "";
}

function namedTypeFqn(expr: TypeExpression | undefined): string | undefined {
  if (!expr) {
    return undefined;
  }
  if (expr.kind === "named") {
    return expr.fqn;
  }
  if (expr.kind === "grouped") {
    return namedTypeFqn(expr.expression);
  }
  return undefined;
}

function resolveAuthoredType(
  raw: string | undefined,
  bindings: Record<string, string>,
): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return undefined;
  }
  const idx = trimmed.indexOf(":");
  if (idx < 0) {
    return trimmed.includes(".") ? trimmed : undefined;
  }
  const ns = bindings[trimmed.slice(0, idx)];
  return ns ? `${ns}.${trimmed.slice(idx + 1)}` : undefined;
}
