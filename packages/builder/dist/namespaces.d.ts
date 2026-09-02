export declare const BML_XMLNS = "http://blockml.org/bml";
export declare const XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";
export declare const SCHEMA_LOCATION = "http://blockml.org/bml https://blockml.org/schemas/bml.xsd";
export declare const DEFAULT_BASE_TYPE = "org.blockml.bml.core.Block";
export declare const ENGLISH_FQN = "org.blockml.bml.language.English";
/** Conventional prefixes for well-known org.blockml.bml.* packages. */
export declare const KNOWN_PACKAGE_PREFIXES: Record<string, string>;
export declare function packageOfFqn(fqn: string): string;
export declare function shortNameOfFqn(fqn: string): string;
export declare function prefixForPackage(pkg: string, bindings: Record<string, string>): string;
export declare function orderedBindings(bindings: Record<string, string>): Record<string, string>;
//# sourceMappingURL=namespaces.d.ts.map