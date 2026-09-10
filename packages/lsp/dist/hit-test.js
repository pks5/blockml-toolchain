import { isDocumentRootLocalName, parse, resolveTypeName, } from "@blockml/parser";
import { collectBaseTypeChain, memberIdentityKey, resolveEffectiveMembers, } from "@blockml/framework";
import { bomLocationToRange } from "./positions.js";
import { isXmlnsAttribute, qnameAt, rangeContains, xmlLocalName, xmlTokenAt, } from "./xml-token.js";
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
export function memberTypeFqn(member) {
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
export function navigationFqn(hit) {
    return hit.kind === "typeRef" ? hit.fqn : undefined;
}
export function resolveAuthoredTypeRef(raw, bindings, context) {
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
    }
    catch {
        return undefined;
    }
}
function implicitContextFor(token, enclosing) {
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
function parentLocal(token) {
    return token.ancestors.length >= 2 ? token.ancestors[token.ancestors.length - 2] : undefined;
}
function isDocumentRootElement(token) {
    return token.ancestors.length === 1 && isDocumentRootLocalName(token.elementLocalName);
}
function isNestedDefinitionWrapper(token) {
    const local = token.elementLocalName;
    if (!isDocumentRootLocalName(local)) {
        return false;
    }
    const idx = token.ancestors.lastIndexOf(local);
    const before = idx > 0 ? token.ancestors[idx - 1] : undefined;
    return before === "subBlocks" || before === "embeddedBlocks";
}
function isDefinitionParent(parent, token) {
    if (!parent) {
        return false;
    }
    if (parent === "block") {
        return true;
    }
    if (!isDocumentRootLocalName(parent)) {
        return false;
    }
    if (token.ancestors[0] === parent) {
        return true;
    }
    const idx = token.ancestors.lastIndexOf(parent);
    const before = idx > 0 ? token.ancestors[idx - 1] : undefined;
    return before === "subBlocks" || before === "embeddedBlocks";
}
function innermostBlock(block, text, position) {
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
function memberKindDefFqn(kind) {
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
function blockMetaFqn(block, token) {
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
function languageLocalName(token) {
    if (token.kind === "attributeName" || token.kind === "attributeValue") {
        return xmlLocalName(token.attributeName ?? token.text);
    }
    if (token.kind === "elementName") {
        return token.elementLocalName;
    }
    return token.elementLocalName;
}
function enclosingMember(token, block) {
    if (!block) {
        return undefined;
    }
    const sectionIdx = token.ancestors.findIndex((name) => MEMBER_SECTIONS.has(name));
    if (sectionIdx >= 0 && token.ancestors.length > sectionIdx + 1) {
        const memberName = token.ancestors[sectionIdx + 1];
        return block.members.find((member) => member.name === memberName);
    }
    const parent = parentLocal(token);
    if (isDefinitionParent(parent, token) && !LANGUAGE_ELEMENT_NAMES.has(token.elementLocalName)) {
        return block.members.find((member) => member.name === token.elementLocalName);
    }
    return undefined;
}
function isDomainMemberTag(token) {
    if (token.kind !== "elementName") {
        return false;
    }
    const parent = parentLocal(token);
    if (parent && MEMBER_SECTIONS.has(parent)) {
        return token.ancestors[token.ancestors.length - 1] === token.elementLocalName;
    }
    return isDefinitionParent(parent, token) && !LANGUAGE_ELEMENT_NAMES.has(token.elementLocalName);
}
function logicalMemberName(local) {
    if (local.startsWith("__")) {
        return local.slice(2);
    }
    if (local.startsWith("_")) {
        return local.slice(1);
    }
    return local;
}
function isReservedInstanceAttribute(name) {
    if (!name || isXmlnsAttribute(name)) {
        return true;
    }
    return name.startsWith("bml:") || name.startsWith("xsi:") || xmlLocalName(name) === "bml";
}
function localMemberNamed(block, name) {
    const unnamed = block.members.find((member) => member.name === name && !member.namespace);
    if (unnamed) {
        return unnamed;
    }
    return block.members.find((member) => member.name === name);
}
function contractMemberNamed(block, name, key, registry) {
    for (const ref of block.contracts ?? []) {
        const contract = registry.get(ref.value)?.block;
        if (!contract) {
            continue;
        }
        const found = key
            ? contract.members.find((member) => memberIdentityKey(member) === key)
            : localMemberNamed(contract, name);
        if (found) {
            return found;
        }
    }
    return undefined;
}
function findNearestInheritedMember(block, registry, name, identity) {
    const key = identity ? memberIdentityKey(identity) : undefined;
    const chain = collectBaseTypeChain(block, registry);
    for (let i = chain.length - 2; i >= 0; i--) {
        const layer = chain[i];
        const local = key
            ? layer.members.find((member) => memberIdentityKey(member) === key)
            : localMemberNamed(layer, name);
        if (local) {
            return local;
        }
        const fromContract = contractMemberNamed(layer, name, key, registry);
        if (fromContract) {
            return fromContract;
        }
    }
    return contractMemberNamed(block, name, key, registry);
}
function findNearestMemberOnType(typeFqn, name, registry) {
    const block = registry.get(typeFqn)?.block;
    if (!block) {
        return undefined;
    }
    return localMemberNamed(block, name) ?? findNearestInheritedMember(block, registry, name);
}
function enclosingInstanceTypeFqn(token, bindings, workspace) {
    const qnames = token.ancestorQNames;
    const start = token.kind === "attributeName" ? qnames.length - 1 : qnames.length - 2;
    for (let i = start; i >= 0; i--) {
        const raw = qnames[i];
        if (!raw) {
            continue;
        }
        const local = xmlLocalName(raw);
        const parent = i > 0 ? xmlLocalName(qnames[i - 1] ?? "") : undefined;
        if (!isDocumentRootLocalName(local) || local === "block") {
            continue;
        }
        if (parent === "subBlocks" || parent === "embeddedBlocks") {
            continue;
        }
        if (i === 0) {
            continue;
        }
        const fqn = resolveAuthoredTypeRef(raw, bindings, "type");
        if (fqn && workspace.registry.get(fqn)) {
            return fqn;
        }
    }
    return undefined;
}
function instanceMemberHit(token, bindings, workspace) {
    if (token.closing) {
        return null;
    }
    if (token.kind === "attributeName") {
        if (isReservedInstanceAttribute(token.text)) {
            return null;
        }
    }
    else if (token.kind === "elementName") {
        if (isDocumentRootLocalName(token.elementLocalName)) {
            return null;
        }
    }
    else {
        return null;
    }
    const typeFqn = enclosingInstanceTypeFqn(token, bindings, workspace);
    if (!typeFqn) {
        return null;
    }
    const authored = token.kind === "attributeName" ? xmlLocalName(token.text) : token.elementLocalName;
    const member = findNearestMemberOnType(typeFqn, logicalMemberName(authored), workspace.registry);
    if (!member?.source) {
        return null;
    }
    const hit = {
        kind: "member",
        member,
        range: token.range,
        definitionSource: member.source,
    };
    const memberType = memberTypeFqn(member);
    if (memberType) {
        hit.typeFqn = memberType;
    }
    return hit;
}
function lookupLanguageMember(workspace, metaFqn, localName) {
    const meta = workspace.registry.get(metaFqn)?.block;
    if (!meta) {
        return undefined;
    }
    const aliases = localName === "isnot" ? ["isNot", "isnot"] : [localName];
    const effective = resolveEffectiveMembers(meta, workspace.registry);
    return effective.find((member) => aliases.includes(member.name));
}
function languageHit(token, enclosing, workspace) {
    if (isXmlnsAttribute(token.attributeName ?? (token.kind === "attributeName" ? token.text : undefined))) {
        return null;
    }
    const current = token.elementLocalName;
    const parent = parentLocal(token);
    let metaFqn;
    if (current === "see" || parent === "see") {
        metaFqn = REFERENCE_DEFINITION;
    }
    else {
        const domain = enclosingMember(token, enclosing);
        if (domain && !isDomainMemberTag(token)) {
            metaFqn = memberKindDefFqn(domain.kind);
        }
        else if (enclosing) {
            metaFqn = blockMetaFqn(enclosing, token);
        }
        else {
            metaFqn = ROOT_BLOCK_DEFINITION;
        }
    }
    const localName = languageLocalName(token);
    const member = lookupLanguageMember(workspace, metaFqn, localName);
    if (member) {
        return { kind: "language", metaFqn, member, range: token.range };
    }
    if (token.kind === "elementName" &&
        (localName === "see" ||
            localName === "block" ||
            isDocumentRootElement(token) ||
            isNestedDefinitionWrapper(token))) {
        return { kind: "language", metaFqn, range: token.range };
    }
    return null;
}
export function hitAt(text, filePath, position, workspace) {
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
    if ((token.kind === "text" || token.kind === "attributeValue") &&
        !isXmlnsAttribute(token.attributeName)) {
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
        const isSugar = !!parent &&
            TYPE_REF_SUGAR_PARENTS.has(parent) &&
            !LANGUAGE_ELEMENT_NAMES.has(token.elementLocalName);
        if (token.text.includes(":") || isSugar) {
            const context = isSugar
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
    const instanceHit = instanceMemberHit(token, bindings, workspace);
    if (instanceHit) {
        return instanceHit;
    }
    if (isDomainMemberTag(token) && !token.closing) {
        const member = enclosingMember(token, enclosing);
        if (member) {
            const hit = { kind: "member", member, range: token.range };
            const typeFqn = memberTypeFqn(member);
            if (typeFqn) {
                hit.typeFqn = typeFqn;
            }
            if (member.override) {
                const inherited = findNearestInheritedMember(enclosing, workspace.registry, member.name, member);
                if (inherited?.source) {
                    hit.definitionSource = inherited.source;
                }
            }
            return hit;
        }
    }
    return languageHit(token, enclosing, workspace);
}
//# sourceMappingURL=hit-test.js.map