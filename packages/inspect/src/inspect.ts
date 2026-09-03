import { isAbsolute, relative, resolve } from "node:path";
import type {
  BlockDefinition,
  BlockInstance,
  BomDocument,
  CompositionNode,
  CompositionTemplate,
  GenericType,
  MemberDefinition,
  MemberValue,
  TypeExpression,
} from "@blockml/bom";
import {
  bootstrapFullProjectRegistry,
  collectBaseTypeChain,
  findLocalMember,
  isLiteralValue,
  projectSourceRoots,
  resolveEffectiveMembers,
  type TypeRegistry,
} from "@blockml/framework";
import { collectNamedFqns, projectTypeExpression } from "./type-refs.js";
import {
  DEFAULT_INSPECT_DEPTH,
  DEFAULT_MAX_BLOCKS,
  DOC_TRUNCATE,
  MAX_INSPECT_DEPTH,
  TYPE_PACKAGE_PREFIX,
  VALUE_TYPE_FQN,
  type InspectBlockOptions,
  type InspectedBlock,
  type InspectedGenericType,
  type InspectedImplementation,
  type InspectedInstance,
  type InspectedMember,
  type InspectOrigin,
  type InspectProjectOptions,
  type InspectResult,
  type InspectTypeRef,
} from "./types.js";

function clampDepth(depth: number | undefined): number {
  const n = depth === undefined ? DEFAULT_INSPECT_DEPTH : depth;
  if (!Number.isFinite(n) || n < 0) {
    return DEFAULT_INSPECT_DEPTH;
  }
  return Math.min(MAX_INSPECT_DEPTH, Math.floor(n));
}

export function isLeafTypeFqn(fqn: string): boolean {
  return fqn.startsWith(TYPE_PACKAGE_PREFIX) || fqn === VALUE_TYPE_FQN;
}

function isPathInside(inner: string, outer: string): boolean {
  const a = resolve(inner);
  const b = resolve(outer);
  const rel = relative(b, a);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function originForFile(filePath: string, workspaceRoots: string[]): InspectOrigin {
  if (!filePath) {
    return "unresolved";
  }
  for (const root of workspaceRoots) {
    if (isPathInside(filePath, root)) {
      return "workspace";
    }
  }
  return "dependency";
}

function displayPath(file: string, rootDir: string | undefined): string {
  if (!rootDir || !file) {
    return file;
  }
  const abs = resolve(file);
  const rel = relative(rootDir, abs);
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : file;
}

function truncateDocumentation(text: string | undefined): { text: string; truncated: boolean } | undefined {
  if (!text) {
    return undefined;
  }
  if (text.length <= DOC_TRUNCATE) {
    return { text, truncated: false };
  }
  return { text: `${text.slice(0, DOC_TRUNCATE)}…`, truncated: true };
}

function firstDocumentation(block: BlockDefinition): { text: string; truncated: boolean } | undefined {
  return truncateDocumentation(block.documentations?.[0]?.text);
}

function lastSegment(fqn: string): string {
  const parts = fqn.split(".");
  return parts[parts.length - 1] || fqn;
}

function resolveAuthoredTypeName(
  raw: string,
  bindings: Record<string, string> | undefined,
): string {
  const trimmed = raw.trim();
  const colon = trimmed.indexOf(":");
  if (colon <= 0 || /[()|, \[]/.test(trimmed)) {
    return trimmed;
  }
  const prefix = trimmed.slice(0, colon);
  const local = trimmed.slice(colon + 1);
  if (!local || local.includes(":")) {
    return trimmed;
  }
  const ns = bindings?.[prefix];
  return ns ? `${ns}.${local}` : trimmed;
}

function projectDeclaredTypeRef(
  raw: string | undefined,
  bindings: Record<string, string> | undefined,
): InspectTypeRef | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  const resolved = resolveAuthoredTypeName(raw, bindings);
  if (resolved.includes(".") || resolved.includes(":")) {
    return { kind: "named", ref: resolved };
  }
  return { kind: "genericParam", name: resolved };
}

function projectGenericTypes(
  params: GenericType[] | undefined,
  bindings: Record<string, string> | undefined,
): InspectedGenericType[] | undefined {
  if (!params?.length) {
    return undefined;
  }
  return params.map((param) => {
    const entry: InspectedGenericType = {
      name: param.name,
      baseType: projectDeclaredTypeRef(param.baseType, bindings) ?? {
        kind: "named",
        ref: param.baseType,
      },
    };
    const defaultType = projectDeclaredTypeRef(param.defaultType, bindings);
    if (defaultType) {
      entry.defaultType = defaultType;
    }
    return entry;
  });
}

function projectBaseType(block: BlockDefinition): InspectTypeRef | undefined {
  if (block.baseTypeExpression) {
    return projectTypeExpression(block.baseTypeExpression);
  }
  if (block.baseType) {
    return { kind: "named", ref: block.baseType };
  }
  return undefined;
}

function baseTypeParentFqn(block: BlockDefinition): string | undefined {
  if (block.baseTypeExpression?.kind === "named") {
    return block.baseTypeExpression.fqn;
  }
  return block.baseType;
}

function projectImplementation(
  impl: { languageFqn: string; source: string } | undefined,
): InspectedImplementation | undefined {
  const text = impl?.source?.trim();
  if (!impl || !text) {
    return undefined;
  }
  const truncated = truncateDocumentation(text);
  if (!truncated) {
    return undefined;
  }
  const projected: InspectedImplementation = {
    language: lastSegment(impl.languageFqn) || impl.languageFqn,
    source: truncated.text,
  };
  if (truncated.truncated) {
    projected.sourceTruncated = true;
  }
  return projected;
}

function projectMemberValue(value: MemberValue): unknown {
  if (value.kind === "literal") {
    return value.value;
  }
  if (value.kind === "expression") {
    return { expression: value.raw };
  }
  return value.address.raw;
}

function projectInstanceId(id: MemberValue | undefined): string | undefined {
  if (!id) {
    return undefined;
  }
  const projected = projectMemberValue(id);
  if (projected === undefined || projected === null || projected === "") {
    return undefined;
  }
  return String(projected);
}

function projectInstance(instance: BlockInstance): InspectedInstance {
  const projected: InspectedInstance = { type: instance.typeFqn };
  const id = projectInstanceId(instance.id);
  if (id) {
    projected.id = id;
  }
  if (instance.generics?.raw) {
    projected.generics = instance.generics.raw;
  }
  const members: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(instance.memberValues)) {
    members[name] = projectMemberValue(value);
  }
  if (Object.keys(members).length > 0) {
    projected.members = members;
  }
  if (instance.aggregationCompositions && instance.aggregationCompositions.length > 0) {
    const aggregations: Record<string, InspectedInstance[]> = {};
    for (const fill of instance.aggregationCompositions) {
      const children = projectInstances(fill.composition);
      if (children) {
        aggregations[fill.aggregationName] = children;
      }
    }
    if (Object.keys(aggregations).length > 0) {
      projected.aggregations = aggregations;
    }
  }
  return projected;
}

function walkCompositionNodes(nodes: CompositionNode[], out: InspectedInstance[]): void {
  for (const node of nodes) {
    if (node.kind === "virtualContainer") {
      walkCompositionNodes(node.children, out);
      continue;
    }
    out.push(projectInstance(node.instance));
  }
}

function projectInstances(composition: CompositionTemplate | undefined): InspectedInstance[] | undefined {
  if (!composition || composition.children.length === 0) {
    return undefined;
  }
  const instances: InspectedInstance[] = [];
  walkCompositionNodes(composition.children, instances);
  return instances.length > 0 ? instances : undefined;
}

function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) {
    list.push(value);
  }
}

function inheritedFromOwner(
  block: BlockDefinition,
  member: MemberDefinition,
  registry: TypeRegistry,
): string | undefined {
  if (findLocalMember(block, member)) {
    return undefined;
  }
  const chain = collectBaseTypeChain(block, registry);
  const ancestors = chain.slice(0, -1);
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = ancestors[i];
    if (ancestor && findLocalMember(ancestor, member)) {
      return ancestor.type;
    }
  }
  for (const ref of block.contracts ?? []) {
    const contractDoc = registry.get(ref.value);
    if (contractDoc && findLocalMember(contractDoc.block, member)) {
      return contractDoc.block.type;
    }
  }
  return undefined;
}

function projectMember(member: MemberDefinition, inheritedFrom?: string): InspectedMember {
  const projected: InspectedMember = {
    kind: member.kind,
    name: member.name,
  };
  if (inheritedFrom) {
    projected.inheritedFrom = inheritedFrom;
  }
  if (member.visibility) {
    projected.visibility = member.visibility;
  }
  if (member.readOnly) {
    projected.readOnly = true;
  }
  if (member.abstract) {
    projected.abstract = true;
  }
  if (member.final) {
    projected.final = true;
  }
  if (member.override) {
    projected.override = true;
  }

  if (member.kind === "property") {
    const type = projectTypeExpression(member.type, member.typeFqn);
    if (type) {
      projected.type = type;
    }
    if (isLiteralValue(member.value)) {
      projected.value = member.value.value;
    }
  } else if (member.kind === "aggregation" || member.kind === "association") {
    const type = projectTypeExpression(member.type);
    if (type) {
      projected.type = type;
    }
    if (member.cardinality) {
      projected.cardinality = member.cardinality;
    }
    if (member.kind === "aggregation") {
      const instances = projectInstances(member.composition);
      if (instances) {
        projected.instances = instances;
      }
    }
  } else if (member.kind === "capability") {
    const input = projectTypeExpression(member.inputType as TypeExpression | undefined);
    if (input) {
      projected.inputType = input;
    }
    const output = projectTypeExpression(member.outputType as TypeExpression | undefined);
    if (output) {
      projected.outputType = output;
    }
    const throws = (member.throws ?? []).map((item) => item.value).filter(Boolean);
    if (throws.length > 0) {
      projected.throws = throws;
    }
    const implementation = projectImplementation(member.implementation);
    if (implementation) {
      projected.implementation = implementation;
    }
  }

  return projected;
}

function collectDeclaredExpansionRefs(doc: BomDocument): string[] {
  const block = doc.block;
  const refs: string[] = [];
  for (const contract of block.contracts ?? []) {
    if (contract.value) {
      refs.push(contract.value);
    }
  }
  for (const sub of block.subBlocks) {
    if (sub.type) {
      refs.push(sub.type);
    }
  }
  if (block.baseTypeExpression) {
    const parent = baseTypeParentFqn(block);
    for (const fqn of collectNamedFqns(block.baseTypeExpression)) {
      if (fqn !== parent) {
        refs.push(fqn);
      }
    }
  }
  const bindings = doc.source.namespaceBindings;
  for (const param of block.genericTypes ?? []) {
    const defaultType = projectDeclaredTypeRef(param.defaultType, bindings);
    if (defaultType?.ref) {
      refs.push(defaultType.ref);
    }
  }
  for (const member of block.members) {
    if (member.kind === "property") {
      refs.push(...collectNamedFqns(member.type, member.typeFqn));
    } else if (member.kind === "aggregation" || member.kind === "association") {
      refs.push(...collectNamedFqns(member.type));
    } else if (member.kind === "capability") {
      refs.push(...collectNamedFqns(member.inputType as TypeExpression | undefined));
      refs.push(...collectNamedFqns(member.outputType as TypeExpression | undefined));
      for (const thrown of member.throws ?? []) {
        if (thrown.value) {
          refs.push(thrown.value);
        }
      }
    }
  }
  return [...new Set(refs)];
}

function projectBlock(
  doc: BomDocument,
  registry: TypeRegistry,
  options: InspectBlockOptions,
): InspectedBlock {
  const block = doc.block;
  const filePath = doc.source?.filePath || block.source?.file || "";
  const workspaceRoots = options.rootDir
    ? projectSourceRoots(options.rootDir, options.srcDir)
    : [];
  const projected: InspectedBlock = {
    fqn: block.type,
    name: block.name,
    members: [],
  };
  if (filePath) {
    projected.file = displayPath(filePath, options.rootDir);
    projected.origin = originForFile(filePath, workspaceRoots);
  }
  if (block.is) {
    projected.is = block.is;
  }
  const documentation = firstDocumentation(block);
  if (documentation) {
    projected.documentation = documentation.text;
    if (documentation.truncated) {
      projected.documentationTruncated = true;
    }
  }
  const baseType = projectBaseType(block);
  if (baseType) {
    projected.baseType = baseType;
  }
  const genericTypes = projectGenericTypes(block.genericTypes, doc.source.namespaceBindings);
  if (genericTypes) {
    projected.genericTypes = genericTypes;
  }
  const chain = collectBaseTypeChain(block, registry);
  const ancestorFqns = chain.slice(0, -1).map((item) => item.type).filter(Boolean);
  if (ancestorFqns.length > 0) {
    projected.ancestors = ancestorFqns;
  }
  const contracts = (block.contracts ?? []).map((item) => item.value).filter(Boolean);
  if (contracts.length > 0) {
    projected.contracts = contracts;
  }
  const subBlocks = block.subBlocks.map((sub) => sub.type).filter(Boolean);
  if (subBlocks.length > 0) {
    projected.subBlocks = subBlocks;
  }
  if (block.abstract) {
    projected.abstract = true;
  }
  if (block.final) {
    projected.final = true;
  }

  const effective = resolveEffectiveMembers(block, registry);
  projected.members = effective.map((member) =>
    projectMember(member, inheritedFromOwner(block, member, registry)),
  );
  return projected;
}

export function inspectBlock(
  fqn: string,
  registry: TypeRegistry,
  options: InspectBlockOptions = {},
): InspectResult {
  const depth = clampDepth(options.depth);
  const maxBlocks = options.maxBlocks ?? DEFAULT_MAX_BLOCKS;
  const result: InspectResult = {
    root: fqn,
    depth,
    blocks: {},
    unresolved: [],
    cycles: [],
    truncated: [],
  };

  const visiting = new Set<string>();
  const expanded = new Set<string>();

  const expand = (currentFqn: string, remaining: number): void => {
    if (visiting.has(currentFqn)) {
      pushUnique(result.cycles, currentFqn);
      return;
    }
    if (expanded.has(currentFqn)) {
      return;
    }
    if (isLeafTypeFqn(currentFqn) && currentFqn !== fqn) {
      return;
    }
    const doc = registry.get(currentFqn);
    if (!doc) {
      pushUnique(result.unresolved, currentFqn);
      return;
    }
    const already = Object.keys(result.blocks).length;
    if (already >= maxBlocks && currentFqn !== fqn) {
      pushUnique(result.truncated, currentFqn);
      return;
    }

    visiting.add(currentFqn);
    result.blocks[currentFqn] = projectBlock(doc, registry, options);
    expanded.add(currentFqn);

    if (remaining > 0) {
      for (const ref of collectDeclaredExpansionRefs(doc)) {
        expand(ref, remaining - 1);
      }
    }
    visiting.delete(currentFqn);
  };

  expand(fqn, depth);
  return result;
}

export function inspectProject(fqn: string, options: InspectProjectOptions = {}): InspectResult {
  const rootDir = options.rootDir ?? process.cwd();
  const bootstrap = bootstrapFullProjectRegistry({
    rootDir,
    ...(options.srcDir !== undefined ? { srcDir: options.srcDir } : {}),
    ...(options.libraries !== undefined ? { libraries: options.libraries } : {}),
  });
  const blockOptions: InspectBlockOptions = { rootDir };
  if (options.depth !== undefined) {
    blockOptions.depth = options.depth;
  }
  if (options.srcDir !== undefined) {
    blockOptions.srcDir = options.srcDir;
  }
  if (options.maxBlocks !== undefined) {
    blockOptions.maxBlocks = options.maxBlocks;
  }
  return inspectBlock(fqn, bootstrap.registry, blockOptions);
}
