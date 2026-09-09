import { mkdirSync, rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ClaudeCodeAgent,
  composeAgentPrompt,
} from "../src/agent/claude-code-agent.js";
import { CLAUDE_EXECUTE_PERMISSIONS } from "../src/agent/claude-permissions.js";
import { fixtureTempDir } from "./fixture.js";

const TMP = fixtureTempDir("claude-agent");

const CLOSED_TASK = [
  "<org.blockml.bml.transformer.workflow.InstructionTask>",
  "  <instructions>Write about oak</instructions>",
  "</org.blockml.bml.transformer.workflow.InstructionTask>",
].join("\n");

const DEFAULT_META = "Execute Task.run on this closed instance:";

describe("composeAgentPrompt", () => {
  it("prepends a non-empty metaPrompt to the closed snippet", () => {
    expect(composeAgentPrompt(DEFAULT_META, CLOSED_TASK)).toBe(
      `${DEFAULT_META}\n\n${CLOSED_TASK}`,
    );
  });

  it("returns only the snippet when metaPrompt is empty", () => {
    expect(composeAgentPrompt("", CLOSED_TASK)).toBe(CLOSED_TASK);
    expect(composeAgentPrompt("   ", CLOSED_TASK)).toBe(CLOSED_TASK);
    expect(composeAgentPrompt(undefined, CLOSED_TASK)).toBe(CLOSED_TASK);
  });
});

describe("ClaudeCodeAgent", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("passes metaPrompt plus the closed Task snippet and no system-prompt injection", async () => {
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
      taskSnippet: CLOSED_TASK,
      metaPrompt: DEFAULT_META,
    });
    expect(result).toEqual({ success: true, stdout: "ok", stderr: "" });
    expect(captured?.cwd).toBe(TMP);
    expect(captured?.command).toBe("claude");
    expect(captured?.args).toContain("-p");
    expect(captured?.args).not.toContain("--append-system-prompt");
    expect(captured?.args).not.toContain("--bare");
    const prompt = captured?.args.find((arg, i) => captured?.args[i - 1] === "-p");
    expect(prompt).toBe(`${DEFAULT_META}\n\n${CLOSED_TASK}`);
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
  });

  it("passes only the snippet when metaPrompt is empty", async () => {
    let prompt: string | undefined;
    const agent = new ClaudeCodeAgent({
      runProcess: async (request) => {
        prompt = request.args.find((arg, i) => request.args[i - 1] === "-p");
        return { exitCode: 0, stdout: "", stderr: "" };
      },
    });
    await agent.execute({
      workspaceRoot: TMP,
      taskSnippet: CLOSED_TASK,
      metaPrompt: "",
    });
    expect(prompt).toBe(CLOSED_TASK);
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
      taskSnippet: CLOSED_TASK,
    });
    expect(captured?.live).toBe(true);
    expect(captured?.args).toContain("--verbose");
    expect(captured?.args).toContain("--output-format");
    expect(captured?.args).toContain("stream-json");
    expect(captured?.args).toContain("--include-partial-messages");
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
      taskSnippet: CLOSED_TASK,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.exitCode).toBe(3);
      expect(result.error).toContain("permission denied");
    }
  });
});
