import type { Diagnostic, SourceLocation, UnknownXmlNode } from "@blockml/bom";
import type { Element } from "@xmldom/xmldom";
import { XMLSerializer } from "@xmldom/xmldom";
import { attributeValueLoc, elementSourceLoc } from "../util/qname.js";
import { elementLocalName, elementPrefix } from "../util/xml.js";
import type { MapContext } from "./context.js";

const MEMBER_SECTIONS = new Set([
  "properties",
  "aggregations",
  "associations",
  "capabilities",
]);

const METADATA_TAGS = new Set([
  "name",
  "type",
  "baseType",
  "is",
  "isnot",
  "isNot",
  "version",
  "definition",
  "since",
  "status",
  "summary",
  "documentation",
  "abstract",
  "final",
  "language",
  "languages",
  "subTypes",
  "subBlocks",
  "embeddedBlocks",
  "genericTypes",
  "contracts",
  "aliases",
  "keywords",
  "changelog",
  "examples",
  "references",
  "constraints",
]);

const ROOT_EXTRA_TAGS = new Set(["composition", "block"]);

export const KNOWN_BML_ATTRIBUTE_LOCALS = new Set([
  "each",
  "if",
  "unless",
  "with",
  "id",
  "version",
  "bean",
  "scope",
  "xml",
]);

const BLOCK_ALLOWED_ATTR_LOCALS = new Set(["type"]);

const IDENTITY_ALLOWED_ATTRS: Record<string, Set<string>> = {
  name: new Set(["value"]),
  type: new Set(["value"]),
  baseType: new Set(["value"]),
  is: new Set(["value"]),
  isnot: new Set(["value"]),
  isNot: new Set(["value"]),
  version: new Set(["value"]),
  definition: new Set(["value"]),
  since: new Set(["value"]),
  status: new Set(["value"]),
  abstract: new Set(["value"]),
  final: new Set(["value"]),
  summary: new Set(["value", "language"]),
  documentation: new Set(["value", "language"]),
  language: new Set(["value"]),
};

const SECTION_ALLOWED_ATTRS = new Set<string>();

const MEMBER_ALLOWED_ATTR_LOCALS = new Set([
  "type",
  "visibility",
  "readOnly",
  "abstract",
  "final",
  "override",
  "default",
  "value",
  "inputType",
  "outputType",
]);

export const isAllowedRootChild = (element: Element): boolean => {
  const local = elementLocalName(element);
  const prefix = elementPrefix(element);
  if (METADATA_TAGS.has(local) || MEMBER_SECTIONS.has(local) || ROOT_EXTRA_TAGS.has(local)) {
    return true;
  }
  if (prefix === "bml" && (local === "xml" || local === "container")) {
    return true;
  }
  return false;
};

export const isInfrastructureAttribute = (name: string): boolean => {
  return name === "xmlns" || name.startsWith("xmlns:") || name.startsWith("xsi:");
};

export const bmlAttributeLocalName = (name: string): string | undefined => {
  if (name.startsWith("bml:")) {
    return name.slice(4);
  }
  return undefined;
};

export const toUnknownXmlNode = (element: Element, ctx: MapContext): UnknownXmlNode => {
  const localName = elementLocalName(element);
  const prefix = elementPrefix(element);
  const attributes: Record<string, string> = {};
  if (element.attributes) {
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes.item(i)!;
      attributes[attr.name] = attr.value;
    }
  }
  const innerXml = serializeInnerXml(element);
  const node: UnknownXmlNode = {
    localName,
    attributes,
    source: elementSourceLoc(ctx.filePath, ctx.source, element),
  };
  if (prefix) {
    node.prefix = prefix;
  }
  if (innerXml !== undefined) {
    node.innerXml = innerXml;
  }
  return node;
};

export const reportDiagnostic = (
  ctx: MapContext,
  code: string,
  message: string,
  source: SourceLocation,
): void => {
  const diagnostic: Diagnostic = {
    severity: "error",
    code,
    message,
    source,
  };
  ctx.diagnostics.push(diagnostic);
};

export const collectUnknownGrammarAttributes = (
  element: Element,
  ctx: MapContext,
  allowedLocals: Set<string>,
): Record<string, string> | undefined => {
  if (!element.attributes) {
    return undefined;
  }
  const unknown: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes.item(i)!;
    const name = attr.name;
    if (isInfrastructureAttribute(name)) {
      continue;
    }
    const bmlLocal = bmlAttributeLocalName(name);
    if (bmlLocal !== undefined) {
      if (KNOWN_BML_ATTRIBUTE_LOCALS.has(bmlLocal)) {
        continue;
      }
      const loc =
        attributeValueLoc(ctx.filePath, ctx.source, element, name, attr.value) ??
        elementSourceLoc(ctx.filePath, ctx.source, element);
      reportDiagnostic(
        ctx,
        "BML_UNKNOWN_DIRECTIVE",
        `Unknown bml:* attribute: ${name}`,
        loc,
      );
      unknown[name] = attr.value;
      continue;
    }
    const local = name.includes(":") ? name.slice(name.indexOf(":") + 1) : name;
    if (allowedLocals.has(local) || allowedLocals.has(name)) {
      continue;
    }
    const loc =
      attributeValueLoc(ctx.filePath, ctx.source, element, name, attr.value) ??
      elementSourceLoc(ctx.filePath, ctx.source, element);
    reportDiagnostic(
      ctx,
      "BML_UNKNOWN_ATTRIBUTE",
      `Unknown attribute: ${name}`,
      loc,
    );
    unknown[name] = attr.value;
  }
  return Object.keys(unknown).length > 0 ? unknown : undefined;
};

export const collectBlockGrammarAttributes = (
  element: Element,
  ctx: MapContext,
): Record<string, string> | undefined => {
  return collectUnknownGrammarAttributes(element, ctx, BLOCK_ALLOWED_ATTR_LOCALS);
};

const CONTAINER_TAGS = new Set([
  ...MEMBER_SECTIONS,
  "subBlocks",
  "embeddedBlocks",
  "genericTypes",
  "contracts",
  "aliases",
  "keywords",
  "changelog",
  "examples",
  "references",
  "constraints",
  "subTypes",
  "languages",
]);

export const collectIdentityOrSectionAttributes = (
  element: Element,
  ctx: MapContext,
): Record<string, string> | undefined => {
  const local = elementLocalName(element);
  if (CONTAINER_TAGS.has(local)) {
    return collectUnknownGrammarAttributes(element, ctx, SECTION_ALLOWED_ATTRS);
  }
  const allowed = IDENTITY_ALLOWED_ATTRS[local];
  if (!allowed) {
    return undefined;
  }
  return collectUnknownGrammarAttributes(element, ctx, allowed);
};

export const collectMemberGrammarAttributes = (
  element: Element,
  ctx: MapContext,
): Record<string, string> | undefined => {
  return collectUnknownGrammarAttributes(element, ctx, MEMBER_ALLOWED_ATTR_LOCALS);
};

export const reportUnknownElement = (element: Element, ctx: MapContext): void => {
  const qname = element.nodeName;
  reportDiagnostic(
    ctx,
    "BML_UNKNOWN_ELEMENT",
    `Unknown element: ${qname}`,
    elementSourceLoc(ctx.filePath, ctx.source, element),
  );
};

export const listUnknownBmlAttributes = (
  element: Element,
): Record<string, string> | undefined => {
  if (!element.attributes) {
    return undefined;
  }
  const unknown: Record<string, string> = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const attr = element.attributes.item(i)!;
    const bmlLocal = bmlAttributeLocalName(attr.name);
    if (bmlLocal === undefined) {
      continue;
    }
    if (KNOWN_BML_ATTRIBUTE_LOCALS.has(bmlLocal)) {
      continue;
    }
    unknown[attr.name] = attr.value;
  }
  return Object.keys(unknown).length > 0 ? unknown : undefined;
};

export const collectUnknownBmlAttributes = (
  element: Element,
  ctx: MapContext,
): Record<string, string> | undefined => {
  const unknown = listUnknownBmlAttributes(element);
  if (!unknown) {
    return undefined;
  }
  for (const [name, value] of Object.entries(unknown)) {
    const loc =
      attributeValueLoc(ctx.filePath, ctx.source, element, name, value) ??
      elementSourceLoc(ctx.filePath, ctx.source, element);
    reportDiagnostic(
      ctx,
      "BML_UNKNOWN_DIRECTIVE",
      `Unknown bml:* attribute: ${name}`,
      loc,
    );
  }
  return unknown;
};

function serializeInnerXml(element: Element): string | undefined {
  if (!element.childNodes.length) {
    return undefined;
  }
  const serializer = new XMLSerializer();
  let out = "";
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes.item(i);
    if (child) {
      out += serializer.serializeToString(child);
    }
  }
  const trimmed = out.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
