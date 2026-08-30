import { forkBom } from "@blockml/framework";
import { persistDocument } from "./relocate.js";
import { loadRunningExecution } from "./load-running.js";
import { setChangedFiles, setFeedback } from "./properties.js";
import type { StartedExecution } from "./start.js";

export interface PersistReflectionInput {
  started: StartedExecution;
  changedFiles: readonly string[];
  feedback: string | undefined;
}

export function persistReflection(
  workspaceRoot: string,
  input: PersistReflectionInput,
): void {
  if (input.changedFiles.length === 0 && input.feedback === undefined) {
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
  persistDocument(forked);
}
