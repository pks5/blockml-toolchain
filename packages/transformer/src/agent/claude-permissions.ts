/**
 * Claude Code permissions for transform executions.
 *
 * This is the only place to change what a non-interactive transform session
 * may do. `ClaudeCodeAgent` turns this object into CLI flags.
 *
 * `-p` cannot answer permission prompts. `bypassPermissions` is the
 * unattended mode. To tighten later, switch `permissionMode` to `acceptEdits`
 * and rely on `allowedTools` as the allowlist.
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
  allowedTools: string[];
}

export const CLAUDE_TRANSFORM_PERMISSIONS: ClaudeTransformPermissions = {
  permissionMode: "bypassPermissions",
  allowedTools: [
    "Read",
    "Write",
    "Edit",
    "Glob",
    "Grep",
    "Bash",
  ],
};

export function claudePermissionCliArgs(
  permissions: ClaudeTransformPermissions = CLAUDE_TRANSFORM_PERMISSIONS,
): string[] {
  const args: string[] = ["--permission-mode", permissions.permissionMode];
  for (const tool of permissions.allowedTools) {
    args.push("--allowedTools", tool);
  }
  return args;
}
