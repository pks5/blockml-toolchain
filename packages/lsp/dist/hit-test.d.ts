import type { BlockDefinition, MemberDefinition } from "@blockml/bom";
import { type LspPosition, type LspRange } from "./positions.js";
export interface TypeHit {
    kind: "type";
    fqn: string;
    block: BlockDefinition;
    range: LspRange;
}
export interface TypeRefHit {
    kind: "typeRef";
    fqn: string;
    block: BlockDefinition;
    range: LspRange;
}
export interface MemberHit {
    kind: "member";
    member: MemberDefinition;
    range: LspRange;
    typeFqn?: string;
}
export type Hit = TypeHit | TypeRefHit | MemberHit;
export declare function memberTypeFqn(member: MemberDefinition): string | undefined;
export declare function navigationFqn(hit: Hit): string | undefined;
export declare function hitAt(text: string, filePath: string, position: LspPosition): Hit | null;
//# sourceMappingURL=hit-test.d.ts.map