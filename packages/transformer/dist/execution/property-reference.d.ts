import type { PropertyDefinition } from "@blockml/bom";
import { type TypeRegistry } from "@blockml/framework";
export declare function parsePropertyReference(raw: string): {
    blockFqn: string;
    propertyName: string;
} | undefined;
export declare function propertyTypeFqn(property: PropertyDefinition): string | undefined;
export declare function propertyLiteral(property: PropertyDefinition): unknown | undefined;
export declare function lookupReferencedProperty(raw: string, registry: TypeRegistry, label: string): {
    blockFqn: string;
    propertyName: string;
    property: PropertyDefinition;
} | {
    error: string;
};
//# sourceMappingURL=property-reference.d.ts.map