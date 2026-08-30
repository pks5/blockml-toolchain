import { forkBom } from "@blockml/framework";
import { TransformError } from "./errors.js";
import { formatDateTimeProperty } from "./lifecycle.js";
import { loadRunningExecution } from "./load-running.js";
import { getStageInstance, setStageBaseCommit, setStageStartedAt, setStageStatus, } from "./properties.js";
import { persistDocument } from "./relocate.js";
import { assertWorktreeClean, commitWorktree } from "../pipeline/git.js";
export function startWorkflowStage(workspaceRoot, started, stageIndex, now) {
    const baseCommit = assertWorktreeClean(workspaceRoot);
    const { document } = loadRunningExecution(workspaceRoot, started);
    const forked = forkBom(document);
    const stage = getStageInstance(forked.block, stageIndex);
    if (!stage) {
        throw new TransformError("execution", `Running ModelTransformation has no Stage at index ${stageIndex}`);
    }
    setStageStatus(stage, "Running");
    setStageStartedAt(stage, formatDateTimeProperty(now));
    setStageBaseCommit(stage, baseCommit);
    persistDocument(forked);
    commitWorktree(workspaceRoot, `transform(stage-start): ${started.generatedName} #${stageIndex + 1}`, { required: true });
    return baseCommit;
}
//# sourceMappingURL=start-stage.js.map