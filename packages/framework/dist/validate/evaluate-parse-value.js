import { parseTypeExpression } from "@blockml/parser";
import { resolveEffectiveMembers } from "../resolve/resolve-effective-members.js";
import { namedTypeFqn } from "./reference-kinds.js";
const TYPESCRIPT_FQN = "org.blockml.bml.language.TypeScript";
const PARSE_VALUE = "parseValue";
const compiledBodies = new Map();
const skipped = { ok: true, skipped: true };
function hasTopLevelUnion(input) {
    let depth = 0;
    for (const ch of input) {
        if (ch === "(" || ch === "[" || ch === "{") {
            depth += 1;
        }
        else if (ch === ")" || ch === "]" || ch === "}") {
            depth -= 1;
        }
        else if (ch === "|" && depth === 0) {
            return true;
        }
    }
    return false;
}
function stripDecorators(typeFqn) {
    let s = typeFqn.trim();
    while (true) {
        const next = s
            .replace(/\[\s*(?:\d+(?:\s*\.\.\s*(?:\d+|n|\*))?)?\s*\]$/, "")
            .replace(/\[\]$/, "")
            .trim();
        if (next === s) {
            break;
        }
        s = next;
    }
    if (s.endsWith("}")) {
        let depth = 0;
        for (let i = s.length - 1; i >= 0; i--) {
            if (s[i] === "}") {
                depth += 1;
            }
            else if (s[i] === "{") {
                depth -= 1;
                if (depth === 0) {
                    s = s.slice(0, i).trim();
                    break;
                }
            }
        }
    }
    if (s.endsWith(")")) {
        let depth = 0;
        for (let i = s.length - 1; i >= 0; i--) {
            if (s[i] === ")") {
                depth += 1;
            }
            else if (s[i] === "(") {
                depth -= 1;
                if (depth === 0) {
                    s = s.slice(0, i).trim();
                    break;
                }
            }
        }
    }
    return s;
}
function namedPrimitiveFqn(typeFqn) {
    const trimmed = typeFqn.trim();
    if (!trimmed || hasTopLevelUnion(trimmed)) {
        return { skip: true };
    }
    const named = stripDecorators(trimmed);
    if (!named || named.startsWith("{")) {
        return { skip: true };
    }
    try {
        const expr = parseTypeExpression(named, {});
        if (expr.kind === "anonymousStruct" || expr.kind === "self" || expr.kind === "genericParam") {
            return { skip: true };
        }
        const fqn = namedTypeFqn(expr);
        return fqn ? { fqn, skip: false } : { skip: true };
    }
    catch {
        return { skip: true };
    }
}
function isTypeScript(languageFqn) {
    const named = namedPrimitiveFqn(languageFqn);
    return !named.skip && named.fqn === TYPESCRIPT_FQN;
}
function toHostJavaScript(source) {
    return source.trim().replace(/^\(\s*([A-Za-z_]\w*)\s*(?::\s*[^)=]+)?\s*\)\s*(?::\s*[^=]+)?\s*=>/, "($1) =>");
}
function compileBody(source) {
    return new Function(`"use strict"; return (${toHostJavaScript(source)});`)();
}
function findParseValue(typeFqn, registry) {
    const doc = registry.get(typeFqn);
    if (!doc) {
        return undefined;
    }
    const member = resolveEffectiveMembers(doc.block, registry).find((m) => m.kind === "capability" && m.name === PARSE_VALUE);
    return member?.kind === "capability" ? member : undefined;
}
export function evaluateParseValue(typeFqn, raw, registry) {
    const named = namedPrimitiveFqn(typeFqn);
    if (named.skip || !named.fqn) {
        return skipped;
    }
    if (!registry.has(named.fqn)) {
        return skipped;
    }
    const cap = findParseValue(named.fqn, registry);
    if (!cap || cap.abstract || !cap.implementation) {
        return skipped;
    }
    if (!isTypeScript(cap.implementation.languageFqn)) {
        return skipped;
    }
    let fn = compiledBodies.get(named.fqn);
    if (!fn) {
        try {
            fn = compileBody(cap.implementation.source);
        }
        catch {
            return skipped;
        }
        compiledBodies.set(named.fqn, fn);
    }
    try {
        return { ok: true, value: fn(raw) };
    }
    catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
}
//# sourceMappingURL=evaluate-parse-value.js.map