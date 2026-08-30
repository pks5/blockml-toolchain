import { forkBom } from "@blockml/framework";
import { persistDocument } from "./relocate.js";
import { loadRunningExecution } from "./load-running.js";
import { setChangedFiles, setException, setFeedback } from "./properties.js";
import type { StartedExecution } from "./start.js";

export interface PersistReflectionInput {
  started: StartedExecution;
  changedFiles: readonly string[];
  feedback: string | undefined;
  exceptionMessage?: string;
}

export function persistReflection(
  workspaceRoot: string,
  input: PersistReflectionInput,
): void {
  const hasException = input.exceptionMessage !== undefined;
  if (
    input.changedFiles.length === 0 &&
    input.feedback === undefined &&
    !hasException
  ) {
    return;
  }
  const { document } = loadRunningExecution(workspaceRoot, input.started);
  const forked = forkBom(document);
  if (input.feedback !== undefined) {
    setFeedback(forked.block, input.feedback);
  }
  if (input.changedFiles.length > 0) {
    setChangedFiles(forked.block, input.changedFiles);
  }
  if (input.exceptionMessage !== undefined) {
    setException(forked.block, input.exceptionMessage);
  }
  persistDocument(forked);
}
