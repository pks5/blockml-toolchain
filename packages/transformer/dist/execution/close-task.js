import { ExpressionEvaluationError, } from "@blockml/framework";
import { TransformError } from "./errors.js";
import { buildBlockEvaluationScope, closeMemberValue, } from "./interpolate.js";
export function getOperationTaskInstances(operation) {
    const task = operation.aggregationCompositions?.find((entry) => entry.aggregationName === "task");
    if (!task) {
        return [];
    }
    return task.composition.children
        .filter((child) => child.kind === "blockInstance")
        .map((child) => child.instance);
}
function assertNoDirectives(directives, where) {
    if (directives && directives.length > 0) {
        throw new TransformError("execution", `Task instance has unresolved directives on ${where}`);
    }
}
function closeCompositionNodes(nodes, scope) {
    return nodes.map((node) => {
        if (node.kind === "virtualContainer") {
            throw new TransformError("execution", "Task instance has a virtual container that cannot be closed");
        }
        assertNoDirectives(node.directives, node.instance.typeFqn);
        return {
            ...node,
            instance: closeTaskInstance(node.instance, scope),
        };
    });
}
export function closeTaskInstance(instance, scope) {
    const memberValues = {};
    for (const [name, value] of Object.entries(instance.memberValues)) {
        memberValues[name] = closeMemberValue(value, scope);
    }
    const closed = {
        ...instance,
        memberValues,
    };
    if (instance.id) {
        closed.id = closeMemberValue(instance.id, scope);
    }
    if (instance.version) {
        closed.version = closeMemberValue(instance.version, scope);
    }
    if (instance.bean) {
        closed.bean = closeMemberValue(instance.bean, scope);
    }
    if (instance.aggregationCompositions) {
        closed.aggregationCompositions = instance.aggregationCompositions.map((entry) => {
            assertNoDirectives(entry.composition.directives, entry.aggregationName);
            return {
                ...entry,
                composition: {
                    ...entry.composition,
                    children: closeCompositionNodes(entry.composition.children, scope),
                },
            };
        });
    }
    return closed;
}
function escapeAttr(value) {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function escapeText(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
function formatClosedValue(value) {
    if (typeof value === "boolean") {
        return value ? "true" : "false";
    }
    if (typeof value === "number") {
        return String(value);
    }
    if (typeof value === "string") {
        return value;
    }
    if (value === null || value === undefined) {
        return "";
    }
    return JSON.stringify(value).replace(/"([^"]+)":/g, "$1:");
}
function emitClosedMemberText(value) {
    if (value.kind === "address") {
        return value.address.raw;
    }
    if (value.kind !== "literal") {
        throw new TransformError("execution", `Closed Task still contains an open ${value.kind} value`);
    }
    return formatClosedValue(value.value);
}
function emitClosedInstance(instance, indent) {
    const pad = "  ".repeat(indent);
    const attrs = [];
    const elements = [];
    for (const [name, value] of Object.entries(instance.memberValues)) {
        if ("authoredPlacement" in value && value.authoredPlacement === "element") {
            const body = emitClosedMemberText(value);
            elements.push(`${pad}  <${name}>${escapeText(body)}</${name}>`);
            continue;
        }
        attrs.push(`${name}="${escapeAttr(emitClosedMemberText(value))}"`);
    }
    const nested = [];
    for (const agg of instance.aggregationCompositions ?? []) {
        nested.push(`${pad}  <${agg.aggregationName}>`);
        for (const child of agg.composition.children) {
            if (child.kind !== "blockInstance") {
                continue;
            }
            nested.push(...emitClosedInstance(child.instance, indent + 2));
        }
        nested.push(`${pad}  </${agg.aggregationName}>`);
    }
    const attrStr = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
    const tag = instance.typeFqn;
    if (elements.length === 0 && nested.length === 0) {
        return [`${pad}<${tag}${attrStr} />`];
    }
    return [
        `${pad}<${tag}${attrStr}>`,
        ...elements,
        ...nested,
        `${pad}</${tag}>`,
    ];
}
export function emitClosedTaskSnippet(instances) {
    return instances.flatMap((instance) => emitClosedInstance(instance, 0)).join("\n");
}
export function closeOperationTask(operation, transformation) {
    const instances = getOperationTaskInstances(operation);
    if (instances.length === 0) {
        throw new TransformError("execution", "AgenticOperation has no configured task");
    }
    const scope = buildBlockEvaluationScope(transformation);
    try {
        const closed = instances.map((instance) => closeTaskInstance(instance, scope));
        return emitClosedTaskSnippet(closed);
    }
    catch (error) {
        if (error instanceof TransformError) {
            throw error;
        }
        if (error instanceof ExpressionEvaluationError) {
            throw new TransformError("execution", error.message);
        }
        throw new TransformError("execution", error instanceof Error ? error.message : String(error));
    }
}
//# sourceMappingURL=close-task.js.map