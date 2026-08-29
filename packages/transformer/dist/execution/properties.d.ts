import type { BlockDefinition } from "@blockml/bom";
import { type TypeRegistry } from "@blockml/framework";
export declare function isTaskExecution(block: BlockDefinition, registry: TypeRegistry): boolean;
export declare function hasTaskComposition(block: BlockDefinition): boolean;
export declare function getPropertyLiteral(block: BlockDefinition, name: string): unknown | undefined;
export declare function getExecutionId(block: BlockDefinition): string | undefined;
export declare function getSequence(block: BlockDefinition): number | undefined;
export declare function setOverrideProperty(block: BlockDefinition, name: string, typeFqn: string, value: unknown): void;
export declare function setSequence(block: BlockDefinition, sequence: number): void;
export declare function setStartedAt(block: BlockDefinition, iso: string): void;
export declare function setCompletedAt(block: BlockDefinition, iso: string): void;
export declare function taskExecutionHasCompletedAt(registry: TypeRegistry): boolean;
//# sourceMappingURL=properties.d.ts.map