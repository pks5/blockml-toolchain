/**
 * Claude Code permissions for transformer operations.
 *
 * Execute may change BML model source. It must not write ModelTransformation
 * files under `_meta/transform/`. Bash is limited to the BlockML CLI.
 *
 * Reflect is read-only: Read/Glob/Grep only. Edit, Write, and Bash are denied.
 *
 * Path rules use `Edit(...)`. That specifier also covers Write.
 * `Write(path)` is ignored by Claude Code.
 *
 * `-p` cannot answer permission prompts. `bypassPermissions` is the
 * unattended mode; deny rules still apply.
 */
export type ClaudePermissionMode =
  | "default"
  | "acceptEdits"
  | "plan"
  | "auto"
  | "dontAsk"
  | "bypassPermissions";

export interface ClaudeTransformPermissions {
  permissionMode: ClaudePermissionMode;
  allowedTools: readonly string[];
  disallowedTools?: readonly string[];
}

export const CLAUDE_EXECUTE_PERMISSIONS: ClaudeTransformPermissions = {
  permissionMode: "bypassPermissions",
  allowedTools: [
    "Read",
    "Glob",
    "Grep",
    "Edit(**/*.bml)",
    "Bash(npx blockml *)",
  ],
  disallowedTools: ["Edit(**/_meta/transform/**)", "Edit(**/node_modules/**)"],
};

export const CLAUDE_REFLECT_PERMISSIONS: ClaudeTransformPermissions = {
  permissionMode: "bypassPermissions",
  allowedTools: ["Read", "Glob", "Grep"],
  disallowedTools: ["Edit", "Write", "Bash"],
};

/** Alias of CLAUDE_EXECUTE_PERMISSIONS for existing imports. */
export const CLAUDE_TRANSFORM_PERMISSIONS = CLAUDE_EXECUTE_PERMISSIONS;

export function claudePermissionCliArgs(
  permissions: ClaudeTransformPermissions = CLAUDE_EXECUTE_PERMISSIONS,
): string[] {
  const args: string[] = ["--permission-mode", permissions.permissionMode];
  for (const tool of permissions.allowedTools) {
    args.push("--allowedTools", tool);
  }
  for (const tool of permissions.disallowedTools ?? []) {
    args.push("--disallowedTools", tool);
  }
  return args;
}
