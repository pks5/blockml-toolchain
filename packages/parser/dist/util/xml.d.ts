import type { Element, Node as DomNode } from "@xmldom/xmldom";
import type { XmlTrivia } from "@blockml/bom";
export declare function isElement(node: DomNode): node is Element;
export declare function isComment(node: DomNode): node is DomNode & {
    data: string;
};
export declare function isTextNode(node: DomNode): node is DomNode & {
    data: string;
};
export declare function isCData(node: DomNode): node is DomNode & {
    data: string;
};
export declare function elementChildren(element: Element): Element[];
export declare function elementLocalName(element: Element): string;
export declare function elementPrefix(element: Element): string;
export declare function getAttribute(element: Element, name: string): string | undefined;
export declare function getCharacterData(element: Element): {
    text: string;
    form: "text" | "cdata";
};
export declare function collectLeadingComments(siblings: DomNode[], index: number): string[];
export declare function collectTrailingComments(siblings: DomNode[], index: number): string[];
export declare function xmlTriviaFromElement(element: Element): XmlTrivia | undefined;
/**
 * Strip the longest leading whitespace prefix shared by every non-empty line,
 * then trim the result. Pretty-printed XML indent is formatting (B13) and must
 * not be stored on character-data fields; relative extra indent is kept.
 */
export declare function trimText(value: string): string;
//# sourceMappingURL=xml.d.ts.map