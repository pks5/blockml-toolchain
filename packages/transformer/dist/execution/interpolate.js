import { evaluateInterpolatedText, } from "@blockml/framework";
function containsUnescapedInterpolation(raw) {
    for (let i = 0; i < raw.length - 1; i++) {
        if (raw[i] === "$" && raw[i + 1] === "{") {
            if (i === 0 || raw[i - 1] !== "\\") {
                return true;
            }
        }
    }
    return false;
}
function literalPropertyValue(block, name) {
    const member = block.members.find((entry) => entry.kind === "property" && entry.name === name);
    const value = member?.value ?? member?.values?.[0]?.value;
    if (value?.kind === "literal") {
        return value.value;
    }
    return undefined;
}
export function buildBlockEvaluationScope(block) {
    const scope = {};
    for (const member of block.members) {
        if (member.kind !== "property") {
            continue;
        }
        const raw = literalPropertyValue(block, member.name);
        if (raw === undefined) {
            continue;
        }
        scope[member.name] = raw;
    }
    return scope;
}
export function resolveMemberText(value, scope) {
    if (!value) {
        return undefined;
    }
    if (value.kind === "interpolated") {
        return evaluateInterpolatedText(value.raw, scope);
    }
    if (value.kind === "literal" && typeof value.value === "string") {
        if (containsUnescapedInterpolation(value.value)) {
            return evaluateInterpolatedText(value.value, scope);
        }
        return value.value;
    }
    return undefined;
}
export function resolveMemberStringList(value, scope) {
    if (!value) {
        return undefined;
    }
    if (value.kind === "interpolated") {
        const resolved = evaluateInterpolatedText(value.raw, scope);
        return resolved === "" ? [] : [resolved];
    }
    if (value.kind !== "literal") {
        return undefined;
    }
    if (typeof value.value === "string") {
        const item = containsUnescapedInterpolation(value.value)
            ? evaluateInterpolatedText(value.value, scope)
            : value.value;
        return item === "" ? [] : [item];
    }
    if (Array.isArray(value.value) && value.value.every((item) => typeof item === "string")) {
        return value.value.map((item) => containsUnescapedInterpolation(item) ? evaluateInterpolatedText(item, scope) : item);
    }
    return undefined;
}
export function getOperationTaskInstructions(operation, scope) {
    const task = operation.aggregationCompositions?.find((entry) => entry.aggregationName === "task");
    if (!task) {
        return undefined;
    }
    for (const child of task.composition.children) {
        if (child.kind !== "blockInstance") {
            continue;
        }
        const instructions = resolveMemberText(child.instance.memberValues.instructions, scope);
        if (instructions !== undefined) {
            return instructions;
        }
    }
    return undefined;
}
//# sourceMappingURL=interpolate.js.map