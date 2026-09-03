import { collectBaseTypeChain } from "@blockml/framework";
import { BOOLEAN_TYPE_FQN, DATETIME_TYPE_FQN, EXECUTION_EXCEPTION_FQN, EXECUTION_STATUS_FQN, FILE_PATH_ENTITY_FQN, FILE_PATH_TYPE_FQN, INTEGER_TYPE_FQN, MODEL_OPERATION_FQN, MODEL_TRANSFORMATION_FQN, TEXT_TYPE_FQN, UUID_TYPE_FQN, } from "./constants.js";
export function isModelTransformation(block, registry) {
    if (block.type === MODEL_TRANSFORMATION_FQN || block.baseType === MODEL_TRANSFORMATION_FQN) {
        return true;
    }
    return collectBaseTypeChain(block, registry).some((entry) => entry.type === MODEL_TRANSFORMATION_FQN);
}
export function hasTaskComposition(block) {
    return hasAggregationComposition(block, "task");
}
export function getOperationInstances(block) {
    const aggregation = block.members.find((member) => member.kind === "aggregation" && member.name === "operations");
    if (!aggregation?.composition) {
        return [];
    }
    return aggregation.composition.children
        .filter((child) => child.kind === "blockInstance")
        .map((child) => child.instance)
        .filter((instance) => instance.typeFqn === MODEL_OPERATION_FQN);
}
export function getOperationInstance(block, operationIndex) {
    return getOperationInstances(block)[operationIndex];
}
export function operationHasTask(instance) {
    return operationHasAggregation(instance, "task");
}
export function operationHasAggregation(instance, name) {
    const aggregation = instance.aggregationCompositions?.find((entry) => entry.aggregationName === name);
    return (aggregation?.composition.children.length ?? 0) > 0;
}
export function hasOperationProperty(instance, name) {
    const value = instance.memberValues[name];
    if (!value) {
        return false;
    }
    if (value.kind === "literal") {
        return value.value !== undefined && value.value !== "";
    }
    return true;
}
export function getOperationPropertyLiteral(instance, name) {
    const value = instance.memberValues[name];
    if (value?.kind === "literal") {
        return value.value;
    }
    return undefined;
}
export function getOperationStatus(instance) {
    const value = getOperationPropertyLiteral(instance, "status");
    if (typeof value !== "string") {
        return undefined;
    }
    const separator = value.lastIndexOf("::");
    return separator >= 0 ? value.slice(separator + 2) : value;
}
export function allOperationsSucceeded(block) {
    const operations = getOperationInstances(block);
    if (operations.length === 0) {
        return false;
    }
    return operations.every((operation) => getOperationStatus(operation) === "Succeeded");
}
function setOperationMember(instance, name, typeFqn, value, authoredPlacement = "element") {
    instance.memberValues[name] = {
        kind: "literal",
        value,
        typeFqn,
        authoredPlacement,
    };
}
export function setOperationStatus(instance, status) {
    // `status` is a reserved metadata element name on composition instances;
    // persist it as an attribute so it round-trips through parse.
    setOperationMember(instance, "status", EXECUTION_STATUS_FQN, status, "attribute");
}
function upsertInstanceAggregation(instance, aggregationName, children) {
    const next = {
        aggregationName,
        composition: { aggregationName, children },
    };
    const existing = [...(instance.aggregationCompositions ?? [])];
    const index = existing.findIndex((entry) => entry.aggregationName === aggregationName);
    if (index >= 0) {
        existing[index] = next;
    }
    else {
        existing.push(next);
    }
    instance.aggregationCompositions = existing;
}
export function setOperationStartedAt(instance, iso) {
    setOperationMember(instance, "startedAt", DATETIME_TYPE_FQN, iso);
}
export function setOperationBaseCommit(instance, commit) {
    setOperationMember(instance, "baseCommit", TEXT_TYPE_FQN, commit);
}
export function setOperationCompletedAt(instance, iso) {
    setOperationMember(instance, "completedAt", DATETIME_TYPE_FQN, iso);
}
export function setOperationOutput(instance, output) {
    setOperationMember(instance, "output", TEXT_TYPE_FQN, output);
}
export function setOperationChangedFiles(instance, paths) {
    upsertInstanceAggregation(instance, "changedFiles", paths.map((path) => ({
        kind: "blockInstance",
        instance: {
            typeFqn: FILE_PATH_ENTITY_FQN,
            memberValues: {
                value: {
                    kind: "literal",
                    value: path,
                    typeFqn: FILE_PATH_TYPE_FQN,
                    authoredPlacement: "attribute",
                },
            },
        },
    })));
}
export function setOperationException(instance, message) {
    upsertInstanceAggregation(instance, "exception", [
        {
            kind: "blockInstance",
            instance: {
                typeFqn: EXECUTION_EXCEPTION_FQN,
                memberValues: {
                    message: {
                        kind: "literal",
                        value: message,
                        typeFqn: TEXT_TYPE_FQN,
                        authoredPlacement: "element",
                    },
                },
            },
        },
    ]);
}
export function hasAggregationComposition(block, name) {
    const aggregation = block.members.find((member) => member.kind === "aggregation" && member.name === name);
    return (aggregation?.composition?.children.length ?? 0) > 0;
}
export function hasPropertyValue(block, name) {
    const member = block.members.find((entry) => entry.kind === "property" && entry.name === name);
    if (!member) {
        return false;
    }
    if (member.value !== undefined) {
        return true;
    }
    return (member.values?.length ?? 0) > 0;
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
export function getStatus(block) {
    const value = getPropertyLiteral(block, "status");
    if (typeof value !== "string") {
        return undefined;
    }
    const separator = value.lastIndexOf("::");
    return separator >= 0 ? value.slice(separator + 2) : value;
}
export function isTemplate(block) {
    const value = getPropertyLiteral(block, "template");
    if (value === true) {
        return true;
    }
    return typeof value === "string" && value.toLowerCase() === "true";
}
export function setTemplate(block, template) {
    setOverrideProperty(block, "template", BOOLEAN_TYPE_FQN, template);
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
function upsertAggregation(block, aggregation) {
    const existing = block.members.findIndex((member) => member.kind === "aggregation" && member.name === aggregation.name);
    if (existing >= 0) {
        block.members[existing] = aggregation;
        return;
    }
    block.members.push(aggregation);
}
export function setSequence(block, sequence) {
    setOverrideProperty(block, "sequence", INTEGER_TYPE_FQN, sequence);
}
export function setExecutionId(block, executionId) {
    setOverrideProperty(block, "executionId", UUID_TYPE_FQN, executionId);
}
export function setStatus(block, status) {
    setOverrideProperty(block, "status", EXECUTION_STATUS_FQN, status);
}
export function setStartedAt(block, iso) {
    setOverrideProperty(block, "startedAt", DATETIME_TYPE_FQN, iso);
}
export function setBaseCommit(block, commit) {
    setOverrideProperty(block, "baseCommit", TEXT_TYPE_FQN, commit);
}
export function setCompletedAt(block, iso) {
    setOverrideProperty(block, "completedAt", DATETIME_TYPE_FQN, iso);
}
export function setFeedback(block, feedback) {
    setOverrideProperty(block, "feedback", TEXT_TYPE_FQN, feedback);
}
export function setChangedFiles(block, paths) {
    const aggregation = {
        kind: "aggregation",
        name: "changedFiles",
        override: true,
        authoredInAggregationsSection: true,
        composition: {
            aggregationName: "changedFiles",
            children: paths.map((path) => ({
                kind: "blockInstance",
                instance: {
                    typeFqn: FILE_PATH_ENTITY_FQN,
                    memberValues: {
                        value: {
                            kind: "literal",
                            value: path,
                            typeFqn: FILE_PATH_TYPE_FQN,
                            authoredPlacement: "attribute",
                        },
                    },
                },
            })),
        },
    };
    upsertAggregation(block, aggregation);
}
export function setException(block, typeFqn, message) {
    const aggregation = {
        kind: "aggregation",
        name: "exception",
        override: true,
        authoredInAggregationsSection: true,
        composition: {
            aggregationName: "exception",
            children: [
                {
                    kind: "blockInstance",
                    instance: {
                        typeFqn,
                        memberValues: {
                            message: {
                                kind: "literal",
                                value: message,
                                typeFqn: TEXT_TYPE_FQN,
                                authoredPlacement: "element",
                            },
                        },
                    },
                },
            ],
        },
    };
    upsertAggregation(block, aggregation);
}
export function setResult(block, typeFqn, value) {
    setOverrideProperty(block, "result", typeFqn, value);
}
export function clearProperty(block, name) {
    const member = block.members.find((entry) => entry.kind === "property" && entry.name === name);
    if (!member) {
        return;
    }
    delete member.value;
    delete member.values;
}
export function modelTransformationHasCompletedAt(registry) {
    const type = registry.get(MODEL_TRANSFORMATION_FQN)?.block;
    if (!type) {
        return true;
    }
    return type.members.some((member) => member.kind === "property" && member.name === "completedAt");
}
//# sourceMappingURL=properties.js.map