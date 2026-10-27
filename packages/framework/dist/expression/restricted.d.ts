import type { ExpressionNode } from "./types.js";
export declare const INTERPOLATION_NOT_ALLOWED = "not allowed in interpolated text";
export type ExpressionProfile = "interpolation" | "expression";
export declare function restrictedExpressionError(node: ExpressionNode, profile?: ExpressionProfile): string | undefined;
export declare function holeLooksLikeModelBinding(raw: string): boolean;
//# sourceMappingURL=restricted.d.ts.map