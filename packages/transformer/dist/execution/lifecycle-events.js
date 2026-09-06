import { formatElapsed } from "./duration.js";
export function emitLifecycle(listener, event) {
    listener?.(event);
}
function operationLabel(event) {
    return `Operation ${event.operationIndex + 1}/${event.operationCount}`;
}
export function formatTransformLifecycle(event) {
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
//# sourceMappingURL=lifecycle-events.js.map