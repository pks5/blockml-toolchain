import type { BlockDefinition, BlockInstance, TypeExpression } from "@blockml/bom";
import { type TypeRegistry } from "@blockml/framework";
export declare class ResultResolutionError extends Error {
    constructor(message: string);
}
export type PathSegment = {
    kind: "index";
    value: number;
} | {
    kind: "name";
    value: string;
};
export interface ResolvedType {
    fqn: string;
    array: boolean;
}
export declare function resolveResultTypeFqn(block: BlockDefinition): string;
export declare function resolveResultType(block: BlockDefinition): ResolvedType;
/**
 * Apply each ResultMapping on the operation onto transformation.result.
 * No-op when the operation has no mappings.
 */
export declare function applyOperationResultMappings(transformation: BlockDefinition, operation: BlockInstance, registry: TypeRegistry): void;
export declare function parseModelPath(raw: string | undefined, label: string): PathSegment[];
export declare function walkType(start: ResolvedType, path: PathSegment[], registry: TypeRegistry, label: string): ResolvedType;
export declare function readPath(value: unknown, path: PathSegment[], label: string): unknown;
export declare function writePath(root: unknown, path: PathSegment[], value: unknown, startType: ResolvedType, registry: TypeRegistry, label?: string): unknown;
export declare function typeFromExpression(expr: TypeExpression): ResolvedType;
//# sourceMappingURL=result.d.ts.map