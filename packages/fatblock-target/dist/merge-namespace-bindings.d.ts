import type { Diagnostic } from "@blockml/bom";
export interface MergeNamespaceResult {
    bindings: Record<string, string>;
    diagnostics: Diagnostic[];
}
export declare function mergeNamespaceBindings(sources: Array<{
    file: string;
    bindings?: Record<string, string>;
}>): MergeNamespaceResult;
//# sourceMappingURL=merge-namespace-bindings.d.ts.map