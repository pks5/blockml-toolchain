import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ClaudeLiveFormatter } from "./claude-stream.js";
import { DEFAULT_AGENTS_MD } from "./default-agents.js";
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
}

export const CLAUDE_BLOCKML_BASH_PERMISSION = "Bash(npx blockml *)";

export function buildClaudeExecutionPrompt(executionFqn: string): string {
  return [
    "Execute the Task defined by this TaskExecution:",
    "",
    executionFqn,
    "",
    "Use the BlockML model, installed libraries, Search, validation tooling,",
    "repository contents, and other available context to understand and perform",
    "the Task.",
    "",
    "Only perform the Task described by the execution.",
  ].join("\n");
}

export function ensureAgentsMarkdown(workspaceRoot: string): string {
  const path = join(workspaceRoot, "AGENTS.md");
  if (!existsSync(path)) {
    writeFileSync(path, DEFAULT_AGENTS_MD, "utf8");
  }
  return readFileSync(path, "utf8");
}

export class ClaudeCodeAgent implements TransformationAgent {
  private readonly command: string;
  private readonly runProcess: ClaudeProcessRunner;
  private readonly verbose: boolean;

  constructor(options: ClaudeCodeAgentOptions = {}) {
    this.command = options.command ?? "claude";
    this.runProcess = options.runProcess ?? defaultClaudeProcessRunner;
    this.verbose = options.verbose === true;
  }

  async execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    const agents = ensureAgentsMarkdown(request.workspaceRoot);
    const prompt = buildClaudeExecutionPrompt(request.executionFqn);
    const args = [
      "-p",
      prompt,
      "--append-system-prompt",
      agents,
      "--allowedTools",
      CLAUDE_BLOCKML_BASH_PERMISSION,
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
        return { success: true };
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

function defaultClaudeProcessRunner(
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
