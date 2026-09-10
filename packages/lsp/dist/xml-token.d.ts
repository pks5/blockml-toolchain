import type { LspPosition, LspRange } from "./positions.js";
export type XmlTokenKind = "elementName" | "attributeName" | "attributeValue" | "text";
export interface XmlToken {
    kind: XmlTokenKind;
    text: string;
    startOffset: number;
    endOffset: number;
    range: LspRange;
    /** Local name of the enclosing element (prefix stripped). */
    elementLocalName: string;
    /** Authored enclosing element name, including prefix when present. */
    elementQName: string;
    /** Local names from root to the enclosing element, inclusive. */
    ancestors: string[];
    /** Authored ancestor names (prefix:Local or Local), root to enclosing. */
    ancestorQNames: string[];
    /** True when this token is a closing tag name. */
    closing?: boolean;
    /** Set on attribute name/value tokens. */
    attributeName?: string;
}
export interface QNameToken {
    text: string;
    range: LspRange;
    startOffset: number;
    endOffset: number;
}
export declare function positionToOffset(text: string, position: LspPosition): number;
export declare function offsetToPosition(text: string, offset: number): LspPosition;
export declare function offsetRangeToLsp(text: string, start: number, end: number): LspRange;
export declare function rangeContains(range: LspRange, position: LspPosition): boolean;
export declare function xmlLocalName(name: string): string;
export declare function xmlTokenAt(text: string, position: LspPosition): XmlToken | null;
export declare function qnameAt(token: XmlToken, position: LspPosition, text: string): QNameToken | null;
export declare function isXmlnsAttribute(name: string | undefined): boolean;
//# sourceMappingURL=xml-token.d.ts.map