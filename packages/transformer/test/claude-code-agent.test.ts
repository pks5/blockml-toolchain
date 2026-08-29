import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ClaudeCodeAgent,
  buildClaudeExecutionPrompt,
  ensureAgentsMarkdown,
} from "../src/agent/claude-code-agent.js";
import { DEFAULT_AGENTS_MD } from "../src/agent/default-agents.js";

const TMP = join(import.meta.dirname, ".tmp-claude-agent");

describe("ClaudeCodeAgent", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("writes AGENTS.md when missing and includes the running execution FQN in the prompt", async () => {
    const runningFqn =
      "com.example.model._transform.running.T00001_JokeTest_20260830T011702";
    let captured: { command: string; args: string[]; cwd: string } | undefined;
    const agent = new ClaudeCodeAgent({
      runProcess: async (request) => {
        captured = request;
        return { exitCode: 0, stdout: "ok", stderr: "" };
      },
    });
    const result = await agent.execute({
      workspaceRoot: TMP,
      executionFqn: runningFqn,
    });
    expect(result).toEqual({ success: true });
    expect(readFileSync(join(TMP, "AGENTS.md"), "utf8")).toBe(DEFAULT_AGENTS_MD);
    expect(captured?.cwd).toBe(TMP);
    expect(captured?.command).toBe("claude");
    expect(captured?.args).toContain("-p");
    expect(captured?.args.some((arg) => arg.includes(runningFqn))).toBe(true);
    expect(buildClaudeExecutionPrompt(runningFqn)).toContain(runningFqn);
  });

  it("does not overwrite an existing AGENTS.md", async () => {
    const existing = "# Custom instructions\n";
    const { writeFileSync } = await import("node:fs");
    writeFileSync(join(TMP, "AGENTS.md"), existing);
    ensureAgentsMarkdown(TMP);
    expect(readFileSync(join(TMP, "AGENTS.md"), "utf8")).toBe(existing);
  });

  it("surfaces a non-zero Claude exit as failure", async () => {
    const agent = new ClaudeCodeAgent({
      runProcess: async () => ({
        exitCode: 3,
        stdout: "",
        stderr: "permission denied",
      }),
    });
    const result = await agent.execute({
      workspaceRoot: TMP,
      executionFqn: "com.example.model._transform.running.X",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.exitCode).toBe(3);
      expect(result.error).toContain("permission denied");
    }
  });
});
