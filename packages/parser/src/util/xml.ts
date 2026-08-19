import type { Element, Node as DomNode } from "@xmldom/xmldom";
import type { XmlTrivia } from "@blockml/bom";

export function isElement(node: DomNode): node is Element {
  return node.nodeType === 1;
}

export function isComment(node: DomNode): node is DomNode & { data: string } {
  return node.nodeType === 8;
}

export function isTextNode(node: DomNode): node is DomNode & { data: string } {
  return node.nodeType === 3;
}

export function isCData(node: DomNode): node is DomNode & { data: string } {
  return node.nodeType === 4;
}

export function elementChildren(element: Element): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes.item(i);
    if (child && isElement(child)) {
      out.push(child);
    }
  }
  return out;
}

export function elementLocalName(element: Element): string {
  const name = element.nodeName;
  const idx = name.indexOf(":");
  return idx === -1 ? name : name.slice(idx + 1);
}

export function elementPrefix(element: Element): string {
  const name = element.nodeName;
  const idx = name.indexOf(":");
  return idx === -1 ? "" : name.slice(0, idx);
}

export function getAttribute(element: Element, name: string): string | undefined {
  const value = element.getAttribute(name);
  return value === null ? undefined : value;
}

export function getCharacterData(element: Element): {
  text: string;
  form: "text" | "cdata";
} {
  let text = "";
  let form: "text" | "cdata" = "text";
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes.item(i)!;
    if (isCData(child)) {
      text += child.data;
      form = "cdata";
    } else if (isTextNode(child)) {
      text += child.data;
    }
  }
  return { text: text.trim(), form };
}

export function collectLeadingComments(siblings: DomNode[], index: number): string[] {
  const comments: string[] = [];
  for (let i = index - 1; i >= 0; i--) {
    const node = siblings[i]!;
    if (isComment(node)) {
      comments.unshift(node.data.trim());
      continue;
    }
    if (isTextNode(node) && node.data.trim() === "") {
      continue;
    }
    break;
  }
  return comments;
}

export function collectTrailingComments(siblings: DomNode[], index: number): string[] {
  let i = index + 1;
  while (i < siblings.length) {
    const node = siblings[i]!;
    if (isTextNode(node) && node.data.trim() === "") {
      i++;
      continue;
    }
    if (isComment(node)) {
      // Comments before the next element sibling are leading for that element (B11) — not trailing here.
      let j = i;
      while (j < siblings.length && isComment(siblings[j]!)) {
        j++;
      }
      while (j < siblings.length) {
        const after = siblings[j]!;
        if (isTextNode(after) && after.data.trim() === "") {
          j++;
          continue;
        }
        break;
      }
      if (j < siblings.length && isElement(siblings[j]!)) {
        return [];
      }
      const comments: string[] = [];
      while (i < siblings.length && isComment(siblings[i]!)) {
        comments.push((siblings[i] as DomNode & { data: string }).data.trim());
        i++;
      }
      return comments;
    }
    break;
  }
  return [];
}

export function xmlTriviaFromElement(element: Element): XmlTrivia | undefined {
  const parent = element.parentNode;
  if (!parent) {
    return undefined;
  }
  const siblings = Array.from(parent.childNodes);
  let index = -1;
  for (let i = 0; i < siblings.length; i++) {
    if (siblings[i] === element) {
      index = i;
      break;
    }
  }
  if (index === -1) {
    return undefined;
  }
  const leadingComments = collectLeadingComments(siblings, index);
  const trailingComments = collectTrailingComments(siblings, index);
  const trivia: XmlTrivia = {};
  if (leadingComments.length > 0) {
    trivia.leadingComments = leadingComments;
  }
  if (trailingComments.length > 0) {
    trivia.trailingComments = trailingComments;
  }
  return Object.keys(trivia).length > 0 ? trivia : undefined;
}

export function trimText(value: string): string {
  return value.trim();
}
