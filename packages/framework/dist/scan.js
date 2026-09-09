import { evaluateCapability, evaluateParseValue, } from "./validate/evaluate-parse-value.js";
const PACKAGE_SELECTOR = "org.blockml.bml.type.PackageSelector";
const TYPE_SELECTOR = "org.blockml.bml.type.TypeSelector";
const TYPE_EXPR_CHARS = /[(){}[\]|<>,:]/;
const PACKAGE_IDENTIFIER = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/;
function parseSelectorList(selectorType, selectors, registry) {
    const parsed = [];
    for (const raw of selectors) {
        const result = evaluateParseValue(selectorType, raw, registry);
        if (!result.ok) {
            return { ok: false, message: result.message };
        }
        if ("skipped" in result) {
            return { ok: false, message: `could not parse selector: ${raw}` };
        }
        parsed.push(String(result.value));
    }
    return { ok: true, selectors: parsed };
}
function matchesAny(selectorType, selectors, candidate, registry) {
    return selectors.some((selector) => {
        const result = evaluateCapability(selectorType, "matches", [selector, candidate], registry);
        return result.ok && !("skipped" in result) && result.value === true;
    });
}
export function typeCandidates(registry) {
    return registry.keys().filter((fqn) => Boolean(fqn) && !TYPE_EXPR_CHARS.test(fqn)).sort();
}
export function packageCandidates(registry) {
    const packages = new Set();
    for (const fqn of registry.keys()) {
        if (!fqn || TYPE_EXPR_CHARS.test(fqn)) {
            continue;
        }
        const segments = fqn.split(".");
        for (let i = 2; i < segments.length; i++) {
            const pkg = segments.slice(0, i).join(".");
            if (PACKAGE_IDENTIFIER.test(pkg)) {
                packages.add(pkg);
            }
        }
    }
    return [...packages].sort();
}
function scan(selectorType, selectors, candidates, registry) {
    const parsed = parseSelectorList(selectorType, selectors, registry);
    if (!parsed.ok) {
        return parsed;
    }
    const hits = candidates.filter((candidate) => matchesAny(selectorType, parsed.selectors, candidate, registry));
    return { ok: true, hits };
}
export function scanTypes(selectors, registry) {
    return scan(TYPE_SELECTOR, selectors, typeCandidates(registry), registry);
}
export function scanPackages(selectors, registry) {
    return scan(PACKAGE_SELECTOR, selectors, packageCandidates(registry), registry);
}
//# sourceMappingURL=scan.js.map