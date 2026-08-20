import { escapeHtml, fqnToHtmlPath, relativePath } from "./fqn-path.js";
export function typeExpressionSummary(expr) {
    switch (expr.kind) {
        case "named": {
            let summary = expr.fqn;
            if (expr.typeArguments?.length) {
                summary += `<${expr.typeArguments.map(typeExpressionSummary).join(", ")}>`;
            }
            if (expr.multiplicity) {
                const max = expr.multiplicity.max === "*" ? "*" : String(expr.multiplicity.max);
                summary += `[${expr.multiplicity.min}..${max}]`;
            }
            return summary;
        }
        case "union":
            return expr.alternatives.map(typeExpressionSummary).join(" | ");
        case "genericParam":
            return expr.name;
        case "self":
            return "Self";
        case "anonymousStruct":
            return `{ ${expr.fields.map((f) => `${f.name}: ${typeExpressionSummary(f.type)}`).join(", ")} }`;
    }
}
export function renderTypeRef(fqn, pagePath, options, knownFqns) {
    if (!knownFqns.has(fqn)) {
        return escapeHtml(fqn);
    }
    const href = relativePath(pagePath, fqnToHtmlPath(fqn, options.outLayout));
    return `<a href="${href}">${escapeHtml(fqn)}</a>`;
}
export function renderTypeExpression(expr, pagePath, options, knownFqns) {
    if (!expr) {
        return "—";
    }
    if (expr.kind === "named") {
        const suffix = typeExpressionSummary(expr).slice(expr.fqn.length);
        const linked = renderTypeRef(expr.fqn, pagePath, options, knownFqns);
        if (suffix) {
            return `${linked}${escapeHtml(suffix)}`;
        }
        return linked;
    }
    return escapeHtml(typeExpressionSummary(expr));
}
//# sourceMappingURL=type-links.js.map