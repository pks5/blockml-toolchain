import { resolveEffectiveMembers } from "../resolve/resolve-effective-members.js";
import { evaluateParseValue } from "./evaluate-parse-value.js";
import { namedTypeFqn, TYPE_REFERENCE } from "./reference-kinds.js";
function diag(code, message, file, loc) {
    const source = {
        file: loc?.file ?? file,
        line: loc?.line ?? 1,
        column: loc?.column ?? 1,
    };
    if (loc?.endLine !== undefined) {
        source.endLine = loc.endLine;
    }
    if (loc?.endColumn !== undefined) {
        source.endColumn = loc.endColumn;
    }
    return { severity: "error", code, message, source };
}
function isUnion(expr) {
    if (!expr) {
        return false;
    }
    if (expr.kind === "union") {
        return true;
    }
    if (expr.kind === "grouped") {
        return isUnion(expr.expression);
    }
    return false;
}
function hasMultiplicity(expr, fallbackFqn) {
    if (expr) {
        if (expr.kind === "named" || expr.kind === "grouped") {
            if (expr.multiplicity !== undefined) {
                return true;
            }
        }
    }
    return fallbackFqn?.includes("[") === true;
}
function rawFromUnknown(value) {
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return undefined;
}
function checkRaw(typeFqn, raw, ctx, loc) {
    const result = evaluateParseValue(typeFqn, raw, ctx.registry);
    if (!result.ok) {
        ctx.diagnostics.push(diag("BML_INVALID_VALUE", result.message, ctx.file, loc));
    }
}
function checkLiteral(val, type, typeFqn, ctx, loc) {
    if (!val || val.kind !== "literal") {
        return;
    }
    if (isUnion(type) || type?.kind === "anonymousStruct") {
        return;
    }
    const named = namedTypeFqn(type, typeFqn);
    if (!named) {
        return;
    }
    const list = hasMultiplicity(type, typeFqn);
    if (list) {
        if (Array.isArray(val.value)) {
            for (const item of val.value) {
                const raw = rawFromUnknown(item);
                if (raw !== undefined) {
                    checkRaw(named, raw, ctx, loc);
                }
            }
        }
        return;
    }
    const raw = rawFromUnknown(val.value);
    if (raw !== undefined) {
        checkRaw(named, raw, ctx, loc);
    }
}
function checkTreValue(inst, ctx, loc) {
    checkRaw(TYPE_REFERENCE, inst.value, ctx, loc);
}
function checkMember(member, ctx) {
    const loc = member.typeSource ?? member.source;
    if (member.kind === "property") {
        checkLiteral(member.value, member.type, member.typeFqn, ctx, loc);
        for (const entry of member.values ?? []) {
            // Prefixed values (scad:value, …) are target-language facets, not BML
            // literals — skip parseValue against the property type. TODO: a matching
            // prefixed type (scad:type for scad:value) so each facet can be validated
            // in its own language. Today prefixed values are not validated.
            if (entry.namespace) {
                continue;
            }
            if (member.value) {
                continue;
            }
            checkLiteral(entry.value, member.type, member.typeFqn, ctx, loc);
        }
        for (const suggestion of member.suggestions ?? []) {
            walkInstance(suggestion, ctx);
        }
        for (const group of member.groups ?? []) {
            checkTreValue(group, ctx, loc);
        }
    }
    else if (member.kind === "aggregation") {
        for (const group of member.groups ?? []) {
            checkTreValue(group, ctx, loc);
        }
    }
    else if (member.kind === "capability") {
        for (const thrown of member.throws ?? []) {
            checkTreValue(thrown, ctx, loc);
        }
    }
    for (const instance of member.constraints ?? []) {
        walkInstance(instance, ctx);
    }
}
function walkInstance(instance, ctx) {
    const typeBlock = ctx.registry.get(instance.typeFqn)?.block;
    const members = typeBlock ? resolveEffectiveMembers(typeBlock, ctx.registry) : [];
    for (const [name, val] of Object.entries(instance.memberValues)) {
        const member = members.find((m) => m.name === name);
        if (!member) {
            continue;
        }
        const type = member.kind === "property" || member.kind === "aggregation" || member.kind === "association"
            ? member.type
            : undefined;
        const typeFqn = member.kind === "property" || member.kind === "capability" ? member.typeFqn : undefined;
        checkLiteral(val, type, typeFqn, ctx, instance.source);
    }
    for (const agg of instance.aggregationCompositions ?? []) {
        walkCompositionNodes(agg.composition.children, ctx);
    }
}
function walkCompositionNodes(nodes, ctx) {
    for (const child of nodes) {
        if (child.kind === "blockInstance") {
            walkInstance(child.instance, ctx);
        }
        else {
            walkCompositionNodes(child.children, ctx);
        }
    }
}
function walkBlockDefinition(block, ctx) {
    for (const ref of block.contracts ?? []) {
        checkTreValue(ref, ctx, block.source);
    }
    if (block.language) {
        checkTreValue(block.language, ctx, block.source);
    }
    for (const instance of block.constraints ?? []) {
        walkInstance(instance, ctx);
    }
    for (const member of block.members) {
        checkMember(member, ctx);
    }
    for (const template of block.compositions) {
        walkCompositionNodes(template.children, ctx);
    }
    for (const sub of block.subBlocks) {
        walkBlockDefinition(sub, ctx);
    }
    for (const embedded of block.embeddedBlocks) {
        walkBlockDefinition(embedded, ctx);
    }
}
export function validateParseValues(document, registry) {
    const diagnostics = [];
    const file = document.source.filePath ?? "<memory>";
    walkBlockDefinition(document.block, { registry, file, diagnostics });
    return diagnostics;
}
//# sourceMappingURL=validate-parse-values.js.map