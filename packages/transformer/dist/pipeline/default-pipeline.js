import { createDefaultExecutorRegistry } from "../executor/default-registry.js";
import { createExecuteStage } from "./execute.js";
import { createFinalizeStage } from "./finalize.js";
import { createPersistStage } from "./persist.js";
import { createPrepareStage } from "./prepare.js";
import { createAgentReflectStage, createReflectStage } from "./reflect.js";
export function createDefaultPipeline(execute, reflect, executors) {
    return {
        prepare: createPrepareStage(),
        execute: createExecuteStage(executors ?? createDefaultExecutorRegistry(execute)),
        reflect: reflect ? createAgentReflectStage(reflect) : createReflectStage(),
        persist: createPersistStage(),
        finalize: createFinalizeStage(),
    };
}
//# sourceMappingURL=default-pipeline.js.map