import { forkBom } from "@blockml/framework";
import { allocateUniqueExecutionId } from "./execution-id.js";
import { formatDateTimeProperty, generateExecutionName } from "./lifecycle.js";
import { applyExecutionParameters, ParametersResolutionError, rewriteParameterTypeFqns, } from "./parameters.js";
import { PARAMETERS_EXCEPTION_FQN } from "./constants.js";
import { isTemplate, setBaseCommit, setException, setExecutionId, setSequence, setStartedAt, setStatus, setTemplate, } from "./properties.js";
import { applyExecutionIdentity, persistDocument, removeFile, rewriteInboundReferences, } from "./relocate.js";
import { SequenceAllocator } from "./sequence.js";
import { assertWorktreeClean, commitWorktree } from "../pipeline/git.js";
export function startExecution(resolved, now, workspaceRoot, allocator = new SequenceAllocator(), parameterOptions = {}) {
    const baseCommit = assertWorktreeClean(workspaceRoot);
    const sequence = allocator.nextSequence(resolved.libraryFqn, resolved.registry);
    const generatedName = generateExecutionName(sequence, resolved.originalName, now);
    const startedAtIso = formatDateTimeProperty(now);
    const pendingFilePath = resolved.document.source.filePath;
    const keepPending = isTemplate(resolved.document.block);
    const forked = forkBom(resolved.document);
    const executionId = allocateUniqueExecutionId(resolved.registry);
    if (keepPending) {
        setTemplate(forked.block, false);
    }
    let parameterError;
    try {
        applyExecutionParameters(forked.block, resolved.registry, parameterOptions);
    }
    catch (error) {
        if (!(error instanceof ParametersResolutionError)) {
            throw error;
        }
        setException(forked.block, PARAMETERS_EXCEPTION_FQN, error.message);
        parameterError = error.message;
    }
    setExecutionId(forked.block, executionId);
    setSequence(forked.block, sequence);
    setStatus(forked.block, "Running");
    setStartedAt(forked.block, startedAtIso);
    setBaseCommit(forked.block, baseCommit);
    const runningFqn = applyExecutionIdentity(forked, {
        libraryFqn: resolved.libraryFqn,
        libraryRoot: resolved.libraryRoot,
        stage: "running",
        name: generatedName,
    });
    rewriteParameterTypeFqns(forked.block, resolved.fqn, runningFqn);
    if (!keepPending) {
        rewriteInboundReferences(resolved.registry, resolved.fqn, runningFqn, pendingFilePath);
    }
    persistDocument(forked);
    if (!keepPending && pendingFilePath !== forked.source.filePath) {
        removeFile(pendingFilePath);
    }
    commitWorktree(workspaceRoot, `transform(start): ${generatedName}`, {
        required: true,
    });
    return {
        executionId,
        libraryFqn: resolved.libraryFqn,
        libraryRoot: resolved.libraryRoot,
        originalName: resolved.originalName,
        sequence,
        startedAt: now,
        startedAtIso,
        baseCommit,
        generatedName,
        runningFqn,
        runningFilePath: forked.source.filePath,
        pendingFilePath,
        ...(parameterError !== undefined ? { parameterError } : {}),
    };
}
//# sourceMappingURL=start.js.map