#!/usr/bin/env node
import { type CliOutputLine } from "./cli-style.js";
import type { ReflectionAgent, TransformationAgent } from "@blockml/transformer";
export interface ParsedArgs {
    command?: string;
    subcommand?: string;
    target?: string;
    file?: string;
    all?: boolean;
    outDir?: string;
    srcDir?: string;
    libraries?: string[];
    include?: string[];
    verbose?: boolean;
    perPackage?: boolean;
    json?: boolean;
    force?: boolean;
    limit?: number;
    query?: string;
    index?: boolean;
    graphFqn?: string;
    graphTo?: string;
    depth?: number;
    executionFqn?: string;
    parametersJson?: string;
    newFqn?: string;
    newBaseType?: string;
    newIs?: string;
}
export interface CliRunOptions {
    transformAgent?: TransformationAgent;
    reflectAgent?: ReflectionAgent;
    onOutputLine?: (line: CliOutputLine) => void;
}
interface PrintableDiagnostic {
    severity: string;
    code: string;
    message: string;
    source?: {
        file: string;
        line: number;
    };
}
export declare function parseArgs(argv: string[]): ParsedArgs;
export declare function formatDiagnostic(d: PrintableDiagnostic): string;
export declare function runCli(argv: string[], cwd?: string, options?: CliRunOptions): Promise<{
    code: number;
    stderr: string;
}>;
/** True when argv[1] is this CLI module, including an npm `.bin` symlink to it. */
export declare function isCliEntry(argv1: string | undefined, modulePath: string): boolean;
export {};
//# sourceMappingURL=cli.d.ts.map