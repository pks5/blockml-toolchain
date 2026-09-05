import { isBooleanLiteral, normalizeBooleanValue } from "../util/boolean.js";
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
function parseJsonLike(raw) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
            const normalized = trimmed
                .replace(/([{,]\s*)([a-zA-Z_][\w+\-]*)\s*:/g, '$1"$2":')
                .replace(/'/g, '"');
            return JSON.parse(normalized);
        }
        catch {
            return trimmed;
        }
    }
    return trimmed;
}
function literal(value, typeFqn, placement) {
    const lit = { kind: "literal", value, typeFqn };
    if (placement) {
        lit.authoredPlacement = placement;
    }
    return lit;
}
export function parseMemberValue(raw, typeFqn, file, line = 1, column = 1, placement, ctx) {
    if (raw === undefined) {
        return undefined;
    }
    const trimmed = raw.trim();
    if (trimmed.startsWith("${") && trimmed.endsWith("}")) {
        const expr = {
            kind: "expression",
            raw: trimmed.slice(2, -1).trim(),
            source: { file, line, column },
        };
        if (placement) {
            expr.authoredPlacement = placement;
        }
        return expr;
    }
    const looksLikeJson = trimmed.startsWith("[") || trimmed.startsWith("{");
    if (!looksLikeJson && containsUnescapedInterpolation(raw)) {
        const interpolated = {
            kind: "interpolated",
            raw,
            source: { file, line, column },
        };
        if (placement) {
            interpolated.authoredPlacement = placement;
        }
        return interpolated;
    }
    if (looksLikeJson) {
        return literal(parseJsonLike(trimmed), typeFqn, placement);
    }
    if (ctx?.parseValue) {
        const result = ctx.parseValue(typeFqn, trimmed);
        if (!result.ok) {
            ctx.diagnostics.push({
                severity: "error",
                code: "BML_INVALID_VALUE",
                message: result.message,
                source: { file, line, column },
            });
            return literal(trimmed, typeFqn, placement);
        }
        if ("value" in result) {
            return literal(result.value, typeFqn, placement);
        }
        return literal(trimmed, typeFqn, placement);
    }
    if (isBooleanLiteral(trimmed)) {
        return literal(normalizeBooleanValue(trimmed), typeFqn, placement);
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        return literal(Number(trimmed), typeFqn, placement);
    }
    return literal(parseJsonLike(trimmed), typeFqn, placement);
}
export function expressionFromRaw(raw, loc) {
    const inner = raw.startsWith("${") ? raw.slice(2, -1).trim() : raw.trim();
    return { kind: "expression", raw: inner, source: loc };
}
//# sourceMappingURL=member-value.js.map