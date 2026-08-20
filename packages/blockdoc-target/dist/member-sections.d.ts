import type { BlockDefinition, MemberDefinition } from "@blockml/bom";
import type { BlockDocOptions } from "./options.js";
export declare function resolveSubBlockTypeFqn(block: BlockDefinition, typeName: string | undefined): string | undefined;
export declare function renderMemberTypeCell(member: MemberDefinition, block: BlockDefinition, pagePath: string, options: Required<BlockDocOptions>, knownFqns: Set<string>): string;
export declare function renderMemberTable(title: string, members: MemberDefinition[], block: BlockDefinition, pagePath: string, options: Required<BlockDocOptions>, knownFqns: Set<string>): string;
//# sourceMappingURL=member-sections.d.ts.map