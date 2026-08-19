import type { BlockDefinition, MemberDefinition, PropertyDefinition } from "@blockml/bom";
import type { TypeRegistry } from "../registry/type-registry.js";
export declare function memberIdentityKey(member: MemberDefinition): string;
export declare function collectBaseTypeChain(block: BlockDefinition, registry: TypeRegistry): BlockDefinition[];
/**
 * Merge members from block.contracts[] in declaration order.
 * Contract subBlocks/compositions/embeddedBlocks are ignored.
 */
export declare function resolveContracts(block: BlockDefinition, registry: TypeRegistry): MemberDefinition[];
/**
 * Merge members: baseType chain (ancestors) → contracts[] → local members.
 */
export declare function resolveEffectiveMembers(block: BlockDefinition, registry: TypeRegistry): MemberDefinition[];
export declare function findLocalMember(block: BlockDefinition, member: MemberDefinition): MemberDefinition | undefined;
export declare function propertyForConstraintCheck(effective: PropertyDefinition, local: PropertyDefinition | undefined): PropertyDefinition;
//# sourceMappingURL=resolve-effective-members.d.ts.map