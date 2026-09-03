import type { ExpressionNode } from "./types.js";
export type ExpressionScope = Record<string, unknown>;
export declare class ExpressionEvaluationError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function evaluateExpression(node: ExpressionNode, scope: ExpressionScope): unknown;
export declare function evaluateInterpolatedText(raw: string, scope: ExpressionScope): string;
//# sourceMappingURL=evaluate-expression.d.ts.map