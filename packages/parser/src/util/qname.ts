import type { SourceLocation } from "@blockml/bom";

export const XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";
export const BML_XMLNS = "http://blockml.org/bml";
export const TYPE_REFERENCE_ENTITY =
  "org.blockml.bml.type.TypeReferenceEntity";

const RELATION_TYPES: Record<string, string> = {
  Extends: "org.blockml.bml.relation.Extends",
  Defines: "org.blockml.bml.relation.Defines",
  AuthoringGuide: "org.blockml.bml.relation.AuthoringGuide",
  SeeAlso: "org.blockml.bml.relation.SeeAlso",
  BML: "org.blockml.bml.relation.BML",
};

export type ImplicitNamespaceContext =
  | "type"
  | "language"
  | "capability"
  | "status"
  | "validation"
  | "block"
  | "relation";

const PRIMITIVE_TYPES: Record<string, string> = {
  Float: "org.blockml.bml.type.Float",
  Integer: "org.blockml.bml.type.Integer",
  Boolean: "org.blockml.bml.type.Boolean",
  Decimal: "org.blockml.bml.type.Decimal",
  Text: "org.blockml.bml.type.Text",
  Color: "org.blockml.bml.type.Color",
  Entity: "org.blockml.bml.core.Entity",
  Block: "org.blockml.bml.core.Block",
  TypeReference: "org.blockml.bml.type.TypeReference",
  TypeReferenceEntity: "org.blockml.bml.type.TypeReferenceEntity",
  InstanceReference: "org.blockml.bml.type.InstanceReference",
  NaturalLanguage: "org.blockml.bml.language.NaturalLanguage",
};

const CAPABILITY_TYPES: Record<string, string> = {
  Inbound: "org.blockml.bml.capability.Inbound",
  Outbound: "org.blockml.bml.capability.Outbound",
  Transformation: "org.blockml.bml.capability.Transformation",
};

const LANGUAGE_TYPES: Record<string, string> = {
  TypeScript: "org.blockml.bml.language.TypeScript",
  OpenSCAD: "org.blockml.bml.language.OpenSCAD",
  English: "org.blockml.bml.language.English",
  ProgrammingLanguage: "org.blockml.bml.language.ProgrammingLanguage",
  BML: "org.blockml.bml.language.BML",
  Markdown: "org.blockml.bml.language.Markdown",
};

const STATUS_TYPES: Record<string, string> = {
  Draft: "org.blockml.bml.status.Draft",
  Stable: "org.blockml.bml.status.Stable",
  Deprecated: "org.blockml.bml.status.Deprecated",
};

export function splitQName(qname: string): { prefix: string; local: string } {
  const idx = qname.indexOf(":");
  if (idx === -1) {
    return { prefix: "", local: qname };
  }
  return { prefix: qname.slice(0, idx), local: qname.slice(idx + 1) };
}

export function resolvePrefix(
  prefix: string,
  bindings: Record<string, string>,
): string | undefined {
  if (prefix === "") {
    return "";
  }
  return bindings[prefix];
}

function lastFqnSegment(fqn: string): string {
  return fqn.split(".").pop() ?? fqn;
}

/** Unqualified own Block name — wins over nested types of the same spelling. */
function isOwnBlockName(local: string, enclosingTypeFqn?: string): boolean {
  return enclosingTypeFqn !== undefined && lastFqnSegment(enclosingTypeFqn) === local;
}

export function resolveBlockReference(
  qname: string,
  bindings: Record<string, string>,
  subBlockIndex: Map<string, string>,
  parentBlockType?: string,
): string {
  const { prefix, local } = splitQName(qname);
  if (prefix) {
    const ns = resolvePrefix(prefix, bindings);
    if (ns === undefined) {
      throw new Error(`BML_UNKNOWN_NAMESPACE_PREFIX: ${prefix}`);
    }
    return `${ns}.${local}`;
  }

  if (isOwnBlockName(local, parentBlockType)) {
    return parentBlockType!;
  }

  if (subBlockIndex.has(local)) {
    return subBlockIndex.get(local)!;
  }

  if (parentBlockType && /^[A-Z]/.test(local) && !local.includes(".")) {
    const candidate = `${parentBlockType}.${local}`;
    if ([...subBlockIndex.values()].includes(candidate)) {
      return candidate;
    }
    return candidate;
  }

  if (local.includes(".")) {
    const parts = local.split(".");
    const root = parts[0]!;
    if (subBlockIndex.has(local)) {
      return subBlockIndex.get(local)!;
    }
    if (parentBlockType) {
      const parentLocal = lastFqnSegment(parentBlockType);
      if (parentLocal === root && parts.length >= 2) {
        const nested = parts.slice(1).join(".");
        if (subBlockIndex.has(nested)) {
          return subBlockIndex.get(nested)!;
        }
      }
    }
  }

  if (/^[A-Z]/.test(local) && parentBlockType) {
    const candidate = `${parentBlockType}.${local}`;
    if (subBlockIndex.has(local)) {
      return subBlockIndex.get(local)!;
    }
    return candidate;
  }

  throw new Error(`BML_UNQUALIFIED_BLOCK_REFERENCE: ${qname}`);
}

export function resolveTypeName(
  name: string,
  bindings: Record<string, string>,
  context: ImplicitNamespaceContext = "type",
): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("BML_UNKNOWN_TYPE: empty");
  }

  if (trimmed === "bml:Self") {
    return "bml:Self";
  }

  const { prefix, local } = splitQName(trimmed);
  if (prefix) {
    const ns = resolvePrefix(prefix, bindings);
    if (ns === undefined) {
      throw new Error(`BML_UNKNOWN_NAMESPACE_PREFIX: ${prefix}`);
    }
    return `${ns}.${local}`;
  }

  const table =
    context === "capability"
      ? CAPABILITY_TYPES
      : context === "language"
        ? LANGUAGE_TYPES
        : context === "status"
          ? STATUS_TYPES
          : context === "relation"
            ? RELATION_TYPES
            : PRIMITIVE_TYPES;

  const typeLocal =
    !prefix && local.includes(".") ? local.slice(0, local.indexOf(".")) : local;

  if (table[local]) {
    return table[local]!;
  }
  if (table[typeLocal]) {
    return table[typeLocal]!;
  }

  if (context === "relation" && /^[A-Z]/.test(local)) {
    return `org.blockml.bml.relation.${local}`;
  }

  if (trimmed.includes(".") && /^[a-z]/.test(trimmed.split(".")[0]!)) {
    return trimmed;
  }

  if (context === "type" && /^[A-Z]/.test(typeLocal)) {
    return `org.blockml.bml.type.${typeLocal}`;
  }

  throw new Error(`BML_UNKNOWN_TYPE: ${name}`);
}

export function hasBmlSemanticQNameBindings(
  bindings: Record<string, string>,
): boolean {
  for (const [prefix, uri] of Object.entries(bindings)) {
    if (prefix === "" || uri === XSI_NS || uri === BML_XMLNS) {
      continue;
    }
    return true;
  }
  return false;
}

export function fqnToQName(
  fqn: string,
  bindings: Record<string, string>,
): string {
  const entries = Object.entries(bindings).filter(
    ([prefix, uri]) => prefix !== "" && uri !== XSI_NS && uri !== BML_XMLNS,
  );

  for (const [prefix, uri] of entries) {
    if (fqn.startsWith(`${uri}.`)) {
      return `${prefix}:${fqn.slice(uri.length + 1)}`;
    }
    if (fqn === uri) {
      return `${prefix}:${fqn.split(".").pop()}`;
    }
  }

  return fqn;
}

export function sourceLoc(
  file: string,
  source: string,
  search: string,
  occurrence = 0,
): SourceLocation {
  let idx = -1;
  let from = 0;
  for (let i = 0; i <= occurrence; i++) {
    idx = source.indexOf(search, from);
    if (idx === -1) {
      break;
    }
    from = idx + search.length;
  }
  if (idx === -1) {
    return { file, line: 1, column: 1 };
  }
  const before = source.slice(0, idx);
  const line = before.split("\n").length;
  const lastNl = before.lastIndexOf("\n");
  const column = idx - lastNl;
  return { file, line, column };
}

function offsetToLineColumn(source: string, offset: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, source.length));
  const before = source.slice(0, clamped);
  const line = before.split("\n").length;
  const lastNl = before.lastIndexOf("\n");
  const column = clamped - lastNl;
  return { line, column };
}

function lineColumnToOffset(source: string, line: number, column: number): number {
  let remaining = line - 1;
  let offset = 0;
  while (remaining > 0) {
    const nl = source.indexOf("\n", offset);
    if (nl === -1) {
      return source.length;
    }
    offset = nl + 1;
    remaining--;
  }
  return Math.min(offset + Math.max(0, column - 1), source.length);
}

function isTagNameBoundary(ch: string | undefined): boolean {
  return (
    ch === undefined ||
    ch === " " ||
    ch === "\t" ||
    ch === "\n" ||
    ch === "\r" ||
    ch === ">" ||
    ch === "/"
  );
}

function findElementEndOffset(source: string, startOffset: number, tagName: string): number {
  const startTagEnd = source.indexOf(">", startOffset);
  if (startTagEnd === -1) {
    return Math.min(startOffset + tagName.length + 1, source.length);
  }
  const startTag = source.slice(startOffset, startTagEnd + 1);
  if (/\/\s*>$/.test(startTag)) {
    return startTagEnd + 1;
  }

  const close = `</${tagName}>`;
  let depth = 1;
  let i = startTagEnd + 1;
  while (i < source.length && depth > 0) {
    const nextClose = source.indexOf(close, i);
    if (nextClose === -1) {
      return startTagEnd + 1;
    }
    let nextOpen = source.indexOf(`<${tagName}`, i);
    while (nextOpen !== -1 && nextOpen < nextClose) {
      if (isTagNameBoundary(source[nextOpen + 1 + tagName.length])) {
        break;
      }
      nextOpen = source.indexOf(`<${tagName}`, nextOpen + 1);
    }
    if (
      nextOpen !== -1 &&
      nextOpen < nextClose &&
      isTagNameBoundary(source[nextOpen + 1 + tagName.length])
    ) {
      depth++;
      const gt = source.indexOf(">", nextOpen);
      i = gt === -1 ? nextOpen + tagName.length + 1 : gt + 1;
    } else {
      depth--;
      if (depth === 0) {
        return nextClose + close.length;
      }
      i = nextClose + close.length;
    }
  }
  return startTagEnd + 1;
}

function startOffsetForElement(
  source: string,
  element: { nodeName: string; lineNumber?: number; columnNumber?: number },
): number {
  if (element.lineNumber !== undefined && element.columnNumber !== undefined) {
    const line = element.lineNumber < 1 ? 1 : element.lineNumber;
    const column = element.columnNumber < 1 ? 1 : element.columnNumber;
    return lineColumnToOffset(source, line, column);
  }
  const idx = source.indexOf(`<${element.nodeName}`);
  return idx === -1 ? 0 : idx;
}

/** Source span for a DOM element, including endLine/endColumn. */
export function elementSourceLoc(
  file: string,
  source: string,
  element: { nodeName: string; lineNumber?: number; columnNumber?: number },
): SourceLocation {
  const tagName = element.nodeName;
  const startOffset = startOffsetForElement(source, element);
  const endOffset = findElementEndOffset(source, startOffset, tagName);
  const start = offsetToLineColumn(source, startOffset);
  const end = offsetToLineColumn(source, endOffset);
  return {
    file,
    line: start.line,
    column: start.column,
    endLine: end.line,
    endColumn: end.column,
  };
}

function locationFromOffsets(
  file: string,
  source: string,
  startOffset: number,
  endOffset: number,
): SourceLocation {
  const start = offsetToLineColumn(source, startOffset);
  const end = offsetToLineColumn(source, endOffset);
  return {
    file,
    line: start.line,
    column: start.column,
    endLine: end.line,
    endColumn: end.column,
  };
}

/** Span of an attribute value inside the element's start tag. */
function attributeValueLoc(
  file: string,
  source: string,
  element: { nodeName: string; lineNumber?: number; columnNumber?: number },
  attrName: string,
  attrValue: string,
): SourceLocation | undefined {
  const start = startOffsetForElement(source, element);
  const gt = source.indexOf(">", start);
  if (gt === -1) {
    return undefined;
  }
  const startTag = source.slice(start, gt + 1);
  for (const q of ['"', "'"] as const) {
    const needle = `${attrName}=${q}${attrValue}${q}`;
    const idx = startTag.indexOf(needle);
    if (idx !== -1) {
      const valueStart = start + idx + attrName.length + 2;
      return locationFromOffsets(file, source, valueStart, valueStart + attrValue.length);
    }
  }
  return undefined;
}

/** First occurrence of `needle` (or `needle:`) within the element's source span. */
function locateNeedleNearElement(
  file: string,
  source: string,
  element: { nodeName: string; lineNumber?: number; columnNumber?: number },
  needle: string,
): SourceLocation | undefined {
  const start = startOffsetForElement(source, element);
  const end = findElementEndOffset(source, start, element.nodeName);
  const slice = source.slice(start, end);
  const withColon = `${needle}:`;
  let idx = slice.indexOf(withColon);
  let len = withColon.length;
  if (idx === -1) {
    idx = slice.indexOf(needle);
    len = needle.length;
  }
  if (idx === -1) {
    return undefined;
  }
  return locationFromOffsets(file, source, start + idx, start + idx + len);
}

const WELL_KNOWN_TYPE_FQNS = new Set<string>([
  ...Object.values(PRIMITIVE_TYPES),
  ...Object.values(CAPABILITY_TYPES),
  ...Object.values(LANGUAGE_TYPES),
  ...Object.values(STATUS_TYPES),
  ...Object.values(RELATION_TYPES),
  "bml:Self",
]);

function isWellKnownTypeFqn(fqn: string): boolean {
  return WELL_KNOWN_TYPE_FQNS.has(fqn);
}

export { attributeValueLoc, isWellKnownTypeFqn, locateNeedleNearElement };
