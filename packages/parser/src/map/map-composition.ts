import type {
  BlockInstance,
  BlockInstanceNode,
  CompositionNode,
  CompositionTemplate,
  LiteralValue,
  MemberValue,
  SourceLocation,
  VirtualContainerNode,
} from "@blockml/bom";
import type { Element } from "@xmldom/xmldom";
import {
  parseDirectives,
  parseBmlMeta,
  parseGenericsBinding,
  isGenericsDirectiveElement,
} from "./directives.js";
import { parseMemberValue } from "./member-value.js";
import { parseTypeExpression } from "./type-expression.js";
import {
  isCommaSugarPayload,
  namedTypePayloadFqn,
  primitiveEntitySugarNodes,
} from "./primitive-entity-sugar.js";
import {
  elementChildren,
  elementLocalName,
  elementPrefix,
  getAttribute,
  getCharacterData,
  isElement,
  xmlTriviaFromElement,
} from "../util/xml.js";
import {
  resolveBlockReference,
  resolvePrefix,
  resolveTypeName,
  TYPE_REFERENCE_ENTITY,
  elementSourceLoc,
  type ImplicitNamespaceContext,
} from "../util/qname.js";
import { parseVisibilityFromName } from "../util/visibility.js";
import type { MapContext } from "./context.js";
import { withElementLocation } from "../util/mapping-error.js";
import {
  listUnknownBmlAttributes,
  reportMixedMemberValue,
  reportNestedComposition,
  reportStandaloneComposition,
  reportUnexpectedTextChildren,
} from "./structural.js";

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

/**
 * Parse-syntax wrappers that are never instance member fills.
 * BlockDefinition metadata names (aliases, keywords, references, …) are
 * definition-context only — on instances they bind the member of that local name.
 */
const INSTANCE_STRUCTURE = new Set([
  ...MEMBER_SECTIONS,
  "composition",
  "implementation",
  "throws",
  "value",
]);

export function mapCompositionTemplate(
  element: Element,
  aggregationName: string,
  ctx: MapContext,
): CompositionTemplate {
  const loc = elementSourceLoc(ctx.filePath, ctx.source, element);
  const compositionEls = elementChildren(element).filter(
    (c) => elementLocalName(c) === "composition",
  );
  const compositionEl = compositionEls[0];
  const target = compositionEl ?? element;
  if (compositionEl) {
    reportUnexpectedTextChildren(compositionEl, ctx);
  }
  const directives = parseDirectives(target, loc, ctx);
  const generics = parseGenericsBinding(target, ctx);
  const children = compositionEl
    ? mapCompositionChildren(compositionEl, ctx)
    : mapCompositionChildren(element, ctx);

  const typeAttr = getAttribute(element, "type");
  let sugar: ReturnType<typeof primitiveEntitySugarNodes> = [];
  if (typeAttr) {
    try {
      const payload = namedTypePayloadFqn(
        parseTypeExpression(typeAttr, ctx.bindings, "type", {
          subBlockIndex: ctx.subBlockIndex,
          ...(ctx.parentBlockType ? { currentTypeFqn: ctx.parentBlockType } : {}),
        }),
      );
      if (payload && isCommaSugarPayload(payload, ctx)) {
        const { text } = getCharacterData(element);
        if (text.trim()) {
          sugar = primitiveEntitySugarNodes(payload, text, ctx, loc);
        }
      }
    } catch {
      // invalid type expression — composition mapping continues without sugar
    }
  }

  return {
    aggregationName,
    ...(directives.length > 0 ? { directives } : {}),
    ...(generics ? { generics } : {}),
    children: [...sugar, ...children],
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
      reportStandaloneComposition(child, ctx);
      continue;
    }
    if (METADATA_ELEMENTS.has(local)) {
      continue;
    }
    if (elementPrefix(child) === "bml" && (local === "xml" || local === "generics")) {
      continue;
    }
    if (local === "container" || local === "bml:container") {
      const loc = elementSourceLoc(ctx.filePath, ctx.source, child);
      reportUnexpectedTextChildren(child, ctx);
      const directives = parseDirectives(child, loc, ctx);
      const generics = parseGenericsBinding(child, ctx);
      const vnode: VirtualContainerNode = {
        kind: "virtualContainer",
        ...(directives.length > 0 ? { directives } : {}),
        ...(generics ? { generics } : {}),
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
  const memberOccurrences: Record<string, MemberValue[]> = {};

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
        ctx,
      );
      if (val) {
        pushMemberOccurrence(memberOccurrences, attrLocal, val);
      }
    }
  }

  const aggregationCompositions: BlockInstance["aggregationCompositions"] = [];
  for (const child of elementChildren(element)) {
    const childLocal = elementLocalName(child);
    if (childLocal === "composition" || INSTANCE_STRUCTURE.has(childLocal)) {
      continue;
    }
    if (isGenericsDirectiveElement(child)) {
      continue;
    }
    if (!instanceMemberIsAggregationFill(child, ctx)) {
      continue;
    }
    for (const compositionEl of elementChildren(child).filter(
      (c) => elementLocalName(c) === "composition",
    )) {
      reportNestedComposition(compositionEl, ctx);
    }
    aggregationCompositions.push({
      aggregationName: parseVisibilityFromName(childLocal).name,
      composition: mapCompositionTemplate(child, parseVisibilityFromName(childLocal).name, ctx),
    });
  }

  for (const child of elementChildren(element)) {
    const childLocal = elementLocalName(child);
    if (childLocal === "composition") {
      continue;
    }
    if (INSTANCE_STRUCTURE.has(childLocal)) {
      continue;
    }
    if (isGenericsDirectiveElement(child)) {
      continue;
    }
    if (instanceMemberIsAggregationFill(child, ctx)) {
      continue;
    }
    const { text } = getCharacterData(child);
    const val = parseMemberValue(
      text || getAttribute(child, "value") || "",
      typeFqn,
      ctx.filePath,
      loc.line,
      loc.column,
      "element",
      ctx,
    );
    if (val) {
      pushMemberOccurrence(memberOccurrences, childLocal, val);
    }
  }

  const memberValues: Record<string, MemberValue> = {};
  for (const [name, occurrences] of Object.entries(memberOccurrences)) {
    const collapsed = collapseMemberOccurrences(occurrences, ctx, loc);
    if (collapsed) {
      memberValues[name] = collapsed;
    }
  }

  const directives = parseDirectives(element, loc, ctx);
  const generics = parseGenericsBinding(element, ctx);
  const instance: BlockInstance = {
    typeFqn,
    memberValues,
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
  if (generics) instance.generics = generics;

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

function pushMemberOccurrence(
  occurrences: Record<string, MemberValue[]>,
  name: string,
  value: MemberValue,
): void {
  const list = occurrences[name] ?? [];
  list.push(value);
  occurrences[name] = list;
}

function isLiteralArray(value: MemberValue): boolean {
  return value.kind === "literal" && Array.isArray(value.value);
}

function collapseMemberOccurrences(
  occurrences: MemberValue[],
  ctx: MapContext,
  loc: SourceLocation,
): MemberValue | undefined {
  if (occurrences.length === 0) {
    return undefined;
  }
  if (occurrences.length === 1) {
    return occurrences[0];
  }

  const placements = new Set(
    occurrences
      .map((value) => ("authoredPlacement" in value ? value.authoredPlacement : undefined))
      .filter((placement): placement is "attribute" | "element" => placement !== undefined),
  );
  if (placements.size > 1 || occurrences.some(isLiteralArray) || occurrences.some((value) => value.kind !== "literal")) {
    reportMixedMemberValue(ctx, loc);
    return occurrences[0];
  }

  const first = occurrences[0] as LiteralValue;
  return {
    kind: "literal",
    value: occurrences.map((value) => (value as LiteralValue).value),
    typeFqn: first.typeFqn,
    ...(first.authoredPlacement ? { authoredPlacement: first.authoredPlacement } : {}),
  };
}

function instanceMemberIsAggregationFill(element: Element, ctx?: MapContext): boolean {
  if (ctx) {
    const typeAttr = getAttribute(element, "type");
    if (typeAttr) {
      try {
        const payload = namedTypePayloadFqn(
          parseTypeExpression(typeAttr, ctx.bindings, "type", {
            subBlockIndex: ctx.subBlockIndex,
            ...(ctx.parentBlockType ? { currentTypeFqn: ctx.parentBlockType } : {}),
          }),
        );
        if (payload && isCommaSugarPayload(payload, ctx)) {
          const { text } = getCharacterData(element);
          if (text.trim()) {
            return true;
          }
        }
      } catch {
        // fall through to child-element detection
      }
    }
  }
  return elementChildren(element).some((c) => {
    const local = elementLocalName(c);
    return local === "composition" || local === "container" || !INSTANCE_STRUCTURE.has(local);
  });
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
  implicit?: ImplicitNamespaceContext,
) {
  const prefix = elementPrefix(element);
  const local = elementLocalName(element);
  const qname = prefix ? `${prefix}:${local}` : local;
  const valueAttr = getAttribute(element, "value");
  const raw = valueAttr ?? qname;
  let value: string;
  if (implicit === "language") {
    value = resolveTypeName(raw, ctx.bindings, "language");
  } else {
    try {
      value = resolveBlockReference(
        raw,
        ctx.bindings,
        ctx.subBlockIndex,
        ctx.parentBlockType,
      );
    } catch {
      value = resolveTypeName(local, ctx.bindings, "language");
    }
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
