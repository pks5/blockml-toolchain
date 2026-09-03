import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLAUDE_EXECUTE_PERMISSIONS, claudePermissionCliArgs, } from "./claude-permissions.js";
import { ClaudeLiveFormatter } from "./claude-stream.js";
import { DEFAULT_AGENTS_MD } from "./default-agents.js";
export function buildClaudeExecutionPrompt(executionFqn, operationIndex) {
    const operationNumber = operationIndex + 1;
    return [
        "You are the Execute step of a BlockML transformer pipeline.",
        "",
        `Perform the Task of the currently Running ModelOperation (Operation ${operationNumber}) in this ModelTransformation:`,
        "",
        executionFqn,
        "",
        "Read the ModelTransformation only to identify the Running ModelOperation and its Task.",
        "Change BML model source so the Task is done. Change nothing else.",
        "",
        "Do not modify the ModelTransformation block, including its ModelOperations.",
        "Do not write files under any _meta/transform/ directory.",
        "Do not set changedFiles, output, completedAt, baseCommit, status, or exception,",
        "or move the execution between pending, running, succeeded, and failed.",
        "",
        "Use the BlockML model, installed libraries, Search, validation tooling,",
        "and repository contents to understand and perform the Task.",
    ].join("\n");
}
export function ensureAgentsMarkdown(workspaceRoot) {
    const path = join(workspaceRoot, "AGENTS.md");
    if (!existsSync(path)) {
        writeFileSync(path, DEFAULT_AGENTS_MD, "utf8");
    }
    return readFileSync(path, "utf8");
}
export class ClaudeCodeAgent {
    command;
    runProcess;
    verbose;
    permissions;
    constructor(options = {}) {
        this.command = options.command ?? "claude";
        this.runProcess = options.runProcess ?? runClaudeProcess;
        this.verbose = options.verbose === true;
        this.permissions = options.permissions ?? CLAUDE_EXECUTE_PERMISSIONS;
    }
    async execute(request) {
        const agents = ensureAgentsMarkdown(request.workspaceRoot);
        const prompt = buildClaudeExecutionPrompt(request.executionFqn, request.operationIndex);
        const args = [
            "-p",
            prompt,
            "--append-system-prompt",
            agents,
            ...claudePermissionCliArgs(this.permissions),
        ];
        if (this.verbose) {
            args.push("--verbose", "--output-format", "stream-json", "--include-partial-messages");
        }
        const processRequest = {
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
        }
        catch (error) {
            return {
                success: false,
                exitCode: 1,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
export function runClaudeProcess(request) {
    return new Promise((resolve, reject) => {
        const child = spawn(request.command, request.args, {
            cwd: request.cwd,
            stdio: ["ignore", "pipe", "pipe"],
        });
        const stdout = [];
        const stderr = [];
        const formatter = request.live ? new ClaudeLiveFormatter() : undefined;
        child.stdout?.on("data", (chunk) => {
            const text = String(chunk);
            stdout.push(text);
            if (formatter) {
                process.stdout.write(formatter.push(text));
            }
        });
        child.stderr?.on("data", (chunk) => {
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
//# sourceMappingURL=claude-code-agent.js.map