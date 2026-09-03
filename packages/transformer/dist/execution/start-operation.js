import { forkBom } from "@blockml/framework";
import { TransformError } from "./errors.js";
import { formatDateTimeProperty } from "./lifecycle.js";
import { loadRunningExecution } from "./load-running.js";
import { getOperationInstance, setOperationBaseCommit, setOperationStartedAt, setOperationStatus, } from "./properties.js";
import { persistDocument } from "./relocate.js";
import { assertWorktreeClean, commitWorktree } from "../pipeline/git.js";
export function startWorkflowOperation(workspaceRoot, started, operationIndex, now) {
    const baseCommit = assertWorktreeClean(workspaceRoot);
    const { document, registry } = loadRunningExecution(workspaceRoot, started);
    const forked = forkBom(document);
    const operation = getOperationInstance(forked.block, operationIndex, registry);
    if (!operation) {
        throw new TransformError("execution", `Running ModelTransformation has no ModelOperation at index ${operationIndex}`);
    }
    setOperationStatus(operation, "Running");
    setOperationStartedAt(operation, formatDateTimeProperty(now));
    setOperationBaseCommit(operation, baseCommit);
    persistDocument(forked);
    commitWorktree(workspaceRoot, `transform(operation-start): ${started.generatedName} #${operationIndex + 1}`, { required: true });
    return baseCommit;
}
//# sourceMappingURL=start-operation.js.map