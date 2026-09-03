import type { ExpressionNode } from "./types.js";
export declare const INTERPOLATION_NOT_ALLOWED = "not allowed in interpolated text";
export declare function restrictedExpressionError(node: ExpressionNode): string | undefined;
export declare function holeLooksLikeModelBinding(raw: string): boolean;
//# sourceMappingURL=restricted.d.ts.map