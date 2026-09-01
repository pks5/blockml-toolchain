import { forkBom } from "@blockml/framework";
import { allocateUniqueExecutionId } from "./execution-id.js";
import { formatDateTimeProperty, generateExecutionName } from "./lifecycle.js";
import {
  isTemplate,
  setBaseCommit,
  setExecutionId,
  setSequence,
  setStartedAt,
  setStatus,
  setTemplate,
} from "./properties.js";
import {
  applyExecutionIdentity,
  persistDocument,
  removeFile,
  rewriteInboundReferences,
} from "./relocate.js";
import type { ResolvedExecution } from "./resolve.js";
import { SequenceAllocator } from "./sequence.js";
import { assertWorktreeClean, commitWorktree } from "../pipeline/git.js";

export interface StartedExecution {
  executionId: string;
  libraryFqn: string;
  originalName: string;
  sequence: number;
  startedAt: Date;
  startedAtIso: string;
  baseCommit: string;
  generatedName: string;
  runningFqn: string;
  runningFilePath: string;
  pendingFilePath: string;
}

export function startExecution(
  resolved: ResolvedExecution,
  now: Date,
  workspaceRoot: string,
  allocator = new SequenceAllocator(),
): StartedExecution {
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

  if (!keepPending) {
    rewriteInboundReferences(
      resolved.registry,
      resolved.fqn,
      runningFqn,
      pendingFilePath,
    );
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
