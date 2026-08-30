export const CLAUDE_TRANSFORM_PERMISSIONS = {
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
export function claudePermissionCliArgs(permissions = CLAUDE_TRANSFORM_PERMISSIONS) {
    const args = ["--permission-mode", permissions.permissionMode];
    for (const tool of permissions.allowedTools) {
        args.push("--allowedTools", tool);
    }
    return args;
}
//# sourceMappingURL=claude-permissions.js.map