import { ClaudeCodeAgent, formatTransformLifecycle, parseParametersJson, runTransformation, TransformError, } from "@blockml/transformer";
import { pushLines, } from "./cli-style.js";
export async function runTransform(executionFqn, rootDir, lines, usage, agent, reflectAgent, onOutputLine, parametersJson, parametersSource) {
    const fqn = executionFqn?.trim() ?? "";
    if (!fqn) {
        emit(lines, onOutputLine, "Specify a ModelTransformation FQN.", "error");
        emit(lines, onOutputLine, usage, "info");
        return 2;
    }
    const source = parametersSource?.trim() || undefined;
    let parameters;
    if (source === undefined && parametersJson !== undefined) {
        try {
            parameters = parseParametersJson(parametersJson);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            emit(lines, onOutputLine, message, "error");
            return error instanceof TransformError ? error.exitCode : 2;
        }
    }
    const result = await runTransformation({
        workspaceRoot: rootDir,
        executionFqn: fqn,
        agent,
        ...(reflectAgent ? { reflectAgent } : {}),
        ...(parameters !== undefined ? { parameters } : {}),
        ...(source !== undefined ? { parametersSource: source } : {}),
        onLifecycle: (event) => {
            const line = lifecycleOutput(event);
            if (line) {
                emit(lines, onOutputLine, line.text, line.kind);
            }
        },
    });
    if (!result.success) {
        emit(lines, onOutputLine, result.error, "error");
        if (result.terminalFqn) {
            emit(lines, onOutputLine, result.terminalFqn, "error");
        }
        return result.exitCode;
    }
    return 0;
}
function lifecycleOutput(event) {
    if (event.kind === "transformationComplete" && event.status !== "Succeeded") {
        return undefined;
    }
    const text = formatTransformLifecycle(event);
    return { kind: lifecycleKind(event), text };
}
function lifecycleKind(event) {
    if (event.kind === "transformationComplete") {
        return "success";
    }
    if (event.kind === "transformationStatus" || event.kind === "stageStatus") {
        if (event.status === "Succeeded") {
            return "success";
        }
        if (event.status === "Failed") {
            return "error";
        }
    }
    return "info";
}
function emit(lines, onOutputLine, text, kind) {
    const before = lines.length;
    pushLines(lines, text, kind);
    if (!onOutputLine) {
        return;
    }
    for (const line of lines.slice(before)) {
        onOutputLine(line);
    }
}
export function defaultTransformAgent(verbose = false) {
    if (verbose) {
        return new ClaudeCodeAgent({ verbose: true });
    }
    return new ClaudeCodeAgent();
}
//# sourceMappingURL=run-transform.js.map