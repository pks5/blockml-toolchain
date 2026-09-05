import type { BlockDefinition } from "@blockml/bom";
import { type TypeRegistry } from "@blockml/framework";
import { type ResolvedType } from "./result.js";
export declare class ParametersResolutionError extends Error {
    constructor(message: string);
}
export { EMPTY_STRUCT_FQN, NUMBER_TYPE_FQN, STRUCT_TYPE_FQN, isPlainObject, } from "./constants.js";
export declare const PRIMITIVE_TYPE_FQN = "org.blockml.bml.type.PrimitiveType";
export declare function parseParametersJson(raw: string | undefined): unknown;
export declare function deepMergeParameters(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown>;
export declare function pendingParametersValue(block: BlockDefinition): unknown;
export declare function resolveParametersTypeFqn(block: BlockDefinition): string;
export declare function resolveParametersType(block: BlockDefinition): ResolvedType;
export declare function isEmptyParameterValue(value: unknown): boolean;
export declare function assertParametersCompatible(value: Record<string, unknown>, typeFqn: string, registry: TypeRegistry, path?: string): void;
export declare function assertCompatibleValue(value: unknown, typeFqn: string, registry: TypeRegistry, path: string): void;
export interface ParameterMappingSpec {
    source: string;
    sourcePath?: string;
    parameterPath?: string;
}
export interface ParameterApplyOptions {
    parameters?: unknown;
    parameterMappings?: readonly ParameterMappingSpec[];
}
export declare function parseParameterMappingsJson(raw: string | undefined): ParameterMappingSpec[] | undefined;
export declare function applyExecutionParameters(block: BlockDefinition, registry: TypeRegistry, options?: ParameterApplyOptions): unknown;
/**
 * Rewrite FQNs rooted at this execution Block after a lifecycle relocate.
 * Covers SubBlocks, parameters and result property types, and composition
 * instances nested under a ModelOperation.
 */
export declare function rewriteParameterTypeFqns(block: BlockDefinition, fromFqn: string, toFqn: string): void;
//# sourceMappingURL=parameters.d.ts.map