import type { GenericType, TypeExpression } from "@blockml/bom";
import type { TypeRegistry } from "../registry/type-registry.js";
export type GenericApplicationDiagnostic = {
    code: "BML_GENERICS_ARGUMENT_MISMATCH" | "BML_MISSING_GENERIC_TYPE_ARGUMENT" | "BML_GENERIC_CONSTRAINT_VIOLATION";
    message: string;
};
export type GenericApplicationResult = {
    bindings: Map<string, TypeExpression>;
    diagnostics: GenericApplicationDiagnostic[];
};
/**
 * Bind authored type arguments to declared genericTypes.
 * Authored args win; remaining parameters take defaultType in declaration order.
 */
export declare function resolveGenericApplication(params: GenericType[], authoredArgs: TypeExpression[], registry: TypeRegistry, namespaceBindings?: Record<string, string>): GenericApplicationResult;
/** Parameters that do not ground from defaultType alone — the instance is open. */
export declare function openGenericParameters(params: GenericType[], namespaceBindings?: Record<string, string>): GenericType[];
//# sourceMappingURL=resolve-generic-application.d.ts.map