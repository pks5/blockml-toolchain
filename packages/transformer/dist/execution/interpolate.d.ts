import type { AddressValue, BlockDefinition, LiteralValue, MemberValue } from "@blockml/bom";
import { type ExpressionScope } from "@blockml/framework";
export declare function containsUnescapedInterpolation(raw: string): boolean;
export declare function buildBlockEvaluationScope(block: BlockDefinition): ExpressionScope;
export declare function resolveMemberText(value: MemberValue | undefined, scope: ExpressionScope): string | undefined;
export declare function resolveMemberStringList(value: MemberValue | undefined, scope: ExpressionScope): string[] | undefined;
export declare function getPropertyMemberValue(block: BlockDefinition, name: string): MemberValue | undefined;
export declare function closePropertyReferencePath(block: BlockDefinition, name: string): string | undefined;
export declare function closeMemberValue(value: MemberValue, scope: ExpressionScope): LiteralValue | AddressValue;
//# sourceMappingURL=interpolate.d.ts.map