import { type ReflectionAgent, type TransformationAgent } from "@blockml/transformer";
import { type CliOutputLine } from "./cli-style.js";
export declare function runTransform(executionFqn: string | undefined, rootDir: string, lines: CliOutputLine[], usage: string, agent: TransformationAgent, reflectAgent?: ReflectionAgent, onOutputLine?: (line: CliOutputLine) => void, parametersJson?: string): Promise<number>;
export declare function defaultTransformAgent(verbose?: boolean): TransformationAgent;
//# sourceMappingURL=run-transform.d.ts.map