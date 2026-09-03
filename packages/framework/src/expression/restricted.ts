import type { ExpressionNode } from "./types.js";

export const INTERPOLATION_NOT_ALLOWED =
  "not allowed in interpolated text";

const ALLOWED_CALL = /^#(math|strings)\./;

export function restrictedExpressionError(node: ExpressionNode): string | undefined {
  switch (node.kind) {
    case "literal":
      return undefined;
    case "binary":
      if (node.operator !== "+") {
        return INTERPOLATION_NOT_ALLOWED;
      }
      return (
        restrictedExpressionError(node.left) ?? restrictedExpressionError(node.right)
      );
    case "property": {
      const head = node.path[0] ?? "";
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
        const err = restrictedExpressionError(arg);
        if (err) {
          return err;
        }
      }
      return undefined;
    }
    case "array":
      for (const el of node.elements) {
        const err = restrictedExpressionError(el);
        if (err) {
          return err;
        }
      }
      return undefined;
    case "object":
      for (const el of Object.values(node.entries)) {
        const err = restrictedExpressionError(el);
        if (err) {
          return err;
        }
      }
      return undefined;
    case "interpolated":
      for (const part of node.parts) {
        const err = restrictedExpressionError(part);
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
