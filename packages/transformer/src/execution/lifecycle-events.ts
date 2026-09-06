import type { ExecutionStatusId, TerminalExecutionStatus } from "./constants.js";
import { formatElapsed } from "./duration.js";

export type TransformLifecycleEvent =
  | {
      kind: "transformationStatus";
      status: ExecutionStatusId;
      fqn: string;
    }
  | {
      kind: "operationStatus";
      operationIndex: number;
      operationCount: number;
      status: ExecutionStatusId;
      fqn: string;
    }
  | {
      kind: "operationExecuteStart";
      operationIndex: number;
      operationCount: number;
      fqn: string;
    }
  | {
      kind: "operationExecuteEnd";
      operationIndex: number;
      operationCount: number;
      fqn: string;
    }
  | {
      kind: "operationReflectStart";
      operationIndex: number;
      operationCount: number;
      fqn: string;
    }
  | {
      kind: "operationReflectEnd";
      operationIndex: number;
      operationCount: number;
      fqn: string;
    }
  | {
      kind: "transformationComplete";
      status: TerminalExecutionStatus;
      terminalFqn: string;
      durationMs: number;
      duration: string;
    };

export type TransformLifecycleListener = (event: TransformLifecycleEvent) => void;

export function emitLifecycle(
  listener: TransformLifecycleListener | undefined,
  event: TransformLifecycleEvent,
): void {
  listener?.(event);
}

function operationLabel(event: {
  operationIndex: number;
  operationCount: number;
}): string {
  return `Operation ${event.operationIndex + 1}/${event.operationCount}`;
}

export function formatTransformLifecycle(event: TransformLifecycleEvent): string {
  switch (event.kind) {
    case "transformationStatus":
      return `ModelTransformation ${event.status}  ${event.fqn}`;
    case "operationStatus":
      return `${operationLabel(event)} ${event.status}`;
    case "operationExecuteStart":
      return `${operationLabel(event)} execute start`;
    case "operationExecuteEnd":
      return `${operationLabel(event)} execute done`;
    case "operationReflectStart":
      return `${operationLabel(event)} reflect start`;
    case "operationReflectEnd":
      return `${operationLabel(event)} reflect done`;
    case "transformationComplete": {
      const elapsed = `Elapsed ${formatElapsed(event.durationMs)}`;
      return event.status === "Succeeded"
        ? `Transformed ${event.terminalFqn}\n${elapsed}`
        : `ModelTransformation Failed  ${event.terminalFqn}\n${elapsed}`;
    }
  }
}
