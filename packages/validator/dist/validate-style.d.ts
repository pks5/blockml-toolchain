import type { BomDocument, Diagnostic, DiagnosticSeverity } from "@blockml/bom";
export interface StyleRuleRecord {
    name: string;
    code: string;
    severity: DiagnosticSeverity;
    message: string;
    check: string;
}
export declare function validateStyle(document: BomDocument): Diagnostic[];
//# sourceMappingURL=validate-style.d.ts.map