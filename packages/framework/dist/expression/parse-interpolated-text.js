import { parseExpression } from "./parse-expression.js";
import { holeLooksLikeModelBinding, INTERPOLATION_NOT_ALLOWED, restrictedExpressionError, } from "./restricted.js";
function findMatchingBrace(input, start) {
    let depth = 1;
    let quote = null;
    for (let i = start; i < input.length; i++) {
        const ch = input[i];
        if (quote) {
            if (ch === "\\" && i + 1 < input.length) {
                i++;
                continue;
            }
            if (ch === quote) {
                quote = null;
            }
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === "{") {
            depth++;
        }
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}
export function parseInterpolatedText(raw) {
    const parts = [];
    let i = 0;
    let literal = "";
    while (i < raw.length) {
        if (raw[i] === "\\" && raw.slice(i, i + 3) === "\\${") {
            literal += "${";
            i += 3;
            continue;
        }
        if (raw[i] === "$" && raw[i + 1] === "{") {
            if (literal) {
                parts.push({ kind: "literal", value: literal });
                literal = "";
            }
            const end = findMatchingBrace(raw, i + 2);
            if (end < 0) {
                return { ok: false, error: { message: "Unclosed interpolation", offset: i } };
            }
            const hole = raw.slice(i + 2, end);
            if (holeLooksLikeModelBinding(hole)) {
                return {
                    ok: false,
                    error: { message: INTERPOLATION_NOT_ALLOWED, offset: i },
                };
            }
            const parsed = parseExpression(hole);
            if (!parsed.ok) {
                return parsed;
            }
            const restricted = restrictedExpressionError(parsed.result.ast);
            if (restricted) {
                return { ok: false, error: { message: restricted, offset: i } };
            }
            parts.push(parsed.result.ast);
            i = end + 1;
            continue;
        }
        literal += raw[i];
        i++;
    }
    if (literal) {
        parts.push({ kind: "literal", value: literal });
    }
    return { ok: true, result: { ast: { kind: "interpolated", parts } } };
}
//# sourceMappingURL=parse-interpolated-text.js.map