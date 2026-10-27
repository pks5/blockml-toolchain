import type {
  ExpressionValue,
  InterpolatedTextValue,
  LiteralValue,
  MemberValue,
  SourceLocation,
} from "@blockml/bom";
import { isBooleanLiteral, normalizeBooleanValue } from "../util/boolean.js";
import type { MapContext } from "./context.js";
import {
  containsUnescapedInterpolation,
  unescapeInterpolationDelimiters,
} from "./interpolation-escape.js";

export {
  containsUnescapedInterpolation,
  escapeInterpolationDelimiters,
  unescapeInterpolationDelimiters,
} from "./interpolation-escape.js";

function parseJsonLike(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const normalized = trimmed
        .replace(/([{,]\s*)([a-zA-Z_][\w+\-]*)\s*:/g, '$1"$2":')
        .replace(/'/g, '"');
      return JSON.parse(normalized);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function literal(
  value: unknown,
  typeFqn: string,
  placement?: "attribute" | "element",
): LiteralValue {
  const stored = typeof value === "string" ? unescapeInterpolationDelimiters(value) : value;
  const lit: LiteralValue = { kind: "literal", value: stored, typeFqn };
  if (placement) {
    lit.authoredPlacement = placement;
  }
  return lit;
}

export function parseMemberValue(
  raw: string | undefined,
  typeFqn: string,
  file: string,
  line = 1,
  column = 1,
  placement?: "attribute" | "element",
  ctx?: MapContext,
): MemberValue | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith("${") && trimmed.endsWith("}")) {
    const expr: ExpressionValue = {
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
    const interpolated: InterpolatedTextValue = {
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

  // An omitted type (inherited property value, empty type FQN) is not a skip:
  // the hook has no member type to call, so the Boolean/number heuristic remains.
  if (ctx?.parseValue && typeFqn.trim()) {
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

export function expressionFromRaw(
  raw: string,
  loc: SourceLocation,
): ExpressionValue {
  const inner = raw.startsWith("${") ? raw.slice(2, -1).trim() : raw.trim();
  return { kind: "expression", raw: inner, source: loc };
}
