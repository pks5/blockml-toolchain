import type { TransformationAgent } from "../agent/transformation-agent.js";
import type { ReflectionAgent } from "../agent/reflection-agent.js";
import { createDefaultExecutorRegistry } from "../executor/default-registry.js";
import type { ExecutorRegistry } from "../executor/registry.js";
import { createExecuteStage } from "./execute.js";
import { createFinalizeStage } from "./finalize.js";
import { createPersistStage } from "./persist.js";
import { createPrepareStage } from "./prepare.js";
import { createAgentReflectStage, createReflectStage } from "./reflect.js";
import type { TransformPipeline } from "./types.js";

export function createDefaultPipeline(
  execute: TransformationAgent,
  reflect?: ReflectionAgent,
  executors?: ExecutorRegistry,
): TransformPipeline {
  return {
    prepare: createPrepareStage(),
    execute: createExecuteStage(executors ?? createDefaultExecutorRegistry(execute)),
    reflect: reflect ? createAgentReflectStage(reflect) : createReflectStage(),
    persist: createPersistStage(),
    finalize: createFinalizeStage(),
  };
}
