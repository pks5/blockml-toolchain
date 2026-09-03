import type { BlockDefinition, BlockInstance, MemberValue } from "@blockml/bom";
import { type ExpressionScope } from "@blockml/framework";
export declare function buildBlockEvaluationScope(block: BlockDefinition): ExpressionScope;
export declare function resolveMemberText(value: MemberValue | undefined, scope: ExpressionScope): string | undefined;
export declare function resolveMemberStringList(value: MemberValue | undefined, scope: ExpressionScope): string[] | undefined;
export declare function getOperationTaskInstructions(operation: BlockInstance, scope: ExpressionScope): string | undefined;
//# sourceMappingURL=interpolate.d.ts.map