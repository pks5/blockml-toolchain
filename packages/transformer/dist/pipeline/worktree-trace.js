import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
export function collectWorktreeTrace(workspaceRoot) {
    const empty = { diff: "", changedFiles: [] };
    const toplevel = git(workspaceRoot, ["rev-parse", "--show-toplevel"]);
    if (toplevel === undefined) {
        return empty;
    }
    if (resolve(toplevel.trim()) !== resolve(workspaceRoot)) {
        return empty;
    }
    const status = git(workspaceRoot, ["status", "--porcelain"]);
    if (status === undefined) {
        return empty;
    }
    const changedFiles = parsePorcelain(status);
    const unstaged = git(workspaceRoot, ["diff"]) ?? "";
    const staged = git(workspaceRoot, ["diff", "--cached"]) ?? "";
    const diff = [unstaged, staged].filter((part) => part.trim().length > 0).join("\n");
    return { diff, changedFiles };
}
function git(cwd, args) {
    const result = spawnSync("git", args, {
        cwd,
        encoding: "utf8",
    });
    if (result.error || result.status !== 0) {
        return undefined;
    }
    return result.stdout;
}
function parsePorcelain(stdout) {
    const files = [];
    for (const line of stdout.split("\n")) {
        if (line.length < 4) {
            continue;
        }
        const rest = line.slice(3);
        const path = rest.includes(" -> ") ? rest.slice(rest.lastIndexOf(" -> ") + 4) : rest;
        const trimmed = path.replace(/^"|"$/g, "").trim();
        if (trimmed.length > 0) {
            files.push(trimmed.replaceAll("\\", "/"));
        }
    }
    return files;
}
//# sourceMappingURL=worktree-trace.js.map