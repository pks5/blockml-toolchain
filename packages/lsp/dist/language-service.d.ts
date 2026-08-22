import type { BomDocument, Diagnostic } from "@blockml/bom";
import type { WorkspaceState } from "./workspace.js";
export interface AnalysisResult {
    diagnostics: Diagnostic[];
    document: BomDocument | null;
}
export declare function analyzeDocument(text: string, filePath: string, workspace: WorkspaceState): AnalysisResult;
//# sourceMappingURL=language-service.d.ts.map