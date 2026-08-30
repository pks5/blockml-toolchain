import { collectBaseTypeChain } from "@blockml/framework";
import { DATETIME_TYPE_FQN, INTEGER_TYPE_FQN, TASK_EXECUTION_FQN, TEXT_TYPE_FQN, } from "./constants.js";
export function isTaskExecution(block, registry) {
    if (block.type === TASK_EXECUTION_FQN || block.baseType === TASK_EXECUTION_FQN) {
        return true;
    }
    return collectBaseTypeChain(block, registry).some((entry) => entry.type === TASK_EXECUTION_FQN);
}
export function hasTaskComposition(block) {
    const task = block.members.find((member) => member.kind === "aggregation" && member.name === "task");
    return (task?.composition?.children.length ?? 0) > 0;
}
export function getPropertyLiteral(block, name) {
    const member = block.members.find((entry) => entry.kind === "property" && entry.name === name);
    if (!member) {
        return undefined;
    }
    const value = member.value ?? member.values?.[0]?.value;
    if (value?.kind === "literal") {
        return value.value;
    }
    return undefined;
}
export function getExecutionId(block) {
    const value = getPropertyLiteral(block, "executionId");
    return typeof value === "string" ? value : undefined;
}
export function getSequence(block) {
    const value = getPropertyLiteral(block, "sequence");
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
export function setOverrideProperty(block, name, typeFqn, value) {
    const literal = {
        kind: "literal",
        value,
        typeFqn,
        authoredPlacement: "element",
    };
    const property = {
        kind: "property",
        name,
        override: true,
        typeFqn,
        value: literal,
        values: [{ namespace: "", value: literal }],
    };
    upsertProperty(block, property);
}
export function setOverridePropertyList(block, name, typeFqn, values) {
    const entries = values.map((value) => {
        const literal = {
            kind: "literal",
            value,
            typeFqn,
            authoredPlacement: "element",
        };
        return { namespace: "", value: literal };
    });
    const property = {
        kind: "property",
        name,
        override: true,
        typeFqn,
        values: [...entries],
    };
    if (entries[0]) {
        property.value = entries[0].value;
    }
    upsertProperty(block, property);
}
function upsertProperty(block, property) {
    const existing = block.members.findIndex((member) => member.kind === "property" && member.name === property.name);
    if (existing >= 0) {
        block.members[existing] = property;
        return;
    }
    let insertAt = 0;
    for (let i = 0; i < block.members.length; i++) {
        if (block.members[i]?.kind === "property") {
            insertAt = i + 1;
        }
    }
    block.members.splice(insertAt, 0, property);
}
export function setSequence(block, sequence) {
    setOverrideProperty(block, "sequence", INTEGER_TYPE_FQN, sequence);
}
export function setStartedAt(block, iso) {
    setOverrideProperty(block, "startedAt", DATETIME_TYPE_FQN, iso);
}
export function setCompletedAt(block, iso) {
    setOverrideProperty(block, "completedAt", DATETIME_TYPE_FQN, iso);
}
export function setFeedback(block, feedback) {
    setOverrideProperty(block, "feedback", TEXT_TYPE_FQN, feedback);
}
export function setChangedFiles(block, paths) {
    setOverridePropertyList(block, "changedFiles", TEXT_TYPE_FQN, paths);
}
export function taskExecutionHasCompletedAt(registry) {
    const type = registry.get(TASK_EXECUTION_FQN)?.block;
    if (!type) {
        return true;
    }
    return type.members.some((member) => member.kind === "property" && member.name === "completedAt");
}
//# sourceMappingURL=properties.js.map