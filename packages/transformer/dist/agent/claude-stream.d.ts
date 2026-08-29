export declare function formatClaudeStreamLine(line: string): string | undefined;
export declare function formatClaudeStreamEvent(event: unknown): string | undefined;
export declare class ClaudeLiveFormatter {
    private leftover;
    push(chunk: string): string;
    flush(): string;
}
//# sourceMappingURL=claude-stream.d.ts.map