import { spawn } from "node:child_process";
import type { BlockDefinition, BlockInstance } from "@blockml/bom";
import { bootstrapFullProjectRegistry } from "@blockml/framework";
import {
  buildBlockEvaluationScope,
  resolveMemberStringList,
  resolveMemberText,
} from "../execution/interpolate.js";
import {
  getOperationInstance,
  getOperationPropertyLiteral,
} from "../execution/properties.js";
import type {
  OperationExecuteRequest,
  OperationExecuteResult,
  OperationExecutor,
} from "./operation-executor.js";

const COMMAND_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface ToolProcessRequest {
  cwd: string;
  command: string;
  args: string[];
}

export interface ToolProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type ToolProcessRunner = (
  request: ToolProcessRequest,
) => Promise<ToolProcessResult>;

export class ToolExecutor implements OperationExecutor {
  constructor(private readonly runProcess: ToolProcessRunner = runNpxProcess) {}

  async execute(request: OperationExecuteRequest): Promise<OperationExecuteResult> {
    const loaded = loadToolOperation(request);
    if (loaded.error) {
      return loaded.error;
    }
    const invocation = readToolInvocation(loaded.operation, loaded.block);
    if (invocation.error) {
      return invocation.error;
    }
    try {
      const result = await this.runProcess({
        cwd: request.workspaceRoot,
        command: invocation.command,
        args: invocation.args,
      });
      const output = combineOutput(result.stdout, result.stderr);
      if (result.exitCode !== 0) {
        return {
          success: false,
          exitCode: result.exitCode,
          error: output
            ? `Tool ${invocation.command} exited ${result.exitCode}\n${output}`
            : `Tool ${invocation.command} exited ${result.exitCode}`,
        };
      }
      return output.length > 0
        ? { success: true, output }
        : { success: true };
    } catch (error) {
      return {
        success: false,
        exitCode: 1,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

function loadToolOperation(
  request: OperationExecuteRequest,
):
  | { operation: BlockInstance; block: BlockDefinition; error?: undefined }
  | { error: OperationExecuteResult } {
  const { registry } = bootstrapFullProjectRegistry({
    rootDir: request.workspaceRoot,
  });
  const document = registry.get(request.executionFqn);
  if (!document) {
    return {
      error: {
        success: false,
        exitCode: 1,
        error: `Running ModelTransformation ${request.executionFqn} was not found`,
      },
    };
  }
  const operation = getOperationInstance(
    document.block,
    request.operationIndex,
    registry,
  );
  if (!operation) {
    return {
      error: {
        success: false,
        exitCode: 1,
        error: `ModelTransformation has no ModelOperation at index ${request.operationIndex}`,
      },
    };
  }
  return { operation, block: document.block };
}

function readToolInvocation(
  operation: BlockInstance,
  block: BlockDefinition,
):
  | { command: string; args: string[]; error?: undefined }
  | { error: OperationExecuteResult } {
  const scope = buildBlockEvaluationScope(block);
  const rawCommand =
    resolveMemberText(operation.memberValues.command, scope) ??
    (typeof getOperationPropertyLiteral(operation, "command") === "string"
      ? (getOperationPropertyLiteral(operation, "command") as string)
      : undefined);
  if (typeof rawCommand !== "string" || rawCommand.trim() === "") {
    return {
      error: {
        success: false,
        exitCode: 1,
        error: "ToolOperation must have command set",
      },
    };
  }
  const command = rawCommand.trim();
  if (!COMMAND_TOKEN.test(command)) {
    return {
      error: {
        success: false,
        exitCode: 1,
        error: `ToolOperation command must be a single npm bin token, got ${JSON.stringify(command)}`,
      },
    };
  }
  if (operation.memberValues.args !== undefined) {
    const args = resolveMemberStringList(operation.memberValues.args, scope);
    if (args === undefined) {
      return {
        error: {
          success: false,
          exitCode: 1,
          error: "ToolOperation args must be type:Text[]",
        },
      };
    }
    return { command, args };
  }
  return { command, args: [] };
}

function runNpxProcess(request: ToolProcessRequest): Promise<ToolProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(npxBin(), [request.command, ...request.args], {
      cwd: request.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: string[] = [];
    const stderr: string[] = [];
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout.push(String(chunk));
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr.push(String(chunk));
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: stdout.join(""),
        stderr: stderr.join(""),
      });
    });
  });
}

function npxBin(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function combineOutput(stdout: string, stderr: string): string {
  if (stdout.length === 0) {
    return stderr;
  }
  if (stderr.length === 0) {
    return stdout;
  }
  return stdout.endsWith("\n") ? `${stdout}${stderr}` : `${stdout}\n${stderr}`;
}
