import type {
  AggregationDefinition,
  AliasEntry,
  AssociationDefinition,
  BlockDefinition,
  BlockInstance,
  CapabilityDefinition,
  ChangelogEntry,
  CompositionTemplate,
  Diagnostic,
  DocumentationExample,
  DocumentationProseEntry,
  DocumentationReference,
  EmbeddedExpression,
  GenericType,
  ImplementationBlock,
  KeywordEntry,
  MemberDefinition,
  MemberValue,
  PropertyDefinition,
  PropertyValueEntry,
  SourceLocation,
  TypeReferenceEntityInstance,
  XmlRenderingBlock,
  XmlRenderingMember,
  TypeExpression,
  UnknownXmlNode,
} from "@blockml/bom";
import type { Element } from "@xmldom/xmldom";
import { createMapContext, type MapContext } from "./context.js";
import {
  mapBlockInstanceNode,
  mapCompositionTemplate,
  mapTypeReferenceEntityInstance,
  isTypeReferenceEntitySugar,
  buildSubBlockIndex,
} from "./map-composition.js";
import {
  parseTypeExpression,
  inferCardinality,
  type TypeExpressionResolveOptions,
} from "./type-expression.js";
import { parseMemberValue } from "./member-value.js";
import {
  elementChildren,
  elementLocalName,
  elementPrefix,
  getAttribute,
  getCharacterData,
  xmlTriviaFromElement,
} from "../util/xml.js";
import { parseVisibilityFromName } from "../util/visibility.js";
import { parseBooleanAttribute, isBooleanLiteral } from "../util/boolean.js";
import {
  resolveBlockReference,
  resolvePrefix,
  resolveTypeName,
  elementSourceLoc,
  elementStartTagIsSelfClosing,
  attributeValueLoc,
  TYPE_REFERENCE_ENTITY,
} from "../util/qname.js";
import { withElementLocation } from "../util/mapping-error.js";
import {
  collectBlockGrammarAttributes,
  collectIdentityOrSectionAttributes,
  collectMemberGrammarAttributes,
  isAllowedRootChild,
  isCharacterDataHost,
  reportDuplicateComposition,
  reportDuplicatePropertyValue,
  reportStandaloneComposition,
  reportUnexpectedTextChildren,
  reportUnknownElement,
  toUnknownXmlNode,
} from "./structural.js";

const MEMBER_SECTIONS = new Set([
  "properties",
  "aggregations",
  "associations",
  "capabilities",
]);

function mapBlockDefinition(
  element: Element,
  ctx: MapContext,
  parentType?: string,
): BlockDefinition {
  const block: BlockDefinition = {
    name: "",
    type: "",
    members: [],
    subBlocks: [],
    embeddedBlocks: [],
    compositions: [],
  };

  const trivia = xmlTriviaFromElement(element);
  if (trivia) {
    block.xmlTrivia = trivia;
  }

  block.source = elementSourceLoc(ctx.filePath, ctx.source, element);

  const unknownAttrs = collectBlockGrammarAttributes(element, ctx);
  if (unknownAttrs) {
    block.unknownAttributes = unknownAttrs;
  }

  const childElements = elementChildren(element);
  const subBlocksRaw: Element[] = [];
  const embeddedRaw: Element[] = [];
  const memberSections: Record<string, Element[]> = {
    properties: [],
    aggregations: [],
    associations: [],
    capabilities: [],
  };
  const unknownElements: UnknownXmlNode[] = [];

  reportUnexpectedTextChildren(element, ctx);

  for (const child of childElements) {
    if (!isCharacterDataHost(child)) {
      reportUnexpectedTextChildren(child, ctx);
    }
    const local = elementLocalName(child);
    if (local === "composition") {
      reportStandaloneComposition(child, ctx);
      unknownElements.push(toUnknownXmlNode(child, ctx));
      continue;
    }
    if (local === "subBlocks") {
      subBlocksRaw.push(...elementChildren(child).filter((c) => elementLocalName(c) === "block"));
      continue;
    }
    if (local === "embeddedBlocks") {
      embeddedRaw.push(...elementChildren(child).filter((c) => elementLocalName(c) === "block"));
      continue;
    }
    if (MEMBER_SECTIONS.has(local)) {
      for (const memberEl of elementChildren(child)) {
        if (local === "aggregations" && elementLocalName(memberEl) === "composition") {
          reportStandaloneComposition(memberEl, ctx);
          unknownElements.push(toUnknownXmlNode(memberEl, ctx));
          continue;
        }
        memberSections[local]!.push(memberEl);
      }
      continue;
    }
    if (isAllowedRootChild(child)) {
      continue;
    }
    reportUnknownElement(child, ctx);
    unknownElements.push(toUnknownXmlNode(child, ctx));
  }

  if (unknownElements.length > 0) {
    block.unknownElements = unknownElements;
  }

  seedSubBlockIndex(element, block, ctx, parentType, subBlocksRaw);

  mapMetadataFields(element, block, ctx);

  if (!block.name) {
    block.name = block.type.split(".").pop() ?? "Block";
  }

  if (ctx.isEmbedded && getAttribute(element, "type")) {
    const typeText = getTextOrAttr(element, "type");
    if (typeText) {
      block.type = withElementLocation(
        ctx.filePath,
        ctx.source,
        element,
        () => resolveBlockReference(typeText, ctx.bindings, ctx.subBlockIndex, parentType),
        { name: "type", value: typeText },
      );
    }
  } else if (!block.type && parentType) {
    block.type = `${parentType}.${block.name}`;
  }

  const subBlockElements: Element[] = [...subBlocksRaw];
  for (const child of childElements) {
    if (elementLocalName(child) === "block") {
      subBlockElements.push(child);
    }
  }

  for (const sbEl of subBlockElements) {
    const sbCtx = createMapContext(ctx.filePath, ctx.source, ctx.bindings, {
      parentBlockType: block.type,
      isRoot: false,
      isEmbedded: false,
      diagnostics: ctx.diagnostics,
    });
    const sb = mapBlockDefinition(sbEl, sbCtx, block.type);
    if (!sb.type) {
      sb.type = `${block.type}.${sb.name}`;
    }
    block.subBlocks.push(sb);
  }

  const subIndex = buildSubBlockIndex(
    block.subBlocks.map((s) => ({ name: s.name, type: s.type })),
    block.type,
  );
  ctx.subBlockIndex = subIndex;
  ctx.parentBlockType = block.type;

  for (const ebEl of embeddedRaw) {
    const ebCtx = createMapContext(ctx.filePath, ctx.source, ctx.bindings, {
      isRoot: false,
      isEmbedded: true,
      diagnostics: ctx.diagnostics,
    });
    block.embeddedBlocks.push(mapBlockDefinition(ebEl, ebCtx));
  }

  appendMembers(memberSections.properties ?? [], "property", block, ctx);
  appendMembers(
    memberSections.aggregations ?? [],
    "aggregation",
    block,
    ctx,
    true,
  );
  appendMembers(memberSections.associations ?? [], "association", block, ctx);
  appendMembers(memberSections.capabilities ?? [], "capability", block, ctx);

  return block;
}

function appendMembers(
  elements: Element[],
  kind: "property" | "aggregation" | "association" | "capability",
  block: BlockDefinition,
  ctx: MapContext,
  inAggregationsSection = false,
) {
  for (const el of elements) {
    const typeAttr = getAttribute(el, "type");
    const member = withElementLocation(
      ctx.filePath,
      ctx.source,
      el,
      () => mapMemberElement(el, kind, ctx, inAggregationsSection),
      typeAttr !== undefined ? { name: "type", value: typeAttr } : undefined,
    );
    if (member) {
      block.members.push(member);
      if (member.kind === "aggregation" && member.composition) {
        block.compositions.push(member.composition);
      }
    }
  }
}

const MEMBER_CHILD_METADATA = new Set([
  "composition",
  "constraints",
  "summary",
  "documentation",
  "since",
  "keywords",
  "changelog",
  "examples",
  "references",
  "value",
  "suggestions",
  "groups",
  "implementation",
  "throws",
  "bml:xml",
  "xml",
  "abstract",
  "final",
  "language",
  "status",
]);

function isMemberMetadataChild(element: Element): boolean {
  const local = elementLocalName(element);
  const prefix = elementPrefix(element);
  if (MEMBER_CHILD_METADATA.has(local)) {
    return true;
  }
  if (prefix === "bml" && (local === "xml" || local === "container")) {
    return true;
  }
  return false;
}

function aggregationHasCompositionContent(element: Element): boolean {
  const compEl = elementChildren(element).find(
    (c) => elementLocalName(c) === "composition",
  );
  if (compEl) {
    return true;
  }
  return elementChildren(element).some((c) => !isMemberMetadataChild(c));
}

function mapMemberElement(
  element: Element,
  kind: "property" | "aggregation" | "association" | "capability",
  ctx: MapContext,
  inAggregationsSection = false,
): MemberDefinition | undefined {
  const rawLocal = elementLocalName(element);
  const { name, visibility } = parseVisibilityFromName(rawLocal);
  const prefix = elementPrefix(element);
  const ns = prefix ? resolvePrefix(prefix, ctx.bindings) : "";
  const base = mapMemberBase(element, name, visibility, ns ?? "", ctx);
  const typeAttrForSpan = getAttribute(element, "type");
  if (typeAttrForSpan !== undefined) {
    const typeSource = attributeValueLoc(
      ctx.filePath,
      ctx.source,
      element,
      "type",
      typeAttrForSpan,
    );
    if (typeSource) {
      base.typeSource = typeSource;
    }
  }

  if (kind === "property") {
    const typeAttr = getAttribute(element, "type");
    let typeFqn = "";
    let typeExpr: TypeExpression | undefined;
    if (typeAttr !== undefined) {
      typeExpr = parseTypeExpression(
        typeAttr,
        ctx.bindings,
        "type",
        typeResolveOptions(ctx),
      );
      typeFqn = typeExpr.kind === "named" ? typeExpr.fqn : "";
    }
    const prop: PropertyDefinition = {
      ...base,
      kind: "property",
      typeFqn,
      ...(typeExpr !== undefined ? { type: typeExpr } : {}),
    };
    mapPropertyValues(element, prop, typeFqn, ctx);
    mapSuggestions(element, prop, ctx);
    mapMemberGroups(element, prop, ctx);
    return finishMember(element, prop, ctx);
  }

  if (kind === "aggregation") {
    const typeAttr = getAttribute(element, "type");
    const agg: AggregationDefinition = {
      ...base,
      kind: "aggregation",
      authoredInAggregationsSection: inAggregationsSection,
    };
    if (typeAttr) {
      agg.type = parseTypeExpression(
        typeAttr,
        ctx.bindings,
        "type",
        typeResolveOptions(ctx),
      );
      agg.cardinality = inferCardinality(agg.type) ?? "0..n";
    }
    const def = getAttribute(element, "default");
    if (def !== undefined) {
      agg.default = parseBooleanAttribute(def);
    }
    if (aggregationHasCompositionContent(element)) {
      agg.composition = mapCompositionTemplate(element, name, ctx);
    }
    const compositionEls = elementChildren(element).filter(
      (c) => elementLocalName(c) === "composition",
    );
    if (compositionEls.length > 1) {
      const extras: UnknownXmlNode[] = [];
      for (const extra of compositionEls.slice(1)) {
        reportDuplicateComposition(extra, ctx);
        extras.push(toUnknownXmlNode(extra, ctx));
      }
      agg.unknownElements = extras;
    }
    mapMemberGroups(element, agg, ctx);
    return finishMember(element, agg, ctx);
  }

  if (kind === "association") {
    const typeAttr = getAttribute(element, "type") ?? "";
    return finishMember(element, {
      ...base,
      kind: "association",
      type: parseTypeExpression(
        typeAttr,
        ctx.bindings,
        "block",
        typeResolveOptions(ctx),
      ),
      cardinality: "0..n",
    } satisfies AssociationDefinition, ctx);
  }

  const capTypeAttr = getAttribute(element, "type") ?? "";
  const cap: CapabilityDefinition = {
    ...base,
    kind: "capability",
    typeFqn: resolveTypeName(capTypeAttr, ctx.bindings, "capability"),
  };
  const inputType = getAttribute(element, "inputType");
  const outputType = getAttribute(element, "outputType");
  if (inputType) {
    cap.inputType = parseTypeExpression(
      inputType,
      ctx.bindings,
      "type",
      typeResolveOptions(ctx),
    );
    const inputTypeSource = attributeValueLoc(
      ctx.filePath,
      ctx.source,
      element,
      "inputType",
      inputType,
    );
    if (inputTypeSource) {
      cap.inputTypeSource = inputTypeSource;
    }
  }
  if (outputType) {
    cap.outputType = parseTypeExpression(
      outputType,
      ctx.bindings,
      "type",
      typeResolveOptions(ctx),
    );
    const outputTypeSource = attributeValueLoc(
      ctx.filePath,
      ctx.source,
      element,
      "outputType",
      outputType,
    );
    if (outputTypeSource) {
      cap.outputTypeSource = outputTypeSource;
    }
  }
  const implEl = elementChildren(element).find(
    (c) => elementLocalName(c) === "implementation",
  );
  if (implEl) {
    cap.implementation = mapImplementation(implEl, ctx);
  }
  mapCapabilityThrows(element, cap, ctx);
  return finishMember(element, cap, ctx);
}

function finishMember<T extends MemberDefinition>(
  element: Element,
  member: T,
  ctx: MapContext,
): T {
  if (member.kind !== "property") {
    reportUnexpectedTextChildren(element, ctx);
  }
  if (member.kind !== "aggregation") {
    const unknown: UnknownXmlNode[] = [];
    for (const child of elementChildren(element)) {
      if (isMemberMetadataChild(child)) {
        continue;
      }
      const local = elementLocalName(child);
      if (local === "value" || local.endsWith(":value")) {
        continue;
      }
      reportUnknownElement(child, ctx);
      unknown.push(toUnknownXmlNode(child, ctx));
    }
    if (unknown.length > 0) {
      member.unknownElements = [...(member.unknownElements ?? []), ...unknown];
    }
  }
  return member;
}

function parseMemberXmlRendering(
  raw: string,
  placement: "element" | "attribute",
): XmlRenderingMember {
  const kinds = raw
    .split("|")
    .map((part) => part.trim())
    .filter((part): part is "element" | "attribute" => part === "element" || part === "attribute");
  return {
    raw,
    kinds: kinds.length > 0 ? kinds : [placement],
    authoredPlacement: placement,
  };
}

function mapMemberBase(
  element: Element,
  name: string,
  visibility: ReturnType<typeof parseVisibilityFromName>["visibility"],
  namespace: string,
  ctx: MapContext,
): Partial<MemberDefinition> & { name: string; visibility: typeof visibility } {
  const base: Partial<MemberDefinition> & { name: string; visibility: typeof visibility } = {
    name,
    visibility,
    source: elementSourceLoc(ctx.filePath, ctx.source, element),
  };
  if (namespace) {
    base.namespace = namespace;
  }

  const trivia = xmlTriviaFromElement(element);
  if (trivia) {
    base.xmlTrivia = trivia;
  }

  const visAttr = getAttribute(element, "visibility");
  if (visAttr) {
    base.visibility = visAttr as "public" | "protected" | "private";
  }
  for (const flag of ["readOnly", "abstract", "final", "override"] as const) {
    const v = getAttribute(element, flag);
    if (v !== undefined) {
      base[flag] = parseBooleanAttribute(v);
    }
  }
  for (const child of elementChildren(element)) {
    const local = elementLocalName(child);
    if (local === "abstract" || local === "final") {
      const raw = getTextOrAttr(child) ?? getAttribute(child, "value");
      if (raw !== undefined) {
        base[local] = parseBooleanAttribute(raw);
      }
    }
  }

  const unknownMemberAttrs = collectMemberGrammarAttributes(element, ctx);
  if (unknownMemberAttrs) {
    base.unknownAttributes = unknownMemberAttrs;
  }

  const xmlAttr = getAttribute(element, "bml:xml");
  const xmlEl = elementChildren(element).find((c) => elementLocalName(c) === "bml:xml" || elementLocalName(c) === "xml");
  if (xmlAttr !== undefined) {
    base.xmlRendering = parseMemberXmlRendering(xmlAttr, "attribute");
  } else if (xmlEl) {
    const { text } = getCharacterData(xmlEl);
    base.xmlRendering = parseMemberXmlRendering(text, "element");
  }

  mapMemberDocumentation(element, base as MemberDefinition, ctx);
  mapMemberConstraints(element, base, ctx);

  return base;
}

function mapMemberDocumentation(
  element: Element,
  target: MemberDefinition,
  ctx: MapContext,
): void {
  for (const child of elementChildren(element)) {
    const local = elementLocalName(child);
    switch (local) {
      case "summary":
        target.summaries = [...(target.summaries ?? []), mapProseEntry(child, ctx)];
        break;
      case "documentation":
        target.documentations = [
          ...(target.documentations ?? []),
          mapProseEntry(child, ctx),
        ];
        break;
      case "since": {
        const v = getTextOrAttr(child);
        if (v !== undefined) target.since = v;
        break;
      }
      case "keywords":
        target.keywords = mapKeywords(child, ctx);
        break;
      case "changelog":
        target.changelog = mapChangelog(child, ctx);
        break;
      case "examples":
        target.examples = mapExamples(child, ctx);
        break;
      case "references":
        target.references = mapReferences(child, ctx);
        break;
    }
  }
}

function mapMetadataFields(
  element: Element,
  block: BlockDefinition,
  ctx: MapContext,
) {
  for (const child of elementChildren(element)) {
    const extraAttrs = collectIdentityOrSectionAttributes(child, ctx);
    if (extraAttrs) {
      block.unknownAttributes = { ...block.unknownAttributes, ...extraAttrs };
    }
    const local = elementLocalName(child);
    switch (local) {
      case "name":
        block.name = getTextOrAttr(child) ?? block.name;
        break;
      case "type":
        block.type = withElementLocation(
          ctx.filePath,
          ctx.source,
          child,
          () =>
            resolveBlockReference(
              getTextOrAttr(child) ?? "",
              ctx.bindings,
              ctx.subBlockIndex,
              ctx.parentBlockType,
            ),
        );
        block.typeSource = elementSourceLoc(ctx.filePath, ctx.source, child);
        ctx.parentBlockType = block.type;
        break;
      case "baseType": {
        const bt = getTextOrAttr(child);
        if (bt) {
          const parsed = withElementLocation(
            ctx.filePath,
            ctx.source,
            child,
            () => parseBaseType(bt, ctx, block.type),
          );
          block.baseType = parsed.fqn;
          if (parsed.expression) {
            block.baseTypeExpression = parsed.expression;
          }
        }
        block.baseTypeSource = elementSourceLoc(ctx.filePath, ctx.source, child);
        break;
      }
      case "is": {
        const v = getTextOrAttr(child);
        if (v !== undefined) block.is = v;
        break;
      }
      case "isnot":
      case "isNot": {
        const v = getTextOrAttr(child);
        if (v !== undefined) block.isNot = v;
        break;
      }
      case "version": {
        const v = getTextOrAttr(child);
        if (v !== undefined) block.version = v;
        break;
      }
      case "definition":
        block.definitionFqn = withElementLocation(
          ctx.filePath,
          ctx.source,
          child,
          () =>
            resolveBlockReference(
              getTextOrAttr(child) ?? "",
              ctx.bindings,
              ctx.subBlockIndex,
              block.type,
            ),
        );
        break;
      case "since": {
        const v = getTextOrAttr(child);
        if (v !== undefined) block.since = v;
        break;
      }
      case "abstract":
      case "final": {
        const v = getTextOrAttr(child) ?? getAttribute(child, "value");
        if (v !== undefined) {
          block[local] = parseBooleanAttribute(v);
        }
        break;
      }
      case "language":
        mapLanguage(child, block, ctx);
        break;
      case "summary":
        block.summaries = [...(block.summaries ?? []), mapProseEntry(child, ctx)];
        break;
      case "documentation":
        block.documentations = [
          ...(block.documentations ?? []),
          mapProseEntry(child, ctx),
        ];
        break;
      case "keywords":
        block.keywords = mapKeywords(child, ctx);
        break;
      case "aliases":
        block.aliases = mapAliases(child, ctx);
        break;
      case "changelog":
        block.changelog = mapChangelog(child, ctx);
        break;
      case "examples":
        block.examples = mapExamples(child, ctx);
        break;
      case "references":
        block.references = mapReferences(child, ctx);
        break;
      case "constraints":
        block.constraints = mapConstraintInstances(child, ctx);
        break;
      case "contracts":
        block.contracts = mapContracts(child, ctx);
        break;
      case "genericTypes":
        block.genericTypes = mapGenericTypes(child, ctx);
        break;
      case "bml:xml":
      case "xml": {
        const { text } = getCharacterData(child);
        block.xmlRendering = { raw: text } satisfies XmlRenderingBlock;
        break;
      }
      default:
        break;
    }
  }

  const xmlAttr = getAttribute(element, "bml:xml");
  if (xmlAttr !== undefined && !block.xmlRendering) {
    block.xmlRendering = { raw: xmlAttr };
  }
}

function seedSubBlockIndex(
  element: Element,
  block: BlockDefinition,
  ctx: MapContext,
  parentType: string | undefined,
  subBlocksRaw: Element[],
): void {
  if (subBlocksRaw.length === 0) {
    return;
  }
  let peekedName = block.name;
  let peekedType = block.type;
  for (const child of elementChildren(element)) {
    const local = elementLocalName(child);
    if (local === "name") {
      peekedName = getTextOrAttr(child) ?? peekedName;
    } else if (local === "type") {
      const typeText = getTextOrAttr(child);
      if (typeText) {
        peekedType = resolveBlockReference(
          typeText,
          ctx.bindings,
          ctx.subBlockIndex,
          parentType,
        );
      }
    }
  }
  if (!peekedType && parentType && peekedName) {
    peekedType = `${parentType}.${peekedName}`;
  }
  if (!peekedType) {
    return;
  }
  const peeked = subBlocksRaw
    .map((el) => peekSubBlock(el, peekedType, ctx, parentType))
    .filter((entry): entry is { name: string; type: string } => entry !== undefined);
  if (peeked.length === 0) {
    return;
  }
  ctx.subBlockIndex = buildSubBlockIndex(peeked, peekedType);
  ctx.parentBlockType = peekedType;
}

function peekSubBlock(
  element: Element,
  parentType: string,
  ctx: MapContext,
  enclosingParent?: string,
): { name: string; type: string } | undefined {
  let name = getAttribute(element, "name");
  let typeText: string | undefined;
  for (const child of elementChildren(element)) {
    const local = elementLocalName(child);
    if (local === "name" && !name) {
      name = getTextOrAttr(child);
    } else if (local === "type") {
      typeText = getTextOrAttr(child);
    }
  }
  if (!name) {
    return undefined;
  }
  const type = typeText
    ? resolveBlockReference(typeText, ctx.bindings, ctx.subBlockIndex, enclosingParent ?? parentType)
    : `${parentType}.${name}`;
  return { name, type };
}

function getTextOrAttr(element: Element, tag?: string): string | undefined {
  const el = tag
    ? elementChildren(element).find((c) => elementLocalName(c) === tag) ?? element
    : element;
  const attr = getAttribute(el, "value");
  if (attr !== undefined) {
    return attr.trim();
  }
  const { text } = getCharacterData(el);
  return text || undefined;
}

function mapLanguage(element: Element, block: BlockDefinition, ctx: MapContext) {
  for (const child of elementChildren(element)) {
    if (isTypeReferenceEntitySugar(child, ctx)) {
      const { inst } = mapTypeReferenceEntityInstance(child, ctx);
      block.language = inst;
      block.languageFqn = inst.value;
    } else if (elementLocalName(child) === "TypeReferenceEntity") {
      const value = getAttribute(child, "value") ?? getTextOrAttr(child);
      if (value) {
        block.language = {
          typeFqn: TYPE_REFERENCE_ENTITY,
          value: resolveBlockReference(value, ctx.bindings, ctx.subBlockIndex, block.type),
        };
        block.languageFqn = block.language.value;
      }
    }
  }
  const text = getTextOrAttr(element);
  if (text && !block.language) {
    block.languageFqn = resolveTypeName(text, ctx.bindings, "language");
    block.language = {
      typeFqn: TYPE_REFERENCE_ENTITY,
      value: block.languageFqn,
    };
  }
}

function mapProseEntry(element: Element, ctx: MapContext): DocumentationProseEntry {
  const prefix = elementPrefix(element);
  const { text, form } = getCharacterData(element);
  const langAttr = getAttribute(element, "language");
  return {
    namespace: prefix ? (resolvePrefix(prefix, ctx.bindings) ?? "") : "",
    text,
    languageFqn: langAttr
      ? resolveTypeName(langAttr, ctx.bindings, "language")
      : blockEffectiveLanguage(ctx),
    ...(form === "cdata" ? { authoredCharacterDataForm: "cdata" as const } : {}),
    source: elementSourceLoc(ctx.filePath, ctx.source, element),
  };
}

function blockEffectiveLanguage(_ctx: MapContext): string {
  return "org.blockml.bml.language.English";
}

const FREE_TEXT_KEYWORD = "org.blockml.bml.meta.FreeTextKeyword";
const FREE_TEXT_ALIAS = "org.blockml.bml.meta.FreeTextAlias";

function commaSeparatedTokens(text: string): string[] {
  return text
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function mapKeywords(element: Element, ctx: MapContext): KeywordEntry[] {
  const entries: KeywordEntry[] = [];
  const { text } = getCharacterData(element);
  for (const term of commaSeparatedTokens(text)) {
    entries.push({ typeFqn: FREE_TEXT_KEYWORD, term });
  }
  for (const child of elementChildren(element)) {
    const local = elementLocalName(child);
    const prefix = elementPrefix(child);
    const typeFqn = prefix
      ? `${resolvePrefix(prefix, ctx.bindings)}.${local}`
      : `org.blockml.bml.meta.${local}`;
    const term = getAttribute(child, "term");
    const langAttr = getAttribute(child, "language");
    const weightAttr = getAttribute(child, "weight");
    entries.push({
      typeFqn,
      ...(term !== undefined ? { term } : {}),
      ...(langAttr !== undefined
        ? { languageFqn: resolveTypeName(langAttr, ctx.bindings, "language") }
        : {}),
      ...(weightAttr !== undefined ? { weight: Number(weightAttr) } : {}),
    });
  }
  return entries;
}

function mapAliases(element: Element, ctx: MapContext): AliasEntry[] {
  const entries: AliasEntry[] = [];
  const { text } = getCharacterData(element);
  for (const name of commaSeparatedTokens(text)) {
    entries.push({ typeFqn: FREE_TEXT_ALIAS, name });
  }
  for (const child of elementChildren(element)) {
    const local = elementLocalName(child);
    const prefix = elementPrefix(child);
    const typeFqn = prefix
      ? `${resolvePrefix(prefix, ctx.bindings)}.${local}`
      : `org.blockml.bml.meta.${local}`;
    const name = getAttribute(child, "name");
    const langAttr = getAttribute(child, "language");
    const legacyAttr = getAttribute(child, "legacy");
    entries.push({
      typeFqn,
      ...(name !== undefined ? { name } : {}),
      ...(langAttr !== undefined
        ? { languageFqn: resolveTypeName(langAttr, ctx.bindings, "language") }
        : {}),
      ...(legacyAttr !== undefined
        ? { legacy: parseBooleanAttribute(legacyAttr) }
        : {}),
    });
  }
  return entries;
}

function mapChangelog(element: Element, ctx: MapContext): ChangelogEntry[] {
  return elementChildren(element)
    .filter((c) => elementLocalName(c) === "change")
    .map((c) => {
      const langAttr = getAttribute(c, "language");
      return {
        version: getAttribute(c, "version") ?? "",
        text: getCharacterData(c).text,
        ...(langAttr !== undefined
          ? { languageFqn: resolveTypeName(langAttr, ctx.bindings, "language") }
          : {}),
      };
    });
}

function mapExamples(element: Element, ctx: MapContext): DocumentationExample[] {
  const examples: DocumentationExample[] = [];
  for (const child of elementChildren(element)) {
    const local = elementLocalName(child);
    if (local !== "example" && !local.endsWith(":example")) {
      if (local.endsWith(":examples")) {
        examples.push(...mapExamples(child, ctx));
      }
      continue;
    }
    const prefix = elementPrefix(child);
    const { text, form } = getCharacterData(child);
    const langAttr = getAttribute(child, "language");
    const snippetAttr = getAttribute(child, "snippet");
    examples.push({
      title: getAttribute(child, "title") ?? "",
      content: text,
      ...(form === "cdata" ? { authoredCharacterDataForm: "cdata" as const } : {}),
      ...(langAttr !== undefined
        ? { contentLanguageFqn: resolveTypeName(langAttr, ctx.bindings, "language") }
        : {}),
      ...(snippetAttr !== undefined
        ? { snippet: parseBooleanAttribute(snippetAttr) }
        : {}),
      namespace: prefix ? (resolvePrefix(prefix, ctx.bindings) ?? "") : "",
    });
  }
  return examples;
}

function mapReferences(element: Element, ctx: MapContext): DocumentationReference[] {
  return elementChildren(element)
    .filter((c) => elementLocalName(c) === "see")
    .map((c) => {
      const langAttr = getAttribute(c, "language");
      const { text } = getCharacterData(c);
      const empty = elementChildren(c).length === 0 && text.length === 0;
      const ref: DocumentationReference = {
        context: text,
        ...(langAttr !== undefined
          ? { languageFqn: resolveTypeName(langAttr, ctx.bindings, "language") }
          : {}),
        source: elementSourceLoc(ctx.filePath, ctx.source, c),
        ...(empty
          ? {
              authoredEmptyElementForm: elementStartTagIsSelfClosing(ctx.source, c)
                ? ("selfClosing" as const)
                : ("paired" as const),
            }
          : {}),
      };
      for (const attr of ["type", "instance", "file", "url", "property", "aggregation", "association", "capability"] as const) {
        const v = getAttribute(c, attr);
        if (v !== undefined) {
          if (attr === "type") {
            ref.type = resolveBlockReference(v, ctx.bindings, ctx.subBlockIndex, ctx.parentBlockType);
          } else {
            ref[attr] = v;
          }
        }
      }
      const rel = getAttribute(c, "relation");
      if (rel) {
        ref.relationFqn = resolveTypeName(rel, ctx.bindings, "relation");
      }
      return ref;
    });
}

function mapConstraintInstances(element: Element, ctx: MapContext): BlockInstance[] {
  return elementChildren(element)
    .filter((c) => elementLocalName(c) !== "composition")
    .map((c) => mapBlockInstanceNode(c, ctx).instance);
}

function mapMemberConstraints(
  element: Element,
  target: { constraints?: BlockInstance[] },
  ctx: MapContext,
) {
  const cEl = elementChildren(element).find((c) => elementLocalName(c) === "constraints");
  if (cEl) {
    target.constraints = mapConstraintInstances(cEl, ctx);
  }
}

function mapContracts(element: Element, ctx: MapContext): TypeReferenceEntityInstance[] {
  const contracts: TypeReferenceEntityInstance[] = [];
  for (const child of elementChildren(element)) {
    if (elementLocalName(child) === "composition") {
      for (const inst of elementChildren(child)) {
        if (isTypeReferenceEntitySugar(inst, ctx)) {
          const { inst: tre } = mapTypeReferenceEntityInstance(inst, ctx);
          contracts.push(tre);
        }
      }
      continue;
    }
    if (isTypeReferenceEntitySugar(child, ctx)) {
      const { inst } = mapTypeReferenceEntityInstance(child, ctx);
      contracts.push(inst);
    }
  }
  return contracts;
}

function typeResolveOptions(ctx: MapContext): TypeExpressionResolveOptions {
  const options: TypeExpressionResolveOptions = {
    subBlockIndex: ctx.subBlockIndex,
  };
  if (ctx.parentBlockType) {
    options.currentTypeFqn = ctx.parentBlockType;
  }
  return options;
}

function isRichNamedType(expr: TypeExpression): boolean {
  return (
    expr.kind === "named" &&
    ((expr.typeArguments?.length ?? 0) > 0 ||
      expr.instanceConfiguration !== undefined ||
      expr.multiplicity !== undefined)
  );
}

function parseBaseType(
  raw: string,
  ctx: MapContext,
  fallbackParent?: string,
): { fqn: string; expression?: TypeExpression } {
  const expr = parseTypeExpression(raw, ctx.bindings, "type", typeResolveOptions(ctx));
  if (expr.kind === "named") {
    if (isRichNamedType(expr)) {
      return { fqn: expr.fqn, expression: expr };
    }
    return { fqn: expr.fqn };
  }
  return {
    fqn: resolveBlockReference(raw, ctx.bindings, ctx.subBlockIndex, fallbackParent),
    expression: expr,
  };
}

function namedTypeFqn(raw: string, ctx: MapContext, fallbackParent?: string): string {
  return parseBaseType(raw, ctx, fallbackParent).fqn;
}

function mapGenericTypes(element: Element, ctx: MapContext): GenericType[] {
  return elementChildren(element).map((c) => {
    const defaultType = getAttribute(c, "defaultType");
    const raw =
      getAttribute(c, "baseType") ?? getTextOrAttr(c) ?? "org.blockml.bml.core.Block";
    return {
      name: elementLocalName(c),
      baseType: withElementLocation(ctx.filePath, ctx.source, c, () =>
        namedTypeFqn(raw, ctx, ctx.parentBlockType),
      ),
      ...(defaultType !== undefined ? { defaultType } : {}),
    };
  });
}

function mapPropertyValues(
  element: Element,
  prop: PropertyDefinition,
  typeFqn: string,
  ctx: MapContext,
) {
  const entries: PropertyValueEntry[] = [];
  const seenNamespaces = new Set<string>();
  const extras: UnknownXmlNode[] = [];

  const addEntry = (
    ns: string,
    val: MemberValue,
    child: Element | undefined,
    source?: SourceLocation,
  ) => {
    if (seenNamespaces.has(ns)) {
      reportDuplicatePropertyValue(child ?? element, ctx, source);
      if (child) {
        extras.push(toUnknownXmlNode(child, ctx));
      }
      return;
    }
    seenNamespaces.add(ns);
    entries.push({ namespace: ns, value: val });
    if (ns === "") {
      prop.value = val;
    }
  };

  for (const child of elementChildren(element)) {
    const local = elementLocalName(child);
    if (local !== "value" && !local.endsWith(":value")) {
      continue;
    }
    const prefix = elementPrefix(child);
    const ns = prefix ? (resolvePrefix(prefix, ctx.bindings) ?? "") : "";
    const attrVal = local === "value" ? getAttribute(child, "value") : undefined;
    const { text } = getCharacterData(child);
    const raw = attrVal ?? text;
    const val = parseMemberValue(raw, typeFqn, ctx.filePath, 1, 1, "element");
    if (val) {
      addEntry(ns, val, child);
    }
  }
  const attrVal = getAttribute(element, "value");
  if (attrVal !== undefined) {
    const val = parseMemberValue(attrVal, typeFqn, ctx.filePath, 1, 1, "attribute");
    if (val) {
      const loc = attributeValueLoc(ctx.filePath, ctx.source, element, "value", attrVal);
      addEntry("", val, undefined, loc);
    }
  }
  if (entries.length > 0) {
    prop.values = entries;
  }
  if (extras.length > 0) {
    prop.unknownElements = extras;
  }
}

function mapMemberGroups(
  element: Element,
  target: { groups?: TypeReferenceEntityInstance[] },
  ctx: MapContext,
) {
  const gEl = elementChildren(element).find((c) => elementLocalName(c) === "groups");
  if (!gEl) {
    return;
  }
  target.groups = [];
  for (const child of elementChildren(gEl)) {
    if (isTypeReferenceEntitySugar(child, ctx)) {
      const { inst } = mapTypeReferenceEntityInstance(child, ctx);
      target.groups.push(inst);
    }
  }
}

function mapSuggestions(element: Element, prop: PropertyDefinition, ctx: MapContext) {
  const sugEl = elementChildren(element).find((c) => elementLocalName(c) === "suggestions");
  if (!sugEl) {
    return;
  }
  prop.suggestions = elementChildren(sugEl).map((c) => {
    const local = elementLocalName(c);
    const loc = elementSourceLoc(ctx.filePath, ctx.source, c);
    const memberValues: Record<string, MemberValue> = {};
    if (c.attributes) {
      for (let i = 0; i < c.attributes.length; i++) {
        const attr = c.attributes.item(i)!;
        if (attr.name.startsWith("xmlns") || attr.name.startsWith("xsi:")) {
          continue;
        }
        const val = parseMemberValue(
          attr.value,
          local,
          ctx.filePath,
          loc.line,
          loc.column,
          "attribute",
        );
        if (val !== undefined) {
          memberValues[attr.name] = val;
        }
      }
    }
    return {
      typeFqn: local,
      memberValues,
      source: loc,
    } satisfies BlockInstance;
  });
}

function mapImplementation(element: Element, ctx: MapContext): ImplementationBlock {
  const langRaw = getAttribute(element, "language") ?? "";
  const { text, form } = getCharacterData(element);
  const embeddedExpressions: EmbeddedExpression[] = [];
  let searchFrom = 0;
  while (true) {
    const start = text.indexOf("<$", searchFrom);
    if (start === -1) {
      break;
    }
    const end = text.indexOf("$>", start);
    if (end === -1) {
      break;
    }
    embeddedExpressions.push({
      raw: text.slice(start + 2, end).trim(),
      start,
      end: end + 2,
    });
    searchFrom = end + 2;
  }
  return {
    languageFqn: resolveTypeName(langRaw, ctx.bindings, "language"),
    source: text,
    ...(form === "cdata" ? { authoredCharacterDataForm: "cdata" as const } : {}),
    embeddedExpressions,
  };
}

const CORE_EXCEPTION = "org.blockml.bml.core.Exception";

function mapThrowsReference(
  child: Element,
  ctx: MapContext,
): TypeReferenceEntityInstance | undefined {
  if (isTypeReferenceEntitySugar(child, ctx)) {
    const { inst } = mapTypeReferenceEntityInstance(child, ctx, CORE_EXCEPTION);
    return inst;
  }
  if (elementLocalName(child) === "TypeReferenceEntity") {
    const valueRaw = getAttribute(child, "value") ?? getTextOrAttr(child);
    if (!valueRaw) {
      return undefined;
    }
    let value: string;
    try {
      value = resolveBlockReference(
        valueRaw,
        ctx.bindings,
        ctx.subBlockIndex,
        ctx.parentBlockType,
      );
    } catch {
      try {
        value = resolveTypeName(valueRaw, ctx.bindings, "type");
      } catch {
        value = valueRaw;
      }
    }
    return {
      typeFqn: TYPE_REFERENCE_ENTITY,
      value,
      boundB: CORE_EXCEPTION,
    };
  }
  return undefined;
}

function mapCapabilityThrows(
  element: Element,
  cap: CapabilityDefinition,
  ctx: MapContext,
): void {
  const throwsEl = elementChildren(element).find((c) => elementLocalName(c) === "throws");
  if (!throwsEl) {
    return;
  }
  cap.throws = [];
  const mapChild = (child: Element) => {
    const inst = mapThrowsReference(child, ctx);
    if (inst) {
      cap.throws!.push(inst);
      return;
    }
    reportUnknownElement(child, ctx);
  };
  for (const child of elementChildren(throwsEl)) {
    if (elementLocalName(child) === "composition") {
      for (const inst of elementChildren(child)) {
        mapChild(inst);
      }
      continue;
    }
    mapChild(child);
  }
}

export function mapBlock(element: Element, ctx: MapContext): BlockDefinition {
  return mapBlockDefinition(element, ctx);
}

export function mapDocumentBlock(
  element: Element,
  filePath: string,
  source: string,
  bindings: Record<string, string>,
  diagnostics: Diagnostic[] = [],
): BlockDefinition {
  const ctx = createMapContext(filePath, source, bindings, { isRoot: true, diagnostics });
  return withElementLocation(filePath, source, element, () => mapBlockDefinition(element, ctx));
}
