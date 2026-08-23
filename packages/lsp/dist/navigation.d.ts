import { type LspPosition, type LspRange } from "./positions.js";
import type { WorkspaceState } from "./workspace.js";
export interface LspLocation {
    uri: string;
    range: LspRange;
}
export interface LspLocationLink {
    originSelectionRange: LspRange;
    target: LspLocation;
}
export declare function definitionAt(text: string, filePath: string, position: LspPosition, workspace: WorkspaceState): LspLocationLink[] | null;
export declare function referencesAt(text: string, filePath: string, position: LspPosition, workspace: WorkspaceState, includeDeclaration?: boolean): LspLocation[] | null;
//# sourceMappingURL=navigation.d.ts.map