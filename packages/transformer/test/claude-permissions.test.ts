import { describe, expect, it } from "vitest";
import {
  CLAUDE_TRANSFORM_PERMISSIONS,
  claudePermissionCliArgs,
} from "../src/agent/claude-permissions.js";

describe("Claude transform permissions", () => {
  it("exposes a single list that the CLI flags follow", () => {
    const args = claudePermissionCliArgs();
    expect(args[0]).toBe("--permission-mode");
    expect(args[1]).toBe(CLAUDE_TRANSFORM_PERMISSIONS.permissionMode);
    for (const tool of CLAUDE_TRANSFORM_PERMISSIONS.allowedTools) {
      expect(args).toContain("--allowedTools");
      expect(args).toContain(tool);
    }
    expect(CLAUDE_TRANSFORM_PERMISSIONS.allowedTools).toContain("Write");
    expect(CLAUDE_TRANSFORM_PERMISSIONS.allowedTools).toContain("Edit");
    expect(CLAUDE_TRANSFORM_PERMISSIONS.allowedTools).toContain("Bash");
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
