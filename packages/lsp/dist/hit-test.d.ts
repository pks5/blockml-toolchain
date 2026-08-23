import type { BlockDefinition, MemberDefinition } from "@blockml/bom";
import { type LspPosition, type LspRange } from "./positions.js";
import type { WorkspaceState } from "./workspace.js";
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
export interface LanguageHit {
    kind: "language";
    metaFqn: string;
    range: LspRange;
    member?: MemberDefinition;
}
export type Hit = TypeRefHit | MemberHit | LanguageHit;
export declare function memberTypeFqn(member: MemberDefinition): string | undefined;
export declare function navigationFqn(hit: Hit): string | undefined;
export declare function resolveAuthoredTypeRef(raw: string, bindings: Record<string, string>): string | undefined;
export declare function hitAt(text: string, filePath: string, position: LspPosition, workspace: WorkspaceState): Hit | null;
//# sourceMappingURL=hit-test.d.ts.map