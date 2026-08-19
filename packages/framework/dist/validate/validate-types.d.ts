import type { BomDocument, Diagnostic, LiteralValue, MemberValue, PropertyDefinition } from "@blockml/bom";
import type { TypeRegistry } from "../registry/type-registry.js";
export declare function validateTypes(document: BomDocument, registry: TypeRegistry): Diagnostic[];
export declare function getLiteralNumericValue(val: MemberValue | undefined): number | undefined;
export declare function getPropertyNumericValue(prop: PropertyDefinition): number | undefined;
export declare function isLiteralValue(val: MemberValue | undefined): val is LiteralValue;
//# sourceMappingURL=validate-types.d.ts.map