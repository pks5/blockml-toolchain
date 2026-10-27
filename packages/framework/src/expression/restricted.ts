import type { ExpressionNode } from "./types.js";

export const INTERPOLATION_NOT_ALLOWED =
  "not allowed in interpolated text";

const ALLOWED_CALL = /^#(math|strings)\./;

const EXPRESSION_BINARY = new Set<string>([
  "+",
  "-",
  "*",
  "/",
  "<",
  ">",
  "<=",
  ">=",
  "==",
  "!=",
]);

export type ExpressionProfile = "interpolation" | "expression";

function binaryAllowed(operator: string, profile: ExpressionProfile): boolean {
  if (profile === "expression") {
    return EXPRESSION_BINARY.has(operator);
  }
  return operator === "+";
}

export function restrictedExpressionError(
  node: ExpressionNode,
  profile: ExpressionProfile = "interpolation",
): string | undefined {
  switch (node.kind) {
    case "literal":
      return undefined;
    case "binary":
      if (!binaryAllowed(node.operator, profile)) {
        return INTERPOLATION_NOT_ALLOWED;
      }
      return (
        restrictedExpressionError(node.left, profile) ??
        restrictedExpressionError(node.right, profile)
      );
    case "property": {
      const head = propertyPathHead(node.path);
      if (head.startsWith("@")) {
        return INTERPOLATION_NOT_ALLOWED;
      }
      return undefined;
    }
    case "call": {
      if (!ALLOWED_CALL.test(node.callee)) {
        return INTERPOLATION_NOT_ALLOWED;
      }
      for (const arg of node.args) {
        const err = restrictedExpressionError(arg, profile);
        if (err) {
          return err;
        }
      }
      return undefined;
    }
    case "array":
      for (const el of node.elements) {
        const err = restrictedExpressionError(el, profile);
        if (err) {
          return err;
        }
      }
      return undefined;
    case "object":
      for (const el of Object.values(node.entries)) {
        const err = restrictedExpressionError(el, profile);
        if (err) {
          return err;
        }
      }
      return undefined;
    case "interpolated":
      for (const part of node.parts) {
        const err = restrictedExpressionError(part, profile);
        if (err) {
          return err;
        }
      }
      return undefined;
    default:
      return INTERPOLATION_NOT_ALLOWED;
  }
}

export function holeLooksLikeModelBinding(raw: string): boolean {
  return /@[A-Za-z_]\w*\s*:/.test(raw);
}

function propertyPathHead(path: string[]): string {
  return path.flatMap((seg) => seg.split(".")).filter(Boolean)[0] ?? "";
}
