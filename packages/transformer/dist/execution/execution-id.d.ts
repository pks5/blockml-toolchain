import type { TypeRegistry } from "@blockml/framework";
/**
 * Execution IDs already present on ModelTransformations under `_meta.transform`.
 * Pending executions are included if they wrongly carry an id.
 */
export declare function usedExecutionIds(registry: TypeRegistry): Set<string>;
export declare function allocateUniqueExecutionId(registry: TypeRegistry, generate?: () => string): string;
//# sourceMappingURL=execution-id.d.ts.map