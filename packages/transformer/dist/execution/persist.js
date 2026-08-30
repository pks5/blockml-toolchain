import { forkBom } from "@blockml/framework";
import { TYPE_PACKAGE_FQN } from "./constants.js";
import { TransformError } from "./errors.js";
import { persistDocument } from "./relocate.js";
import { loadRunningExecution } from "./load-running.js";
import { getStageInstance, setStageChangedFiles, setStageCompletedAt, setStageException, setStageFeedback, setStageStatus, } from "./properties.js";
import { commitWorktree } from "../pipeline/git.js";
export function persistReflection(workspaceRoot, input) {
    const { document } = loadRunningExecution(workspaceRoot, input.started);
    const forked = forkBom(document);
    const stage = getStageInstance(forked.block, input.stageIndex);
    if (!stage) {
        throw new TransformError("execution", `Running ModelTransformation has no Stage at index ${input.stageIndex}`);
    }
    if (input.feedback !== undefined) {
        setStageFeedback(stage, input.feedback);
    }
    if (input.changedFiles.length > 0) {
        ensureTypeNamespace(forked);
        setStageChangedFiles(stage, input.changedFiles);
    }
    if (input.exceptionMessage !== undefined) {
        setStageException(stage, input.exceptionMessage);
    }
    setStageStatus(stage, input.outcome === "failed" ? "Failed" : "Succeeded");
    setStageCompletedAt(stage, input.completedAtIso);
    persistDocument(forked);
    commitWorktree(workspaceRoot, `transform(stage): ${input.started.generatedName} #${input.stageIndex + 1}`, { required: true });
}
function ensureTypeNamespace(document) {
    const bindings = { ...(document.source.namespaceBindings ?? {}) };
    if (Object.values(bindings).includes(TYPE_PACKAGE_FQN)) {
        return;
    }
    bindings.type ??= TYPE_PACKAGE_FQN;
    document.source.namespaceBindings = bindings;
}
//# sourceMappingURL=persist.js.map