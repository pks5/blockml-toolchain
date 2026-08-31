import type {
  BlockInstance,
  BlockInstanceNode,
  CompositionNode,
  CompositionTemplate,
  DirectiveAttribute,
  ExpressionValue,
  MemberValue,
} from "@blockml/bom";
import type { EmitContext } from "./context.js";
import { fqnToQName, visibilityPrefix } from "./qname.js";
import {
  emitCharacterData,
  escapeAttr,
  formatBoolean,
  formatMemberValue,
  XmlWriter,
} from "./xml.js";

export function emitCompositionTemplate(
  writer: XmlWriter,
  template: CompositionTemplate,
  ctx: EmitContext,
  wrapInAggregation?: string,
): void {
  if (wrapInAggregation) {
    const prefix = visibilityPrefix(undefined);
    writer.comments(undefined);
    writer.line(`<${prefix}${wrapInAggregation}>`);
    writer.pushDepth();
  }

  emitCompositionContents(writer, template, ctx, true);

  if (wrapInAggregation) {
    writer.popDepth();
    writer.line(`</${wrapInAggregation}>`);
  }
}

function emitCompositionContents(
  writer: XmlWriter,
  template: CompositionTemplate,
  ctx: EmitContext,
  wrapInComposition: boolean,
): void {
  const compositionDirectives = emitDirectiveAttrs(template.directives);
  if (wrapInComposition) {
    writer.line(
      `<composition${compositionDirectives.length ? " " + compositionDirectives.join(" ") : ""}>`,
    );
    writer.pushDepth();
  } else if (compositionDirectives.length > 0) {
    writer.line(`<bml:container ${compositionDirectives.join(" ")}>`);
    writer.pushDepth();
  }
  for (const child of template.children) {
    emitCompositionNode(writer, child, ctx);
  }
  if (wrapInComposition) {
    writer.popDepth();
    writer.line("</composition>");
  } else if (compositionDirectives.length > 0) {
    writer.popDepth();
    writer.line("</bml:container>");
  }
}

export function emitCompositionNode(
  writer: XmlWriter,
  node: CompositionNode,
  ctx: EmitContext,
): void {
  if (node.kind === "virtualContainer") {
    const containerDirectives = emitDirectiveAttrs(node.directives);
    writer.line(
      `<bml:container${containerDirectives.length ? " " + containerDirectives.join(" ") : ""}>`,
    );
    writer.pushDepth();
    for (const child of node.children) {
      emitCompositionNode(writer, child, ctx);
    }
    writer.popDepth();
    writer.line("</bml:container>");
    return;
  }
  emitBlockInstance(writer, node.instance, node.directives, ctx);
  writer.comments(node.instance.xmlTrivia, true);
}

export function emitBlockInstance(
  writer: XmlWriter,
  instance: BlockInstance,
  directives: DirectiveAttribute[] | undefined,
  ctx: EmitContext,
): void {
  writer.comments(instance.xmlTrivia);
  const tag = ctx.useQName
    ? fqnToQName(instance.typeFqn, ctx.bindings)
    : instance.typeFqn;
  const attrs: string[] = [];
  attrs.push(...emitDirectiveAttrs(directives));
  if (instance.id) {
    attrs.push(...emitMetaAttr("bml:id", instance.id));
  }
  if (instance.version) {
    attrs.push(...emitMetaAttr("bml:version", instance.version));
  }
  if (instance.bean) {
    attrs.push(...emitMetaAttr("bml:bean", instance.bean));
  }
  if (instance.scope) {
    attrs.push(`bml:scope="${instance.scope}"`);
  }
  if (instance.unknownAttributes) {
    for (const [name, value] of Object.entries(instance.unknownAttributes)) {
      attrs.push(`${name}="${escapeAttr(value)}"`);
    }
  }

  for (const [name, val] of Object.entries(instance.memberValues)) {
    if ("authoredPlacement" in val && val.authoredPlacement === "element") {
      continue;
    }
    attrs.push(`${name}="${emitMemberValueAttr(val)}"`);
  }

  const elementChildren: string[] = [];
  for (const [name, val] of Object.entries(instance.memberValues)) {
    if (!("authoredPlacement" in val) || val.authoredPlacement !== "element") {
      continue;
    }
    elementChildren.push(emitMemberValueElement(name, val));
  }

  const hasBody =
    elementChildren.length > 0 ||
    (instance.aggregationCompositions?.length ?? 0) > 0;

  if (!hasBody) {
    writer.line(`<${tag}${attrs.length ? " " + attrs.join(" ") : ""} />`);
    return;
  }

  writer.line(`<${tag}${attrs.length ? " " + attrs.join(" ") : ""}>`);
  writer.pushDepth();
  for (const line of elementChildren) {
    writer.line(line);
  }
  for (const agg of instance.aggregationCompositions ?? []) {
    writer.line(`<${agg.aggregationName}>`);
    writer.pushDepth();
    emitCompositionContents(writer, agg.composition, ctx, false);
    writer.popDepth();
    writer.line(`</${agg.aggregationName}>`);
  }
  writer.popDepth();
  writer.line(`</${tag}>`);
}

function emitDirectiveAttrs(directives: DirectiveAttribute[] | undefined): string[] {
  if (!directives?.length) {
    return [];
  }
  return directives.map((d) => {
    switch (d.type) {
      case "each":
        return `bml:each="${escapeAttr(`${d.variables.join(",")} : \${ ${d.collection.raw} }`)}"`;
      case "if":
        return `bml:if="${escapeAttr(`\${ ${d.condition.raw} }`)}"`;
      case "unless":
        return `bml:unless="${escapeAttr(`\${ ${d.condition.raw} }`)}"`;
      case "with":
        return `bml:with="${escapeAttr(d.bindings.map((b) => `${b.name}=\${ ${b.value.raw} }`).join(","))}"`;
    }
  });
}

function emitMetaAttr(name: string, val: MemberValue): string[] {
  if (val.kind === "expression") {
    return [`${name}="\${ ${escapeAttr(val.raw)} }"`];
  }
  if (val.kind === "address") {
    return [`${name}="${escapeAttr(val.address.raw)}"`];
  }
  return [`${name}="${escapeAttr(String(val.value))}"`];
}

function emitMemberValueAttr(val: MemberValue): string {
  if (val.kind === "expression") {
    return `\${ ${val.raw} }`;
  }
  if (val.kind === "address") {
    return val.address.raw;
  }
  if (typeof val.value === "boolean") {
    return formatBoolean(val.value);
  }
  if (typeof val.value === "object") {
    return formatMemberValue(val.value);
  }
  return escapeAttr(String(val.value));
}

function emitMemberValueElement(name: string, val: MemberValue): string {
  if (val.kind === "expression") {
    return `<${name}>\${ ${val.raw} }</${name}>`;
  }
  if (val.kind === "address") {
    return `<${name}>${escapeAttr(val.address.raw)}</${name}>`;
  }
  return `<${name}>${formatMemberValue(val.value)}</${name}>`;
}

export function emitConstraintInstances(
  writer: XmlWriter,
  instances: BlockInstance[],
  ctx: EmitContext,
): void {
  writer.line("<constraints>");
  writer.pushDepth();
  for (const inst of instances) {
    emitBlockInstance(writer, inst, undefined, ctx);
  }
  writer.popDepth();
  writer.line("</constraints>");
}

export function emitTypeReferenceEntity(
  writer: XmlWriter,
  value: string,
  ctx: EmitContext,
  version?: MemberValue,
): void {
  const qname = ctx.useQName ? fqnToQName(value, ctx.bindings) : value;
  const attrs: string[] = [];
  if (version) {
    attrs.push(...emitMetaAttr("bml:version", version));
  }
  const attrStr = attrs.length ? " " + attrs.join(" ") : "";
  writer.line(`<${qname}${attrStr} />`);
}
