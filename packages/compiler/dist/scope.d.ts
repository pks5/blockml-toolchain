import type { Diagnostic } from "@blockml/bom";
import type { CompileScope, ResolvedScope, ScopeConfigHints } from "./types.js";
export declare function resolveScope(scope: CompileScope, hints?: ScopeConfigHints): {
    resolved: ResolvedScope | null;
    diagnostics: Diagnostic[];
};
export declare function scopeAccepts(resolvedKind: Exclude<ResolvedScope["kind"], never>, accepts: Array<ResolvedScope["kind"] | "auto">): boolean;
//# sourceMappingURL=scope.d.ts.map