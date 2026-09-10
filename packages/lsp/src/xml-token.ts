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

const QNAME_PATTERN =
  /[A-Za-z_][\w-]*:[A-Za-z_][\w.-]*|[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*){2,}|(?:_+)?[A-Z][A-Za-z0-9_]*/g;

export function positionToOffset(text: string, position: LspPosition): number {
  let remaining = position.line;
  let offset = 0;
  while (remaining > 0) {
    const nl = text.indexOf("\n", offset);
    if (nl === -1) {
      return text.length;
    }
    offset = nl + 1;
    remaining--;
  }
  return Math.min(offset + Math.max(0, position.character), text.length);
}

export function offsetToPosition(text: string, offset: number): LspPosition {
  const clamped = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, clamped);
  const line = before.split("\n").length - 1;
  const lastNl = before.lastIndexOf("\n");
  const character = lastNl === -1 ? clamped : clamped - lastNl - 1;
  return { line, character };
}

export function offsetRangeToLsp(text: string, start: number, end: number): LspRange {
  return {
    start: offsetToPosition(text, start),
    end: offsetToPosition(text, end),
  };
}

export function rangeContains(range: LspRange, position: LspPosition): boolean {
  if (position.line < range.start.line || position.line > range.end.line) {
    return false;
  }
  if (position.line === range.start.line && position.character < range.start.character) {
    return false;
  }
  if (position.line === range.end.line && position.character >= range.end.character) {
    return false;
  }
  return true;
}

export function xmlLocalName(name: string): string {
  const idx = name.lastIndexOf(":");
  return idx === -1 ? name : name.slice(idx + 1);
}

function isNameStart(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z_]/.test(ch);
}

function isNameChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9_.:-]/.test(ch);
}

function skipWs(text: string, i: number): number {
  while (i < text.length && /[ \t\n\r]/.test(text[i]!)) {
    i++;
  }
  return i;
}

function readName(text: string, i: number): { name: string; start: number; end: number } | undefined {
  if (!isNameStart(text[i])) {
    return undefined;
  }
  const start = i;
  i++;
  while (isNameChar(text[i])) {
    i++;
  }
  return { name: text.slice(start, i), start, end: i };
}

function tokenAt(
  kind: XmlTokenKind,
  text: string,
  start: number,
  end: number,
  ancestors: string[],
  ancestorQNames: string[],
  extra?: { attributeName?: string; closing?: boolean },
): XmlToken {
  const value = text.slice(start, end);
  const token: XmlToken = {
    kind,
    text: value,
    startOffset: start,
    endOffset: end,
    range: offsetRangeToLsp(text, start, end),
    elementLocalName: ancestors[ancestors.length - 1] ?? "",
    elementQName: ancestorQNames[ancestorQNames.length - 1] ?? "",
    ancestors: [...ancestors],
    ancestorQNames: [...ancestorQNames],
  };
  if (extra?.attributeName !== undefined) {
    token.attributeName = extra.attributeName;
  }
  if (extra?.closing) {
    token.closing = true;
  }
  return token;
}

function collectTokens(source: string): XmlToken[] {
  const tokens: XmlToken[] = [];
  const stack: string[] = [];
  const qStack: string[] = [];
  let i = 0;

  while (i < source.length) {
    if (source.startsWith("<!--", i)) {
      const end = source.indexOf("-->", i + 4);
      i = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith("<![CDATA[", i)) {
      const start = i + 9;
      const end = source.indexOf("]]>", start);
      const close = end === -1 ? source.length : end;
      const body = source.slice(start, close);
      if (body.trim() && stack.length > 0) {
        tokens.push(tokenAt("text", source, start, close, stack, qStack));
      }
      i = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith("<?", i)) {
      const end = source.indexOf("?>", i + 2);
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    if (source.startsWith("</", i)) {
      const name = readName(source, i + 2);
      if (!name) {
        i++;
        continue;
      }
      const local = xmlLocalName(name.name);
      const ancestors = stack.length > 0 ? [...stack] : [local];
      const ancestorQNames = qStack.length > 0 ? [...qStack] : [name.name];
      tokens.push(
        tokenAt("elementName", source, name.start, name.end, ancestors, ancestorQNames, {
          closing: true,
        }),
      );
      if (stack.length > 0) {
        stack.pop();
        qStack.pop();
      }
      const gt = source.indexOf(">", name.end);
      i = gt === -1 ? source.length : gt + 1;
      continue;
    }
    if (source[i] === "<") {
      const name = readName(source, i + 1);
      if (!name) {
        i++;
        continue;
      }
      const local = xmlLocalName(name.name);
      stack.push(local);
      qStack.push(name.name);
      tokens.push(tokenAt("elementName", source, name.start, name.end, stack, qStack));
      let j = skipWs(source, name.end);
      let selfClosing = false;
      while (j < source.length) {
        if (source.startsWith("/>", j)) {
          selfClosing = true;
          j += 2;
          break;
        }
        if (source[j] === ">") {
          j++;
          break;
        }
        const attr = readName(source, j);
        if (!attr) {
          j++;
          continue;
        }
        tokens.push(
          tokenAt("attributeName", source, attr.start, attr.end, stack, qStack, {
            attributeName: attr.name,
          }),
        );
        j = skipWs(source, attr.end);
        if (source[j] === "=") {
          j = skipWs(source, j + 1);
          const quote = source[j];
          if (quote === '"' || quote === "'") {
            const valueStart = j + 1;
            const valueEnd = source.indexOf(quote, valueStart);
            const close = valueEnd === -1 ? source.length : valueEnd;
            tokens.push(
              tokenAt("attributeValue", source, valueStart, close, stack, qStack, {
                attributeName: attr.name,
              }),
            );
            j = valueEnd === -1 ? source.length : valueEnd + 1;
          }
        }
        j = skipWs(source, j);
      }
      if (selfClosing && stack.length > 0) {
        stack.pop();
        qStack.pop();
      }
      i = j;
      continue;
    }

    const nextTag = source.indexOf("<", i);
    const end = nextTag === -1 ? source.length : nextTag;
    const body = source.slice(i, end);
    if (body.trim() && stack.length > 0) {
      tokens.push(tokenAt("text", source, i, end, stack, qStack));
    }
    i = end;
  }

  return tokens;
}

export function xmlTokenAt(text: string, position: LspPosition): XmlToken | null {
  const offset = positionToOffset(text, position);
  const tokens = collectTokens(text);
  for (const token of tokens) {
    if (offset >= token.startOffset && offset < token.endOffset) {
      return token;
    }
  }
  return null;
}

export function qnameAt(token: XmlToken, position: LspPosition, text: string): QNameToken | null {
  if (token.kind !== "text" && token.kind !== "attributeValue") {
    return null;
  }
  const offset = positionToOffset(text, position);
  QNAME_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = QNAME_PATTERN.exec(token.text)) !== null) {
    const start = token.startOffset + match.index;
    const end = start + match[0].length;
    if (offset >= start && offset < end) {
      return {
        text: match[0],
        startOffset: start,
        endOffset: end,
        range: offsetRangeToLsp(text, start, end),
      };
    }
  }
  return null;
}

export function isXmlnsAttribute(name: string | undefined): boolean {
  if (!name) {
    return false;
  }
  return name === "xmlns" || name.startsWith("xmlns:") || name === "xsi:schemaLocation" || name === "xsi:noNamespaceSchemaLocation";
}
