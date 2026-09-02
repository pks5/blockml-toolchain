import { CLAUDE_REFLECT_PERMISSIONS, claudePermissionCliArgs, } from "./claude-permissions.js";
import { ensureAgentsMarkdown, runClaudeProcess, } from "./claude-code-agent.js";
const TRACE_CHAR_LIMIT = 24_000;
export function buildClaudeReflectPrompt(executionFqn, stageIndex, trace, resultProducer) {
    const changed = trace.changedFiles.length > 0
        ? trace.changedFiles.map((path) => `- ${path}`).join("\n")
        : "(none detected from git)";
    const stageNumber = stageIndex + 1;
    const lines = [
        "You are the Reflect step of a BlockML transformer pipeline.",
        "",
        `The Execute step has finished Stage ${stageNumber} of this running ModelTransformation:`,
        "",
        executionFqn,
        "",
        "You must NOT change the model, ModelTransformation, or any other files.",
        "Read only. Produce changedFiles and feedback for this Stage only.",
        "",
        "Git-detected changed files:",
        changed,
        "",
        "Git diff:",
        clip(trace.diff) || "(empty)",
        "",
        "Execute stdout:",
        clip(trace.stdout) || "(empty)",
        "",
    ];
    if (resultProducer) {
        lines.push("This Stage aggregates a ResultProducer. Interpret produce against the", "Execute output above. Do not write Stage.result yourself; return it in JSON.", "", `ResultProducer type: ${resultProducer.typeFqn}`, `Bound T: ${resultProducer.resultTypeFqn}`, "produce implementation:", resultProducer.produceImplementation || "(none authored)", "", "Return ONLY a JSON object:", '{ "changedFiles": ["relative/path.bml"], "feedback": "summary", "result": <value of T> }', "", `"result" must be a JSON value of bound T (${resultProducer.resultTypeFqn}).`, "Text-like types are JSON strings. Boolean is JSON boolean. Integer is JSON number.", "StructType is a JSON object.", "");
    }
    else {
        lines.push("Return ONLY a JSON object:", '{ "changedFiles": ["relative/path.bml"], "feedback": "summary" }', "", "Do not include a result field. This Stage has no ResultProducer.", "");
    }
    lines.push("changedFiles must be workspace-relative paths Execute actually modified.", "Do not include _meta/transform/ ModelTransformation files unless Execute wrongly", "touched them; mention that in feedback if so.");
    return lines.join("\n");
}
export function parseReflectionOutput(stdout) {
    const value = extractJsonObject(stdout);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Reflect output is not a JSON object");
    }
    const record = value;
    const files = record.changedFiles;
    const feedback = record.feedback;
    if (!Array.isArray(files) || files.some((entry) => typeof entry !== "string")) {
        throw new Error("Reflect output changedFiles must be a string array");
    }
    if (typeof feedback !== "string") {
        throw new Error("Reflect output feedback must be a string");
    }
    const parsed = {
        changedFiles: files.map((entry) => String(entry).replaceAll("\\", "/")),
        feedback,
    };
    if ("result" in record) {
        parsed.result = record.result;
    }
    return parsed;
}
export class ClaudeReflectAgent {
    command;
    runProcess;
    verbose;
    permissions;
    constructor(options = {}) {
        this.command = options.command ?? "claude";
        this.runProcess = options.runProcess ?? runClaudeProcess;
        this.verbose = options.verbose === true;
        this.permissions = options.permissions ?? CLAUDE_REFLECT_PERMISSIONS;
    }
    async reflect(request) {
        const agents = ensureAgentsMarkdown(request.workspaceRoot);
        const prompt = buildClaudeReflectPrompt(request.executionFqn, request.stageIndex, request.trace, request.resultProducer);
        const args = [
            "-p",
            prompt,
            "--append-system-prompt",
            agents,
            ...claudePermissionCliArgs(this.permissions),
        ];
        if (this.verbose) {
            args.push("--verbose");
        }
        const processRequest = {
            command: this.command,
            args,
            cwd: request.workspaceRoot,
            ...(this.verbose ? { live: true } : {}),
        };
        try {
            const result = await this.runProcess(processRequest);
            if (result.exitCode !== 0) {
                const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
                return {
                    success: false,
                    exitCode: result.exitCode,
                    error: detail || `Claude Code exited with code ${result.exitCode}`,
                };
            }
            try {
                const parsed = parseReflectionOutput(result.stdout);
                if (request.resultProducer && parsed.result === undefined) {
                    return {
                        success: false,
                        exitCode: 1,
                        error: "ResultProducer.produce did not return a result",
                    };
                }
                return {
                    success: true,
                    changedFiles: parsed.changedFiles,
                    feedback: parsed.feedback,
                    ...(parsed.result !== undefined ? { result: parsed.result } : {}),
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
        catch (error) {
            return {
                success: false,
                exitCode: 1,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
function extractJsonObject(text) {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
    const candidate = fenced?.[1] ?? text;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) {
        throw new Error("Reflect output has no JSON object");
    }
    return JSON.parse(candidate.slice(start, end + 1));
}
function clip(text) {
    if (text.length <= TRACE_CHAR_LIMIT) {
        return text;
    }
    return `${text.slice(0, TRACE_CHAR_LIMIT)}\n…[truncated]`;
}
//# sourceMappingURL=claude-reflect-agent.js.map