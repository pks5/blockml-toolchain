import { forkBom } from "@blockml/framework";
import { formatDateTimeProperty, generateExecutionName } from "./lifecycle.js";
import { getExecutionId, setSequence, setStartedAt } from "./properties.js";
import { applyExecutionIdentity, persistDocument, removeFile, rewriteInboundReferences, } from "./relocate.js";
import { SequenceAllocator } from "./sequence.js";
export function startExecution(resolved, now, allocator = new SequenceAllocator()) {
    const sequence = allocator.nextSequence(resolved.libraryFqn, resolved.registry);
    const generatedName = generateExecutionName(sequence, resolved.originalName, now);
    const startedAtIso = formatDateTimeProperty(now);
    const pendingFilePath = resolved.document.source.filePath;
    const forked = forkBom(resolved.document);
    const executionId = getExecutionId(forked.block);
    setSequence(forked.block, sequence);
    setStartedAt(forked.block, startedAtIso);
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
    return {
        executionId,
        libraryFqn: resolved.libraryFqn,
        originalName: resolved.originalName,
        sequence,
        startedAt: now,
        startedAtIso,
        generatedName,
        runningFqn,
        runningFilePath: forked.source.filePath,
        pendingFilePath,
    };
}
//# sourceMappingURL=start.js.map