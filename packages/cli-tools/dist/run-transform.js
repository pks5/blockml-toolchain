import { ClaudeCodeAgent, ClaudeReflectAgent, runTransformation, } from "@blockml/transformer";
import { pushLines } from "./cli-style.js";
export async function runTransform(executionFqn, rootDir, lines, usage, agent, reflectAgent) {
    const fqn = executionFqn?.trim() ?? "";
    if (!fqn) {
        pushLines(lines, "Specify a TaskExecution FQN.", "error");
        pushLines(lines, usage, "info");
        return 2;
    }
    const result = await runTransformation({
        workspaceRoot: rootDir,
        executionFqn: fqn,
        agent,
        ...(reflectAgent ? { reflectAgent } : {}),
    });
    if (!result.success) {
        pushLines(lines, result.error, "error");
        if (result.terminalFqn) {
            pushLines(lines, result.terminalFqn, "error");
        }
        return result.exitCode;
    }
    pushLines(lines, `Transformed ${result.terminalFqn}`, "success");
    return 0;
}
export function defaultTransformAgent(verbose = false) {
    if (verbose) {
        return new ClaudeCodeAgent({ verbose: true });
    }
    return new ClaudeCodeAgent();
}
export function defaultReflectAgent(verbose = false) {
    if (verbose) {
        return new ClaudeReflectAgent({ verbose: true });
    }
    return new ClaudeReflectAgent();
}
//# sourceMappingURL=run-transform.js.map