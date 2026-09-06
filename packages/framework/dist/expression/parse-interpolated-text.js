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
function countBackslashes(raw, start) {
    let n = 0;
    while (start + n < raw.length && raw[start + n] === "\\") {
        n++;
    }
    return n;
}
export function parseInterpolatedText(raw) {
    const parts = [];
    let i = 0;
    let literal = "";
    const flushLiteral = () => {
        if (literal) {
            parts.push({ kind: "literal", value: literal });
            literal = "";
        }
    };
    const takeHole = (at) => {
        flushLiteral();
        const end = findMatchingBrace(raw, at + 2);
        if (end < 0) {
            return { ok: false, error: { message: "Unclosed interpolation", offset: at } };
        }
        const hole = raw.slice(at + 2, end);
        if (holeLooksLikeModelBinding(hole)) {
            return {
                ok: false,
                error: { message: INTERPOLATION_NOT_ALLOWED, offset: at },
            };
        }
        const parsed = parseExpression(hole);
        if (!parsed.ok) {
            return parsed;
        }
        const restricted = restrictedExpressionError(parsed.result.ast);
        if (restricted) {
            return { ok: false, error: { message: restricted, offset: at } };
        }
        parts.push(parsed.result.ast);
        return end + 1;
    };
    while (i < raw.length) {
        if (raw[i] === "\\") {
            const n = countBackslashes(raw, i);
            if (raw[i + n] === "$" && raw[i + n + 1] === "{") {
                literal += "\\".repeat(Math.floor(n / 2));
                if (n % 2 === 1) {
                    literal += "${";
                    i += n + 2;
                    continue;
                }
                const next = takeHole(i + n);
                if (typeof next !== "number") {
                    return next;
                }
                i = next;
                continue;
            }
            literal += raw.slice(i, i + n);
            i += n;
            continue;
        }
        if (raw[i] === "$" && raw[i + 1] === "{") {
            const next = takeHole(i);
            if (typeof next !== "number") {
                return next;
            }
            i = next;
            continue;
        }
        literal += raw[i];
        i++;
    }
    flushLiteral();
    return { ok: true, result: { ast: { kind: "interpolated", parts } } };
}
//# sourceMappingURL=parse-interpolated-text.js.map