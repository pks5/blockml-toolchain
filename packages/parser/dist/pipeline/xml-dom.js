import { DOMParser } from "@xmldom/xmldom";
export function parseXmlDom(source) {
    const parser = new DOMParser({ locator: true });
    return parser.parseFromString(source, "text/xml");
}
export function getParseErrors(doc) {
    const errors = [];
    const elements = doc.getElementsByTagName("parsererror");
    for (let i = 0; i < elements.length; i++) {
        const el = elements.item(i);
        if (el?.textContent) {
            errors.push(el.textContent);
        }
    }
    return errors;
}
export function documentElement(doc) {
    return doc.documentElement;
}
//# sourceMappingURL=xml-dom.js.map