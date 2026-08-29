import { type TransformationAgent } from "@blockml/transformer";
import { type CliOutputLine } from "./cli-style.js";
export declare function runTransform(executionFqn: string | undefined, rootDir: string, lines: CliOutputLine[], usage: string, agent: TransformationAgent): Promise<number>;
export declare function defaultTransformAgent(): TransformationAgent;
//# sourceMappingURL=run-transform.d.ts.map