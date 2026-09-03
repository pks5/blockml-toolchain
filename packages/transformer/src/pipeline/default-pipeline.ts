import type { TransformationAgent } from "../agent/transformation-agent.js";
import type { ReflectionAgent } from "../agent/reflection-agent.js";
import { createExecuteStage } from "./execute.js";
import { createFinalizeStage } from "./finalize.js";
import { createPersistStage } from "./persist.js";
import { createPrepareStage } from "./prepare.js";
import { createAgentReflectStage, createReflectStage } from "./reflect.js";
import type { TransformPipeline } from "./types.js";

export function createDefaultPipeline(
  execute: TransformationAgent,
  reflect?: ReflectionAgent,
): TransformPipeline {
  return {
    prepare: createPrepareStage(),
    execute: createExecuteStage(execute),
    reflect: reflect ? createAgentReflectStage(reflect) : createReflectStage(),
    persist: createPersistStage(),
    finalize: createFinalizeStage(),
  };
}
