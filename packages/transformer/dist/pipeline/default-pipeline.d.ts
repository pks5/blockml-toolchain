import type { TransformationAgent } from "../agent/transformation-agent.js";
import type { ReflectionAgent } from "../agent/reflection-agent.js";
import type { ExecutorRegistry } from "../executor/registry.js";
import type { TransformPipeline } from "./types.js";
export declare function createDefaultPipeline(execute: TransformationAgent, reflect?: ReflectionAgent, executors?: ExecutorRegistry): TransformPipeline;
//# sourceMappingURL=default-pipeline.d.ts.map