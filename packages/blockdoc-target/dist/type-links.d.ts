import type { TypeExpression } from "@blockml/bom";
import type { BlockDocOptions } from "./options.js";
export declare function typeExpressionSummary(expr: TypeExpression): string;
export declare function renderTypeRef(fqn: string, pagePath: string, options: Required<BlockDocOptions>, knownFqns: Set<string>): string;
export declare function renderTypeExpression(expr: TypeExpression | undefined, pagePath: string, options: Required<BlockDocOptions>, knownFqns: Set<string>): string;
//# sourceMappingURL=type-links.d.ts.map