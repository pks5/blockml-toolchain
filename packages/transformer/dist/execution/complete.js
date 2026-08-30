import { forkBom } from "@blockml/framework";
import { formatDateTimeProperty } from "./lifecycle.js";
import { loadRunningExecution } from "./load-running.js";
import { setCompletedAt, setStatus, modelTransformationHasCompletedAt, } from "./properties.js";
import { applyExecutionIdentity, persistDocument, removeFile, rewriteInboundReferences, } from "./relocate.js";
export function finalizeExecution(workspaceRoot, started, now, stage) {
    const { document, registry } = loadRunningExecution(workspaceRoot, started);
    const forked = forkBom(document);
    const completedAtIso = formatDateTimeProperty(now);
    if (modelTransformationHasCompletedAt(registry)) {
        setCompletedAt(forked.block, completedAtIso);
    }
    setStatus(forked.block, stage === "succeeded" ? "Succeeded" : "Failed");
    const runningFilePath = forked.source.filePath;
    const terminalFqn = applyExecutionIdentity(forked, {
        libraryFqn: started.libraryFqn,
        stage,
        name: started.generatedName,
    });
    rewriteInboundReferences(registry, started.runningFqn, terminalFqn, runningFilePath);
    persistDocument(forked);
    if (runningFilePath !== forked.source.filePath) {
        removeFile(runningFilePath);
    }
    return {
        terminalFqn,
        terminalFilePath: forked.source.filePath,
        completedAtIso,
        stage,
    };
}
//# sourceMappingURL=complete.js.map