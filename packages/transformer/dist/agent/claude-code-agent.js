import { spawn } from "node:child_process";
import { CLAUDE_EXECUTE_PERMISSIONS, claudePermissionCliArgs, } from "./claude-permissions.js";
import { ClaudeLiveFormatter } from "./claude-stream.js";
export function composeAgentPrompt(metaPrompt, taskSnippet) {
    const snippet = taskSnippet.trim();
    const meta = metaPrompt?.trim() ?? "";
    if (!meta) {
        return snippet;
    }
    return `${meta}\n\n${snippet}`;
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
        const prompt = composeAgentPrompt(request.metaPrompt, request.taskSnippet);
        const args = [
            "-p",
            prompt,
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