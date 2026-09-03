import type { BomDocument } from "@blockml/bom";
import { forkBom } from "@blockml/framework";
import { TYPE_PACKAGE_FQN } from "./constants.js";
import { TransformError } from "./errors.js";
import { persistDocument } from "./relocate.js";
import { loadRunningExecution } from "./load-running.js";
import {
  getOperationInstance,
  setOperationChangedFiles,
  setOperationCompletedAt,
  setOperationException,
  setOperationOutput,
  setOperationStatus,
} from "./properties.js";
import type { StartedExecution } from "./start.js";
import { commitWorktree } from "../pipeline/git.js";

export interface PersistReflectionInput {
  started: StartedExecution;
  operationIndex: number;
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
  const operation = getOperationInstance(forked.block, input.operationIndex);
  if (!operation) {
    throw new TransformError(
      "execution",
      `Running ModelTransformation has no ModelOperation at index ${input.operationIndex}`,
    );
  }
  if (input.output !== undefined) {
    setOperationOutput(operation, input.output);
  }
  if (input.changedFiles.length > 0) {
    ensureTypeNamespace(forked);
    setOperationChangedFiles(operation, input.changedFiles);
  }
  if (input.exceptionMessage !== undefined) {
    setOperationException(operation, input.exceptionMessage);
  }
  setOperationStatus(operation, input.outcome === "failed" ? "Failed" : "Succeeded");
  setOperationCompletedAt(operation, input.completedAtIso);
  persistDocument(forked);
  commitWorktree(
    workspaceRoot,
    `transform(operation): ${input.started.generatedName} #${input.operationIndex + 1}`,
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
