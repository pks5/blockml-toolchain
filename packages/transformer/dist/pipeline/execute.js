import { TransformError } from "../execution/errors.js";
import { collectWorktreeTrace, modelChangedFiles } from "./worktree-trace.js";
import { commitWorktree } from "./git.js";
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
            commitWorktree(context.workspaceRoot, `transform(execute): ${prepared.started.generatedName}`);
            return {
                ...prepared,
                trace: {
                    stdout: agentResult.stdout ?? "",
                    stderr: agentResult.stderr ?? "",
                    diff: worktree.diff,
                    changedFiles: modelChangedFiles(worktree.changedFiles),
                },
            };
        },
    };
}
//# sourceMappingURL=execute.js.map