import type { ExecutionStatusId, TerminalExecutionStatus } from "./constants.js";
export type TransformLifecycleEvent = {
    kind: "transformationStatus";
    status: ExecutionStatusId;
    fqn: string;
} | {
    kind: "stageStatus";
    stageIndex: number;
    stageCount: number;
    status: ExecutionStatusId;
    fqn: string;
} | {
    kind: "stageExecuteStart";
    stageIndex: number;
    stageCount: number;
    fqn: string;
} | {
    kind: "stageExecuteEnd";
    stageIndex: number;
    stageCount: number;
    fqn: string;
} | {
    kind: "stageReflectStart";
    stageIndex: number;
    stageCount: number;
    fqn: string;
} | {
    kind: "stageReflectEnd";
    stageIndex: number;
    stageCount: number;
    fqn: string;
} | {
    kind: "transformationComplete";
    status: TerminalExecutionStatus;
    terminalFqn: string;
};
export type TransformLifecycleListener = (event: TransformLifecycleEvent) => void;
export declare function emitLifecycle(listener: TransformLifecycleListener | undefined, event: TransformLifecycleEvent): void;
export declare function formatTransformLifecycle(event: TransformLifecycleEvent): string;
//# sourceMappingURL=lifecycle-events.d.ts.map