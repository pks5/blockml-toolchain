export declare const TRANSFORM_LOCK_SENTINEL = "transform.lock";
export declare const TRANSFORM_LOCK_STALE_MS = 30000;
export declare const TRANSFORM_LOCK_UPDATE_MS = 10000;
export interface WorktreeLockMetadata {
    pid: number;
    startedAt: string;
    executionFqn: string;
}
export interface WorktreeLock {
    release: () => Promise<void>;
}
export declare function transformLockPath(workspaceRoot: string): string;
export declare function acquireWorktreeLock(workspaceRoot: string, executionFqn: string): Promise<WorktreeLock>;
//# sourceMappingURL=worktree-lock.d.ts.map