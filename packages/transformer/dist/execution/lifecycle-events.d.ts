import type { ExecutionStatusId, TerminalExecutionStatus } from "./constants.js";
export type TransformLifecycleEvent = {
    kind: "transformationStatus";
    status: ExecutionStatusId;
    fqn: string;
} | {
    kind: "operationStatus";
    operationIndex: number;
    operationCount: number;
    status: ExecutionStatusId;
    fqn: string;
} | {
    kind: "operationExecuteStart";
    operationIndex: number;
    operationCount: number;
    fqn: string;
} | {
    kind: "operationExecuteEnd";
    operationIndex: number;
    operationCount: number;
    fqn: string;
} | {
    kind: "operationReflectStart";
    operationIndex: number;
    operationCount: number;
    fqn: string;
} | {
    kind: "operationReflectEnd";
    operationIndex: number;
    operationCount: number;
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