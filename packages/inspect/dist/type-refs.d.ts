import type { Multiplicity, TypeExpression } from "@blockml/bom";
import type { InspectTypeRef } from "./types.js";
export declare function multiplicityLabel(multiplicity?: Multiplicity): string | undefined;
export declare function projectTypeExpression(expr: TypeExpression | undefined, typeFqn?: string): InspectTypeRef | undefined;
export declare function collectNamedFqns(expr: TypeExpression | undefined, typeFqn?: string): string[];
//# sourceMappingURL=type-refs.d.ts.map