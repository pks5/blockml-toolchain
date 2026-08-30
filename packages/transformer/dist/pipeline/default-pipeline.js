import { createExecuteStage } from "./execute.js";
import { createFinalizeStage } from "./finalize.js";
import { createPersistStage } from "./persist.js";
import { createPrepareStage } from "./prepare.js";
import { createNoopReflectStage, createReflectStage } from "./reflect.js";
export function createDefaultPipeline(execute, reflect) {
    return {
        prepare: createPrepareStage(),
        execute: createExecuteStage(execute),
        reflect: reflect ? createReflectStage(reflect) : createNoopReflectStage(),
        persist: createPersistStage(),
        finalize: createFinalizeStage(),
    };
}
//# sourceMappingURL=default-pipeline.js.map