import { forkBom } from "@blockml/framework";
import { EXECUTION_EXCEPTION_FQN, RESULT_EXCEPTION_FQN, TYPE_PACKAGE_FQN, } from "./constants.js";
import { TransformError } from "./errors.js";
import { persistDocument } from "./relocate.js";
import { loadRunningExecution } from "./load-running.js";
import { getOperationInstance, setOperationChangedFiles, setOperationCompletedAt, setOperationException, setOperationOutput, setOperationStatus, } from "./properties.js";
import { applyOperationResultMappings, ResultResolutionError } from "./result.js";
import { commitWorktree } from "../pipeline/git.js";
export function persistReflection(workspaceRoot, input) {
    const { document, registry } = loadRunningExecution(workspaceRoot, input.started);
    const forked = forkBom(document);
    const operation = getOperationInstance(forked.block, input.operationIndex, registry);
    if (!operation) {
        throw new TransformError("execution", `Running ModelTransformation has no ModelOperation at index ${input.operationIndex}`);
    }
    if (input.output !== undefined) {
        setOperationOutput(operation, input.output);
    }
    if (input.changedFiles.length > 0) {
        ensureTypeNamespace(forked);
        setOperationChangedFiles(operation, input.changedFiles);
    }
    let outcome = input.outcome;
    let exceptionMessage = input.exceptionMessage;
    let exceptionType = EXECUTION_EXCEPTION_FQN;
    if (outcome === "succeeded") {
        try {
            applyOperationResultMappings(forked.block, operation, registry);
        }
        catch (error) {
            if (!(error instanceof ResultResolutionError)) {
                throw error;
            }
            outcome = "failed";
            exceptionMessage = error.message;
            exceptionType = RESULT_EXCEPTION_FQN;
        }
    }
    if (exceptionMessage !== undefined) {
        setOperationException(operation, exceptionMessage, exceptionType);
    }
    setOperationStatus(operation, outcome === "failed" ? "Failed" : "Succeeded");
    setOperationCompletedAt(operation, input.completedAtIso);
    persistDocument(forked);
    commitWorktree(workspaceRoot, `transform(operation): ${input.started.generatedName} #${input.operationIndex + 1}`, { required: true });
    return {
        outcome,
        ...(exceptionMessage !== undefined ? { exceptionMessage } : {}),
    };
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