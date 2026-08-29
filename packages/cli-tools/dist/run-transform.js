import { ClaudeCodeAgent, runTransformation, } from "@blockml/transformer";
import { pushLines } from "./cli-style.js";
export async function runTransform(executionFqn, rootDir, lines, usage, agent) {
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
    });
    if (!result.success) {
        pushLines(lines, result.error, "error");
        return result.exitCode;
    }
    pushLines(lines, `Transformed ${result.completedFqn}`, "success");
    return 0;
}
export function defaultTransformAgent(verbose = false) {
    if (verbose) {
        return new ClaudeCodeAgent({ verbose: true });
    }
    return new ClaudeCodeAgent();
}
//# sourceMappingURL=run-transform.js.map