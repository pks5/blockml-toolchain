import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TOOL_OPERATION_FQN } from "../src/execution/constants.js";
import {
  ToolExecutor,
  type ToolProcessRequest,
} from "../src/executor/tool-executor.js";
import { pendingExecutionXml, pendingFqn, writeProject } from "./fixture.js";

const TMP = join(import.meta.dirname, ".tmp-transformer-tool-executor");

function writeToolPending(opts?: {
  command?: string;
  args?: readonly string[];
  parameterFields?: readonly string[];
  pendingParameters?: string;
}): string {
  writeProject(TMP, {
    "blocks/com/example/model/_meta/transform/pending/JokeTest.bml":
      pendingExecutionXml({
        name: "JokeTest",
        captureOutput: true,
        ...(opts?.parameterFields !== undefined
          ? { parameterFields: opts.parameterFields }
          : {}),
        ...(opts?.pendingParameters !== undefined
          ? { pendingParameters: opts.pendingParameters }
          : {}),
        tool: {
          command: opts?.command ?? "blockml",
          ...(opts?.args !== undefined ? { args: opts.args } : { args: ["validate"] }),
        },
      }),
  });
  return pendingFqn("JokeTest");
}

describe("ToolExecutor", () => {
  beforeEach(() => {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    rmSync(TMP, { recursive: true, force: true });
  });

  it("spawns npx command args and returns combined output", async () => {
    const executionFqn = writeToolPending();
    const calls: ToolProcessRequest[] = [];
    const executor = new ToolExecutor(async (request) => {
      calls.push(request);
      return {
        exitCode: 0,
        stdout: "Validation succeeded.\n",
        stderr: "",
      };
    });
    const result = await executor.execute({
      workspaceRoot: TMP,
      executionFqn,
      operationIndex: 0,
      operationTypeFqn: TOOL_OPERATION_FQN,
    });
    expect(result).toEqual({
      success: true,
      output: "Validation succeeded.\n",
    });
    expect(calls).toEqual([
      { cwd: TMP, command: "blockml", args: ["validate"] },
    ]);
  });

  it("fails when the tool exits non-zero", async () => {
    const executionFqn = writeToolPending();
    const executor = new ToolExecutor(async () => ({
      exitCode: 1,
      stdout: "",
      stderr: "Validation failed.\n",
    }));
    const result = await executor.execute({
      workspaceRoot: TMP,
      executionFqn,
      operationIndex: 0,
      operationTypeFqn: TOOL_OPERATION_FQN,
    });
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.exitCode).toBe(1);
    expect(result.error).toContain("exited 1");
    expect(result.error).toContain("Validation failed.");
  });

  it("rejects a command that is not a single token", async () => {
    const executionFqn = writeToolPending({ command: "blockml validate" });
    let ran = false;
    const executor = new ToolExecutor(async () => {
      ran = true;
      return { exitCode: 0, stdout: "", stderr: "" };
    });
    const result = await executor.execute({
      workspaceRoot: TMP,
      executionFqn,
      operationIndex: 0,
      operationTypeFqn: TOOL_OPERATION_FQN,
    });
    expect(ran).toBe(false);
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error).toMatch(/single npm bin token/);
  });

  it("interpolates ${} holes in Text[] args against this.parameters", async () => {
    const executionFqn = writeToolPending({
      parameterFields: ["mode"],
      pendingParameters: '{"mode":"validate"}',
      args: ["${ this.parameters.mode }"],
    });
    const calls: ToolProcessRequest[] = [];
    const executor = new ToolExecutor(async (request) => {
      calls.push(request);
      return { exitCode: 0, stdout: "ok\n", stderr: "" };
    });
    const result = await executor.execute({
      workspaceRoot: TMP,
      executionFqn,
      operationIndex: 0,
      operationTypeFqn: TOOL_OPERATION_FQN,
    });
    expect(result.success).toBe(true);
    expect(calls).toEqual([{ cwd: TMP, command: "blockml", args: ["validate"] }]);
  });
});
