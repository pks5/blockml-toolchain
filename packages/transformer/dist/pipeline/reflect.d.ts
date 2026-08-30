import type { ReflectionAgent } from "../agent/reflection-agent.js";
import type { ExecutedWork, Reflection, TransformStage } from "./types.js";
export declare function createNoopReflectStage(): TransformStage<ExecutedWork, Reflection>;
export declare function createReflectStage(agent: ReflectionAgent): TransformStage<ExecutedWork, Reflection>;
//# sourceMappingURL=reflect.d.ts.map