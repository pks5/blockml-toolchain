import type { BlockInstance } from "@blockml/bom";
import { type TypeRegistry } from "@blockml/framework";
import type { ResultProducerSpec } from "../agent/reflection-agent.js";
import type { StartedExecution } from "./start.js";
export interface StageResultProducer {
    spec: ResultProducerSpec;
    resultTypeFqn: string;
    registry: TypeRegistry;
}
export declare function loadStageResultProducer(workspaceRoot: string, started: StartedExecution, stageIndex: number): StageResultProducer | undefined;
export declare function getStageResultProducerInstance(instance: BlockInstance): BlockInstance | undefined;
export declare function resolveStageResultTypeFqn(instance: BlockInstance, registry: TypeRegistry): string;
export declare function assertStageResultValue(value: unknown, typeFqn: string, registry: TypeRegistry): void;
//# sourceMappingURL=result-producer.d.ts.map