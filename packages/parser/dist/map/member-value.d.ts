import type { ExpressionValue, MemberValue, SourceLocation } from "@blockml/bom";
export declare function containsUnescapedInterpolation(raw: string): boolean;
export declare function parseMemberValue(raw: string | undefined, typeFqn: string, file: string, line?: number, column?: number, placement?: "attribute" | "element"): MemberValue | undefined;
export declare function expressionFromRaw(raw: string, loc: SourceLocation): ExpressionValue;
//# sourceMappingURL=member-value.d.ts.map