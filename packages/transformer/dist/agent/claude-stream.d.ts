export interface FormatClaudeStreamOptions {
    skipCompletedThinking?: boolean;
    skipCompletedText?: boolean;
}
export declare function formatClaudeStreamLine(line: string, options?: FormatClaudeStreamOptions): string | undefined;
export declare function formatClaudeStreamEvent(event: unknown, options?: FormatClaudeStreamOptions): string | undefined;
export declare class ClaudeLiveFormatter {
    private leftover;
    private streamedThinking;
    private streamedText;
    private thinkingLabeled;
    private readonly toolBuffers;
    push(chunk: string): string;
    flush(): string;
    private formatLine;
    private captureToolInput;
}
//# sourceMappingURL=claude-stream.d.ts.map