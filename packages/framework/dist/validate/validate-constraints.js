import { findLocalMember, propertyForConstraintCheck, resolveEffectiveMembers, } from "../resolve/resolve-effective-members.js";
import { getPropertyNumericValue, isLiteralValue, } from "./validate-types.js";
function diag(code, message, file, line = 1, column = 1, severity = "error") {
    return { severity, code, message, source: { file, line, column } };
}
function constraintBranch(typeFqn) {
    if (typeFqn.includes(".constraint.Min") || typeFqn.includes(".constraint.Max")) {
        return "ValueConstraint";
    }
    if (typeFqn.includes(".constraint.ValuePresent")) {
        return "ValueConstraint";
    }
    if (typeFqn.includes(".constraint.RequiresMember")) {
        return "BlockConstraint";
    }
    if (typeFqn.includes(".constraint.MustBeReadOnly")) {
        return "PropertyConstraint";
    }
    if (typeFqn.includes(".constraint.AllowedChildType")) {
        return "AggregationConstraint";
    }
    if (typeFqn.includes(".constraint.NoSelfReference")) {
        return "AssociationConstraint";
    }
    if (typeFqn.includes(".constraint.RequiresImplementation")) {
        return "CapabilityConstraint";
    }
    if (typeFqn.endsWith(".constraint.Constraint") || typeFqn.includes(".constraint.")) {
        if (typeFqn.includes("ValueConstraint")) {
            return "ValueConstraint";
        }
        if (typeFqn.includes("BlockConstraint")) {
            return "BlockConstraint";
        }
        if (typeFqn.includes("MemberConstraint")) {
            return "PropertyConstraint";
        }
    }
    return "Unknown";
}
function allowedBranchForContext(context) {
    switch (context) {
        case "block":
            return new Set(["BlockConstraint"]);
        case "property":
            return new Set(["ValueConstraint", "PropertyConstraint"]);
        case "aggregation":
            return new Set(["AggregationConstraint"]);
        case "association":
            return new Set(["AssociationConstraint"]);
        case "capability":
            return new Set(["CapabilityConstraint"]);
    }
}
function hasValidation(instance) {
    const v = instance.memberValues["validation"];
    return v !== undefined;
}
function validationIsError(instance) {
    const v = instance.memberValues["validation"];
    if (!v || v.kind !== "literal") {
        return false;
    }
    const val = String(v.value);
    return val.includes("Error") || val.includes("error");
}
function evaluateBlockConstraint(instance, block, registry, file, diagnostics) {
    if (!hasValidation(instance) || !validationIsError(instance)) {
        return;
    }
    if (instance.typeFqn.includes(".RequiresMember")) {
        const nameVal = instance.memberValues["name"];
        const memberName = nameVal && isLiteralValue(nameVal) ? String(nameVal.value) : undefined;
        if (!memberName) {
            return;
        }
        const effective = resolveEffectiveMembers(block, registry);
        const found = effective.some((m) => m.name === memberName);
        if (!found) {
            diagnostics.push(diag("BML_CONSTRAINT_VIOLATION", `RequiresMember: missing member ${memberName}`, file, instance.source?.line, instance.source?.column));
        }
    }
}
function hasAuthoredPropertyValue(prop) {
    if (prop.value !== undefined) {
        if (prop.value.kind === "literal") {
            const v = prop.value.value;
            return v !== null && v !== "";
        }
        return true;
    }
    for (const entry of prop.values ?? []) {
        if (entry.value !== undefined) {
            return true;
        }
    }
    return false;
}
function evaluateValueConstraint(instance, prop, file, diagnostics) {
    if (!hasValidation(instance) || !validationIsError(instance)) {
        return;
    }
    const typeFqn = instance.typeFqn;
    if (typeFqn.includes(".Min")) {
        const minVal = instance.memberValues["value"];
        const min = minVal && isLiteralValue(minVal) && typeof minVal.value === "number"
            ? minVal.value
            : Number(minVal && isLiteralValue(minVal) ? minVal.value : NaN);
        const actual = prop ? getPropertyNumericValue(prop) : undefined;
        if (actual !== undefined && !Number.isNaN(min) && actual < min) {
            diagnostics.push(diag("BML_CONSTRAINT_VIOLATION", `Value ${actual} is less than minimum ${min}`, file, prop?.source?.line, prop?.source?.column));
        }
    }
    if (typeFqn.includes(".ValuePresent")) {
        if (prop && !hasAuthoredPropertyValue(prop)) {
            diagnostics.push(diag("BML_CONSTRAINT_VIOLATION", `ValuePresent constraint violated on ${prop.name}`, file, prop.source?.line, prop.source?.column));
        }
    }
}
function validateConstraintInstances(instances, context, file, diagnostics, block, registry, prop) {
    if (!instances?.length) {
        return;
    }
    const allowed = allowedBranchForContext(context);
    for (const inst of instances) {
        const branch = constraintBranch(inst.typeFqn);
        if (branch === "Unknown") {
            diagnostics.push(diag("BML_CONSTRAINT_UNKNOWN", `Unknown constraint type: ${inst.typeFqn}`, file, inst.source?.line, inst.source?.column));
            continue;
        }
        if (!allowed.has(branch)) {
            diagnostics.push(diag("BML_CONSTRAINT_TARGET_MISMATCH", `${branch} not allowed on ${context}`, file, inst.source?.line, inst.source?.column));
            continue;
        }
        if (branch === "ValueConstraint") {
            evaluateValueConstraint(inst, prop, file, diagnostics);
        }
        if (branch === "BlockConstraint" && block && registry) {
            evaluateBlockConstraint(inst, block, registry, file, diagnostics);
        }
    }
}
function validateMemberConstraintPlacement(member, file, diagnostics) {
    const context = member.kind === "property"
        ? "property"
        : member.kind === "aggregation"
            ? "aggregation"
            : member.kind === "association"
                ? "association"
                : "capability";
    if (!member.constraints?.length) {
        return;
    }
    const allowed = allowedBranchForContext(context);
    for (const inst of member.constraints) {
        const branch = constraintBranch(inst.typeFqn);
        if (branch === "Unknown") {
            diagnostics.push(diag("BML_CONSTRAINT_UNKNOWN", `Unknown constraint type: ${inst.typeFqn}`, file, inst.source?.line, inst.source?.column));
            continue;
        }
        if (!allowed.has(branch)) {
            diagnostics.push(diag("BML_CONSTRAINT_TARGET_MISMATCH", `${branch} not allowed on ${context}`, file, inst.source?.line, inst.source?.column));
        }
    }
}
function validateEffectiveMemberConstraints(block, registry, file, diagnostics) {
    const effective = resolveEffectiveMembers(block, registry);
    for (const member of effective) {
        if (!member.constraints?.length) {
            continue;
        }
        if (member.kind === "property") {
            const local = findLocalMember(block, member);
            const prop = propertyForConstraintCheck(member, local?.kind === "property" ? local : undefined);
            for (const inst of member.constraints) {
                if (constraintBranch(inst.typeFqn) === "ValueConstraint") {
                    evaluateValueConstraint(inst, prop, file, diagnostics);
                }
            }
        }
    }
}
function validateMemberConstraints(member, file, diagnostics) {
    validateMemberConstraintPlacement(member, file, diagnostics);
}
function validateBlockConstraints(block, registry, file, diagnostics) {
    validateConstraintInstances(block.constraints, "block", file, diagnostics, block, registry);
    for (const member of block.members) {
        validateMemberConstraints(member, file, diagnostics);
    }
    validateEffectiveMemberConstraints(block, registry, file, diagnostics);
    for (const sub of block.subBlocks) {
        validateBlockConstraints(sub, registry, file, diagnostics);
    }
}
export function validateConstraints(document, registry) {
    const diagnostics = [];
    const file = document.source.filePath ?? "<memory>";
    validateBlockConstraints(document.block, registry, file, diagnostics);
    return diagnostics;
}
//# sourceMappingURL=validate-constraints.js.map