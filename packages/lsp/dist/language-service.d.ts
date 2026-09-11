import type { BomDocument, Diagnostic } from "@blockml/bom";
import { type WorkspaceState } from "./workspace.js";
export interface AnalysisResult {
    diagnostics: Diagnostic[];
    document: BomDocument | null;
}
export declare function analyzeDocument(text: string, filePath: string, workspace: WorkspaceState): AnalysisResult;
export interface WorkspaceAnalysisResult {
    filePaths: string[];
    diagnostics: Diagnostic[];
}
/** Absolute project-source .bml paths (registry + unregistered disk files). */
export declare function listProjectWorkspaceFiles(workspace: WorkspaceState): string[];
/** Validate a registry document, or parse-only when the file never entered the registry. */
export declare function analyzeProjectWorkspaceFile(workspace: WorkspaceState, filePath: string): Diagnostic[];
export declare function analyzeWorkspace(workspace: WorkspaceState): WorkspaceAnalysisResult;
export interface FormatDocumentOptions {
    indent?: number;
    xmlDeclaration?: boolean;
}
export declare function formatDocument(text: string, options?: FormatDocumentOptions): string | null;
//# sourceMappingURL=language-service.d.ts.map