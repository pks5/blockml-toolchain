import type { TypeExpression } from "@blockml/bom";
import { escapeHtml, fqnToHtmlPath, relativePath } from "./fqn-path.js";
import type { BlockDocOptions } from "./options.js";

export function typeExpressionSummary(expr: TypeExpression): string {
  switch (expr.kind) {
    case "named": {
      let summary = expr.fqn;
      if (expr.typeArguments?.length) {
        summary += `<${expr.typeArguments.map(typeExpressionSummary).join(", ")}>`;
      }
      if (expr.multiplicity) {
        const max =
          expr.multiplicity.max === "*" ? "*" : String(expr.multiplicity.max);
        summary += `[${expr.multiplicity.min}..${max}]`;
      }
      return summary;
    }
    case "union":
      return expr.alternatives.map(typeExpressionSummary).join(" | ");
    case "grouped": {
      const inner = typeExpressionSummary(expr.expression);
      if (!expr.multiplicity) {
        return `(${inner})`;
      }
      const max =
        expr.multiplicity.max === "*" ? "*" : String(expr.multiplicity.max);
      return `(${inner})[${expr.multiplicity.min}..${max}]`;
    }
    case "genericParam":
      return expr.name;
    case "self":
      return "Self";
    case "anonymousStruct":
      return `{ ${expr.fields.map((f) => `${f.name}: ${typeExpressionSummary(f.type)}`).join(", ")} }`;
  }
}

export function renderTypeRef(
  fqn: string,
  pagePath: string,
  options: Required<BlockDocOptions>,
  knownFqns: Set<string>,
): string {
  if (!knownFqns.has(fqn)) {
    return escapeHtml(fqn);
  }
  const href = relativePath(pagePath, fqnToHtmlPath(fqn, options.outLayout));
  return `<a href="${href}">${escapeHtml(fqn)}</a>`;
}

export function renderTypeExpression(
  expr: TypeExpression | undefined,
  pagePath: string,
  options: Required<BlockDocOptions>,
  knownFqns: Set<string>,
): string {
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
