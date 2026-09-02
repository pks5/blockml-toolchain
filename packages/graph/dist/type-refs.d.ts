import type { Multiplicity, TypeExpression } from "@blockml/bom";
export interface NamedTypeRef {
    fqn: string;
    cardinality?: string;
}
export declare function multiplicityLabel(multiplicity?: Multiplicity): string | undefined;
export declare function collectNamedTypes(expr: TypeExpression | undefined): NamedTypeRef[];
//# sourceMappingURL=type-refs.d.ts.map