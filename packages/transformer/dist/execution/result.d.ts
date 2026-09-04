import type { BlockDefinition } from "@blockml/bom";
import { type TypeRegistry } from "@blockml/framework";
export { parsePropertyReference } from "./property-reference.js";
export declare class ResultResolutionError extends Error {
    constructor(message: string);
}
export declare function resolveResultTypeFqn(block: BlockDefinition): string;
/**
 * Copy resultSource onto result. No-op when resultSource is unset.
 * Throws ResultResolutionError when the path, Block, Property, type, or value is invalid.
 */
export declare function applyTransformationResult(transformation: BlockDefinition, registry: TypeRegistry): void;
//# sourceMappingURL=result.d.ts.map