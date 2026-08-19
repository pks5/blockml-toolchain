import { resolveTypeName, splitQName, } from "../util/qname.js";
function parseMultiplicity(input) {
    const arrayMatch = input.match(/^(.+?)\[\s*(\d+)\s*\.\.\s*(\d+|n|\*)\s*\]\s*$/);
    if (arrayMatch) {
        const expr = arrayMatch[1].trim();
        const min = Number(arrayMatch[2]);
        const maxRaw = arrayMatch[3];
        const max = maxRaw === "n" || maxRaw === "*" ? "*" : Number(maxRaw);
        return { expr, multiplicity: { min, max } };
    }
    if (input.endsWith("[]")) {
        return {
            expr: input.slice(0, -2).trim(),
            multiplicity: { min: 0, max: "*" },
        };
    }
    const fixedMatch = input.match(/^(.+?)\[\s*(\d+)\s*\]\s*$/);
    if (fixedMatch) {
        const n = Number(fixedMatch[2]);
        return {
            expr: fixedMatch[1].trim(),
            multiplicity: { min: n, max: n },
        };
    }
    return { expr: input.trim() };
}
function parseInstanceConfig(input, ctx) {
    const braceIdx = input.indexOf("{");
    if (braceIdx === -1) {
        return { base: input.trim() };
    }
    const base = input.slice(0, braceIdx).trim();
    const configText = input.slice(braceIdx).trim();
    const inner = configText.slice(1, -1).trim();
    const config = {};
    if (!inner) {
        return { base, config };
    }
    if (/^[\d\s",\-+.]+$/.test(inner) || /^[^:]/.test(inner.split(",")[0] ?? "")) {
        const positional = inner.split(",").map((part) => ({
            kind: "literal",
            value: parseLiteralToken(part.trim(), ctx),
            typeFqn: "unknown",
        }));
        config.positional = positional;
        return { base, config };
    }
    const named = {};
    const parts = splitTopLevel(inner, ",");
    for (const part of parts) {
        const colon = part.indexOf(":");
        if (colon === -1) {
            continue;
        }
        const key = part.slice(0, colon).trim();
        const valText = part.slice(colon + 1).trim();
        named[key] = parseLiteralValue(valText, ctx);
    }
    config.named = named;
    return { base, config };
}
function splitTopLevel(input, sep) {
    const parts = [];
    let depth = 0;
    let current = "";
    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "{" || ch === "[" || ch === "(") {
            depth++;
        }
        else if (ch === "}" || ch === "]" || ch === ")") {
            depth--;
        }
        if (ch === sep && depth === 0) {
            parts.push(current.trim());
            current = "";
            continue;
        }
        current += ch;
    }
    if (current.trim()) {
        parts.push(current.trim());
    }
    return parts;
}
function parseLiteralToken(token, ctx) {
    if (token.startsWith('"') || token.startsWith("'")) {
        return token.slice(1, -1);
    }
    if (token === "true" || token === "false") {
        return token === "true";
    }
    if (/^-?\d+(\.\d+)?$/.test(token)) {
        return Number(token);
    }
    try {
        return resolveTypeName(token, ctx.bindings, ctx.implicit);
    }
    catch {
        return token;
    }
}
function parseLiteralValue(text, ctx) {
    if (text.startsWith("${") && text.endsWith("}")) {
        return {
            kind: "expression",
            raw: text.slice(2, -1).trim(),
        };
    }
    return {
        kind: "literal",
        value: parseLiteralToken(text, ctx),
        typeFqn: "unknown",
    };
}
function parseAnonymousStruct(input, ctx) {
    const inner = input.slice(1, -1).trim();
    const fields = [];
    const parts = splitTopLevel(inner, ",");
    for (const part of parts) {
        const colon = part.indexOf(":");
        if (colon === -1) {
            continue;
        }
        const name = part.slice(0, colon).trim();
        const typeText = part.slice(colon + 1).trim();
        fields.push({ name, type: parseTypeExpressionInternal(typeText, ctx) });
    }
    return { kind: "anonymousStruct", fields };
}
function parseGenericApplication(base, argsText, ctx) {
    const args = splitTopLevel(argsText, ",");
    return {
        kind: "named",
        fqn: resolveTypeName(base, ctx.bindings, ctx.implicit),
        typeArguments: args.map((a) => parseTypeExpressionInternal(a.trim(), ctx)),
    };
}
function parseTypeExpressionInternal(raw, ctx) {
    const input = raw.trim();
    if (!input) {
        throw new Error("BML_UNKNOWN_TYPE: empty");
    }
    if (/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(input)) {
        const named = { kind: "named", fqn: input };
        return named;
    }
    if (input === "bml:Self") {
        return { kind: "self" };
    }
    if (input.startsWith("{") && input.endsWith("}")) {
        return parseAnonymousStruct(input, ctx);
    }
    if (input.includes("|")) {
        const alts = splitTopLevel(input, "|");
        return {
            kind: "union",
            alternatives: alts.map((a) => parseTypeExpressionInternal(a.trim(), ctx)),
        };
    }
    const { expr, multiplicity } = parseMultiplicity(input);
    const { base, config } = parseInstanceConfig(expr, ctx);
    const genericMatch = base.match(/^(.+?)\((.+)\)$/);
    if (genericMatch) {
        const ref = parseGenericApplication(genericMatch[1].trim(), genericMatch[2].trim(), ctx);
        if (multiplicity) {
            ref.multiplicity = multiplicity;
        }
        if (config) {
            ref.instanceConfiguration = config;
        }
        return ref;
    }
    if (/^[A-Z]$/.test(base) || /^[A-Z][a-zA-Z0-9]*$/.test(base) && !base.includes(".")) {
        const { prefix } = splitQName(base);
        if (!prefix && base.length <= 2) {
            return { kind: "genericParam", name: base };
        }
    }
    const named = {
        kind: "named",
        fqn: resolveTypeName(base, ctx.bindings, ctx.implicit),
    };
    if (multiplicity) {
        named.multiplicity = multiplicity;
    }
    if (config) {
        named.instanceConfiguration = config;
    }
    return named;
}
export function parseTypeExpression(raw, bindings, implicit = "type") {
    return parseTypeExpressionInternal(raw, { bindings, implicit });
}
export function inferCardinality(type) {
    if (!type) {
        return undefined;
    }
    if (type.kind === "named" && type.multiplicity) {
        const { min, max } = type.multiplicity;
        if (min === 0 && max === "*") {
            return "0..n";
        }
        if (min === 1 && max === 1) {
            return "1..1";
        }
        if (min === 0 && max === 1) {
            return "0..1";
        }
        if (min === 1 && max === "*") {
            return "1..n";
        }
    }
    if (type.kind === "named" && type.fqn.endsWith("[]")) {
        return "0..n";
    }
    return undefined;
}
export function typeExpressionToString(type) {
    switch (type.kind) {
        case "self":
            return "bml:Self";
        case "genericParam":
            return type.name;
        case "anonymousStruct":
            return `{ ${type.fields.map((f) => `${f.name}: ${typeExpressionToString(f.type)}`).join(", ")} }`;
        case "union":
            return type.alternatives.map(typeExpressionToString).join(" | ");
        case "named": {
            let s = type.fqn;
            if (type.typeArguments?.length) {
                s = `${s}(${type.typeArguments.map(typeExpressionToString).join(", ")})`;
            }
            if (type.instanceConfiguration?.named) {
                const pairs = Object.entries(type.instanceConfiguration.named).map(([k, v]) => `${k}: ${memberValueToConfig(v)}`);
                s += `{${pairs.join(", ")}}`;
            }
            else if (type.instanceConfiguration?.positional?.length) {
                s += `{${type.instanceConfiguration.positional.map(memberValueToConfig).join(", ")}}`;
            }
            if (type.multiplicity) {
                const { min, max } = type.multiplicity;
                if (min === 0 && max === "*") {
                    s += "[]";
                }
                else if (min === max) {
                    s += `[${min}]`;
                }
                else {
                    s += `[${min}..${max}]`;
                }
            }
            return s;
        }
    }
}
function memberValueToConfig(v) {
    if (v.kind === "expression") {
        return `\${ ${v.raw} }`;
    }
    if (typeof v.value === "string") {
        return `"${v.value}"`;
    }
    return String(v.value);
}
//# sourceMappingURL=type-expression.js.map