import { DOMParser, type Document, type Element } from "@xmldom/xmldom";

export function parseXmlDom(source: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(source, "text/xml");
}

export function getParseErrors(doc: Document): string[] {
  const errors: string[] = [];
  const elements = doc.getElementsByTagName("parsererror");
  for (let i = 0; i < elements.length; i++) {
    const el = elements.item(i);
    if (el?.textContent) {
      errors.push(el.textContent);
    }
  }
  return errors;
}

export function documentElement(doc: Document): Element | null {
  return doc.documentElement;
}
