import type { ExecutionStatusId, TerminalExecutionStatus } from "./constants.js";

export type TransformLifecycleEvent =
  | {
      kind: "transformationStatus";
      status: ExecutionStatusId;
      fqn: string;
    }
  | {
      kind: "stageStatus";
      stageIndex: number;
      stageCount: number;
      status: ExecutionStatusId;
      fqn: string;
    }
  | {
      kind: "stageExecuteStart";
      stageIndex: number;
      stageCount: number;
      fqn: string;
    }
  | {
      kind: "stageExecuteEnd";
      stageIndex: number;
      stageCount: number;
      fqn: string;
    }
  | {
      kind: "stageReflectStart";
      stageIndex: number;
      stageCount: number;
      fqn: string;
    }
  | {
      kind: "stageReflectEnd";
      stageIndex: number;
      stageCount: number;
      fqn: string;
    }
  | {
      kind: "transformationComplete";
      status: TerminalExecutionStatus;
      terminalFqn: string;
    };

export type TransformLifecycleListener = (event: TransformLifecycleEvent) => void;

export function emitLifecycle(
  listener: TransformLifecycleListener | undefined,
  event: TransformLifecycleEvent,
): void {
  listener?.(event);
}

function stageLabel(event: { stageIndex: number; stageCount: number }): string {
  return `Stage ${event.stageIndex + 1}/${event.stageCount}`;
}

export function formatTransformLifecycle(event: TransformLifecycleEvent): string {
  switch (event.kind) {
    case "transformationStatus":
      return `ModelTransformation ${event.status}  ${event.fqn}`;
    case "stageStatus":
      return `${stageLabel(event)} ${event.status}`;
    case "stageExecuteStart":
      return `${stageLabel(event)} execute start`;
    case "stageExecuteEnd":
      return `${stageLabel(event)} execute done`;
    case "stageReflectStart":
      return `${stageLabel(event)} reflect start`;
    case "stageReflectEnd":
      return `${stageLabel(event)} reflect done`;
    case "transformationComplete":
      return event.status === "Succeeded"
        ? `Transformed ${event.terminalFqn}`
        : `ModelTransformation Failed  ${event.terminalFqn}`;
  }
}
