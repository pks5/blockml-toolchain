import { spawn } from "node:child_process";
import {
  CLAUDE_EXECUTE_PERMISSIONS,
  claudePermissionCliArgs,
  type ClaudeTransformPermissions,
} from "./claude-permissions.js";
import { ClaudeLiveFormatter } from "./claude-stream.js";
import type {
  AgentExecutionRequest,
  AgentExecutionResult,
  TransformationAgent,
} from "./transformation-agent.js";

export interface ClaudeProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ClaudeProcessRequest {
  command: string;
  args: string[];
  cwd: string;
  live?: boolean;
}

export type ClaudeProcessRunner = (
  request: ClaudeProcessRequest,
) => Promise<ClaudeProcessResult>;

export interface ClaudeCodeAgentOptions {
  command?: string;
  runProcess?: ClaudeProcessRunner;
  verbose?: boolean;
  permissions?: ClaudeTransformPermissions;
}

export function composeAgentPrompt(
  metaPrompt: string | undefined,
  taskSnippet: string,
): string {
  const snippet = taskSnippet.trim();
  const meta = metaPrompt?.trim() ?? "";
  if (!meta) {
    return snippet;
  }
  return `${meta}\n\n${snippet}`;
}

export class ClaudeCodeAgent implements TransformationAgent {
  private readonly command: string;
  private readonly runProcess: ClaudeProcessRunner;
  private readonly verbose: boolean;
  private readonly permissions: ClaudeTransformPermissions;

  constructor(options: ClaudeCodeAgentOptions = {}) {
    this.command = options.command ?? "claude";
    this.runProcess = options.runProcess ?? runClaudeProcess;
    this.verbose = options.verbose === true;
    this.permissions = options.permissions ?? CLAUDE_EXECUTE_PERMISSIONS;
  }

  async execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    const prompt = composeAgentPrompt(request.metaPrompt, request.taskSnippet);
    const args = [
      "-p",
      prompt,
      ...claudePermissionCliArgs(this.permissions),
    ];
    if (this.verbose) {
      args.push(
        "--verbose",
        "--output-format",
        "stream-json",
        "--include-partial-messages",
      );
    }

    const processRequest: ClaudeProcessRequest = {
      command: this.command,
      args,
      cwd: request.workspaceRoot,
    };
    if (this.verbose) {
      processRequest.live = true;
    }

    try {
      const result = await this.runProcess(processRequest);
      if (result.exitCode === 0) {
        return { success: true, stdout: result.stdout, stderr: result.stderr };
      }
      const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
      return {
        success: false,
        exitCode: result.exitCode,
        error: detail || `Claude Code exited with code ${result.exitCode}`,
      };
    } catch (error) {
      return {
        success: false,
        exitCode: 1,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export function runClaudeProcess(
  request: ClaudeProcessRequest,
): Promise<ClaudeProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: string[] = [];
    const stderr: string[] = [];
    const formatter = request.live ? new ClaudeLiveFormatter() : undefined;
    child.stdout?.on("data", (chunk: Buffer | string) => {
      const text = String(chunk);
      stdout.push(text);
      if (formatter) {
        process.stdout.write(formatter.push(text));
      }
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      const text = String(chunk);
      stderr.push(text);
      if (request.live) {
        process.stderr.write(text);
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (formatter) {
        process.stdout.write(formatter.flush());
      }
      resolve({
        exitCode: code ?? 1,
        stdout: stdout.join(""),
        stderr: stderr.join(""),
      });
    });
  });
}
