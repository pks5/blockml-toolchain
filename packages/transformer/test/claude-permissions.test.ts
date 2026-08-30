import { describe, expect, it } from "vitest";
import {
  CLAUDE_EXECUTE_PERMISSIONS,
  CLAUDE_REFLECT_PERMISSIONS,
  CLAUDE_TRANSFORM_PERMISSIONS,
  claudePermissionCliArgs,
} from "../src/agent/claude-permissions.js";

describe("Claude execute permissions", () => {
  it("allows model BML edits and BlockML CLI, denies _transform and node_modules", () => {
    const args = claudePermissionCliArgs();
    expect(args[0]).toBe("--permission-mode");
    expect(args[1]).toBe(CLAUDE_EXECUTE_PERMISSIONS.permissionMode);
    for (const tool of CLAUDE_EXECUTE_PERMISSIONS.allowedTools) {
      expect(args).toContain("--allowedTools");
      expect(args).toContain(tool);
    }
    expect(CLAUDE_EXECUTE_PERMISSIONS.allowedTools).toContain("Edit(**/*.bml)");
    expect(CLAUDE_EXECUTE_PERMISSIONS.allowedTools).toContain("Bash(npx blockml *)");
    expect(CLAUDE_EXECUTE_PERMISSIONS.allowedTools).not.toContain("Write");
    expect(CLAUDE_EXECUTE_PERMISSIONS.allowedTools).not.toContain("Bash");
    expect(CLAUDE_EXECUTE_PERMISSIONS.disallowedTools).toContain(
      "Edit(**/_transform/**)",
    );
    expect(CLAUDE_EXECUTE_PERMISSIONS.disallowedTools).toContain(
      "Edit(**/node_modules/**)",
    );
    expect(args).toContain("--disallowedTools");
    expect(args).toContain("Edit(**/_transform/**)");
    expect(CLAUDE_TRANSFORM_PERMISSIONS).toBe(CLAUDE_EXECUTE_PERMISSIONS);
  });

  it("keeps Reflect read-only", () => {
    const args = claudePermissionCliArgs(CLAUDE_REFLECT_PERMISSIONS);
    expect(CLAUDE_REFLECT_PERMISSIONS.allowedTools).toEqual(["Read", "Glob", "Grep"]);
    expect(CLAUDE_REFLECT_PERMISSIONS.disallowedTools).toEqual(["Edit", "Write", "Bash"]);
    expect(args).toContain("--disallowedTools");
    expect(args).toContain("Edit");
    expect(args).toContain("Bash");
    expect(args).not.toContain("Edit(**/*.bml)");
  });

  it("can emit a tighter policy without changing the agent", () => {
    expect(
      claudePermissionCliArgs({
        permissionMode: "acceptEdits",
        allowedTools: ["Read", "Bash(npx blockml *)"],
      }),
    ).toEqual([
      "--permission-mode",
      "acceptEdits",
      "--allowedTools",
      "Read",
      "--allowedTools",
      "Bash(npx blockml *)",
    ]);
  });
});
