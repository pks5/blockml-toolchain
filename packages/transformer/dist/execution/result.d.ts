import type { BlockDefinition } from "@blockml/bom";
import { type TypeRegistry } from "@blockml/framework";
export declare class ResultResolutionError extends Error {
    constructor(message: string);
}
export declare function resolveResultTypeFqn(block: BlockDefinition): string;
export declare function parsePropertyReference(raw: string): {
    blockFqn: string;
    propertyName: string;
} | undefined;
/**
 * Copy resultSource onto result. No-op when resultSource is unset.
 * Throws ResultResolutionError when the path, Block, Property, type, or value is invalid.
 */
export declare function applyTransformationResult(transformation: BlockDefinition, registry: TypeRegistry): void;
//# sourceMappingURL=result.d.ts.map