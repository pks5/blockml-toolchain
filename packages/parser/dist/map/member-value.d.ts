import type { ExpressionValue, MemberValue, SourceLocation } from "@blockml/bom";
import type { MapContext } from "./context.js";
export { containsUnescapedInterpolation, escapeInterpolationDelimiters, unescapeInterpolationDelimiters, } from "./interpolation-escape.js";
export declare function parseMemberValue(raw: string | undefined, typeFqn: string, file: string, line?: number, column?: number, placement?: "attribute" | "element", ctx?: MapContext): MemberValue | undefined;
export declare function expressionFromRaw(raw: string, loc: SourceLocation): ExpressionValue;
//# sourceMappingURL=member-value.d.ts.map