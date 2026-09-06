import { ClaudeCodeAgent, formatTransformLifecycle, parseParameterMappingsJson, parseParametersJson, runTransformation, TransformError, } from "@blockml/transformer";
import { pushLines, } from "./cli-style.js";
export async function runTransform(executionFqn, rootDir, lines, usage, agent, reflectAgent, onOutputLine, parametersJson, parameterMappingsJson, library) {
    const fqn = executionFqn?.trim() ?? "";
    if (!fqn) {
        emit(lines, onOutputLine, "Specify a ModelTransformation FQN.", "error");
        emit(lines, onOutputLine, usage, "info");
        return 2;
    }
    let parameterMappings = undefined;
    if (parameterMappingsJson !== undefined) {
        try {
            parameterMappings = parseParameterMappingsJson(parameterMappingsJson);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            emit(lines, onOutputLine, message, "error");
            return error instanceof TransformError ? error.exitCode : 2;
        }
    }
    const mappings = parameterMappings !== undefined && parameterMappings.length > 0
        ? parameterMappings
        : undefined;
    let parameters;
    if (mappings === undefined && parametersJson !== undefined) {
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
        ...(library !== undefined ? { library } : {}),
        agent,
        ...(reflectAgent ? { reflectAgent } : {}),
        ...(parameters !== undefined ? { parameters } : {}),
        ...(mappings !== undefined ? { parameterMappings: mappings } : {}),
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
    const text = formatTransformLifecycle(event);
    return { kind: lifecycleKind(event), text };
}
function lifecycleKind(event) {
    if (event.kind === "transformationComplete") {
        return event.status === "Succeeded" ? "success" : "error";
    }
    if (event.kind === "transformationStatus" || event.kind === "operationStatus") {
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