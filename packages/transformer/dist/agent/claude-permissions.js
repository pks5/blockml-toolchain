export const CLAUDE_EXECUTE_PERMISSIONS = {
    permissionMode: "bypassPermissions",
    allowedTools: [
        "Read",
        "Glob",
        "Grep",
        "Edit(**/*.bml)",
        "Bash(npx blockml *)",
    ],
    disallowedTools: ["Edit(**/_transform/**)", "Edit(**/node_modules/**)"],
};
export const CLAUDE_REFLECT_PERMISSIONS = {
    permissionMode: "bypassPermissions",
    allowedTools: ["Read", "Glob", "Grep"],
    disallowedTools: ["Edit", "Write", "Bash"],
};
/** Alias of CLAUDE_EXECUTE_PERMISSIONS for existing imports. */
export const CLAUDE_TRANSFORM_PERMISSIONS = CLAUDE_EXECUTE_PERMISSIONS;
export function claudePermissionCliArgs(permissions = CLAUDE_EXECUTE_PERMISSIONS) {
    const args = ["--permission-mode", permissions.permissionMode];
    for (const tool of permissions.allowedTools) {
        args.push("--allowedTools", tool);
    }
    for (const tool of permissions.disallowedTools ?? []) {
        args.push("--disallowedTools", tool);
    }
    return args;
}
//# sourceMappingURL=claude-permissions.js.map