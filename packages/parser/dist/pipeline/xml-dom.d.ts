import { type Document, type Element } from "@xmldom/xmldom";
export interface XmlParseError {
    level: "warning" | "error" | "fatalError";
    message: string;
    line: number;
    column: number;
}
export declare function parseXmlDom(source: string, _filePath?: string): {
    document: Document | null;
    errors: XmlParseError[];
};
export declare function getParseErrors(doc: Document): string[];
export declare function documentElement(doc: Document): Element | null;
//# sourceMappingURL=xml-dom.d.ts.map