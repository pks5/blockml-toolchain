export interface WorktreeTrace {
    diff: string;
    changedFiles: readonly string[];
}
export declare function collectWorktreeTrace(workspaceRoot: string): WorktreeTrace;
//# sourceMappingURL=worktree-trace.d.ts.map