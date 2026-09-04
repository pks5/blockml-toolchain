import { evaluateExpression, evaluateInterpolatedText, ExpressionEvaluationError, parseExpression, } from "@blockml/framework";
import { BOOLEAN_TYPE_FQN, INTEGER_TYPE_FQN, TEXT_TYPE_FQN, } from "./constants.js";
export function containsUnescapedInterpolation(raw) {
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
function evaluateExpressionRaw(raw, scope) {
    const parsed = parseExpression(raw);
    if (!parsed.ok) {
        throw new ExpressionEvaluationError("BML_EXPRESSION_PARSE_ERROR", parsed.error.message);
    }
    return evaluateExpression(parsed.result.ast, scope);
}
function closeStringLeaf(raw, scope) {
    if (!containsUnescapedInterpolation(raw)) {
        return raw;
    }
    return evaluateInterpolatedText(raw, scope);
}
export function resolveMemberText(value, scope) {
    if (!value) {
        return undefined;
    }
    if (value.kind === "interpolated") {
        return evaluateInterpolatedText(value.raw, scope);
    }
    if (value.kind === "expression") {
        const resolved = evaluateExpressionRaw(value.raw, scope);
        return resolved === undefined || resolved === null ? "" : String(resolved);
    }
    if (value.kind === "literal" && typeof value.value === "string") {
        return closeStringLeaf(value.value, scope);
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
    if (value.kind === "expression") {
        const resolved = evaluateExpressionRaw(value.raw, scope);
        if (Array.isArray(resolved) && resolved.every((item) => typeof item === "string")) {
            return resolved;
        }
        const text = resolved === undefined || resolved === null ? "" : String(resolved);
        return text === "" ? [] : [text];
    }
    if (value.kind !== "literal") {
        return undefined;
    }
    if (typeof value.value === "string") {
        const item = closeStringLeaf(value.value, scope);
        return item === "" ? [] : [item];
    }
    if (Array.isArray(value.value) && value.value.every((item) => typeof item === "string")) {
        return value.value.map((item) => closeStringLeaf(item, scope));
    }
    return undefined;
}
function literalTypeFqn(value, fallback) {
    if (fallback) {
        return fallback;
    }
    if (typeof value === "boolean") {
        return BOOLEAN_TYPE_FQN;
    }
    if (typeof value === "number" && Number.isInteger(value)) {
        return INTEGER_TYPE_FQN;
    }
    return TEXT_TYPE_FQN;
}
function assertClosedLiteral(value) {
    if (typeof value === "string" && containsUnescapedInterpolation(value)) {
        throw new ExpressionEvaluationError("BML_EXPR_UNCLOSED", "Closed Task still contains an interpolated string");
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            assertClosedLiteral(item);
        }
        return;
    }
    if (typeof value === "object" && value !== null) {
        for (const item of Object.values(value)) {
            assertClosedLiteral(item);
        }
    }
}
export function closeMemberValue(value, scope) {
    if (value.kind === "address") {
        if (value.address.isExpression) {
            throw new ExpressionEvaluationError("BML_EXPR_UNCLOSED", `Address still contains an expression: ${value.address.raw}`);
        }
        return value;
    }
    let resolved;
    let typeFqn = TEXT_TYPE_FQN;
    if (value.kind === "interpolated") {
        resolved = evaluateInterpolatedText(value.raw, scope);
    }
    else if (value.kind === "expression") {
        resolved = evaluateExpressionRaw(value.raw, scope);
        typeFqn = literalTypeFqn(resolved);
    }
    else {
        typeFqn = value.typeFqn;
        if (typeof value.value === "string") {
            resolved = closeStringLeaf(value.value, scope);
        }
        else if (Array.isArray(value.value) &&
            value.value.every((item) => typeof item === "string")) {
            resolved = value.value.map((item) => closeStringLeaf(item, scope));
        }
        else {
            resolved = value.value;
        }
    }
    assertClosedLiteral(resolved);
    const closed = {
        kind: "literal",
        value: resolved,
        typeFqn,
    };
    if ("authoredPlacement" in value && value.authoredPlacement) {
        closed.authoredPlacement = value.authoredPlacement;
    }
    return closed;
}
//# sourceMappingURL=interpolate.js.map