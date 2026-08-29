import { bootstrapFullProjectRegistry, forkBom } from "@blockml/framework";
import { formatDateTimeProperty, parseExecutionFqn } from "./lifecycle.js";
import { getExecutionId, setCompletedAt, taskExecutionHasCompletedAt, } from "./properties.js";
import { applyExecutionIdentity, persistDocument, removeFile, rewriteInboundReferences, } from "./relocate.js";
import { TransformError } from "./errors.js";
export function completeExecution(workspaceRoot, started, now) {
    const { registry } = bootstrapFullProjectRegistry({ rootDir: workspaceRoot });
    const running = registry.get(started.runningFqn) ??
        findRunningByExecutionId(registry, started.libraryFqn, started.executionId);
    if (!running) {
        throw new TransformError("execution", `Running TaskExecution ${started.runningFqn} was not found after agent execution`);
    }
    const forked = forkBom(running);
    const completedAtIso = formatDateTimeProperty(now);
    if (taskExecutionHasCompletedAt(registry)) {
        setCompletedAt(forked.block, completedAtIso);
    }
    const runningFilePath = forked.source.filePath;
    const completedFqn = applyExecutionIdentity(forked, {
        libraryFqn: started.libraryFqn,
        stage: "completed",
        name: started.generatedName,
    });
    rewriteInboundReferences(registry, started.runningFqn, completedFqn, runningFilePath);
    persistDocument(forked);
    if (runningFilePath !== forked.source.filePath) {
        removeFile(runningFilePath);
    }
    return {
        completedFqn,
        completedFilePath: forked.source.filePath,
        completedAtIso,
    };
}
function findRunningByExecutionId(registry, libraryFqn, executionId) {
    if (!executionId) {
        return undefined;
    }
    for (const fqn of registry.keys()) {
        const parsed = parseExecutionFqn(fqn);
        if (!parsed || parsed.libraryFqn !== libraryFqn || parsed.stage !== "running") {
            continue;
        }
        const document = registry.get(fqn);
        if (document && getExecutionId(document.block) === executionId) {
            return document;
        }
    }
    return undefined;
}
//# sourceMappingURL=complete.js.map