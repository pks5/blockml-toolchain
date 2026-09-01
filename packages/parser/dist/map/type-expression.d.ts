import type { TypeExpression } from "@blockml/bom";
import { type ImplicitNamespaceContext } from "../util/qname.js";
export type TypeExpressionResolveOptions = {
    subBlockIndex?: Map<string, string>;
    currentTypeFqn?: string;
};
export declare function parseTypeExpression(raw: string, bindings: Record<string, string>, implicit?: ImplicitNamespaceContext, options?: TypeExpressionResolveOptions): TypeExpression;
export type ParseGenericArgumentListResult = {
    ok: true;
    arguments: TypeExpression[];
} | {
    ok: false;
    code: "BML_GENERICS_ARGUMENT_MISMATCH";
} | {
    ok: false;
    code: "BML_INVALID_TYPE_REFERENCE";
    message: string;
};
/**
 * Parse a parenthesized type-argument list as used by `bml:generics`.
 * Outer parentheses are required. The type name is omitted because the
 * instance tag is the type.
 */
export declare function parseGenericArgumentList(raw: string, bindings: Record<string, string>, implicit?: ImplicitNamespaceContext, options?: TypeExpressionResolveOptions): ParseGenericArgumentListResult;
export declare function inferCardinality(type: TypeExpression | undefined): "0..1" | "0..n" | "1..1" | "1..n" | undefined;
export declare function typeExpressionToString(type: TypeExpression): string;
//# sourceMappingURL=type-expression.d.ts.map