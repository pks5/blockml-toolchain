import { forkBom } from "@blockml/framework";
import { RESULT_EXCEPTION_FQN, type TerminalLifecycleStage } from "./constants.js";
import { formatDateTimeProperty } from "./lifecycle.js";
import { loadRunningExecution } from "./load-running.js";
import {
  setCompletedAt,
  setException,
  setStatus,
  modelTransformationHasCompletedAt,
  allOperationsSucceeded,
} from "./properties.js";
import { rewriteParameterTypeFqns } from "./parameters.js";
import {
  applyTransformationResult,
  ResultResolutionError,
} from "./result.js";
import {
  applyExecutionIdentity,
  persistDocument,
  removeFile,
  rewriteInboundReferences,
} from "./relocate.js";
import type { StartedExecution } from "./start.js";
import { commitWorktree } from "../pipeline/git.js";

export interface FinalizedExecution {
  terminalFqn: string;
  terminalFilePath: string;
  completedAtIso: string;
  stage: TerminalLifecycleStage;
  error?: string;
}

export function finalizeExecution(
  workspaceRoot: string,
  started: StartedExecution,
  now: Date,
): FinalizedExecution {
  const { document, registry } = loadRunningExecution(workspaceRoot, started);
  const forked = forkBom(document);
  const completedAtIso = formatDateTimeProperty(now);
  if (modelTransformationHasCompletedAt(registry)) {
    setCompletedAt(forked.block, completedAtIso);
  }
  const operationsSucceeded = allOperationsSucceeded(forked.block, registry);
  let resultError: string | undefined;
  if (operationsSucceeded) {
    try {
      applyTransformationResult(forked.block, registry);
    } catch (error) {
      if (!(error instanceof ResultResolutionError)) {
        throw error;
      }
      setException(forked.block, RESULT_EXCEPTION_FQN, error.message);
      resultError = error.message;
    }
  }
  const succeeded = operationsSucceeded && resultError === undefined;
  const stage: TerminalLifecycleStage = succeeded ? "succeeded" : "failed";
  setStatus(forked.block, succeeded ? "Succeeded" : "Failed");

  const runningFilePath = forked.source.filePath;
  const terminalFqn = applyExecutionIdentity(forked, {
    libraryFqn: started.libraryFqn,
    stage,
    name: started.generatedName,
  });
  rewriteParameterTypeFqns(forked.block, started.runningFqn, terminalFqn);

  rewriteInboundReferences(registry, started.runningFqn, terminalFqn, runningFilePath);
  persistDocument(forked);
  if (runningFilePath !== forked.source.filePath) {
    removeFile(runningFilePath);
  }
  commitWorktree(workspaceRoot, `transform(${stage}): ${started.generatedName}`, {
    required: true,
  });

  return {
    terminalFqn,
    terminalFilePath: forked.source.filePath,
    completedAtIso,
    stage,
    ...(resultError !== undefined ? { error: resultError } : {}),
  };
}
