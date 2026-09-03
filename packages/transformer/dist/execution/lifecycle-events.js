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
        case "transformationComplete":
            return event.status === "Succeeded"
                ? `Transformed ${event.terminalFqn}`
                : `ModelTransformation Failed  ${event.terminalFqn}`;
    }
}
//# sourceMappingURL=lifecycle-events.js.map