import { DOMParser, type Document, type Element } from "@xmldom/xmldom";

export interface XmlParseError {
  level: "warning" | "error" | "fatalError";
  message: string;
  line: number;
  column: number;
}

const LOCATION_SUFFIX = /@[^[]*\[line:(\d+),col:(\d+)\]\s*$/;

function locationFromMessage(msg: string): {
  message: string;
  line: number;
  column: number;
} {
  const match = msg.match(LOCATION_SUFFIX);
  if (!match) {
    return { message: msg.trim(), line: 1, column: 1 };
  }
  return {
    message: msg.slice(0, match.index).trim(),
    line: Number(match[1]),
    column: Number(match[2]),
  };
}

function locationFromContext(
  msg: string,
  context: { lineNumber?: number; columnNumber?: number; locator?: { lineNumber?: number; columnNumber?: number } } | undefined,
): { message: string; line: number; column: number } {
  const fromMsg = locationFromMessage(msg);
  const locator = context?.locator ?? context;
  const line = locator?.lineNumber ?? fromMsg.line;
  const column = locator?.columnNumber ?? fromMsg.column;
  return { message: fromMsg.message, line, column };
}

export function parseXmlDom(
  source: string,
  _filePath?: string,
): { document: Document | null; errors: XmlParseError[] } {
  const errors: XmlParseError[] = [];
  const parser = new DOMParser({
    locator: true,
    onError(level, msg, context) {
      const loc = locationFromContext(String(msg), context);
      errors.push({
        level,
        message: loc.message,
        line: loc.line,
        column: loc.column,
      });
    },
  });
  try {
    const document = parser.parseFromString(source, "text/xml");
    return { document, errors };
  } catch (e) {
    const loc = (e as { locator?: { lineNumber?: number; columnNumber?: number } })
      .locator;
    if (errors.length === 0) {
      const fromMsg = locationFromMessage(e instanceof Error ? e.message : String(e));
      errors.push({
        level: "fatalError",
        message: fromMsg.message,
        line: loc?.lineNumber ?? fromMsg.line,
        column: loc?.columnNumber ?? fromMsg.column,
      });
    } else if (loc?.lineNumber && errors[0]!.line <= 1) {
      errors[0]!.line = loc.lineNumber;
      errors[0]!.column = loc.columnNumber ?? errors[0]!.column;
    }
    return { document: null, errors };
  }
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
