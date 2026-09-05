import type { BomDocument, Diagnostic, TypeExpression } from "@blockml/bom";
import type { TypeRegistry } from "../registry/type-registry.js";
export declare function walkNamedTypes(expr: TypeExpression | undefined, visit: (fqn: string) => void): void;
export declare function validateReferences(document: BomDocument, registry: TypeRegistry): Diagnostic[];
//# sourceMappingURL=validate-references.d.ts.map