import { forkBom } from "@blockml/framework";
import { formatDateTimeProperty, generateExecutionName } from "./lifecycle.js";
import { getExecutionId, setSequence, setStartedAt, setStatus } from "./properties.js";
import {
  applyExecutionIdentity,
  persistDocument,
  removeFile,
  rewriteInboundReferences,
} from "./relocate.js";
import type { ResolvedExecution } from "./resolve.js";
import { SequenceAllocator } from "./sequence.js";

export interface StartedExecution {
  executionId: string | undefined;
  libraryFqn: string;
  originalName: string;
  sequence: number;
  startedAt: Date;
  startedAtIso: string;
  generatedName: string;
  runningFqn: string;
  runningFilePath: string;
  pendingFilePath: string;
}

export function startExecution(
  resolved: ResolvedExecution,
  now: Date,
  allocator = new SequenceAllocator(),
): StartedExecution {
  const sequence = allocator.nextSequence(resolved.libraryFqn, resolved.registry);
  const generatedName = generateExecutionName(sequence, resolved.originalName, now);
  const startedAtIso = formatDateTimeProperty(now);
  const pendingFilePath = resolved.document.source.filePath;
  const forked = forkBom(resolved.document);
  const executionId = getExecutionId(forked.block);

  setSequence(forked.block, sequence);
  setStatus(forked.block, "Running");
  setStartedAt(forked.block, startedAtIso);

  const runningFqn = applyExecutionIdentity(forked, {
    libraryFqn: resolved.libraryFqn,
    stage: "running",
    name: generatedName,
  });

  rewriteInboundReferences(
    resolved.registry,
    resolved.fqn,
    runningFqn,
    pendingFilePath,
  );
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
