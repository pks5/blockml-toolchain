import { type CliOutputLine } from "./cli-style.js";
import type { BomConfig } from "./load-config.js";
export interface InspectCliArgs {
    inspectFqn?: string;
    json?: boolean;
    depth?: number;
    srcDir?: string;
    libraries?: string[];
}
export declare function runInspect(parsed: InspectCliArgs, rootDir: string, config: BomConfig, lines: CliOutputLine[], usage: string): Promise<number>;
//# sourceMappingURL=run-inspect.d.ts.map