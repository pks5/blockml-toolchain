#!/usr/bin/env node
export interface ParsedArgs {
    command?: string;
    target?: string;
    file?: string;
    all?: boolean;
    outDir?: string;
    srcDir?: string;
    libraries?: string[];
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
export declare function runCli(argv: string[], cwd?: string): {
    code: number;
    stderr: string;
};
export {};
//# sourceMappingURL=cli.d.ts.map