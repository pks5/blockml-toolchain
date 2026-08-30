import { forkBom } from "@blockml/framework";
import { TYPE_PACKAGE_FQN } from "./constants.js";
import { persistDocument } from "./relocate.js";
import { loadRunningExecution } from "./load-running.js";
import { setChangedFiles, setException, setFeedback } from "./properties.js";
export function persistReflection(workspaceRoot, input) {
    const hasException = input.exceptionMessage !== undefined;
    if (input.changedFiles.length === 0 &&
        input.feedback === undefined &&
        !hasException) {
        return;
    }
    const { document } = loadRunningExecution(workspaceRoot, input.started);
    const forked = forkBom(document);
    if (input.feedback !== undefined) {
        setFeedback(forked.block, input.feedback);
    }
    if (input.changedFiles.length > 0) {
        ensureTypeNamespace(forked);
        setChangedFiles(forked.block, input.changedFiles);
    }
    if (input.exceptionMessage !== undefined) {
        setException(forked.block, input.exceptionMessage);
    }
    persistDocument(forked);
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