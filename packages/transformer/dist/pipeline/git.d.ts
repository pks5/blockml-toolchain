export interface GitCommandResult {
    status: number;
    stdout: string;
    stderr: string;
}
export declare function git(cwd: string, args: string[]): GitCommandResult;
export declare function gitStdout(cwd: string, args: string[]): string | undefined;
export declare function assertWorktreeClean(workspaceRoot: string): string;
export declare function commitWorktree(workspaceRoot: string, message: string, options?: {
    required?: boolean;
}): boolean;
//# sourceMappingURL=git.d.ts.map