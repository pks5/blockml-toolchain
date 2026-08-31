import { resolve } from "node:path";
import { TRANSFORM_PATH } from "../execution/constants.js";
import { gitStdout } from "./git.js";
export function isTransformLifecyclePath(path) {
    return (path.includes(`/${TRANSFORM_PATH}/`) || path.startsWith(`${TRANSFORM_PATH}/`));
}
export function modelChangedFiles(paths) {
    return paths.filter((path) => !isTransformLifecyclePath(path));
}
export function collectWorktreeTrace(workspaceRoot) {
    const empty = { diff: "", changedFiles: [] };
    const toplevel = gitStdout(workspaceRoot, ["rev-parse", "--show-toplevel"]);
    if (toplevel === undefined) {
        return empty;
    }
    if (resolve(toplevel.trim()) !== resolve(workspaceRoot)) {
        return empty;
    }
    const status = gitStdout(workspaceRoot, ["status", "--porcelain"]);
    if (status === undefined) {
        return empty;
    }
    const changedFiles = parsePorcelain(status);
    const unstaged = gitStdout(workspaceRoot, ["diff"]) ?? "";
    const staged = gitStdout(workspaceRoot, ["diff", "--cached"]) ?? "";
    const diff = [unstaged, staged].filter((part) => part.trim().length > 0).join("\n");
    return { diff, changedFiles };
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