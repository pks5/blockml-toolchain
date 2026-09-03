import type { BomDocument } from "@blockml/bom";
import { forkBom } from "@blockml/framework";
import { TYPE_PACKAGE_FQN } from "./constants.js";
import { TransformError } from "./errors.js";
import { persistDocument } from "./relocate.js";
import { loadRunningExecution } from "./load-running.js";
import {
  getStageInstance,
  setStageChangedFiles,
  setStageCompletedAt,
  setStageException,
  setStageOutput,
  setStageStatus,
} from "./properties.js";
import type { StartedExecution } from "./start.js";
import { commitWorktree } from "../pipeline/git.js";

export interface PersistReflectionInput {
  started: StartedExecution;
  stageIndex: number;
  changedFiles: readonly string[];
  output: string | undefined;
  exceptionMessage?: string;
  outcome: "succeeded" | "failed";
  completedAtIso: string;
}

export function persistReflection(
  workspaceRoot: string,
  input: PersistReflectionInput,
): void {
  const { document } = loadRunningExecution(workspaceRoot, input.started);
  const forked = forkBom(document);
  const stage = getStageInstance(forked.block, input.stageIndex);
  if (!stage) {
    throw new TransformError(
      "execution",
      `Running ModelTransformation has no Stage at index ${input.stageIndex}`,
    );
  }
  if (input.output !== undefined) {
    setStageOutput(stage, input.output);
  }
  if (input.changedFiles.length > 0) {
    ensureTypeNamespace(forked);
    setStageChangedFiles(stage, input.changedFiles);
  }
  if (input.exceptionMessage !== undefined) {
    setStageException(stage, input.exceptionMessage);
  }
  setStageStatus(stage, input.outcome === "failed" ? "Failed" : "Succeeded");
  setStageCompletedAt(stage, input.completedAtIso);
  persistDocument(forked);
  commitWorktree(
    workspaceRoot,
    `transform(stage): ${input.started.generatedName} #${input.stageIndex + 1}`,
    { required: true },
  );
}

function ensureTypeNamespace(document: BomDocument): void {
  const bindings = { ...(document.source.namespaceBindings ?? {}) };
  if (Object.values(bindings).includes(TYPE_PACKAGE_FQN)) {
    return;
  }
  bindings.type ??= TYPE_PACKAGE_FQN;
  document.source.namespaceBindings = bindings;
}
