import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ClaudeCodeAgent,
  buildClaudeExecutionPrompt,
  ensureAgentsMarkdown,
} from "../src/agent/claude-code-agent.js";
import { DEFAULT_AGENTS_MD } from "../src/agent/default-agents.js";
import { CLAUDE_EXECUTE_PERMISSIONS } from "../src/agent/claude-permissions.js";

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
    let captured: {
      command: string;
      args: string[];
      cwd: string;
      live?: boolean;
    } | undefined;
    const agent = new ClaudeCodeAgent({
      runProcess: async (request) => {
        captured = request;
        return { exitCode: 0, stdout: "ok", stderr: "" };
      },
    });
    const result = await agent.execute({
      workspaceRoot: TMP,
      executionFqn: runningFqn,
      stageIndex: 0,
    });
    expect(result).toEqual({ success: true, stdout: "ok", stderr: "" });
    expect(readFileSync(join(TMP, "AGENTS.md"), "utf8")).toBe(DEFAULT_AGENTS_MD);
    expect(captured?.cwd).toBe(TMP);
    expect(captured?.command).toBe("claude");
    expect(captured?.args).toContain("-p");
    expect(captured?.args.some((arg) => arg.includes(runningFqn))).toBe(true);
    expect(captured?.args).toContain("--permission-mode");
    expect(captured?.args).toContain("bypassPermissions");
    expect(captured?.args).toContain("--allowedTools");
    expect(captured?.args).toContain("Edit(**/*.bml)");
    expect(captured?.args).toContain("Bash(npx blockml *)");
    expect(captured?.args).toContain("--disallowedTools");
    for (const tool of CLAUDE_EXECUTE_PERMISSIONS.disallowedTools ?? []) {
      expect(captured?.args).toContain(tool);
    }
    expect(captured?.args).not.toContain("Write");
    expect(captured?.args).not.toContain("Bash");
    expect(captured?.args).not.toContain("--verbose");
    expect(captured?.live).toBeUndefined();
    const prompt = buildClaudeExecutionPrompt(runningFqn, 0);
    expect(prompt).toContain(runningFqn);
    expect(prompt).toContain("Execute step");
    expect(prompt).toContain("Running Stage");
    expect(prompt).toContain("Change BML model source");
    expect(prompt).toContain("Do not modify the ModelTransformation block");
    expect(prompt).toContain("_transform/");
  });

  it("streams a verbose Claude session with stream-json", async () => {
    let captured: { args: string[]; live?: boolean } | undefined;
    const agent = new ClaudeCodeAgent({
      verbose: true,
      runProcess: async (request) => {
        captured = { args: request.args, live: request.live };
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    });
    await agent.execute({
      workspaceRoot: TMP,
      executionFqn: "com.example.model._transform.running.X",
      stageIndex: 0,
    });
    expect(captured?.live).toBe(true);
    expect(captured?.args).toContain("--verbose");
    expect(captured?.args).toContain("--output-format");
    expect(captured?.args).toContain("stream-json");
    expect(captured?.args).toContain("--include-partial-messages");
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
      stageIndex: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.exitCode).toBe(3);
      expect(result.error).toContain("permission denied");
    }
  });
});
