import type { BlockDefinition, MemberDefinition } from "@blockml/bom";
import { type TypeRegistry } from "@blockml/framework";
import type { BlockDocOptions } from "./options.js";
export declare function resolveSubBlockTypeFqn(block: BlockDefinition, typeName: string | undefined): string | undefined;
export declare function memberHasAuthoredType(member: MemberDefinition): boolean;
export declare function resolveInheritedMemberType(member: MemberDefinition, block: BlockDefinition, registry: TypeRegistry | undefined): {
    member: MemberDefinition;
    ownerBlock: BlockDefinition;
};
export declare function renderMemberTypeCell(member: MemberDefinition, block: BlockDefinition, pagePath: string, options: Required<BlockDocOptions>, knownFqns: Set<string>, registry?: TypeRegistry): string;
export declare function renderMemberTable(title: string, members: MemberDefinition[], block: BlockDefinition, pagePath: string, options: Required<BlockDocOptions>, knownFqns: Set<string>, registry?: TypeRegistry): string;
//# sourceMappingURL=member-sections.d.ts.map