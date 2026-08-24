import type {
  BlockInstance,
  BlockInstanceNode,
  CompositionNode,
  CompositionTemplate,
  VirtualContainerNode,
} from "@blockml/bom";
import type { Element } from "@xmldom/xmldom";
import { parseDirectives, parseBmlMeta } from "./directives.js";
import { parseMemberValue } from "./member-value.js";
import {
  elementChildren,
  elementLocalName,
  elementPrefix,
  getAttribute,
  isElement,
  xmlTriviaFromElement,
} from "../util/xml.js";
import {
  resolveBlockReference,
  resolvePrefix,
  resolveTypeName,
  TYPE_REFERENCE_ENTITY,
  elementSourceLoc,
} from "../util/qname.js";
import { parseVisibilityFromName } from "../util/visibility.js";
import type { MapContext } from "./context.js";
import { withElementLocation } from "../util/mapping-error.js";
import { listUnknownBmlAttributes } from "./structural.js";

const MEMBER_SECTIONS = new Set([
  "properties",
  "aggregations",
  "associations",
  "capabilities",
]);

const METADATA_ELEMENTS = new Set([
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
  "bml:xml",
  "groups",
  "suggestions",
  "subTypes",
  "languages",
]);

const RESERVED = new Set([...MEMBER_SECTIONS, ...METADATA_ELEMENTS, "composition", "implementation", "value", "groups", "suggestions"]);

export function mapCompositionTemplate(
  element: Element,
  aggregationName: string,
  ctx: MapContext,
): CompositionTemplate {
  const loc = elementSourceLoc(ctx.filePath, ctx.source, element);
  const compositionEl = elementChildren(element).find(
    (c) => elementLocalName(c) === "composition",
  );
  const target = compositionEl ?? element;
  const directives = parseDirectives(target, loc, ctx);
  const children = compositionEl
    ? mapCompositionChildren(compositionEl, ctx)
    : mapCompositionChildren(element, ctx);

  return {
    aggregationName,
    ...(directives.length > 0 ? { directives } : {}),
    children,
    source: loc,
  };
}

function mapCompositionChildren(
  compositionEl: Element,
  ctx: MapContext,
): CompositionNode[] {
  const nodes: CompositionNode[] = [];
  for (const child of elementChildren(compositionEl)) {
    const local = elementLocalName(child);
    if (local === "composition") {
      continue;
    }
    if (METADATA_ELEMENTS.has(local)) {
      continue;
    }
    if (elementPrefix(child) === "bml" && (local === "xml" || local === "container")) {
      continue;
    }
    if (local === "container" || local === "bml:container") {
      const loc = elementSourceLoc(ctx.filePath, ctx.source, child);
      const directives = parseDirectives(child, loc, ctx);
      const vnode: VirtualContainerNode = {
        kind: "virtualContainer",
        ...(directives.length > 0 ? { directives } : {}),
        children: mapCompositionChildren(child, ctx),
        source: loc,
      };
      nodes.push(vnode);
      continue;
    }
    nodes.push(mapBlockInstanceNode(child, ctx));
  }
  return nodes;
}

export function mapBlockInstanceNode(
  element: Element,
  ctx: MapContext,
): BlockInstanceNode {
  const local = elementLocalName(element);
  const prefix = elementPrefix(element);
  const loc = elementSourceLoc(ctx.filePath, ctx.source, element);

  const qname = prefix ? `${prefix}:${local}` : local;
  const typeFqn = withElementLocation(ctx.filePath, ctx.source, element, () =>
    resolveBlockReference(qname, ctx.bindings, ctx.subBlockIndex, ctx.parentBlockType),
  );

  const meta = parseBmlMeta(element, typeFqn, ctx.filePath, loc);
  const memberValues: Record<string, ReturnType<typeof parseMemberValue>> = {};

  if (element.attributes) {
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes.item(i)!;
      const attrName = attr.name;
      const attrLocal = attrName.includes(":")
        ? attrName.split(":").pop()!
        : attrName;
      if (
        attrName.startsWith("xmlns") ||
        attrName.startsWith("xsi:") ||
        attrName.startsWith("bml:") ||
        attrLocal === "bml"
      ) {
        continue;
      }
      if (["id", "version", "bean", "scope"].includes(attrLocal) && attrName.startsWith("bml:")) {
        continue;
      }
      const val = parseMemberValue(
        attr.value,
        typeFqn,
        ctx.filePath,
        loc.line,
        loc.column,
        "attribute",
      );
      if (val) {
        memberValues[attrLocal] = val;
      }
    }
  }

  for (const child of elementChildren(element)) {
    const childLocal = elementLocalName(child);
    if (childLocal === "composition") {
      continue;
    }
    if (RESERVED.has(childLocal)) {
      continue;
    }
    const { text } = getCharacterDataSimple(child);
    const val = parseMemberValue(
      text || getAttribute(child, "value"),
      typeFqn,
      ctx.filePath,
      loc.line,
      loc.column,
      "element",
    );
    if (val) {
      memberValues[childLocal] = val;
    }
  }

  const aggregationCompositions: BlockInstance["aggregationCompositions"] = [];
  for (const child of elementChildren(element)) {
    const childLocal = elementLocalName(child);
    if (childLocal === "composition") {
      continue;
    }
    const compChild = elementChildren(child).find(
      (c) => elementLocalName(c) === "composition",
    );
    if (compChild || elementChildren(child).some((c) => !RESERVED.has(elementLocalName(c)))) {
      const hasComposition = elementChildren(child).some(
        (c) => elementLocalName(c) === "composition",
      );
      if (hasComposition) {
        aggregationCompositions.push({
          aggregationName: parseVisibilityFromName(childLocal).name,
          composition: mapCompositionTemplate(child, parseVisibilityFromName(childLocal).name, ctx),
        });
      }
    }
  }

  const directives = parseDirectives(element, loc, ctx);
  const instance: BlockInstance = {
    typeFqn,
    memberValues: Object.fromEntries(
      Object.entries(memberValues).filter(([, v]) => v !== undefined),
    ) as BlockInstance["memberValues"],
    source: loc,
  };

  const unknownBml = listUnknownBmlAttributes(element);
  if (unknownBml) {
    instance.unknownAttributes = unknownBml;
  }

  if (meta.id) instance.id = meta.id;
  if (meta.version) instance.version = meta.version;
  if (meta.bean) instance.bean = meta.bean;
  if (meta.scope) instance.scope = meta.scope;

  const trivia = xmlTriviaFromElement(element);
  if (trivia) instance.xmlTrivia = trivia;

  if (aggregationCompositions.length > 0) {
    instance.aggregationCompositions = aggregationCompositions;
  }

  return {
    kind: "blockInstance",
    instance,
    ...(directives.length > 0 ? { directives } : {}),
    source: loc,
  };
}

function getCharacterDataSimple(element: Element): { text: string } {
  let text = "";
  for (let i = 0; i < element.childNodes.length; i++) {
    const child = element.childNodes.item(i)!;
    if (child.nodeType === 3 || child.nodeType === 4) {
      text += child.nodeValue ?? "";
    }
  }
  return { text: text.trim() };
}

export function isTypeReferenceEntitySugar(
  element: Element,
  ctx: MapContext,
): boolean {
  if (element.childNodes.length > 0) {
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes.item(i)!;
      if (isElement(child)) {
        return false;
      }
    }
  }
  const local = elementLocalName(element);
  return local !== "TypeReferenceEntity" && local !== "composition";
}

export function mapTypeReferenceEntityInstance(
  element: Element,
  ctx: MapContext,
  boundB?: string,
) {
  const prefix = elementPrefix(element);
  const local = elementLocalName(element);
  const qname = prefix ? `${prefix}:${local}` : local;
  const valueAttr = getAttribute(element, "value");
  let value: string;
  try {
    value =
      valueAttr ??
      resolveBlockReference(
        prefix ? `${prefix}:${local}` : local,
        ctx.bindings,
        ctx.subBlockIndex,
        ctx.parentBlockType,
      );
  } catch {
    value =
      valueAttr ??
      resolveTypeName(local, ctx.bindings, "language");
  }
  const meta = parseBmlMeta(
    element,
    TYPE_REFERENCE_ENTITY,
    ctx.filePath,
    elementSourceLoc(ctx.filePath, ctx.source, element),
  );
  const inst = {
    typeFqn: TYPE_REFERENCE_ENTITY as "org.blockml.bml.type.TypeReferenceEntity",
    value,
    ...(boundB ? { boundB } : {}),
  };
  return { inst, version: meta.version };
}

export function buildSubBlockIndex(
  subBlocks: { name: string; type: string }[],
  parentType: string,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const sb of subBlocks) {
    index.set(sb.name, sb.type);
    const qualified = `${parentType.split(".").pop()}.${sb.name}`;
    index.set(qualified, sb.type);
  }
  return index;
}
