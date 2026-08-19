import { XSI_NS, BML_XMLNS } from "./constants.js";
export { XSI_NS, BML_XMLNS };
export declare function hasBmlSemanticQNameBindings(bindings: Record<string, string>): boolean;
export declare function fqnToQName(fqn: string, bindings: Record<string, string>): string;
export declare function qnameToParts(qname: string): {
    prefix: string;
    local: string;
};
export declare function visibilityPrefix(visibility: "private" | "protected" | "public" | undefined): string;
//# sourceMappingURL=qname.d.ts.map