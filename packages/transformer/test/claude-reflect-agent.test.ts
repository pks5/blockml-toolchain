import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ClaudeReflectAgent,
  buildClaudeReflectPrompt,
  parseReflectionOutput,
} from "../src/agent/claude-reflect-agent.js";
import { CLAUDE_REFLECT_PERMISSIONS } from "../src/agent/claude-permissions.js";
import type { ExecutionTrace } from "../src/pipeline/types.js";

const TMP = join(import.meta.dirname, ".tmp-claude-reflect");

const TRACE: ExecutionTrace = {
  stdout: "execute did the work",
  stderr: "",
  diff: "diff --git a/model.bml b/model.bml",
  changedFiles: ["blocks/com/example/model/Face.bml"],
};

describe("parseReflectionOutput", () => {
  it("parses a bare JSON object", () => {
    expect(
      parseReflectionOutput(
        '{"changedFiles":["a.bml"],"feedback":"added a"}',
      ),
    ).toEqual({ changedFiles: ["a.bml"], feedback: "added a" });
  });

  it("keeps an optional result value", () => {
    expect(
      parseReflectionOutput(
        '{"changedFiles":["a.bml"],"feedback":"added a","result":"poem summary"}',
      ),
    ).toEqual({
      changedFiles: ["a.bml"],
      feedback: "added a",
      result: "poem summary",
    });
  });

  it("parses JSON inside a markdown fence and surrounding prose", () => {
    const stdout = [
      "Here you go:",
      "```json",
      '{ "changedFiles": ["x.bml"], "feedback": "ok" }',
      "```",
    ].join("\n");
    expect(parseReflectionOutput(stdout)).toEqual({
      changedFiles: ["x.bml"],
      feedback: "ok",
    });
  });

  it("rejects output without JSON", () => {
    expect(() => parseReflectionOutput("no json here")).toThrow(/no JSON object/);
  });
});

describe("ClaudeReflectAgent", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("sends a read-only reflect prompt with the execute trace", async () => {
    let captured: { args: string[]; cwd: string } | undefined;
    const agent = new ClaudeReflectAgent({
      runProcess: async (request) => {
        captured = { args: request.args, cwd: request.cwd };
        return {
          exitCode: 0,
          stdout: '{"changedFiles":["model.bml"],"feedback":"looks good"}',
          stderr: "",
        };
      },
    });
    const result = await agent.reflect({
      workspaceRoot: TMP,
      executionFqn: "com.example.model._meta.transform.running.T00001_X",
      stageIndex: 0,
      trace: TRACE,
    });
    expect(result).toEqual({
      success: true,
      changedFiles: ["model.bml"],
      feedback: "looks good",
    });
    const prompt = captured?.args.find((arg, i) => captured?.args[i - 1] === "-p");
    expect(prompt).toContain("Reflect step");
    expect(prompt).toContain("com.example.model._meta.transform.running.T00001_X");
    expect(prompt).toContain("execute did the work");
    expect(prompt).toContain("blocks/com/example/model/Face.bml");
    expect(prompt).toContain("must NOT change");
    expect(prompt).toContain("no ResultProducer");
    expect(captured?.args).toContain("--allowedTools");
    expect(captured?.args).toContain("Read");
    expect(captured?.args).toContain("--disallowedTools");
    expect(captured?.args).toContain("Edit");
    expect(captured?.args).toContain("Write");
    expect(captured?.args).toContain("Bash");
    expect(captured?.args).not.toContain("Edit(**/*.bml)");
    expect(CLAUDE_REFLECT_PERMISSIONS.allowedTools).toEqual(["Read", "Glob", "Grep"]);
  });

  it("fails when Claude exits non-zero or returns invalid JSON", async () => {
    const failing = new ClaudeReflectAgent({
      runProcess: async () => ({ exitCode: 2, stdout: "", stderr: "denied" }),
    });
    const failed = await failing.reflect({
      workspaceRoot: TMP,
      executionFqn: "com.example.model._meta.transform.running.X",
      stageIndex: 0,
      trace: TRACE,
    });
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.error).toContain("denied");
    }

    const invalid = new ClaudeReflectAgent({
      runProcess: async () => ({ exitCode: 0, stdout: "not json", stderr: "" }),
    });
    const parsed = await invalid.reflect({
      workspaceRoot: TMP,
      executionFqn: "com.example.model._meta.transform.running.X",
      stageIndex: 0,
      trace: TRACE,
    });
    expect(parsed.success).toBe(false);
  });

  it("requires result in JSON when a ResultProducer is present", async () => {
    const captured: string[] = [];
    const agent = new ClaudeReflectAgent({
      runProcess: async (request) => {
        captured.push(request.args.find((arg, i) => request.args[i - 1] === "-p") ?? "");
        return {
          exitCode: 0,
          stdout:
            '{"changedFiles":["model.bml"],"feedback":"ok","result":"a tree and a mushroom"}',
          stderr: "",
        };
      },
    });
    const producer = {
      typeFqn: "com.example.model.TestResultProducer",
      resultTypeFqn: "org.blockml.bml.type.Text",
      produceImplementation: "Returns a summary of the poem.",
    };
    const result = await agent.reflect({
      workspaceRoot: TMP,
      executionFqn: "com.example.model._meta.transform.running.X",
      stageIndex: 0,
      trace: TRACE,
      resultProducer: producer,
    });
    expect(result).toEqual({
      success: true,
      changedFiles: ["model.bml"],
      feedback: "ok",
      result: "a tree and a mushroom",
    });
    expect(captured[0]).toContain("Returns a summary of the poem.");

    const missing = new ClaudeReflectAgent({
      runProcess: async () => ({
        exitCode: 0,
        stdout: '{"changedFiles":["model.bml"],"feedback":"ok"}',
        stderr: "",
      }),
    });
    const failed = await missing.reflect({
      workspaceRoot: TMP,
      executionFqn: "com.example.model._meta.transform.running.X",
      stageIndex: 0,
      trace: TRACE,
      resultProducer: producer,
    });
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.error).toMatch(/did not return a result/);
    }
  });
});

describe("buildClaudeReflectPrompt", () => {
  it("includes git files and execute stdout", () => {
    const prompt = buildClaudeReflectPrompt("lib._meta.transform.running.T1", 0, TRACE);
    expect(prompt).toContain("lib._meta.transform.running.T1");
    expect(prompt).toContain("Face.bml");
    expect(prompt).toContain("execute did the work");
    expect(prompt).toContain("changedFiles");
    expect(prompt).toContain("no ResultProducer");
  });

  it("includes ResultProducer produce instructions when present", () => {
    const prompt = buildClaudeReflectPrompt("lib._meta.transform.running.T1", 0, TRACE, {
      typeFqn: "lib.TestResultProducer",
      resultTypeFqn: "org.blockml.bml.type.Text",
      produceImplementation: "Returns a summary of the poem.",
    });
    expect(prompt).toContain("ResultProducer");
    expect(prompt).toContain("lib.TestResultProducer");
    expect(prompt).toContain("org.blockml.bml.type.Text");
    expect(prompt).toContain("Returns a summary of the poem.");
    expect(prompt).toContain('"result"');
    expect(prompt).not.toContain("no ResultProducer");
  });
});
