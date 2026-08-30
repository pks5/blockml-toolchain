/**
 * Claude Code permissions for transformer stages.
 *
 * Execute may change BML model source. It must not write ModelTransformation
 * files under `_transform/`. Bash is limited to the BlockML CLI.
 *
 * Reflect is read-only: Read/Glob/Grep only. Edit, Write, and Bash are denied.
 *
 * Path rules use `Edit(...)`. That specifier also covers Write.
 * `Write(path)` is ignored by Claude Code.
 *
 * `-p` cannot answer permission prompts. `bypassPermissions` is the
 * unattended mode; deny rules still apply.
 */
export type ClaudePermissionMode = "default" | "acceptEdits" | "plan" | "auto" | "dontAsk" | "bypassPermissions";
export interface ClaudeTransformPermissions {
    permissionMode: ClaudePermissionMode;
    allowedTools: readonly string[];
    disallowedTools?: readonly string[];
}
export declare const CLAUDE_EXECUTE_PERMISSIONS: ClaudeTransformPermissions;
export declare const CLAUDE_REFLECT_PERMISSIONS: ClaudeTransformPermissions;
/** Alias of CLAUDE_EXECUTE_PERMISSIONS for existing imports. */
export declare const CLAUDE_TRANSFORM_PERMISSIONS: ClaudeTransformPermissions;
export declare function claudePermissionCliArgs(permissions?: ClaudeTransformPermissions): string[];
//# sourceMappingURL=claude-permissions.d.ts.map