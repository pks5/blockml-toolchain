import { type CliOutputLine } from "./cli-style.js";
import type { BomConfig } from "./load-config.js";
export interface ScanCliArgs {
    subcommand?: string;
    selectors?: string[];
    json?: boolean;
    srcDir?: string;
    libraries?: string[];
}
export declare function runScan(parsed: ScanCliArgs, rootDir: string, config: BomConfig, lines: CliOutputLine[], usage: string): number;
//# sourceMappingURL=run-scan.d.ts.map