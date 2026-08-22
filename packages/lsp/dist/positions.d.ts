import type { Diagnostic, SourceLocation } from "@blockml/bom";
export type LspDiagnosticSeverity = 1 | 2 | 3 | 4;
export interface LspPosition {
    line: number;
    character: number;
}
export interface LspRange {
    start: LspPosition;
    end: LspPosition;
}
export interface LspDiagnostic {
    severity?: LspDiagnosticSeverity;
    code?: string;
    message: string;
    range: LspRange;
    source?: string;
}
export declare function bomSeverityToLsp(severity: Diagnostic["severity"]): LspDiagnosticSeverity;
export declare function bomLocationToRange(loc: SourceLocation, documentText?: string): LspRange;
export declare function diagnosticToLsp(diagnostic: Diagnostic, documentText?: string): LspDiagnostic;
//# sourceMappingURL=positions.d.ts.map