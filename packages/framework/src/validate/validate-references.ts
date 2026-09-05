import type {
  BlockDefinition,
  BlockInstance,
  BomDocument,
  CompositionNode,
  Diagnostic,
  DocumentationReference,
  MemberDefinition,
  MemberValue,
  PropertyDefinition,
  SourceLocation,
  TypeExpression,
  TypeReferenceEntityInstance,
} from "@blockml/bom";
import { isWellKnownTypeFqn, parseTypeExpression } from "@blockml/parser";
import type { TypeRegistry } from "../registry/type-registry.js";
import { resolveEffectiveMembers } from "../resolve/resolve-effective-members.js";
import { satisfiesTypeBound } from "../resolve/satisfies-type-bound.js";
import {
  collectDocumentInstanceIds,
  resolveInstanceRef,
  type InstanceIdLoc,
} from "./instance-ids.js";
import {
  classifyDeclaredType,
  namedTypeFqn,
  TYPE_REFERENCE_ENTITY,
  type ClassifiedDeclaredType,
  type ReferenceKind,
} from "./reference-kinds.js";

const CORE_EXCEPTION = "org.blockml.bml.core.Exception";
const CORE_BLOCK = "org.blockml.bml.core.Block";

const MEMBER_KIND_BY_REFERENCE: Record<
  Extract<ReferenceKind, "property" | "aggregation" | "association" | "capability">,
  MemberDefinition["kind"]
> = {
  property: "property",
  aggregation: "aggregation",
  association: "association",
  capability: "capability",
};

type CheckCtx = {
  registry: TypeRegistry;
  file: string;
  diagnostics: Diagnostic[];
  ids: Map<string, InstanceIdLoc>;
};

function diag(
  code: string,
  message: string,
  file: string,
  loc?: Pick<SourceLocation, "line" | "column" | "endLine" | "endColumn" | "file">,
): Diagnostic {
  const source: SourceLocation = {
    file: loc?.file ?? file,
    line: loc?.line ?? 1,
    column: loc?.column ?? 1,
  };
  if (loc?.endLine !== undefined) {
    source.endLine = loc.endLine;
  }
  if (loc?.endColumn !== undefined) {
    source.endColumn = loc.endColumn;
  }
  return { severity: "error", code, message, source };
}

function typeIsKnown(fqn: string, registry: TypeRegistry): boolean {
  return registry.has(fqn) || isWellKnownTypeFqn(fqn);
}

export function walkNamedTypes(expr: TypeExpression | undefined, visit: (fqn: string) => void): void {
  if (!expr) {
    return;
  }
  switch (expr.kind) {
    case "named":
      visit(expr.fqn);
      for (const arg of expr.typeArguments ?? []) {
        walkNamedTypes(arg, visit);
      }
      break;
    case "union":
      for (const alt of expr.alternatives) {
        walkNamedTypes(alt, visit);
      }
      break;
    case "grouped":
      walkNamedTypes(expr.expression, visit);
      break;
    case "anonymousStruct":
      for (const field of expr.fields) {
        walkNamedTypes(field.type, visit);
      }
      break;
    default:
      break;
  }
}

function typeExpressionFromRaw(raw: string): TypeExpression | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^[a-z][a-z0-9]*(\.[A-Za-z0-9]+)+$/.test(trimmed)) {
    return { kind: "named", fqn: trimmed };
  }
  try {
    return parseTypeExpression(trimmed, {});
  } catch {
    return { kind: "named", fqn: trimmed };
  }
}

function literalText(val: MemberValue | undefined): string | undefined {
  if (!val || val.kind !== "literal") {
    return undefined;
  }
  if (typeof val.value === "string") {
    return val.value;
  }
  return undefined;
}

function packageIsKnown(pkg: string, registry: TypeRegistry): boolean {
  const prefix = `${pkg}.`;
  return registry.keys().some((fqn) => fqn.startsWith(prefix));
}

function reportUnknownType(
  fqn: string,
  ctx: CheckCtx,
  loc: SourceLocation | undefined,
  code: string,
  message: string,
): boolean {
  if (typeIsKnown(fqn, ctx.registry)) {
    return true;
  }
  ctx.diagnostics.push(diag(code, message, ctx.file, loc));
  return false;
}

function checkTypeExpression(
  expr: TypeExpression | undefined,
  ctx: CheckCtx,
  loc: SourceLocation | undefined,
  code = "BML_UNKNOWN_TYPE",
  messagePrefix = "Unknown type",
): void {
  walkNamedTypes(expr, (fqn) => {
    reportUnknownType(fqn, ctx, loc, code, `${messagePrefix}: ${fqn}`);
  });
}

function checkTypeFqn(
  raw: string,
  ctx: CheckCtx,
  loc: SourceLocation | undefined,
  code = "BML_UNKNOWN_TYPE",
  messagePrefix = "Unknown type",
  boundFqn?: string,
): void {
  const expr = typeExpressionFromRaw(raw);
  if (!expr) {
    return;
  }
  checkTypeExpression(expr, ctx, loc, code, messagePrefix);
  if (!boundFqn) {
    return;
  }
  const named = expr.kind === "named" ? expr.fqn : namedTypeFqn(expr);
  if (!named || !ctx.registry.has(named) || !ctx.registry.has(boundFqn)) {
    return;
  }
  if (!satisfiesTypeBound(named, boundFqn, ctx.registry)) {
    ctx.diagnostics.push(
      diag(
        "BML_TYPE_BOUND_NOT_SATISFIED",
        `Type ${named} does not satisfy bound ${boundFqn}`,
        ctx.file,
        loc,
      ),
    );
  }
}

function parseMemberPath(raw: string): { ownerFqn?: string; name: string } {
  const sectioned =
    /^(.*)\.(properties|aggregations|associations|capabilities)\.([A-Za-z_][A-Za-z0-9_]*)$/.exec(
      raw.trim(),
    );
  if (sectioned) {
    return { ownerFqn: sectioned[1], name: sectioned[3]! };
  }
  const trimmed = raw.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot > 0) {
    return { ownerFqn: trimmed.slice(0, lastDot), name: trimmed.slice(lastDot + 1) };
  }
  return { name: trimmed };
}

function checkMemberPath(
  raw: string,
  kind: Extract<ReferenceKind, "property" | "aggregation" | "association" | "capability">,
  ctx: CheckCtx,
  loc: SourceLocation | undefined,
  ownerFqn?: string,
): void {
  const parsed = parseMemberPath(raw);
  const owner = parsed.ownerFqn ?? ownerFqn;
  if (!owner) {
    ctx.diagnostics.push(
      diag("BML_UNKNOWN_PROPERTY", `Unknown ${kind}: ${raw}`, ctx.file, loc),
    );
    return;
  }
  const typeDoc = ctx.registry.get(owner);
  if (!typeDoc) {
    if (!typeIsKnown(owner, ctx.registry)) {
      ctx.diagnostics.push(diag("BML_UNKNOWN_TYPE", `Unknown type: ${owner}`, ctx.file, loc));
    } else {
      ctx.diagnostics.push(
        diag("BML_UNKNOWN_PROPERTY", `Unknown ${kind}: ${parsed.name} on ${owner}`, ctx.file, loc),
      );
    }
    return;
  }
  const expected = MEMBER_KIND_BY_REFERENCE[kind];
  const found = resolveEffectiveMembers(typeDoc.block, ctx.registry).some(
    (member) => member.name === parsed.name && member.kind === expected,
  );
  if (!found) {
    ctx.diagnostics.push(
      diag("BML_UNKNOWN_PROPERTY", `Unknown ${kind}: ${parsed.name} on ${owner}`, ctx.file, loc),
    );
  }
}

function checkReferenceValue(
  classified: ClassifiedDeclaredType,
  raw: string,
  ctx: CheckCtx,
  loc: SourceLocation | undefined,
  options?: { typeCode?: string; typeMessage?: string; ownerFqn?: string; boundFqn?: string },
): void {
  if (classified.role === "identifier") {
    return;
  }
  const bound = options?.boundFqn ?? classified.boundFqn;
  switch (classified.kind) {
    case "type":
      checkTypeFqn(
        raw,
        ctx,
        loc,
        options?.typeCode ?? "BML_UNKNOWN_TYPE",
        options?.typeMessage ?? "Unknown type",
        bound,
      );
      break;
    case "package":
      if (!packageIsKnown(raw.trim(), ctx.registry)) {
        ctx.diagnostics.push(diag("BML_UNKNOWN_TYPE", `Unknown package: ${raw.trim()}`, ctx.file, loc));
      }
      break;
    case "instance":
      if (!resolveInstanceRef(raw.trim(), ctx.ids)) {
        ctx.diagnostics.push(
          diag("BML_UNRESOLVABLE_INSTANCE_REF", `Unresolved instance reference: ${raw.trim()}`, ctx.file, loc),
        );
      }
      break;
    case "property":
    case "aggregation":
    case "association":
    case "capability":
      checkMemberPath(raw, classified.kind, ctx, loc, options?.ownerFqn ?? bound);
      break;
  }
}

function checkTypeReferenceEntity(
  inst: TypeReferenceEntityInstance,
  ctx: CheckCtx,
  loc: SourceLocation | undefined,
  options?: { typeCode?: string; typeMessage?: string; boundFqn?: string },
): void {
  checkTypeFqn(
    inst.value,
    ctx,
    loc,
    options?.typeCode ?? "BML_UNKNOWN_TYPE",
    options?.typeMessage ?? "Unknown type",
    options?.boundFqn ?? inst.boundB,
  );
}

function checkDocumentationReference(ref: DocumentationReference, ctx: CheckCtx): void {
  const loc = ref.source;
  if (ref.type) {
    checkTypeFqn(ref.type, ctx, loc);
  }
  const pkg = (ref as DocumentationReference & { package?: string }).package;
  if (pkg && !packageIsKnown(pkg, ctx.registry)) {
    ctx.diagnostics.push(diag("BML_UNKNOWN_TYPE", `Unknown package: ${pkg}`, ctx.file, loc));
  }
  if (ref.instance) {
    checkReferenceValue({ role: "reference", kind: "instance", isEntity: false }, ref.instance, ctx, loc);
  }
  if (ref.property) {
    checkMemberPath(ref.property, "property", ctx, loc, ref.type);
  }
  if (ref.aggregation) {
    checkMemberPath(ref.aggregation, "aggregation", ctx, loc, ref.type);
  }
  if (ref.association) {
    checkMemberPath(ref.association, "association", ctx, loc, ref.type);
  }
  if (ref.capability) {
    checkMemberPath(ref.capability, "capability", ctx, loc, ref.type);
  }
  if (ref.relationFqn) {
    checkTypeFqn(ref.relationFqn, ctx, loc);
  }
  if (ref.languageFqn) {
    checkTypeFqn(ref.languageFqn, ctx, loc);
  }
}

function checkMemberValue(
  val: MemberValue | undefined,
  classified: ClassifiedDeclaredType | undefined,
  ctx: CheckCtx,
  loc: SourceLocation | undefined,
): void {
  if (!classified || classified.role !== "reference") {
    return;
  }
  const text = literalText(val);
  if (text === undefined) {
    return;
  }
  checkReferenceValue(classified, text, ctx, loc ?? val?.source);
}

function checkMemberTypes(member: MemberDefinition, ctx: CheckCtx): void {
  const loc = member.typeSource ?? member.source;
  if (member.kind === "property") {
    if (member.type) {
      checkTypeExpression(member.type, ctx, loc);
    } else if (member.typeFqn) {
      checkTypeFqn(member.typeFqn, ctx, loc);
    }
    for (const group of member.groups ?? []) {
      checkTypeReferenceEntity(group, ctx, loc);
    }
    const classified = classifyDeclaredType(member.type, ctx.registry, member.typeFqn);
    checkMemberValue(member.value, classified, ctx, member.value?.source ?? loc);
    for (const entry of member.values ?? []) {
      checkMemberValue(entry.value, classified, ctx, entry.value.source ?? loc);
    }
    for (const suggestion of member.suggestions ?? []) {
      walkInstance(suggestion, ctx);
    }
  } else if (member.kind === "aggregation") {
    checkTypeExpression(member.type, ctx, loc);
    for (const group of member.groups ?? []) {
      checkTypeReferenceEntity(group, ctx, loc);
    }
  } else if (member.kind === "association") {
    checkTypeExpression(member.type, ctx, loc);
  } else if (member.kind === "capability") {
    if (member.typeFqn) {
      checkTypeFqn(member.typeFqn, ctx, loc);
    }
    checkTypeExpression(member.inputType, ctx, member.inputTypeSource ?? loc);
    checkTypeExpression(member.outputType, ctx, member.outputTypeSource ?? loc);
    if (member.implementation?.languageFqn) {
      checkTypeFqn(member.implementation.languageFqn, ctx, loc);
    }
    for (const thrown of member.throws ?? []) {
      checkTypeReferenceEntity(thrown, ctx, loc, { boundFqn: thrown.boundB ?? CORE_EXCEPTION });
    }
  }

  for (const ref of member.references ?? []) {
    checkDocumentationReference(ref, ctx);
  }
  for (const instance of member.constraints ?? []) {
    walkInstance(instance, ctx);
  }
}

function walkInstance(instance: BlockInstance, ctx: CheckCtx): void {
  const typeBlock = ctx.registry.get(instance.typeFqn)?.block;
  const members = typeBlock ? resolveEffectiveMembers(typeBlock, ctx.registry) : [];
  if (instance.typeFqn === TYPE_REFERENCE_ENTITY) {
    const value = literalText(instance.memberValues.value);
    if (value) {
      checkTypeFqn(value, ctx, instance.source);
    }
  }

  for (const [name, val] of Object.entries(instance.memberValues)) {
    const member = members.find((m) => m.name === name);
    if (!member) {
      continue;
    }
    const type =
      member.kind === "property" || member.kind === "aggregation" || member.kind === "association"
        ? member.type
        : undefined;
    const typeFqn = member.kind === "property" || member.kind === "capability" ? member.typeFqn : undefined;
    const classified = classifyDeclaredType(type, ctx.registry, typeFqn);
    checkMemberValue(val, classified, ctx, val.source ?? instance.source);
  }

  for (const agg of instance.aggregationCompositions ?? []) {
    const member = members.find((m) => m.kind === "aggregation" && m.name === agg.aggregationName);
    const classified = member && member.kind === "aggregation"
      ? classifyDeclaredType(member.type, ctx.registry)
      : undefined;
    walkCompositionNodes(agg.composition.children, ctx, classified);
  }
}

function walkCompositionNodes(
  nodes: CompositionNode[],
  ctx: CheckCtx,
  aggregationDeclared?: ClassifiedDeclaredType,
): void {
  for (const child of nodes) {
    if (child.kind === "blockInstance") {
      if (aggregationDeclared?.role === "reference" && aggregationDeclared.isEntity) {
        if (aggregationDeclared.kind === "type") {
          checkTypeFqn(
            child.instance.typeFqn,
            ctx,
            child.instance.source ?? child.source,
            "BML_UNKNOWN_TYPE",
            "Unknown type",
            aggregationDeclared.boundFqn,
          );
        } else {
          const value = literalText(child.instance.memberValues.value) ?? child.instance.typeFqn;
          checkReferenceValue(
            aggregationDeclared,
            value,
            ctx,
            child.instance.source ?? child.source,
          );
        }
      }
      walkInstance(child.instance, ctx);
    } else {
      walkCompositionNodes(child.children, ctx, aggregationDeclared);
    }
  }
}

function isGenericParamName(name: string, block: BlockDefinition): boolean {
  return (block.genericTypes ?? []).some((g) => g.name === name);
}

function walkBlockDefinition(block: BlockDefinition, ctx: CheckCtx): void {
  if (block.baseType) {
    reportUnknownType(
      block.baseType,
      ctx,
      block.baseTypeSource ?? block.source,
      "BML_UNKNOWN_BASE_TYPE",
      `Unknown baseType: ${block.baseType}`,
    );
  }
  if (block.baseTypeExpression) {
    const root = namedTypeFqn(block.baseTypeExpression);
    walkNamedTypes(block.baseTypeExpression, (fqn) => {
      if (fqn === root || fqn === block.baseType) {
        return;
      }
      reportUnknownType(fqn, ctx, block.baseTypeSource ?? block.source, "BML_UNKNOWN_TYPE", `Unknown type: ${fqn}`);
    });
  }

  for (const ref of block.contracts ?? []) {
    checkTypeReferenceEntity(ref, ctx, block.source, {
      typeCode: "BML_UNKNOWN_CONTRACT",
      typeMessage: "Unknown contract",
      boundFqn: ref.boundB ?? CORE_BLOCK,
    });
  }

  if (block.language) {
    checkTypeReferenceEntity(block.language, ctx, block.source);
  } else if (block.languageFqn) {
    checkTypeFqn(block.languageFqn, ctx, block.source);
  }

  for (const generic of block.genericTypes ?? []) {
    checkTypeFqn(generic.baseType, ctx, block.source);
    if (generic.defaultType && !isGenericParamName(generic.defaultType, block)) {
      checkTypeFqn(generic.defaultType, ctx, block.source);
    }
  }

  for (const ref of block.references ?? []) {
    checkDocumentationReference(ref, ctx);
  }

  for (const instance of block.constraints ?? []) {
    walkInstance(instance, ctx);
  }

  for (const member of block.members) {
    checkMemberTypes(member, ctx);
  }

  for (const template of block.compositions) {
    walkCompositionNodes(template.children, ctx);
  }

  for (const sub of block.subBlocks) {
    walkBlockDefinition(sub, ctx);
  }
  for (const embedded of block.embeddedBlocks) {
    walkBlockDefinition(embedded, ctx);
  }
}

export function validateReferences(document: BomDocument, registry: TypeRegistry): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const file = document.source.filePath ?? "<memory>";
  const ids = collectDocumentInstanceIds(document.block, file);
  walkBlockDefinition(document.block, { registry, file, diagnostics, ids });
  return diagnostics;
}
