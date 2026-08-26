/** CLI24 message kinds and terminal colors. */
export type CliStreamKind = "error" | "warning" | "recommendation" | "info" | "success";
export interface CliOutputLine {
    kind: CliStreamKind;
    text: string;
}
export interface CliWriteStream {
    write(chunk: string): unknown;
    isTTY?: boolean;
}
export declare function diagnosticKind(severity: string): CliStreamKind;
export declare function pushLines(lines: CliOutputLine[], text: string, kind: CliStreamKind): void;
export declare function formatCliOutput(lines: CliOutputLine[]): string;
export declare function streamForKind(kind: CliStreamKind): "stdout" | "stderr";
export declare function shouldUseColor(stream: {
    isTTY?: boolean;
}, env?: NodeJS.ProcessEnv): boolean;
export declare function colorizeLine(kind: CliStreamKind, text: string, enabled: boolean): string;
export declare function writeCliOutput(lines: CliOutputLine[], io?: {
    stdout?: CliWriteStream;
    stderr?: CliWriteStream;
    env?: NodeJS.ProcessEnv;
}): void;
//# sourceMappingURL=cli-style.d.ts.map