import { findLocalMember, propertyForConstraintCheck, resolveEffectiveMembers, } from "../resolve/resolve-effective-members.js";
import { getPropertyNumericValue, isLiteralValue, } from "./validate-types.js";
function diag(code, message, file, line = 1, column = 1, severity = "error") {
    return { severity, code, message, source: { file, line, column } };
}
function constraintBranch(typeFqn) {
    if (typeFqn.includes(".constraint.MinItems") ||
        typeFqn.includes(".constraint.MaxItems") ||
        typeFqn.includes(".constraint.AllowedChildType")) {
        return "AggregationConstraint";
    }
    if (typeFqn.includes(".constraint.Min") ||
        typeFqn.includes(".constraint.Max") ||
        typeFqn.includes(".constraint.MinLength") ||
        typeFqn.includes(".constraint.MaxLength") ||
        typeFqn.includes(".constraint.Pattern") ||
        typeFqn.includes(".constraint.ValuePresent")) {
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
function validationSeverity(instance) {
    const v = instance.memberValues["validation"];
    if (!v || v.kind !== "literal") {
        return null;
    }
    const val = String(v.value);
    if (val.includes("Error") || val.includes("error")) {
        return "error";
    }
    if (val.includes("Warning") || val.includes("warning")) {
        return "warning";
    }
    if (val.includes("Information") || val.includes("information")) {
        return "info";
    }
    return null;
}
function validationIsEnforced(instance) {
    return validationSeverity(instance) !== null;
}
function constraintViolationCode(severity) {
    if (severity === "warning") {
        return "BML_CONSTRAINT_WARNING";
    }
    if (severity === "info") {
        return "BML_CONSTRAINT_INFORMATION";
    }
    return "BML_CONSTRAINT_VIOLATION";
}
function pushConstraintViolation(instance, message, file, diagnostics, source) {
    const severity = validationSeverity(instance);
    if (!severity) {
        return;
    }
    diagnostics.push(diag(constraintViolationCode(severity), message, file, source?.line ?? instance.source?.line, source?.column ?? instance.source?.column, severity));
}
function getPropertyStringValue(prop) {
    const fromLiteral = (val) => {
        if (val?.kind === "literal" && typeof val.value === "string") {
            return val.value;
        }
        return undefined;
    };
    const direct = fromLiteral(prop.value);
    if (direct !== undefined) {
        return direct;
    }
    for (const entry of prop.values ?? []) {
        const s = fromLiteral(entry.value);
        if (s !== undefined) {
            return s;
        }
    }
    return undefined;
}
function constraintTypeArg(instance) {
    const typeVal = instance.memberValues["type"];
    if (typeVal?.kind === "literal") {
        return String(typeVal.value);
    }
    return undefined;
}
function evaluateBlockConstraint(instance, block, registry, file, diagnostics) {
    if (!validationIsEnforced(instance)) {
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
            pushConstraintViolation(instance, `RequiresMember: missing member ${memberName}`, file, diagnostics);
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
    if (!validationIsEnforced(instance)) {
        return;
    }
    const typeFqn = instance.typeFqn;
    const limitVal = instance.memberValues["value"];
    const limit = limitVal && isLiteralValue(limitVal) && typeof limitVal.value === "number"
        ? limitVal.value
        : Number(limitVal && isLiteralValue(limitVal) ? limitVal.value : NaN);
    if (typeFqn.includes(".Min") && !typeFqn.includes("MinItems") && !typeFqn.includes("MinLength")) {
        const actual = prop ? getPropertyNumericValue(prop) : undefined;
        if (actual !== undefined && !Number.isNaN(limit) && actual < limit) {
            pushConstraintViolation(instance, `Value ${actual} is less than minimum ${limit}`, file, diagnostics, prop?.source);
        }
    }
    if (typeFqn.includes(".Max") && !typeFqn.includes("MaxItems") && !typeFqn.includes("MaxLength")) {
        const actual = prop ? getPropertyNumericValue(prop) : undefined;
        if (actual !== undefined && !Number.isNaN(limit) && actual > limit) {
            pushConstraintViolation(instance, `Value ${actual} is greater than maximum ${limit}`, file, diagnostics, prop?.source);
        }
    }
    if (typeFqn.includes(".MinLength")) {
        const actual = prop ? getPropertyStringValue(prop) : undefined;
        if (actual !== undefined && !Number.isNaN(limit) && actual.length < limit) {
            pushConstraintViolation(instance, `String length ${actual.length} is less than minimum ${limit}`, file, diagnostics, prop?.source);
        }
    }
    if (typeFqn.includes(".MaxLength")) {
        const actual = prop ? getPropertyStringValue(prop) : undefined;
        if (actual !== undefined && !Number.isNaN(limit) && actual.length > limit) {
            pushConstraintViolation(instance, `String length ${actual.length} is greater than maximum ${limit}`, file, diagnostics, prop?.source);
        }
    }
    if (typeFqn.includes(".Pattern")) {
        const patternVal = instance.memberValues["pattern"] ?? instance.memberValues["value"];
        const pattern = patternVal && isLiteralValue(patternVal) ? String(patternVal.value) : undefined;
        const actual = prop ? getPropertyStringValue(prop) : undefined;
        if (pattern && actual !== undefined) {
            try {
                if (!new RegExp(pattern).test(actual)) {
                    pushConstraintViolation(instance, `Value does not match pattern ${pattern}`, file, diagnostics, prop?.source);
                }
            }
            catch {
                // invalid pattern — skip runtime evaluation
            }
        }
    }
    if (typeFqn.includes(".ValuePresent")) {
        if (prop && !hasAuthoredPropertyValue(prop)) {
            pushConstraintViolation(instance, `ValuePresent constraint violated on ${prop.name}`, file, diagnostics, prop?.source);
        }
    }
}
function evaluatePropertyConstraint(instance, prop, file, diagnostics) {
    if (!validationIsEnforced(instance) || !prop) {
        return;
    }
    if (instance.typeFqn.includes(".MustBeReadOnly") && !prop.readOnly) {
        pushConstraintViolation(instance, `Property ${prop.name} must be readOnly`, file, diagnostics, prop.source);
    }
}
function evaluateAggregationConstraint(instance, member, file, diagnostics) {
    if (!validationIsEnforced(instance) || member.kind !== "aggregation") {
        return;
    }
    const children = member.composition?.children.filter((c) => c.kind === "blockInstance") ?? [];
    const count = children.length;
    if (instance.typeFqn.includes(".MinItems")) {
        const minVal = instance.memberValues["value"];
        const min = minVal && isLiteralValue(minVal) && typeof minVal.value === "number"
            ? minVal.value
            : Number(minVal && isLiteralValue(minVal) ? minVal.value : NaN);
        if (!Number.isNaN(min) && count < min) {
            pushConstraintViolation(instance, `Aggregation ${member.name} has ${count} children, minimum is ${min}`, file, diagnostics, member.source);
        }
    }
    if (instance.typeFqn.includes(".MaxItems")) {
        const maxVal = instance.memberValues["value"];
        const max = maxVal && isLiteralValue(maxVal) && typeof maxVal.value === "number"
            ? maxVal.value
            : Number(maxVal && isLiteralValue(maxVal) ? maxVal.value : NaN);
        if (!Number.isNaN(max) && count > max) {
            pushConstraintViolation(instance, `Aggregation ${member.name} has ${count} children, maximum is ${max}`, file, diagnostics, member.source);
        }
    }
    if (instance.typeFqn.includes(".AllowedChildType")) {
        const allowed = constraintTypeArg(instance);
        if (allowed) {
            for (const child of children) {
                if (child.kind !== "blockInstance") {
                    continue;
                }
                const childType = child.instance.typeFqn;
                if (childType !== allowed && !childType.startsWith(`${allowed}.`)) {
                    pushConstraintViolation(instance, `Child type ${childType} is not allowed (expected ${allowed})`, file, diagnostics, child.instance.source);
                }
            }
        }
    }
}
function evaluateCapabilityConstraint(instance, member, file, diagnostics) {
    if (!validationIsEnforced(instance) || member.kind !== "capability") {
        return;
    }
    if (instance.typeFqn.includes(".RequiresImplementation")) {
        const impl = member.implementation?.source?.trim();
        if (!impl) {
            pushConstraintViolation(instance, `Capability ${member.name} requires implementation`, file, diagnostics, member.source);
        }
    }
}
function validateConstraintInstances(instances, context, file, diagnostics, block, registry, prop, member) {
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
        if (branch === "PropertyConstraint") {
            evaluatePropertyConstraint(inst, prop, file, diagnostics);
        }
        if (branch === "BlockConstraint" && block && registry) {
            evaluateBlockConstraint(inst, block, registry, file, diagnostics);
        }
        if (branch === "AggregationConstraint" && member) {
            evaluateAggregationConstraint(inst, member, file, diagnostics);
        }
        if (branch === "CapabilityConstraint" && member) {
            evaluateCapabilityConstraint(inst, member, file, diagnostics);
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
        const local = findLocalMember(block, member);
        if (member.kind === "property") {
            const prop = propertyForConstraintCheck(member, local?.kind === "property" ? local : undefined);
            for (const inst of member.constraints) {
                const branch = constraintBranch(inst.typeFqn);
                if (branch === "ValueConstraint") {
                    evaluateValueConstraint(inst, prop, file, diagnostics);
                }
                if (branch === "PropertyConstraint") {
                    evaluatePropertyConstraint(inst, prop, file, diagnostics);
                }
            }
        }
        if (member.kind === "aggregation") {
            const agg = local?.kind === "aggregation" ? local : member;
            for (const inst of member.constraints) {
                evaluateAggregationConstraint(inst, agg, file, diagnostics);
            }
        }
        if (member.kind === "capability") {
            const cap = local?.kind === "capability" ? local : member;
            for (const inst of member.constraints) {
                evaluateCapabilityConstraint(inst, cap, file, diagnostics);
            }
        }
    }
}
function validateMemberConstraints(member, file, diagnostics) {
    validateMemberConstraintPlacement(member, file, diagnostics);
    const context = member.kind === "property"
        ? "property"
        : member.kind === "aggregation"
            ? "aggregation"
            : member.kind === "association"
                ? "association"
                : "capability";
    const prop = member.kind === "property" ? member : undefined;
    validateConstraintInstances(member.constraints, context, file, diagnostics, undefined, undefined, prop, member);
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