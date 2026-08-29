import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_AGENTS_MD } from "./default-agents.js";
export function buildClaudeExecutionPrompt(executionFqn) {
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
    constructor(options = {}) {
        this.command = options.command ?? "claude";
        this.runProcess = options.runProcess ?? defaultClaudeProcessRunner;
    }
    async execute(request) {
        const agents = ensureAgentsMarkdown(request.workspaceRoot);
        const prompt = buildClaudeExecutionPrompt(request.executionFqn);
        const args = ["-p", prompt, "--append-system-prompt", agents];
        try {
            const result = await this.runProcess({
                command: this.command,
                args,
                cwd: request.workspaceRoot,
            });
            if (result.exitCode === 0) {
                return { success: true };
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
function defaultClaudeProcessRunner(request) {
    return new Promise((resolve, reject) => {
        const child = spawn(request.command, request.args, {
            cwd: request.cwd,
            stdio: ["ignore", "pipe", "pipe"],
        });
        const stdout = [];
        const stderr = [];
        child.stdout?.on("data", (chunk) => {
            stdout.push(String(chunk));
        });
        child.stderr?.on("data", (chunk) => {
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
//# sourceMappingURL=claude-code-agent.js.map