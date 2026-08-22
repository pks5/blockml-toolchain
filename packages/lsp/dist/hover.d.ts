import type { LspPosition, LspRange } from "./positions.js";
import type { WorkspaceState } from "./workspace.js";
export interface MarkupContent {
    kind: "markdown";
    value: string;
}
export interface HoverInfo {
    contents: MarkupContent;
    range: LspRange;
}
export declare function hoverAt(text: string, filePath: string, position: LspPosition, workspace: WorkspaceState): HoverInfo | null;
//# sourceMappingURL=hover.d.ts.map