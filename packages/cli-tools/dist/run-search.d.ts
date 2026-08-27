import { type CliOutputLine } from "./cli-style.js";
import type { BomConfig } from "./load-config.js";
export interface SearchCliArgs {
    query?: string;
    index?: boolean;
    json?: boolean;
    force?: boolean;
    limit?: number;
    srcDir?: string;
    libraries?: string[];
}
export declare function runSearch(parsed: SearchCliArgs, rootDir: string, config: BomConfig, lines: CliOutputLine[], formatDiagnostic: (d: {
    severity: string;
    code: string;
    message: string;
    source?: {
        file: string;
        line: number;
    };
}) => string, usage: string): Promise<number>;
//# sourceMappingURL=run-search.d.ts.map