export declare function isTransformLifecyclePath(path: string): boolean;
export declare function modelChangedFiles(paths: readonly string[]): string[];
export interface WorktreeTrace {
    diff: string;
    changedFiles: readonly string[];
}
export declare function collectWorktreeTrace(workspaceRoot: string): WorktreeTrace;
//# sourceMappingURL=worktree-trace.d.ts.map