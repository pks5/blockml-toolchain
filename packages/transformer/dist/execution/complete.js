import { forkBom } from "@blockml/framework";
import { formatDateTimeProperty } from "./lifecycle.js";
import { loadRunningExecution } from "./load-running.js";
import { setCompletedAt, taskExecutionHasCompletedAt, } from "./properties.js";
import { applyExecutionIdentity, persistDocument, removeFile, rewriteInboundReferences, } from "./relocate.js";
export function completeExecution(workspaceRoot, started, now) {
    const { document, registry } = loadRunningExecution(workspaceRoot, started);
    const forked = forkBom(document);
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
//# sourceMappingURL=complete.js.map