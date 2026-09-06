import { isAbsolute, relative, resolve } from "node:path";
import { bootstrapFullProjectRegistry, collectBaseTypeChain, findLocalMember, isLiteralValue, projectSourceRoots, resolveEffectiveMembers, } from "@blockml/framework";
import { collectNamedFqns, projectTypeExpression } from "./type-refs.js";
import { DEFAULT_INSPECT_DEPTH, DEFAULT_MAX_BLOCKS, DOC_TRUNCATE, MAX_INSPECT_DEPTH, REF_TRUNCATE, TYPE_PACKAGE_PREFIX, VALUE_TYPE_FQN, } from "./types.js";
function clampDepth(depth) {
    const n = depth === undefined ? DEFAULT_INSPECT_DEPTH : depth;
    if (!Number.isFinite(n) || n < 0) {
        return DEFAULT_INSPECT_DEPTH;
    }
    return Math.min(MAX_INSPECT_DEPTH, Math.floor(n));
}
export function isLeafTypeFqn(fqn) {
    return fqn.startsWith(TYPE_PACKAGE_PREFIX) || fqn === VALUE_TYPE_FQN;
}
function isPathInside(inner, outer) {
    const a = resolve(inner);
    const b = resolve(outer);
    const rel = relative(b, a);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
function originForFile(filePath, workspaceRoots) {
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
function displayPath(file, rootDir) {
    if (!rootDir || !file) {
        return file;
    }
    const abs = resolve(file);
    const rel = relative(rootDir, abs);
    return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : file;
}
function truncateDocumentation(text) {
    if (!text) {
        return undefined;
    }
    if (text.length <= DOC_TRUNCATE) {
        return { text, truncated: false };
    }
    return { text: `${text.slice(0, DOC_TRUNCATE)}…`, truncated: true };
}
function firstDocumentation(block) {
    return truncateDocumentation(block.documentations?.[0]?.text);
}
function projectReferences(refs) {
    if (!refs?.length) {
        return undefined;
    }
    const projected = [];
    for (const ref of refs) {
        const entry = {
            relation: lastSegment(ref.relationFqn ?? "") || "SeeAlso",
        };
        if (ref.type) {
            entry.ref = ref.type;
        }
        if (ref.file) {
            entry.file = ref.file;
        }
        if (ref.url) {
            entry.url = ref.url;
        }
        if (entry.ref || entry.file || entry.url) {
            projected.push(entry);
        }
    }
    if (projected.length === 0) {
        return undefined;
    }
    if (projected.length <= REF_TRUNCATE) {
        return { references: projected, omitted: 0 };
    }
    return {
        references: projected.slice(0, REF_TRUNCATE),
        omitted: projected.length - REF_TRUNCATE,
    };
}
function lastSegment(fqn) {
    const parts = fqn.split(".");
    return parts[parts.length - 1] || fqn;
}
function resolveAuthoredTypeName(raw, bindings) {
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
function projectDeclaredTypeRef(raw, bindings) {
    if (!raw?.trim()) {
        return undefined;
    }
    const resolved = resolveAuthoredTypeName(raw, bindings);
    if (resolved.includes(".") || resolved.includes(":")) {
        return { kind: "named", ref: resolved };
    }
    return { kind: "genericParam", name: resolved };
}
function projectGenericTypes(params, bindings) {
    if (!params?.length) {
        return undefined;
    }
    return params.map((param) => {
        const entry = {
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
function projectBaseType(block) {
    if (block.baseTypeExpression) {
        return projectTypeExpression(block.baseTypeExpression);
    }
    if (block.baseType) {
        return { kind: "named", ref: block.baseType };
    }
    return undefined;
}
function baseTypeParentFqn(block) {
    if (block.baseTypeExpression?.kind === "named") {
        return block.baseTypeExpression.fqn;
    }
    return block.baseType;
}
function projectImplementation(impl) {
    const text = impl?.source?.trim();
    if (!impl || !text) {
        return undefined;
    }
    const truncated = truncateDocumentation(text);
    if (!truncated) {
        return undefined;
    }
    const projected = {
        language: lastSegment(impl.languageFqn) || impl.languageFqn,
        source: truncated.text,
    };
    if (truncated.truncated) {
        projected.sourceTruncated = true;
    }
    return projected;
}
function projectMemberValue(value) {
    if (value.kind === "literal") {
        return value.value;
    }
    if (value.kind === "expression") {
        return { expression: value.raw };
    }
    if (value.kind === "interpolated") {
        return { interpolated: value.raw };
    }
    return value.address.raw;
}
function projectInstanceId(id) {
    if (!id) {
        return undefined;
    }
    const projected = projectMemberValue(id);
    if (projected === undefined || projected === null || projected === "") {
        return undefined;
    }
    return String(projected);
}
function projectInstance(instance) {
    const projected = { type: instance.typeFqn };
    const id = projectInstanceId(instance.id);
    if (id) {
        projected.id = id;
    }
    if (instance.generics?.raw) {
        projected.generics = instance.generics.raw;
    }
    const members = {};
    for (const [name, value] of Object.entries(instance.memberValues)) {
        members[name] = projectMemberValue(value);
    }
    if (Object.keys(members).length > 0) {
        projected.members = members;
    }
    if (instance.aggregationCompositions && instance.aggregationCompositions.length > 0) {
        const aggregations = {};
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
function walkCompositionNodes(nodes, out) {
    for (const node of nodes) {
        if (node.kind === "virtualContainer") {
            walkCompositionNodes(node.children, out);
            continue;
        }
        out.push(projectInstance(node.instance));
    }
}
function projectInstances(composition) {
    if (!composition || composition.children.length === 0) {
        return undefined;
    }
    const instances = [];
    walkCompositionNodes(composition.children, instances);
    return instances.length > 0 ? instances : undefined;
}
function pushUnique(list, value) {
    if (!list.includes(value)) {
        list.push(value);
    }
}
function inheritedFromOwner(block, member, registry) {
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
function projectMember(member, inheritedFrom) {
    const projected = {
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
    }
    else if (member.kind === "aggregation" || member.kind === "association") {
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
    }
    else if (member.kind === "capability") {
        const input = projectTypeExpression(member.inputType);
        if (input) {
            projected.inputType = input;
        }
        const output = projectTypeExpression(member.outputType);
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
function collectDeclaredExpansionRefs(doc) {
    const block = doc.block;
    const refs = [];
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
        }
        else if (member.kind === "aggregation" || member.kind === "association") {
            refs.push(...collectNamedFqns(member.type));
        }
        else if (member.kind === "capability") {
            refs.push(...collectNamedFqns(member.inputType));
            refs.push(...collectNamedFqns(member.outputType));
            for (const thrown of member.throws ?? []) {
                if (thrown.value) {
                    refs.push(thrown.value);
                }
            }
        }
    }
    return [...new Set(refs)];
}
function projectBlock(doc, registry, options) {
    const block = doc.block;
    const filePath = doc.source?.filePath || block.source?.file || "";
    const workspaceRoots = options.rootDir
        ? projectSourceRoots(options.rootDir, options.srcDir)
        : [];
    const projected = {
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
    const references = projectReferences(block.references);
    if (references) {
        projected.references = references.references;
        if (references.omitted > 0) {
            projected.referencesTruncated = references.omitted;
        }
    }
    const effective = resolveEffectiveMembers(block, registry);
    projected.members = effective.map((member) => projectMember(member, inheritedFromOwner(block, member, registry)));
    return projected;
}
export function inspectBlock(fqn, registry, options = {}) {
    const depth = clampDepth(options.depth);
    const maxBlocks = options.maxBlocks ?? DEFAULT_MAX_BLOCKS;
    const result = {
        root: fqn,
        depth,
        blocks: {},
        unresolved: [],
        cycles: [],
        truncated: [],
    };
    const visiting = new Set();
    const expanded = new Set();
    const expand = (currentFqn, remaining) => {
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
export function inspectProject(fqn, options = {}) {
    const rootDir = options.rootDir ?? process.cwd();
    const bootstrap = bootstrapFullProjectRegistry({
        rootDir,
        ...(options.srcDir !== undefined ? { srcDir: options.srcDir } : {}),
        ...(options.libraries !== undefined ? { libraries: options.libraries } : {}),
    });
    const blockOptions = { rootDir };
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
//# sourceMappingURL=inspect.js.map