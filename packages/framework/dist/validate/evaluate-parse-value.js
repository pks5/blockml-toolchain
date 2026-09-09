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
function splitTopLevelParams(params) {
    const parts = [];
    let depth = 0;
    let current = "";
    for (const ch of params) {
        if (ch === "(" || ch === "{" || ch === "[" || ch === "<") {
            depth += 1;
        }
        else if (ch === ")" || ch === "}" || ch === "]" || ch === ">") {
            depth -= 1;
        }
        if (ch === "," && depth === 0) {
            parts.push(current);
            current = "";
        }
        else {
            current += ch;
        }
    }
    if (current.trim()) {
        parts.push(current);
    }
    return parts;
}
function stripParamTypes(params) {
    return splitTopLevelParams(params)
        .map((part) => {
        const trimmed = part.trim();
        const name = trimmed.match(/^([A-Za-z_]\w*)/)?.[1];
        return name ?? trimmed;
    })
        .filter(Boolean)
        .join(", ");
}
function toHostJavaScript(source) {
    const trimmed = source.trim();
    return trimmed.replace(/^\(([\s\S]*?)\)\s*(?::\s*[^=]+)?\s*=>/, (_all, params) => `(${stripParamTypes(params)}) =>`);
}
function compileBody(source) {
    return new Function(`"use strict"; return (${toHostJavaScript(source)});`)();
}
function findCapability(typeFqn, capabilityName, registry) {
    const doc = registry.get(typeFqn);
    if (!doc) {
        return undefined;
    }
    const member = resolveEffectiveMembers(doc.block, registry).find((m) => m.kind === "capability" && m.name === capabilityName);
    return member?.kind === "capability" ? member : undefined;
}
export function evaluateCapability(typeFqn, capabilityName, args, registry) {
    const named = namedPrimitiveFqn(typeFqn);
    if (named.skip || !named.fqn) {
        return skipped;
    }
    if (!registry.has(named.fqn)) {
        return skipped;
    }
    const cap = findCapability(named.fqn, capabilityName, registry);
    if (!cap || cap.abstract || !cap.implementation) {
        return skipped;
    }
    if (!isTypeScript(cap.implementation.languageFqn)) {
        return skipped;
    }
    const cacheKey = `${named.fqn}#${capabilityName}`;
    let fn = compiledBodies.get(cacheKey);
    if (!fn) {
        try {
            fn = compileBody(cap.implementation.source);
        }
        catch {
            return skipped;
        }
        compiledBodies.set(cacheKey, fn);
    }
    try {
        return { ok: true, value: fn(...args) };
    }
    catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
}
export function evaluateParseValue(typeFqn, raw, registry) {
    return evaluateCapability(typeFqn, PARSE_VALUE, [raw], registry);
}
//# sourceMappingURL=evaluate-parse-value.js.map