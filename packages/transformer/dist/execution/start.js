import { forkBom } from "@blockml/framework";
import { allocateUniqueExecutionId } from "./execution-id.js";
import { formatDateTimeProperty, generateExecutionName } from "./lifecycle.js";
import { setBaseCommit, setExecutionId, setSequence, setStartedAt, setStatus, } from "./properties.js";
import { applyExecutionIdentity, persistDocument, removeFile, rewriteInboundReferences, } from "./relocate.js";
import { SequenceAllocator } from "./sequence.js";
import { assertWorktreeClean, commitWorktree } from "../pipeline/git.js";
export function startExecution(resolved, now, workspaceRoot, allocator = new SequenceAllocator()) {
    const baseCommit = assertWorktreeClean(workspaceRoot);
    const sequence = allocator.nextSequence(resolved.libraryFqn, resolved.registry);
    const generatedName = generateExecutionName(sequence, resolved.originalName, now);
    const startedAtIso = formatDateTimeProperty(now);
    const pendingFilePath = resolved.document.source.filePath;
    const forked = forkBom(resolved.document);
    const executionId = allocateUniqueExecutionId(resolved.registry);
    setExecutionId(forked.block, executionId);
    setSequence(forked.block, sequence);
    setStatus(forked.block, "Running");
    setStartedAt(forked.block, startedAtIso);
    setBaseCommit(forked.block, baseCommit);
    const runningFqn = applyExecutionIdentity(forked, {
        libraryFqn: resolved.libraryFqn,
        stage: "running",
        name: generatedName,
    });
    rewriteInboundReferences(resolved.registry, resolved.fqn, runningFqn, pendingFilePath);
    persistDocument(forked);
    if (pendingFilePath !== forked.source.filePath) {
        removeFile(pendingFilePath);
    }
    commitWorktree(workspaceRoot, `transform(start): ${generatedName}`, {
        required: true,
    });
    return {
        executionId,
        libraryFqn: resolved.libraryFqn,
        originalName: resolved.originalName,
        sequence,
        startedAt: now,
        startedAtIso,
        baseCommit,
        generatedName,
        runningFqn,
        runningFilePath: forked.source.filePath,
        pendingFilePath,
    };
}
//# sourceMappingURL=start.js.map