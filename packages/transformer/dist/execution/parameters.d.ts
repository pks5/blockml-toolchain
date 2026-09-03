import type { BlockDefinition } from "@blockml/bom";
import { type TypeRegistry } from "@blockml/framework";
export declare class ParametersResolutionError extends Error {
    constructor(message: string);
}
export declare const EMPTY_STRUCT_FQN = "org.blockml.bml.type.EmptyStruct";
export declare const STRUCT_TYPE_FQN = "org.blockml.bml.type.StructType";
export declare const NUMBER_TYPE_FQN = "org.blockml.bml.type.Number";
export declare const PRIMITIVE_TYPE_FQN = "org.blockml.bml.type.PrimitiveType";
export declare function isPlainObject(value: unknown): value is Record<string, unknown>;
export declare function parseParametersJson(raw: string | undefined): unknown;
export declare function deepMergeParameters(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown>;
export declare function pendingParametersValue(block: BlockDefinition): unknown;
export declare function resolveParametersTypeFqn(block: BlockDefinition): string;
export declare function isEmptyParameterValue(value: unknown): boolean;
export declare function assertParametersCompatible(value: Record<string, unknown>, typeFqn: string, registry: TypeRegistry, path?: string): void;
export declare function assertCompatibleValue(value: unknown, typeFqn: string, registry: TypeRegistry, path: string): void;
export interface ParameterApplyOptions {
    parameters?: unknown;
    parametersSource?: string;
}
export declare function applyExecutionParameters(block: BlockDefinition, registry: TypeRegistry, options?: ParameterApplyOptions): unknown;
/**
 * Rewrite FQNs rooted at this execution Block after a lifecycle relocate.
 * Covers SubBlocks, the parameters property, and composition instances
 * nested under a ModelOperation.
 */
export declare function rewriteParameterTypeFqns(block: BlockDefinition, fromFqn: string, toFqn: string): void;
//# sourceMappingURL=parameters.d.ts.map