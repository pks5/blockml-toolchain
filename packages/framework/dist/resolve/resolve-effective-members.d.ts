import type { BlockDefinition, MemberDefinition } from "@blockml/bom";
import type { TypeRegistry } from "../registry/type-registry.js";
export declare function memberIdentityKey(member: MemberDefinition): string;
export declare function collectBaseTypeChain(block: BlockDefinition, registry: TypeRegistry): BlockDefinition[];
/**
 * Merge members along baseType chain + local declarations.
 * Later layers override earlier when override=true or same identity replaces.
 */
export declare function resolveEffectiveMembers(block: BlockDefinition, registry: TypeRegistry): MemberDefinition[];
//# sourceMappingURL=resolve-effective-members.d.ts.map