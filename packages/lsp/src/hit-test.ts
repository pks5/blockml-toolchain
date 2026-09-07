import type { BlockDefinition, MemberDefinition } from "@blockml/bom";
import {
  isDocumentRootLocalName,
  parse,
  resolveTypeName,
  type ImplicitNamespaceContext,
} from "@blockml/parser";
import { resolveEffectiveMembers } from "@blockml/framework";
import { bomLocationToRange, type LspPosition, type LspRange } from "./positions.js";
import {
  isXmlnsAttribute,
  qnameAt,
  rangeContains,
  xmlLocalName,
  xmlTokenAt,
  type XmlToken,
} from "./xml-token.js";
import type { WorkspaceState } from "./workspace.js";

const MEMBER_SECTIONS = new Set(["properties", "aggregations", "associations", "capabilities"]);

const TYPE_SLOT_ATTRIBUTES = new Set([
  "type",
  "baseType",
  "inputType",
  "outputType",
  "language",
  "contentLanguage",
  "relation",
  "defaultType",
]);

const TYPE_REF_SUGAR_PARENTS = new Set(["language", "contracts", "groups"]);

const LANGUAGE_ELEMENT_NAMES = new Set([
  "block",
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
  "properties",
  "aggregations",
  "associations",
  "capabilities",
  "see",
  "change",
  "example",
  "composition",
  "implementation",
  "xml",
]);

const ROOT_BLOCK_DEFINITION = "org.blockml.bml.definition.RootBlockDefinition";
const SUB_BLOCK_DEFINITION = "org.blockml.bml.definition.SubBlockDefinition";
const EMBEDDED_BLOCK_DEFINITION = "org.blockml.bml.definition.EmbeddedBlockDefinition";
const PROPERTY_DEFINITION = "org.blockml.bml.definition.PropertyDefinition";
const AGGREGATION_DEFINITION = "org.blockml.bml.definition.AggregationDefinition";
const ASSOCIATION_DEFINITION = "org.blockml.bml.definition.AssociationDefinition";
const CAPABILITY_DEFINITION = "org.blockml.bml.definition.CapabilityDefinition";
const REFERENCE_DEFINITION = "org.blockml.bml.definition.StructuralDefinition.Reference";

export interface TypeRefHit {
  kind: "typeRef";
  fqn: string;
  block: BlockDefinition;
  range: LspRange;
}

export interface MemberHit {
  kind: "member";
  member: MemberDefinition;
  range: LspRange;
  typeFqn?: string;
}

export interface LanguageHit {
  kind: "language";
  metaFqn: string;
  range: LspRange;
  member?: MemberDefinition;
}

export type Hit = TypeRefHit | MemberHit | LanguageHit;

export function memberTypeFqn(member: MemberDefinition): string | undefined {
  switch (member.kind) {
    case "property":
    case "capability":
      return member.typeFqn || undefined;
    case "association":
      return member.type.kind === "named" ? member.type.fqn : undefined;
    case "aggregation":
      return member.type?.kind === "named" ? member.type.fqn : undefined;
  }
}

export function navigationFqn(hit: Hit): string | undefined {
  return hit.kind === "typeRef" ? hit.fqn : undefined;
}

export function resolveAuthoredTypeRef(
  raw: string,
  bindings: Record<string, string>,
  context?: ImplicitNamespaceContext,
): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const qualified = trimmed.includes(":") || trimmed.includes(".");
  if (!qualified && context === undefined) {
    return undefined;
  }
  try {
    return resolveTypeName(trimmed, bindings, context ?? "type");
  } catch {
    return undefined;
  }
}

function implicitContextFor(
  token: XmlToken,
  enclosing: MemberDefinition | undefined,
): ImplicitNamespaceContext | undefined {
  if (token.kind === "attributeValue") {
    const attr = xmlLocalName(token.attributeName ?? "");
    if (!TYPE_SLOT_ATTRIBUTES.has(attr)) {
      return undefined;
    }
    if (attr === "language" || attr === "contentLanguage") {
      return "language";
    }
    if (attr === "relation") {
      return "relation";
    }
    if (attr === "type" && enclosing?.kind === "capability") {
      return "capability";
    }
    return "type";
  }
  if (token.kind === "text") {
    if (token.elementLocalName === "language") {
      return "language";
    }
    if (token.elementLocalName === "status") {
      return "status";
    }
    return undefined;
  }
  return undefined;
}

function parentLocal(token: XmlToken): string | undefined {
  return token.ancestors.length >= 2 ? token.ancestors[token.ancestors.length - 2] : undefined;
}

function isDocumentRootElement(token: XmlToken): boolean {
  return token.ancestors.length === 1 && isDocumentRootLocalName(token.elementLocalName);
}

function isDefinitionParent(parent: string | undefined, token: XmlToken): boolean {
  if (!parent) {
    return false;
  }
  if (parent === "block") {
    return true;
  }
  return isDocumentRootLocalName(parent) && token.ancestors[0] === parent;
}

function innermostBlock(
  block: BlockDefinition,
  text: string,
  position: LspPosition,
): BlockDefinition | undefined {
  const range = block.source ? bomLocationToRange(block.source, text) : undefined;
  if (range && !rangeContains(range, position)) {
    return undefined;
  }
  for (const nested of [...block.subBlocks, ...block.embeddedBlocks]) {
    const inner = innermostBlock(nested, text, position);
    if (inner) {
      return inner;
    }
  }
  return block;
}

function memberKindDefFqn(kind: MemberDefinition["kind"]): string {
  switch (kind) {
    case "property":
      return PROPERTY_DEFINITION;
    case "aggregation":
      return AGGREGATION_DEFINITION;
    case "association":
      return ASSOCIATION_DEFINITION;
    case "capability":
      return CAPABILITY_DEFINITION;
  }
}

function blockMetaFqn(block: BlockDefinition, token: XmlToken): string {
  if (block.definitionFqn) {
    return block.definitionFqn;
  }
  if (token.ancestors.includes("embeddedBlocks")) {
    return EMBEDDED_BLOCK_DEFINITION;
  }
  if (token.ancestors.includes("subBlocks")) {
    return SUB_BLOCK_DEFINITION;
  }
  return ROOT_BLOCK_DEFINITION;
}

function languageLocalName(token: XmlToken): string {
  if (token.kind === "attributeName" || token.kind === "attributeValue") {
    return xmlLocalName(token.attributeName ?? token.text);
  }
  if (token.kind === "elementName") {
    return token.elementLocalName;
  }
  return token.elementLocalName;
}

function enclosingMember(
  token: XmlToken,
  block: BlockDefinition | undefined,
): MemberDefinition | undefined {
  if (!block) {
    return undefined;
  }
  const sectionIdx = token.ancestors.findIndex((name) => MEMBER_SECTIONS.has(name));
  if (sectionIdx >= 0 && token.ancestors.length > sectionIdx + 1) {
    const memberName = token.ancestors[sectionIdx + 1]!;
    return block.members.find((member) => member.name === memberName);
  }
  const parent = parentLocal(token);
  if (isDefinitionParent(parent, token) && !LANGUAGE_ELEMENT_NAMES.has(token.elementLocalName)) {
    return block.members.find((member) => member.name === token.elementLocalName);
  }
  return undefined;
}

function isDomainMemberTag(token: XmlToken): boolean {
  if (token.kind !== "elementName") {
    return false;
  }
  const parent = parentLocal(token);
  if (parent && MEMBER_SECTIONS.has(parent)) {
    return token.ancestors[token.ancestors.length - 1] === token.elementLocalName;
  }
  return isDefinitionParent(parent, token) && !LANGUAGE_ELEMENT_NAMES.has(token.elementLocalName);
}

function lookupLanguageMember(
  workspace: WorkspaceState,
  metaFqn: string,
  localName: string,
): MemberDefinition | undefined {
  const meta = workspace.registry.get(metaFqn)?.block;
  if (!meta) {
    return undefined;
  }
  const aliases = localName === "isnot" ? ["isNot", "isnot"] : [localName];
  const effective = resolveEffectiveMembers(meta, workspace.registry);
  return effective.find((member) => aliases.includes(member.name));
}

function languageHit(
  token: XmlToken,
  enclosing: BlockDefinition | undefined,
  workspace: WorkspaceState,
): LanguageHit | null {
  if (isXmlnsAttribute(token.attributeName ?? (token.kind === "attributeName" ? token.text : undefined))) {
    return null;
  }

  const current = token.elementLocalName;
  const parent = parentLocal(token);
  let metaFqn: string;
  if (current === "see" || parent === "see") {
    metaFqn = REFERENCE_DEFINITION;
  } else {
    const domain = enclosingMember(token, enclosing);
    if (domain && !isDomainMemberTag(token)) {
      metaFqn = memberKindDefFqn(domain.kind);
    } else if (enclosing) {
      metaFqn = blockMetaFqn(enclosing, token);
    } else {
      metaFqn = ROOT_BLOCK_DEFINITION;
    }
  }

  const localName = languageLocalName(token);
  const member = lookupLanguageMember(workspace, metaFqn, localName);
  if (member) {
    return { kind: "language", metaFqn, member, range: token.range };
  }
  if (
    token.kind === "elementName" &&
    (localName === "see" || localName === "block" || isDocumentRootElement(token))
  ) {
    return { kind: "language", metaFqn, range: token.range };
  }
  return null;
}

export function hitAt(
  text: string,
  filePath: string,
  position: LspPosition,
  workspace: WorkspaceState,
): Hit | null {
  const parseResult = parse(text, { filePath, continueOnError: true });
  if (!parseResult.document) {
    return null;
  }

  const token = xmlTokenAt(text, position);
  if (!token) {
    return null;
  }

  const bindings = parseResult.document.source.namespaceBindings ?? {};
  const enclosing = innermostBlock(parseResult.document.block, text, position) ?? parseResult.document.block;
  const domain = enclosingMember(token, enclosing);

  if (
    (token.kind === "text" || token.kind === "attributeValue") &&
    !isXmlnsAttribute(token.attributeName)
  ) {
    const qn = qnameAt(token, position, text);
    if (qn) {
      const fqn = resolveAuthoredTypeRef(qn.text, bindings, implicitContextFor(token, domain));
      if (fqn) {
        return { kind: "typeRef", fqn, block: enclosing, range: qn.range };
      }
    }
  }

  if (token.kind === "elementName") {
    const parent = parentLocal(token);
    const isSugar =
      !!parent &&
      TYPE_REF_SUGAR_PARENTS.has(parent) &&
      !LANGUAGE_ELEMENT_NAMES.has(token.elementLocalName);
    if (token.text.includes(":") || isSugar) {
      const context: ImplicitNamespaceContext | undefined = isSugar
        ? parent === "language"
          ? "language"
          : "type"
        : undefined;
      const fqn = resolveAuthoredTypeRef(token.text, bindings, context);
      if (fqn) {
        return { kind: "typeRef", fqn, block: enclosing, range: token.range };
      }
    }
  }

  if (isDomainMemberTag(token)) {
    const member = enclosingMember(token, enclosing);
    if (member) {
      const hit: MemberHit = { kind: "member", member, range: token.range };
      const typeFqn = memberTypeFqn(member);
      if (typeFqn) {
        hit.typeFqn = typeFqn;
      }
      return hit;
    }
  }

  return languageHit(token, enclosing, workspace);
}
