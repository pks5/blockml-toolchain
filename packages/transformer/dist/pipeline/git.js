import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { TransformError } from "../execution/errors.js";
export function resolveWorkspacePath(path) {
    try {
        return realpathSync(path);
    }
    catch {
        return resolve(path);
    }
}
/** Nearest enclosing Git toplevel walking up from `from`. */
export function resolveGitToplevel(from) {
    let dir = resolveWorkspacePath(from);
    for (;;) {
        if (existsSync(join(dir, ".git"))) {
            return dir;
        }
        const parent = dirname(dir);
        if (parent === dir) {
            return undefined;
        }
        dir = parent;
    }
}
function gitEnv(cwd) {
    const start = resolveWorkspacePath(cwd);
    const root = resolveGitToplevel(start) ?? start;
    const env = { ...process.env };
    delete env.GIT_DIR;
    delete env.GIT_WORK_TREE;
    delete env.GIT_INDEX_FILE;
    env.GIT_DIR = resolve(root, ".git");
    env.GIT_WORK_TREE = root;
    return env;
}
export function git(cwd, args) {
    const result = spawnSync("git", args, {
        cwd,
        encoding: "utf8",
        env: gitEnv(cwd),
    });
    if (result.error) {
        return { status: 1, stdout: "", stderr: result.error.message };
    }
    return {
        status: result.status ?? 1,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
    };
}
export function gitStdout(cwd, args) {
    const result = git(cwd, args);
    if (result.status !== 0) {
        return undefined;
    }
    return result.stdout;
}
export function assertWorktreeClean(workspaceRoot) {
    const toplevel = resolveGitToplevel(workspaceRoot);
    if (!toplevel) {
        throw new TransformError("resolve", `Workspace is not a Git repository: ${workspaceRoot}`);
    }
    const head = git(toplevel, ["rev-parse", "HEAD"]);
    if (head.status !== 0) {
        throw new TransformError("resolve", "Git HEAD is missing; cannot record baseCommit");
    }
    const status = git(toplevel, ["status", "--porcelain"]);
    if (status.status !== 0) {
        throw new TransformError("resolve", status.stderr.trim() || "git status failed");
    }
    const dirty = status.stdout.trim();
    if (dirty.length > 0) {
        throw new TransformError("resolve", `Worktree is not clean; aborting transformation.\n${dirty}`);
    }
    return head.stdout.trim();
}
export function commitWorktree(workspaceRoot, message, options = {}) {
    const add = git(workspaceRoot, ["add", "-A"]);
    if (add.status !== 0) {
        throw new TransformError("execution", add.stderr.trim() || "git add failed");
    }
    const cached = git(workspaceRoot, ["diff", "--cached", "--quiet"]);
    if (cached.status === 0) {
        if (options.required) {
            throw new TransformError("execution", `git commit produced no changes: ${message}`);
        }
        return false;
    }
    if (cached.status !== 1) {
        throw new TransformError("execution", cached.stderr.trim() || "git diff --cached failed");
    }
    const commit = git(workspaceRoot, [
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-m",
        message,
    ]);
    if (commit.status !== 0) {
        throw new TransformError("execution", commit.stderr.trim() || "git commit failed");
    }
    return true;
}
//# sourceMappingURL=git.js.map