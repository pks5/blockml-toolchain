import { parseInterpolatedText } from "./parse-interpolated-text.js";
import {
  INTERPOLATION_NOT_ALLOWED,
  restrictedExpressionError,
} from "./restricted.js";
import type { ExpressionNode } from "./types.js";

export type ExpressionScope = Record<string, unknown>;

export class ExpressionEvaluationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ExpressionEvaluationError";
    this.code = code;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function lookupPath(scope: ExpressionScope, path: string[]): unknown {
  const segments = path.flatMap((seg) => seg.split(".")).filter(Boolean);
  let i = 0;
  if (segments[0] === "this" || segments[0] === "#this") {
    i = 1;
  }
  let current: unknown = scope;
  for (; i < segments.length; i++) {
    const key = segments[i]!;
    const record = asRecord(current);
    if (!record || !(key in record)) {
      throw new ExpressionEvaluationError(
        "BML_EXPR_UNKNOWN_PROPERTY",
        `Unknown property ${segments.join(".")}`,
      );
    }
    current = record[key];
  }
  return current;
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function evalBuiltin(callee: string, args: unknown[]): unknown {
  switch (callee) {
    case "#strings.concat":
      return args.map(stringifyValue).join("");
    case "#strings.trim":
      return stringifyValue(args[0]).trim();
    case "#strings.length":
      return stringifyValue(args[0]).length;
    case "#strings.toUpperCase":
      return stringifyValue(args[0]).toUpperCase();
    case "#strings.toLowerCase":
      return stringifyValue(args[0]).toLowerCase();
    case "#math.min":
      return Math.min(Number(args[0]), Number(args[1]));
    case "#math.max":
      return Math.max(Number(args[0]), Number(args[1]));
    case "#math.abs":
      return Math.abs(Number(args[0]));
    case "#math.floor":
      return Math.floor(Number(args[0]));
    case "#math.ceil":
      return Math.ceil(Number(args[0]));
    case "#math.round":
      return Math.round(Number(args[0]));
    default:
      throw new ExpressionEvaluationError(
        "BML_EXPR_NOT_ALLOWED_IN_INTERPOLATION",
        INTERPOLATION_NOT_ALLOWED,
      );
  }
}

export function evaluateExpression(
  node: ExpressionNode,
  scope: ExpressionScope,
): unknown {
  const restricted = restrictedExpressionError(node);
  if (restricted) {
    throw new ExpressionEvaluationError(
      "BML_EXPR_NOT_ALLOWED_IN_INTERPOLATION",
      restricted,
    );
  }
  switch (node.kind) {
    case "literal":
      return node.value;
    case "property":
      return lookupPath(scope, node.path);
    case "binary": {
      const left = evaluateExpression(node.left, scope);
      const right = evaluateExpression(node.right, scope);
      if (node.operator === "+") {
        if (typeof left === "number" && typeof right === "number") {
          return left + right;
        }
        return stringifyValue(left) + stringifyValue(right);
      }
      throw new ExpressionEvaluationError(
        "BML_EXPR_NOT_ALLOWED_IN_INTERPOLATION",
        INTERPOLATION_NOT_ALLOWED,
      );
    }
    case "call":
      return evalBuiltin(
        node.callee,
        node.args.map((arg) => evaluateExpression(arg, scope)),
      );
    case "array":
      return node.elements.map((el) => evaluateExpression(el, scope));
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node.entries)) {
        out[key] = evaluateExpression(value, scope);
      }
      return out;
    }
    case "interpolated":
      return node.parts.map((part) => stringifyValue(evaluateExpression(part, scope))).join("");
    default:
      throw new ExpressionEvaluationError(
        "BML_EXPR_NOT_ALLOWED_IN_INTERPOLATION",
        INTERPOLATION_NOT_ALLOWED,
      );
  }
}

export function evaluateInterpolatedText(
  raw: string,
  scope: ExpressionScope,
): string {
  const parsed = parseInterpolatedText(raw);
  if (!parsed.ok) {
    const code = parsed.error.message === INTERPOLATION_NOT_ALLOWED
      ? "BML_EXPR_NOT_ALLOWED_IN_INTERPOLATION"
      : parsed.error.message === "Unclosed interpolation"
        ? "BML_EXPR_SYNTAX_ERROR"
        : "BML_EXPRESSION_PARSE_ERROR";
    throw new ExpressionEvaluationError(code, parsed.error.message);
  }
  return stringifyValue(evaluateExpression(parsed.result.ast, scope));
}
