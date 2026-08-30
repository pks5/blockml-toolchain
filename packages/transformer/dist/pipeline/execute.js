import { TransformError } from "../execution/errors.js";
import { collectWorktreeTrace } from "./worktree-trace.js";
function isTransformLifecyclePath(path) {
    return path.includes("/_transform/") || path.startsWith("_transform/");
}
export function createExecuteStage(agent) {
    return {
        async run(prepared, context) {
            const agentResult = await agent.execute({
                workspaceRoot: context.workspaceRoot,
                executionFqn: prepared.started.runningFqn,
            });
            if (!agentResult.success) {
                throw new TransformError("execution", agentResult.error || "Transformation agent failed");
            }
            const worktree = collectWorktreeTrace(context.workspaceRoot);
            return {
                ...prepared,
                trace: {
                    stdout: agentResult.stdout ?? "",
                    stderr: agentResult.stderr ?? "",
                    diff: worktree.diff,
                    changedFiles: worktree.changedFiles.filter((path) => !isTransformLifecyclePath(path)),
                },
            };
        },
    };
}
//# sourceMappingURL=execute.js.map