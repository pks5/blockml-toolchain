import type { TypeExpression } from "@blockml/bom";
import { type ImplicitNamespaceContext } from "../util/qname.js";
export type TypeExpressionResolveOptions = {
    subBlockIndex?: Map<string, string>;
    currentTypeFqn?: string;
};
export declare function parseTypeExpression(raw: string, bindings: Record<string, string>, implicit?: ImplicitNamespaceContext, options?: TypeExpressionResolveOptions): TypeExpression;
export declare function inferCardinality(type: TypeExpression | undefined): "0..1" | "0..n" | "1..1" | "1..n" | undefined;
export declare function typeExpressionToString(type: TypeExpression): string;
//# sourceMappingURL=type-expression.d.ts.map