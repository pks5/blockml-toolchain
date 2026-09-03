import type {
  ExpressionValue,
  InterpolatedTextValue,
  LiteralValue,
  MemberValue,
  SourceLocation,
} from "@blockml/bom";
import { isBooleanLiteral, normalizeBooleanValue } from "../util/boolean.js";

export function containsUnescapedInterpolation(raw: string): boolean {
  for (let i = 0; i < raw.length - 1; i++) {
    if (raw[i] === "$" && raw[i + 1] === "{") {
      if (i === 0 || raw[i - 1] !== "\\") {
        return true;
      }
    }
  }
  return false;
}

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

export function parseMemberValue(
  raw: string | undefined,
  typeFqn: string,
  file: string,
  line = 1,
  column = 1,
  placement?: "attribute" | "element",
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

  if (isBooleanLiteral(trimmed)) {
    const lit: LiteralValue = {
      kind: "literal",
      value: normalizeBooleanValue(trimmed),
      typeFqn,
    };
    if (placement) {
      lit.authoredPlacement = placement;
    }
    return lit;
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const lit: LiteralValue = {
      kind: "literal",
      value: Number(trimmed),
      typeFqn,
    };
    if (placement) {
      lit.authoredPlacement = placement;
    }
    return lit;
  }

  const lit: LiteralValue = {
    kind: "literal",
    value: parseJsonLike(trimmed),
    typeFqn,
  };
  if (placement) {
    lit.authoredPlacement = placement;
  }
  return lit;
}

export function expressionFromRaw(
  raw: string,
  loc: SourceLocation,
): ExpressionValue {
  const inner = raw.startsWith("${") ? raw.slice(2, -1).trim() : raw.trim();
  return { kind: "expression", raw: inner, source: loc };
}
