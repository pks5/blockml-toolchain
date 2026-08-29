import type {
  AggregationDefinition,
  AssociationDefinition,
  BlockDefinition,
  CapabilityDefinition,
  DocumentationExample,
  DocumentationProseEntry,
  DocumentationReference,
  MemberDefinition,
  PropertyDefinition,
  TypeReferenceEntityInstance,
  UnknownXmlNode,
} from "@blockml/bom";
import type { EmitContext } from "./context.js";
import { emitTypeExpression } from "./type-expression.js";
import { fqnToQName, visibilityPrefix } from "./qname.js";
import {
  emitCharacterData,
  escapeAttr,
  escapeText,
  formatBoolean,
  XmlWriter,
} from "./xml.js";
import {
  emitBlockInstance,
  emitCompositionTemplate,
  emitConstraintInstances,
  emitTypeReferenceEntity,
} from "./composition.js";

const BLOCK_EMIT_ORDER: Array<
  | "name"
  | "type"
  | "baseType"
  | "is"
  | "isNot"
  | "version"
  | "definition"
  | "since"
  | "status"
  | "summary"
  | "documentation"
  | "abstract"
  | "final"
  | "keywords"
  | "changelog"
  | "examples"
  | "references"
  | "constraints"
  | "aliases"
  | "language"
  | "genericTypes"
  | "contracts"
  | "properties"
  | "aggregations"
  | "associations"
  | "capabilities"
  | "subBlocks"
  | "embeddedBlocks"
  | "bml:xml"
> = [
  "name",
  "type",
  "baseType",
  "is",
  "isNot",
  "version",
  "definition",
  "since",
  "status",
  "summary",
  "documentation",
  "abstract",
  "final",
  "keywords",
  "changelog",
  "examples",
  "references",
  "constraints",
  "aliases",
  "language",
  "genericTypes",
  "contracts",
  "properties",
  "aggregations",
  "associations",
  "capabilities",
  "subBlocks",
  "embeddedBlocks",
  "bml:xml",
];

export function emitBlockDefinition(
  writer: XmlWriter,
  block: BlockDefinition,
  ctx: EmitContext,
): void {
  for (const key of BLOCK_EMIT_ORDER) {
    emitBlockField(writer, block, key, ctx);
  }
  emitUnknownXmlNodes(writer, block.unknownElements);
}

function emitBlockField(
  writer: XmlWriter,
  block: BlockDefinition,
  key: (typeof BLOCK_EMIT_ORDER)[number],
  ctx: EmitContext,
): void {
  switch (key) {
    case "name":
      if (block.name) {
        emitSimpleElement(writer, "name", block.name);
      }
      break;
    case "type":
      if (block.type) {
        emitSimpleElement(
          writer,
          "type",
          ctx.useQName ? fqnToQName(block.type, ctx.bindings) : block.type,
        );
      }
      break;
    case "baseType":
      if (block.baseTypeExpression) {
        emitSimpleElement(
          writer,
          "baseType",
          emitTypeExpression(block.baseTypeExpression, ctx.bindings, ctx.useQName),
        );
      } else if (block.baseType) {
        emitSimpleElement(
          writer,
          "baseType",
          ctx.useQName ? fqnToQName(block.baseType, ctx.bindings) : block.baseType,
        );
      }
      break;
    case "is":
      if (block.is) {
        emitSimpleElement(writer, "is", block.is);
      }
      break;
    case "isNot":
      if (block.isNot) {
        emitSimpleElement(writer, "isnot", block.isNot);
      }
      break;
    case "version":
      if (block.version) {
        emitSimpleElement(writer, "version", block.version);
      }
      break;
    case "definition":
      if (block.definitionFqn) {
        emitSimpleElement(
          writer,
          "definition",
          ctx.useQName
            ? fqnToQName(block.definitionFqn, ctx.bindings)
            : block.definitionFqn,
        );
      }
      break;
    case "since":
      if (block.since) {
        emitSimpleElement(writer, "since", block.since);
      }
      break;
    case "abstract":
      if (block.abstract) {
        emitSimpleElement(writer, "abstract", formatBoolean(block.abstract));
      }
      break;
    case "final":
      if (block.final) {
        emitSimpleElement(writer, "final", formatBoolean(block.final));
      }
      break;
    case "summary":
      for (const s of block.summaries ?? []) {
        emitProse(writer, "summary", s, ctx);
      }
      break;
    case "documentation":
      for (const d of block.documentations ?? []) {
        emitProse(writer, "documentation", d, ctx);
      }
      break;
    case "keywords":
      if (block.keywords?.length) {
        writer.line("<keywords>");
        writer.pushDepth();
        for (const kw of block.keywords) {
          const qn = ctx.useQName
            ? fqnToQName(kw.typeFqn, ctx.bindings)
            : kw.typeFqn.split(".").pop()!;
          const attrs = [
            kw.term ? `term="${escapeAttr(kw.term)}"` : "",
            kw.weight !== undefined ? `weight="${kw.weight}"` : "",
          ]
            .filter(Boolean)
            .join(" ");
          writer.line(`<${qn}${attrs ? " " + attrs : ""} />`);
        }
        writer.popDepth();
        writer.line("</keywords>");
      }
      break;
    case "changelog":
      if (block.changelog?.length) {
        writer.line("<changelog>");
        writer.pushDepth();
        for (const ch of block.changelog) {
          const attrs = [`version="${escapeAttr(ch.version)}"`]
            .filter(Boolean)
            .join(" ");
          writer.line(`<change ${attrs}>`);
          writer.pushDepth();
          emitCharacterData(writer, ch.text);
          writer.popDepth();
          writer.line("</change>");
        }
        writer.popDepth();
        writer.line("</changelog>");
      }
      break;
    case "examples":
      if (block.examples?.length) {
        emitExamples(writer, block.examples, ctx, "examples");
      }
      break;
    case "references":
      if (block.references?.length) {
        writer.line("<references>");
        writer.pushDepth();
        for (const ref of block.references) {
          emitReference(writer, ref, ctx);
        }
        writer.popDepth();
        writer.line("</references>");
      }
      break;
    case "constraints":
      if (block.constraints?.length) {
        emitConstraintInstances(writer, block.constraints, ctx);
      }
      break;
    case "aliases":
      if (block.aliases?.length) {
        writer.line("<aliases>");
        writer.pushDepth();
        for (const a of block.aliases) {
          const qn = ctx.useQName
            ? fqnToQName(a.typeFqn, ctx.bindings)
            : a.typeFqn.split(".").pop()!;
          const attrs = [
            a.name ? `name="${escapeAttr(a.name)}"` : "",
            a.legacy ? `legacy="true"` : "",
          ]
            .filter(Boolean)
            .join(" ");
          writer.line(`<${qn}${attrs ? " " + attrs : ""} />`);
        }
        writer.popDepth();
        writer.line("</aliases>");
      }
      break;
    case "language":
      if (block.language) {
        writer.line("<language>");
        writer.pushDepth();
        emitTypeReferenceEntity(writer, block.language.value, ctx);
        writer.popDepth();
        writer.line("</language>");
      }
      break;
    case "genericTypes":
      if (block.genericTypes?.length) {
        writer.line("<genericTypes>");
        writer.pushDepth();
        for (const gt of block.genericTypes) {
          const attrs = [
            `baseType="${escapeAttr(ctx.useQName ? fqnToQName(gt.baseType, ctx.bindings) : gt.baseType)}"`,
            gt.defaultType ? `defaultType="${escapeAttr(gt.defaultType)}"` : "",
          ]
            .filter(Boolean)
            .join(" ");
          writer.line(`<${gt.name} ${attrs} />`);
        }
        writer.popDepth();
        writer.line("</genericTypes>");
      }
      break;
    case "contracts":
      if (block.contracts?.length) {
        writer.line("<contracts>");
        writer.pushDepth();
        for (const c of block.contracts) {
          emitTypeReferenceEntity(writer, c.value, ctx);
        }
        writer.popDepth();
        writer.line("</contracts>");
      }
      break;
    case "properties":
      emitMemberSection(writer, block.members.filter((m) => m.kind === "property"), "properties", ctx);
      break;
    case "aggregations": {
      const sectionMembers = block.members.filter(
        (m) => m.kind === "aggregation" && m.authoredInAggregationsSection !== false,
      );
      const directMembers = block.members.filter(
        (m) => m.kind === "aggregation" && m.authoredInAggregationsSection === false,
      );
      emitMemberSection(writer, sectionMembers, "aggregations", ctx);
      for (const m of directMembers) {
        emitMember(writer, m, ctx);
      }
      break;
    }
    case "associations":
      emitMemberSection(
        writer,
        block.members.filter((m) => m.kind === "association"),
        "associations",
        ctx,
      );
      break;
    case "capabilities":
      emitMemberSection(
        writer,
        block.members.filter((m) => m.kind === "capability"),
        "capabilities",
        ctx,
      );
      break;
    case "subBlocks":
      if (block.subBlocks.length) {
        writer.line("<subBlocks>");
        writer.pushDepth();
        for (const sb of block.subBlocks) {
          emitNestedBlock(writer, sb, ctx);
        }
        writer.popDepth();
        writer.line("</subBlocks>");
      }
      break;
    case "embeddedBlocks":
      if (block.embeddedBlocks.length) {
        writer.line("<embeddedBlocks>");
        writer.pushDepth();
        for (const eb of block.embeddedBlocks) {
          emitNestedBlock(writer, eb, ctx);
        }
        writer.popDepth();
        writer.line("</embeddedBlocks>");
      }
      break;
    case "bml:xml":
      if (block.xmlRendering) {
        if (block.xmlRendering.raw.startsWith("${")) {
          writer.line(`<bml:xml>${block.xmlRendering.raw}</bml:xml>`);
        } else {
          writer.line(`<bml:xml>${block.xmlRendering.raw}</bml:xml>`);
        }
      }
      break;
  }
}

function emitNestedBlock(
  writer: XmlWriter,
  block: BlockDefinition,
  ctx: EmitContext,
): void {
  writer.comments(block.xmlTrivia);
  writer.line("<block>");
  writer.pushDepth();
  emitBlockDefinition(writer, block, ctx);
  writer.popDepth();
  writer.line("</block>");
  writer.comments(block.xmlTrivia, true);
}

function emitSimpleElement(writer: XmlWriter, tag: string, text: string): void {
  writer.line(`<${tag}>`);
  writer.pushDepth();
  emitCharacterData(writer, text);
  writer.popDepth();
  writer.line(`</${tag}>`);
}

function emitUnknownXmlNodes(writer: XmlWriter, nodes: UnknownXmlNode[] | undefined): void {
  if (!nodes?.length) {
    return;
  }
  for (const node of nodes) {
    emitUnknownXmlNode(writer, node);
  }
}

function emitUnknownXmlNode(writer: XmlWriter, node: UnknownXmlNode): void {
  const tag = node.prefix ? `${node.prefix}:${node.localName}` : node.localName;
  const attrText = Object.entries(node.attributes)
    .map(([name, value]) => `${name}="${escapeAttr(value)}"`)
    .join(" ");
  const open = attrText ? `<${tag} ${attrText}` : `<${tag}`;
  if (node.innerXml) {
    writer.line(`${open}>${node.innerXml}</${tag}>`);
  } else {
    writer.line(`${open} />`);
  }
}

function emitProse(
  writer: XmlWriter,
  tag: string,
  entry: DocumentationProseEntry,
  ctx: EmitContext,
): void {
  const prefix = entry.namespace
    ? Object.entries(ctx.bindings).find(([, v]) => v === entry.namespace)?.[0]
    : undefined;
  const qtag = prefix ? `${prefix}:${tag}` : tag;
  writer.line(`<${qtag}>`);
  writer.pushDepth();
  emitCharacterData(writer, entry.text, entry.authoredCharacterDataForm);
  writer.popDepth();
  writer.line(`</${qtag}>`);
}

function emitExamples(
  writer: XmlWriter,
  examples: DocumentationExample[],
  ctx: EmitContext,
  containerTag: string,
): void {
  writer.line(`<${containerTag}>`);
  writer.pushDepth();
  for (const ex of examples) {
    const prefix = ex.namespace
      ? Object.entries(ctx.bindings).find(([, v]) => v === ex.namespace)?.[0]
      : undefined;
    const tag = prefix ? `${prefix}:example` : "example";
    const attrs = [
      `title="${escapeAttr(ex.title)}"`,
      ex.contentLanguageFqn ? `language="${escapeAttr(ex.contentLanguageFqn)}"` : "",
      ex.snippet ? `snippet="true"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    writer.line(`<${tag} ${attrs}>`);
    writer.pushDepth();
    emitCharacterData(writer, ex.content, ex.authoredCharacterDataForm);
    writer.popDepth();
    writer.line(`</${tag}>`);
  }
  writer.popDepth();
  writer.line(`</${containerTag}>`);
}

function emitMemberXmlRendering(
  attrs: string[],
  xmlRendering: MemberDefinition["xmlRendering"],
): void {
  if (!xmlRendering?.raw) {
    return;
  }
  if (xmlRendering.authoredPlacement === "attribute") {
    attrs.push(`bml:xml="${escapeAttr(xmlRendering.raw)}"`);
  }
}

function emitReference(
  writer: XmlWriter,
  ref: DocumentationReference,
  ctx: EmitContext,
): void {
  const attrs = [
    ref.type ? `type="${escapeAttr(ctx.useQName ? fqnToQName(ref.type, ctx.bindings) : ref.type)}"` : "",
    ref.instance ? `instance="${escapeAttr(ref.instance)}"` : "",
    ref.file ? `file="${escapeAttr(ref.file)}"` : "",
    ref.url ? `url="${escapeAttr(ref.url)}"` : "",
    ref.property ? `property="${escapeAttr(ref.property)}"` : "",
    ref.aggregation ? `aggregation="${escapeAttr(ref.aggregation)}"` : "",
    ref.association ? `association="${escapeAttr(ref.association)}"` : "",
    ref.capability ? `capability="${escapeAttr(ref.capability)}"` : "",
    ref.relationFqn ? `relation="${escapeAttr(ref.relationFqn.split(".").pop()!)}"` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const attrStr = attrs ? ` ${attrs}` : "";
  if (!ref.context.trim()) {
    writer.line(`<see${attrStr} />`);
    return;
  }
  writer.line(`<see${attrStr}>`);
  writer.pushDepth();
  emitCharacterData(writer, ref.context);
  writer.popDepth();
  writer.line("</see>");
}

function emitMemberSection(
  writer: XmlWriter,
  members: MemberDefinition[],
  section: string,
  ctx: EmitContext,
): void {
  if (!members.length) {
    return;
  }
  writer.line(`<${section}>`);
  writer.pushDepth();
  for (const m of members) {
    emitMember(writer, m, ctx);
  }
  writer.popDepth();
  writer.line(`</${section}>`);
}

function emitMember(writer: XmlWriter, member: MemberDefinition, ctx: EmitContext): void {
  writer.comments(member.xmlTrivia);
  const prefix = visibilityPrefix(member.visibility);
  const nsPrefix = member.namespace
    ? Object.entries(ctx.bindings).find(([, v]) => v === member.namespace)?.[0]
    : undefined;
  const tag = nsPrefix ? `${nsPrefix}:${prefix}${member.name}` : `${prefix}${member.name}`;

  const attrs: string[] = [];
  if (member.readOnly) attrs.push('readOnly="true"');
  if (member.abstract) attrs.push('abstract="true"');
  if (member.final) attrs.push('final="true"');
  if (member.override) attrs.push('override="true"');
  emitMemberXmlRendering(attrs, member.xmlRendering);
  if (member.unknownAttributes) {
    for (const [name, value] of Object.entries(member.unknownAttributes)) {
      attrs.push(`${name}="${escapeAttr(value)}"`);
    }
  }

  switch (member.kind) {
    case "property": {
      const typeAttr = member.type
        ? emitTypeExpression(member.type, ctx.bindings, ctx.useQName)
        : member.typeFqn
          ? ctx.useQName
            ? fqnToQName(member.typeFqn, ctx.bindings)
            : member.typeFqn
          : "";
      if (typeAttr) {
        attrs.push(`type="${escapeAttr(typeAttr)}"`);
      }
      const hasBody =
        member.values?.length ||
        member.documentations?.length ||
        member.constraints?.length ||
        member.suggestions?.length ||
        member.groups?.length ||
        member.examples?.length ||
        member.changelog?.length ||
        member.since !== undefined ||
        member.summaries?.length ||
        member.references?.length ||
        member.keywords?.length ||
        member.xmlRendering?.authoredPlacement === "element" ||
        (member.unknownElements?.length ?? 0) > 0;
      if (!hasBody && !("authoredPlacement" in (member.value ?? {}) && member.value && "authoredPlacement" in member.value && member.value.authoredPlacement === "element")) {
        if (member.value) {
          attrs.push(`value="${emitLiteralAttr(member.value)}"`);
        }
        writer.line(`<${tag} ${attrs.join(" ")} />`);
        break;
      }
      writer.line(`<${tag} ${attrs.join(" ")}>`);
      writer.pushDepth();
      if (member.xmlRendering?.authoredPlacement === "element" && member.xmlRendering.raw) {
        writer.line(`<bml:xml>${member.xmlRendering.raw}</bml:xml>`);
      }
      emitMemberCommonChildren(writer, member, ctx);
      emitMemberGroups(writer, member.groups, ctx);
      const valueEntries =
        member.values?.length
          ? member.values
          : member.value
            ? [{ namespace: "", value: member.value }]
            : [];
      for (const v of valueEntries) {
        if (
          "authoredPlacement" in v.value &&
          v.value.authoredPlacement === "attribute"
        ) {
          continue;
        }
        const facetPrefix = v.namespace
          ? Object.entries(ctx.bindings).find(([, uri]) => uri === v.namespace)?.[0]
          : undefined;
        const vtag = facetPrefix ? `${facetPrefix}:value` : "value";
        writer.line(`<${vtag}>${emitLiteralBody(v.value)}</${vtag}>`);
      }
      if (member.suggestions?.length) {
        writer.line("<suggestions>");
        writer.pushDepth();
        for (const s of member.suggestions) {
          const tag = s.typeFqn.includes(".") ? s.typeFqn.split(".").pop()! : s.typeFqn;
          const sugAttrs = Object.entries(s.memberValues).map(
            ([k, v]) => `${k}="${emitLiteralAttr(v)}"`,
          );
          writer.line(
            `<${tag}${sugAttrs.length ? " " + sugAttrs.join(" ") : ""} />`,
          );
        }
        writer.popDepth();
        writer.line("</suggestions>");
      }
      writer.popDepth();
      writer.line(`</${tag}>`);
      break;
    }
    case "aggregation": {
      if (member.type) {
        attrs.push(
          `type="${escapeAttr(emitTypeExpression(member.type, ctx.bindings, ctx.useQName))}"`,
        );
      }
      if (member.default) attrs.push('default="true"');
      const hasComp = !!member.composition;
      const hasBody =
        hasComp ||
        (member.documentations?.length ?? 0) > 0 ||
        (member.summaries?.length ?? 0) > 0 ||
        (member.examples?.length ?? 0) > 0 ||
        (member.references?.length ?? 0) > 0 ||
        member.since !== undefined ||
        (member.keywords?.length ?? 0) > 0 ||
        (member.changelog?.length ?? 0) > 0 ||
        member.xmlRendering?.authoredPlacement === "element" ||
        (member.unknownElements?.length ?? 0) > 0;
      if (!hasBody) {
        writer.line(`<${tag}${attrs.length ? " " + attrs.join(" ") : ""} />`);
        break;
      }
      writer.line(`<${tag}${attrs.length ? " " + attrs.join(" ") : ""}>`);
      writer.pushDepth();
      if (member.xmlRendering?.authoredPlacement === "element" && member.xmlRendering.raw) {
        writer.line(`<bml:xml>${member.xmlRendering.raw}</bml:xml>`);
      }
      emitMemberCommonChildren(writer, member, ctx);
      emitMemberGroups(writer, member.groups, ctx);
      if (member.composition) {
        emitCompositionTemplate(writer, member.composition, ctx);
      }
      writer.popDepth();
      writer.line(`</${tag}>`);
      break;
    }
    case "association": {
      attrs.push(
        `type="${escapeAttr(emitTypeExpression(member.type, ctx.bindings, ctx.useQName))}"`,
      );
      if (member.unknownElements?.length) {
        writer.line(`<${tag} ${attrs.join(" ")}>`);
        writer.pushDepth();
        emitUnknownXmlNodes(writer, member.unknownElements);
        writer.popDepth();
        writer.line(`</${tag}>`);
      } else {
        writer.line(`<${tag} ${attrs.join(" ")} />`);
      }
      break;
    }
    case "capability": {
      attrs.push(
        `type="${escapeAttr(ctx.useQName ? fqnToQName(member.typeFqn, ctx.bindings) : member.typeFqn.split(".").pop()!)}"`,
      );
      if (member.inputType) {
        attrs.push(
          `inputType="${escapeAttr(emitTypeExpression(member.inputType, ctx.bindings, ctx.useQName))}"`,
        );
      }
      if (member.outputType) {
        attrs.push(
          `outputType="${escapeAttr(emitTypeExpression(member.outputType, ctx.bindings, ctx.useQName))}"`,
        );
      }
      const hasBody =
        member.throws !== undefined ||
        !!member.implementation ||
        (member.documentations?.length ?? 0) > 0 ||
        (member.summaries?.length ?? 0) > 0 ||
        (member.examples?.length ?? 0) > 0 ||
        (member.references?.length ?? 0) > 0 ||
        member.since !== undefined ||
        (member.keywords?.length ?? 0) > 0 ||
        (member.changelog?.length ?? 0) > 0 ||
        (member.constraints?.length ?? 0) > 0 ||
        member.xmlRendering?.authoredPlacement === "element" ||
        (member.unknownElements?.length ?? 0) > 0;
      if (!hasBody) {
        writer.line(`<${tag} ${attrs.join(" ")} />`);
        break;
      }
      writer.line(`<${tag} ${attrs.join(" ")}>`);
      writer.pushDepth();
      if (member.throws) {
        writer.line("<throws>");
        writer.pushDepth();
        for (const t of member.throws) {
          emitTypeReferenceEntity(writer, t.value, ctx);
        }
        writer.popDepth();
        writer.line("</throws>");
      }
      emitMemberCommonChildren(writer, member, ctx);
      if (member.implementation) {
        const lang = ctx.useQName
          ? fqnToQName(member.implementation.languageFqn, ctx.bindings)
          : member.implementation.languageFqn.split(".").pop()!;
        writer.line(`<implementation language="${escapeAttr(lang)}">`);
        writer.pushDepth();
        emitCharacterData(
          writer,
          member.implementation.source,
          member.implementation.authoredCharacterDataForm,
        );
        writer.popDepth();
        writer.line("</implementation>");
      }
      writer.popDepth();
      writer.line(`</${tag}>`);
      break;
    }
  }
  writer.comments(member.xmlTrivia, true);
}

function emitMemberGroups(
  writer: XmlWriter,
  groups: TypeReferenceEntityInstance[] | undefined,
  ctx: EmitContext,
): void {
  if (!groups?.length) {
    return;
  }
  writer.line("<groups>");
  writer.pushDepth();
  for (const g of groups) {
    emitTypeReferenceEntity(writer, g.value, ctx);
  }
  writer.popDepth();
  writer.line("</groups>");
}

function emitMemberCommonChildren(
  writer: XmlWriter,
  member: MemberDefinition,
  ctx: EmitContext,
): void {
  for (const s of member.summaries ?? []) {
    emitProse(writer, "summary", s, ctx);
  }
  for (const d of member.documentations ?? []) {
    emitProse(writer, "documentation", d, ctx);
  }
  if (member.since) {
    emitSimpleElement(writer, "since", member.since);
  }
  if (member.keywords?.length) {
    writer.line("<keywords>");
    writer.pushDepth();
    for (const kw of member.keywords) {
      const qn = ctx.useQName
        ? fqnToQName(kw.typeFqn, ctx.bindings)
        : kw.typeFqn.split(".").pop()!;
      const attrs = [
        kw.term ? `term="${escapeAttr(kw.term)}"` : "",
        kw.weight !== undefined ? `weight="${kw.weight}"` : "",
      ]
        .filter(Boolean)
        .join(" ");
      writer.line(`<${qn}${attrs ? " " + attrs : ""} />`);
    }
    writer.popDepth();
    writer.line("</keywords>");
  }
  if (member.changelog?.length) {
    writer.line("<changelog>");
    writer.pushDepth();
    for (const ch of member.changelog) {
      writer.line(`<change version="${escapeAttr(ch.version)}">`);
      writer.pushDepth();
      emitCharacterData(writer, ch.text);
      writer.popDepth();
      writer.line("</change>");
    }
    writer.popDepth();
    writer.line("</changelog>");
  }
  if (member.examples?.length) {
    emitExamples(writer, member.examples, ctx, "examples");
  }
  if (member.references?.length) {
    writer.line("<references>");
    writer.pushDepth();
    for (const ref of member.references) {
      emitReference(writer, ref, ctx);
    }
    writer.popDepth();
    writer.line("</references>");
  }
  if (member.constraints?.length) {
    emitConstraintInstances(writer, member.constraints, ctx);
  }
  emitUnknownXmlNodes(writer, member.unknownElements);
}

function formatLiteralValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return formatBoolean(value);
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return JSON.stringify(value).replace(/"([^"]+)":/g, "$1:");
  }
  return String(value);
}

function emitLiteralAttr(val: { kind: string; value?: unknown; raw?: string }): string {
  if (val.kind === "expression") {
    return `\${ ${val.raw} }`;
  }
  return escapeAttr(formatLiteralValue(val.value));
}

function emitLiteralBody(val: { kind: string; value?: unknown; raw?: string }): string {
  if (val.kind === "expression") {
    return `\${ ${val.raw} }`;
  }
  return escapeText(formatLiteralValue(val.value));
}

export function emitRootStartTag(
  writer: XmlWriter,
  bindings: Record<string, string>,
  schemaLocation?: string,
  noNamespaceSchemaLocation?: string,
  unknownAttributes?: Record<string, string>,
): void {
  const attrs: string[] = [];
  for (const [prefix, uri] of Object.entries(bindings)) {
    if (prefix === "") {
      attrs.push(`xmlns="${uri}"`);
    } else {
      attrs.push(`xmlns:${prefix}="${uri}"`);
    }
  }
  if (schemaLocation) {
    attrs.push(`xsi:schemaLocation="${escapeAttr(schemaLocation)}"`);
  }
  if (noNamespaceSchemaLocation) {
    attrs.push(
      `xsi:noNamespaceSchemaLocation="${escapeAttr(noNamespaceSchemaLocation)}"`,
    );
  }
  if (unknownAttributes) {
    for (const [name, value] of Object.entries(unknownAttributes)) {
      attrs.push(`${name}="${escapeAttr(value)}"`);
    }
  }
  writer.line(`<block ${attrs.join("\n  ")}>`);
}
