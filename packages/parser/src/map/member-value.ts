import type {
  ExpressionValue,
  LiteralValue,
  MemberValue,
  SourceLocation,
} from "@blockml/bom";
import { isBooleanLiteral, normalizeBooleanValue } from "../util/boolean.js";

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
