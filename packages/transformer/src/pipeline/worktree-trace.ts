import { TRANSFORM_PATH } from "../execution/constants.js";
import { gitStdout, resolveGitToplevel } from "./git.js";

export function isTransformLifecyclePath(path: string): boolean {
  return (
    path.includes(`/${TRANSFORM_PATH}/`) || path.startsWith(`${TRANSFORM_PATH}/`)
  );
}

export function modelChangedFiles(paths: readonly string[]): string[] {
  return paths.filter((path) => !isTransformLifecyclePath(path));
}

export interface WorktreeTrace {
  diff: string;
  changedFiles: readonly string[];
}

export function collectWorktreeTrace(workspaceRoot: string): WorktreeTrace {
  const empty: WorktreeTrace = { diff: "", changedFiles: [] };
  const toplevel = resolveGitToplevel(workspaceRoot);
  if (toplevel === undefined) {
    return empty;
  }
  const status = gitStdout(toplevel, ["status", "--porcelain"]);
  if (status === undefined) {
    return empty;
  }
  const changedFiles = parsePorcelain(status);
  const unstaged = gitStdout(toplevel, ["diff"]) ?? "";
  const staged = gitStdout(toplevel, ["diff", "--cached"]) ?? "";
  const diff = [unstaged, staged].filter((part) => part.trim().length > 0).join("\n");
  return { diff, changedFiles };
}

function parsePorcelain(stdout: string): string[] {
  const files: string[] = [];
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
