export function emitLifecycle(listener, event) {
    listener?.(event);
}
function stageLabel(event) {
    return `Stage ${event.stageIndex + 1}/${event.stageCount}`;
}
export function formatTransformLifecycle(event) {
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
//# sourceMappingURL=lifecycle-events.js.map