import { type CliOutputLine } from "./cli-style.js";
import type { BomConfig } from "./load-config.js";
export declare const GRAPH_SUBCOMMANDS: readonly ["index", "neighbors", "uses", "used-by", "ancestors", "descendants", "members", "path", "query", "schema"];
export type GraphSubcommand = (typeof GRAPH_SUBCOMMANDS)[number];
export interface GraphCliArgs {
    subcommand?: string;
    graphFqn?: string;
    graphTo?: string;
    query?: string;
    json?: boolean;
    force?: boolean;
    depth?: number;
    srcDir?: string;
    libraries?: string[];
}
export declare function runGraph(parsed: GraphCliArgs, rootDir: string, config: BomConfig, lines: CliOutputLine[], formatDiagnostic: (d: {
    severity: string;
    code: string;
    message: string;
    source?: {
        file: string;
        line: number;
    };
}) => string, usage: string): Promise<number>;
//# sourceMappingURL=run-graph.d.ts.map