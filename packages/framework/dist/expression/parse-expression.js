function skipWs(input, i) {
    while (i < input.length && /\s/.test(input[i])) {
        i++;
    }
    return i;
}
function parseIdentifier(input, i) {
    i = skipWs(input, i);
    const start = i;
    if (!/[@#A-Za-z_]/.test(input[i] ?? "")) {
        return null;
    }
    i++;
    while (i < input.length && /[@#A-Za-z0-9_.]/.test(input[i])) {
        i++;
    }
    return { id: input.slice(start, i), next: i };
}
function parsePrimary(input, i) {
    i = skipWs(input, i);
    if (input[i] === "[") {
        i++;
        const elements = [];
        i = skipWs(input, i);
        if (input[i] === "]") {
            return { node: { kind: "array", elements }, next: i + 1 };
        }
        while (i < input.length) {
            const el = parseExpressionInternal(input, i);
            elements.push(el.node);
            i = skipWs(input, el.next);
            if (input[i] === "]") {
                return { node: { kind: "array", elements }, next: i + 1 };
            }
            if (input[i] !== ",") {
                throw new Error(`Expected ',' or ']' at ${i}`);
            }
            i++;
        }
        throw new Error("Unclosed array");
    }
    if (input[i] === "{") {
        i++;
        const entries = {};
        i = skipWs(input, i);
        if (input[i] === "}") {
            return { node: { kind: "object", entries }, next: i + 1 };
        }
        while (i < input.length) {
            const keyMatch = parseIdentifier(input, i);
            if (!keyMatch) {
                throw new Error(`Expected object key at ${i}`);
            }
            i = skipWs(input, keyMatch.next);
            if (input[i] !== ":") {
                throw new Error(`Expected ':' at ${i}`);
            }
            i++;
            const val = parseExpressionInternal(input, i);
            entries[keyMatch.id] = val.node;
            i = skipWs(input, val.next);
            if (input[i] === "}") {
                return { node: { kind: "object", entries }, next: i + 1 };
            }
            if (input[i] !== ",") {
                throw new Error(`Expected ',' or '}' at ${i}`);
            }
            i++;
        }
        throw new Error("Unclosed object");
    }
    if (input[i] === "(") {
        i++;
        const inner = parseExpressionInternal(input, i);
        i = skipWs(input, inner.next);
        if (input[i] !== ")") {
            throw new Error(`Expected ')' at ${i}`);
        }
        return { node: inner.node, next: i + 1 };
    }
    if (input[i] === '"' || input[i] === "'") {
        const q = input[i];
        i++;
        let s = "";
        while (i < input.length && input[i] !== q) {
            s += input[i];
            i++;
        }
        if (input[i] !== q) {
            throw new Error("Unclosed string");
        }
        return { node: { kind: "literal", value: s }, next: i + 1 };
    }
    if (input.slice(i, i + 4) === "true") {
        return { node: { kind: "literal", value: true }, next: i + 4 };
    }
    if (input.slice(i, i + 5) === "false") {
        return { node: { kind: "literal", value: false }, next: i + 5 };
    }
    const numMatch = input.slice(i).match(/^-?\d+(?:\.\d+)?/);
    if (numMatch) {
        const raw = numMatch[0];
        const value = raw.includes(".") ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
        return { node: { kind: "literal", value }, next: i + raw.length };
    }
    const id = parseIdentifier(input, i);
    if (!id) {
        throw new Error(`Unexpected token at ${i}`);
    }
    i = id.next;
    if (input[i] === "(") {
        i++;
        const args = [];
        i = skipWs(input, i);
        if (input[i] === ")") {
            return { node: { kind: "call", callee: id.id, args }, next: i + 1 };
        }
        while (i < input.length) {
            const arg = parseExpressionInternal(input, i);
            args.push(arg.node);
            i = skipWs(input, arg.next);
            if (input[i] === ")") {
                return { node: { kind: "call", callee: id.id, args }, next: i + 1 };
            }
            if (input[i] !== ",") {
                throw new Error(`Expected ',' or ')' at ${i}`);
            }
            i++;
        }
        throw new Error("Unclosed call");
    }
    const path = [id.id];
    while (input[i] === ".") {
        i++;
        const seg = parseIdentifier(input, i);
        if (!seg) {
            throw new Error(`Expected property after '.' at ${i}`);
        }
        path.push(seg.id);
        i = seg.next;
    }
    return { node: { kind: "property", path }, next: i };
}
function parseMultiplicative(input, i) {
    let { node, next } = parsePrimary(input, i);
    i = skipWs(input, next);
    while (input[i] === "*" || input[i] === "/") {
        const op = input[i];
        i++;
        const right = parsePrimary(input, i);
        node = { kind: "binary", operator: op, left: node, right: right.node };
        i = skipWs(input, right.next);
    }
    return { node, next: i };
}
function parseAdditive(input, i) {
    let { node, next } = parseMultiplicative(input, i);
    i = skipWs(input, next);
    while (input[i] === "+" || input[i] === "-") {
        const op = input[i];
        i++;
        const right = parseMultiplicative(input, i);
        node = { kind: "binary", operator: op, left: node, right: right.node };
        i = skipWs(input, right.next);
    }
    return { node, next: i };
}
function parseExpressionInternal(input, i) {
    return parseAdditive(input, i);
}
export function parseExpression(raw) {
    const trimmed = raw.trim();
    if (!trimmed) {
        return {
            ok: false,
            error: { message: "Empty expression; write \\${ } for literal delimiters", offset: 0 },
        };
    }
    try {
        const { node, next } = parseExpressionInternal(trimmed, 0);
        const rest = trimmed.slice(skipWs(trimmed, next));
        if (rest.length > 0) {
            return { ok: false, error: { message: `Unexpected trailing input: ${rest}`, offset: next } };
        }
        const result = { ast: node };
        return { ok: true, result };
    }
    catch (e) {
        return {
            ok: false,
            error: { message: e instanceof Error ? e.message : String(e), offset: 0 },
        };
    }
}
//# sourceMappingURL=parse-expression.js.map