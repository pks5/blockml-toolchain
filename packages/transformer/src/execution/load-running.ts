import type { BomDocument } from "@blockml/bom";
import { bootstrapFullProjectRegistry, type TypeRegistry } from "@blockml/framework";
import { TransformError } from "./errors.js";
import { parseExecutionFqn } from "./lifecycle.js";
import { getExecutionId } from "./properties.js";
import type { StartedExecution } from "./start.js";

export interface LoadedRunningExecution {
  document: BomDocument;
  registry: TypeRegistry;
}

export function loadRunningExecution(
  workspaceRoot: string,
  started: StartedExecution,
): LoadedRunningExecution {
  const { registry } = bootstrapFullProjectRegistry({ rootDir: workspaceRoot });
  const document =
    registry.get(started.runningFqn) ??
    findRunningByExecutionId(registry, started.libraryFqn, started.executionId);

  if (!document) {
    throw new TransformError(
      "execution",
      `Running ModelTransformation ${started.runningFqn} was not found`,
    );
  }

  return { document, registry };
}

function findRunningByExecutionId(
  registry: TypeRegistry,
  libraryFqn: string,
  executionId: string | undefined,
) {
  if (!executionId) {
    return undefined;
  }
  for (const fqn of registry.keys()) {
    const parsed = parseExecutionFqn(fqn);
    if (!parsed || parsed.libraryFqn !== libraryFqn || parsed.stage !== "running") {
      continue;
    }
    const found = registry.get(fqn);
    if (found && getExecutionId(found.block) === executionId) {
      return found;
    }
  }
  return undefined;
}
