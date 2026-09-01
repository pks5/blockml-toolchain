import { parseExpression } from "../expression/parse-expression.js";
import { memberIdentityKey, resolveEffectiveMembers, } from "../resolve/resolve-effective-members.js";
import { satisfiesTypeBound } from "../resolve/satisfies-type-bound.js";
import { isWellKnownTypeFqn } from "@blockml/parser";
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
function typeIsKnown(fqn, registry) {
    return registry.has(fqn) || isWellKnownTypeFqn(fqn);
}
const CORE_EXCEPTION = "org.blockml.bml.core.Exception";
function walkNamedTypes(expr, visit) {
    if (!expr) {
        return;
    }
    switch (expr.kind) {
        case "named":
            visit(expr.fqn);
            for (const arg of expr.typeArguments ?? []) {
                walkNamedTypes(arg, visit);
            }
            break;
        case "union":
            for (const alt of expr.alternatives) {
                walkNamedTypes(alt, visit);
            }
            break;
        case "grouped":
            walkNamedTypes(expr.expression, visit);
            break;
        case "anonymousStruct":
            for (const field of expr.fields) {
                walkNamedTypes(field.type, visit);
            }
            break;
        default:
            break;
    }
}
function validateMemberTypes(member, registry, file, diagnostics) {
    const loc = member.typeSource ?? member.source;
    const report = (fqn) => {
        if (!typeIsKnown(fqn, registry)) {
            diagnostics.push(diag("BML_UNKNOWN_TYPE", `Unknown type: ${fqn}`, file, loc));
        }
    };
    if (member.kind === "property") {
        if (member.type) {
            walkNamedTypes(member.type, report);
        }
        else if (member.typeFqn) {
            report(member.typeFqn);
        }
    }
    else if (member.kind === "aggregation" || member.kind === "association") {
        walkNamedTypes(member.type, report);
    }
    else if (member.kind === "capability") {
        if (member.typeFqn) {
            report(member.typeFqn);
        }
        walkNamedTypes(member.inputType, (fqn) => {
            if (!typeIsKnown(fqn, registry)) {
                diagnostics.push(diag("BML_UNKNOWN_TYPE", `Unknown type: ${fqn}`, file, member.inputTypeSource ?? loc));
            }
        });
        walkNamedTypes(member.outputType, (fqn) => {
            if (!typeIsKnown(fqn, registry)) {
                diagnostics.push(diag("BML_UNKNOWN_TYPE", `Unknown type: ${fqn}`, file, member.outputTypeSource ?? loc));
            }
        });
        for (const thrown of member.throws ?? []) {
            const fqn = thrown.value;
            if (!typeIsKnown(fqn, registry)) {
                diagnostics.push(diag("BML_UNKNOWN_TYPE", `Unknown type: ${fqn}`, file, loc));
                continue;
            }
            if (!satisfiesTypeBound(fqn, CORE_EXCEPTION, registry)) {
                diagnostics.push(diag("BML_TYPE_BOUND_NOT_SATISFIED", `Type ${fqn} does not satisfy bound ${CORE_EXCEPTION}`, file, loc));
            }
        }
    }
}
function literalNumber(val) {
    if (!val || val.kind !== "literal") {
        return undefined;
    }
    return typeof val.value === "number" ? val.value : undefined;
}
function validateBlockDefinition(block, registry, file, diagnostics) {
    if (block.baseType && !registry.has(block.baseType)) {
        diagnostics.push(diag("BML_UNKNOWN_BASE_TYPE", `Unknown baseType: ${block.baseType}`, file, block.baseTypeSource ?? block.source));
    }
    for (const ref of block.contracts ?? []) {
        if (!registry.has(ref.value)) {
            diagnostics.push(diag("BML_UNKNOWN_CONTRACT", `Unknown contract: ${ref.value}`, file, block.source));
        }
    }
    const effective = resolveEffectiveMembers(block, registry);
    const seen = new Set();
    for (const member of effective) {
        const key = memberIdentityKey(member);
        if (seen.has(key)) {
            diagnostics.push(diag("BML_MEMBER_COLLISION", `Duplicate effective member identity: ${key}`, file, member.source));
        }
        seen.add(key);
    }
    for (const member of block.members) {
        validateMemberTypes(member, registry, file, diagnostics);
        const skipOverrideCheck = member.kind === "aggregation" &&
            (member.composition !== undefined || member.default === true);
        if (member.override) {
            const parentBlock = block.baseType ? registry.get(block.baseType)?.block : undefined;
            const parentMembers = parentBlock
                ? resolveEffectiveMembers(parentBlock, registry)
                : [];
            const hasParent = parentMembers.some((m) => memberIdentityKey(m) === memberIdentityKey(member) && m.kind === member.kind);
            if (block.baseType && registry.has(block.baseType) && !hasParent) {
                diagnostics.push(diag("BML_OVERRIDE_WITHOUT_PARENT", `override without parent member: ${member.name}`, file, member.source));
            }
        }
        else if (block.baseType && registry.has(block.baseType) && !skipOverrideCheck) {
            const parentBlock = registry.get(block.baseType)?.block;
            const parentDirect = parentBlock?.members ?? [];
            const hasParent = parentDirect.some((m) => memberIdentityKey(m) === memberIdentityKey(member) && m.kind === member.kind);
            if (hasParent && !member.override) {
                diagnostics.push(diag("BML_OVERRIDE_REQUIRED", `override required for redeclared member: ${member.name}`, file, member.source));
            }
        }
        if (member.kind === "property") {
            validatePropertyExpressions(member, file, diagnostics);
        }
    }
    for (const sub of block.subBlocks) {
        validateBlockDefinition(sub, registry, file, diagnostics);
    }
}
function validatePropertyExpressions(prop, file, diagnostics) {
    const checkVal = (val, label) => {
        if (!val || val.kind !== "expression") {
            return;
        }
        const expr = val;
        const parsed = parseExpression(expr.raw);
        if (!parsed.ok) {
            diagnostics.push(diag("BML_EXPRESSION_PARSE_ERROR", `${label}: ${parsed.error.message}`, file, expr.source));
        }
    };
    checkVal(prop.value, prop.name);
    for (const entry of prop.values ?? []) {
        checkVal(entry.value, prop.name);
    }
}
function validateInstanceExpressions(instance, file, diagnostics) {
    for (const [name, val] of Object.entries(instance.memberValues)) {
        if (val.kind === "expression") {
            const parsed = parseExpression(val.raw);
            if (!parsed.ok) {
                diagnostics.push(diag("BML_EXPRESSION_PARSE_ERROR", `${name}: ${parsed.error.message}`, file, val.source));
            }
        }
    }
}
function walkCompositions(block, file, diagnostics) {
    for (const template of block.compositions) {
        for (const child of template.children) {
            if (child.kind === "blockInstance") {
                validateInstanceExpressions(child.instance, file, diagnostics);
            }
            else {
                for (const nested of child.children) {
                    if (nested.kind === "blockInstance") {
                        validateInstanceExpressions(nested.instance, file, diagnostics);
                    }
                }
            }
        }
    }
}
export function validateTypes(document, registry) {
    const diagnostics = [];
    const file = document.source.filePath ?? "<memory>";
    if (document.block.type && !registry.has(document.block.type)) {
        registry.register(document);
    }
    validateBlockDefinition(document.block, registry, file, diagnostics);
    walkCompositions(document.block, file, diagnostics);
    return diagnostics;
}
export function getLiteralNumericValue(val) {
    return literalNumber(val);
}
export function getPropertyNumericValue(prop) {
    const fromValue = literalNumber(prop.value);
    if (fromValue !== undefined) {
        return fromValue;
    }
    for (const entry of prop.values ?? []) {
        const n = literalNumber(entry.value);
        if (n !== undefined) {
            return n;
        }
    }
    return undefined;
}
export function isLiteralValue(val) {
    return val?.kind === "literal";
}
//# sourceMappingURL=validate-types.js.map