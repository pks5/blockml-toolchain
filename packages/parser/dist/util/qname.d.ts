import type { SourceLocation } from "@blockml/bom";
export declare const XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";
export declare const BML_XMLNS = "http://blockml.org/bml";
export declare const TYPE_REFERENCE_ENTITY = "org.blockml.bml.type.TypeReferenceEntity";
export type ImplicitNamespaceContext = "type" | "language" | "capability" | "status" | "validation" | "block" | "relation";
export declare function splitQName(qname: string): {
    prefix: string;
    local: string;
};
export declare function resolvePrefix(prefix: string, bindings: Record<string, string>): string | undefined;
export declare function resolveBlockReference(qname: string, bindings: Record<string, string>, subBlockIndex: Map<string, string>, parentBlockType?: string): string;
export declare function resolveTypeName(name: string, bindings: Record<string, string>, context?: ImplicitNamespaceContext): string;
export declare function hasBmlSemanticQNameBindings(bindings: Record<string, string>): boolean;
export declare function fqnToQName(fqn: string, bindings: Record<string, string>): string;
export declare function sourceLoc(file: string, source: string, search: string, occurrence?: number): SourceLocation;
/** Source span for a DOM element, including endLine/endColumn. */
export declare function elementSourceLoc(file: string, source: string, element: {
    nodeName: string;
    lineNumber?: number;
    columnNumber?: number;
}): SourceLocation;
/** True when the element's start tag is authored as self-closing (`<tag …/>`). */
export declare function elementStartTagIsSelfClosing(source: string, element: {
    nodeName: string;
    lineNumber?: number;
    columnNumber?: number;
}): boolean;
/** Span of an attribute value inside the element's start tag. */
declare function attributeValueLoc(file: string, source: string, element: {
    nodeName: string;
    lineNumber?: number;
    columnNumber?: number;
}, attrName: string, attrValue: string): SourceLocation | undefined;
/** First occurrence of `needle` (or `needle:`) within the element's source span. */
declare function locateNeedleNearElement(file: string, source: string, element: {
    nodeName: string;
    lineNumber?: number;
    columnNumber?: number;
}, needle: string): SourceLocation | undefined;
declare function isWellKnownTypeFqn(fqn: string): boolean;
export { attributeValueLoc, isWellKnownTypeFqn, locateNeedleNearElement };
//# sourceMappingURL=qname.d.ts.map