import type { BomDocument } from "@blockml/bom";
import type { TypeRegistry } from "../registry/type-registry.js";
/**
 * Declared property type for an instance member, when that type is in the registry.
 * Generic parameters and unknown types return undefined so the authored block FQN stays.
 */
export declare function resolveInstanceMemberType(ownerTypeFqn: string, memberName: string, registry: TypeRegistry): string | undefined;
/** Member ids of an EnumType, or undefined when `typeFqn` is not an enum. */
export declare function enumMemberIds(typeFqn: string, registry: TypeRegistry): Set<string> | undefined;
/**
 * Bare member id for an authored enum token.
 * Accepts the id and `{EnumTypeFQN}::id`. Unknown tokens return undefined.
 */
export declare function canonicalEnumId(enumFqn: string, raw: string, ids: Set<string>): string | undefined;
/**
 * Re-parse instance literals with the member type. Same-file types are visible
 * when `registry` is an overlay that already contains `document`.
 */
export declare function applyInstanceMemberTypes(document: BomDocument, registry: TypeRegistry): void;
/** Store EnumType property and instance literals as the member id. */
export declare function canonicalizeEnumLiterals(document: BomDocument, registry: TypeRegistry): void;
/** Instance scalars and enum ids, including types declared on `document` itself. */
export declare function normalizeParsedMemberValues(document: BomDocument, registry: TypeRegistry): void;
//# sourceMappingURL=member-literals.d.ts.map