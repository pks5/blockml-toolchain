import { createMapContext } from "./context.js";
import { mapBlockInstanceNode, mapCompositionTemplate, mapTypeReferenceEntityInstance, isTypeReferenceEntitySugar, buildSubBlockIndex, } from "./map-composition.js";
import { parseTypeExpression, inferCardinality, } from "./type-expression.js";
import { parseMemberValue } from "./member-value.js";
import { parseGenericsBinding, isGenericsDirectiveElement } from "./directives.js";
import { elementChildren, elementLocalName, elementPrefix, getAttribute, getCharacterData, xmlTriviaFromElement, } from "../util/xml.js";
import { parseVisibilityFromName } from "../util/visibility.js";
import { parseBooleanAttribute, isBooleanLiteral } from "../util/boolean.js";
import { resolveBlockReference, resolvePrefix, resolveTypeName, elementSourceLoc, elementStartTagIsSelfClosing, attributeValueLoc, TYPE_REFERENCE_ENTITY, } from "../util/qname.js";
import { withElementLocation } from "../util/mapping-error.js";
import { collectBlockGrammarAttributes, collectIdentityOrSectionAttributes, collectMemberGrammarAttributes, isAllowedRootChild, isCharacterDataHost, reportDiagnostic, reportDuplicateComposition, reportDuplicatePropertyValue, reportStandaloneComposition, reportUnexpectedTextChildren, reportUnknownElement, toUnknownXmlNode, } from "./structural.js";
import { isDocumentRootLocalName, V1_ROOT_ELEMENT } from "../pipeline/root-type.js";
const MEMBER_SECTIONS = new Set([
    "properties",
    "aggregations",
    "associations",
    "capabilities",
]);
function lastTypeSegment(type) {
    return type.split(".").pop() ?? type;
}
function rootTypesAgree(tagType, childType) {
    if (tagType === childType) {
        return true;
    }
    if (tagType.includes(".") && childType.includes(".")) {
        return false;
    }
    return lastTypeSegment(tagType) === lastTypeSegment(childType);
}
function preferResolvedType(tagType, childType) {
    if (childType.includes(".") && !tagType.includes(".")) {
        return childType;
    }
    return tagType.includes(".") ? tagType : childType;
}
function typeFromRootTag(element, ctx) {
    const local = elementLocalName(element);
    if (local === V1_ROOT_ELEMENT) {
        return undefined;
    }
    const prefix = elementPrefix(element);
    if (!prefix) {
        return local;
    }
    return withElementLocation(ctx.filePath, ctx.source, element, () => resolveBlockReference(`${prefix}:${local}`, ctx.bindings, ctx.subBlockIndex, ctx.parentBlockType));
}
function applyRootTypeIdentity(element, block, ctx, tagType, missingCode) {
    if (tagType) {
        if (block.type && !rootTypesAgree(tagType, block.type)) {
            reportDiagnostic(ctx, "BML_MAP_ERROR", `BML_MAP_ERROR: tag type ${tagType} disagrees with <type> ${block.type}`, elementSourceLoc(ctx.filePath, ctx.source, element));
            block.type = tagType;
            block.typeSource = elementSourceLoc(ctx.filePath, ctx.source, element);
        }
        else if (block.type) {
            block.type = preferResolvedType(tagType, block.type);
        }
        else {
            block.type = tagType;
            block.typeSource = elementSourceLoc(ctx.filePath, ctx.source, element);
        }
        ctx.parentBlockType = block.type;
        return;
    }
    if (!block.type) {
        const site = missingCode === "BML_MISSING_EMBEDDED_BLOCK_TYPE" ? "embed tag" : "root tag";
        reportDiagnostic(ctx, missingCode, `${missingCode}: neither ${site} nor <type> supplies a type`, elementSourceLoc(ctx.filePath, ctx.source, element));
    }
}
function applySubBlockIdentity(element, block, ctx, parentType) {
    const local = elementLocalName(element);
    const tagName = local === V1_ROOT_ELEMENT ? undefined : local;
    if (tagName) {
        if (block.name && block.name !== tagName) {
            reportDiagnostic(ctx, "BML_MAP_ERROR", `BML_MAP_ERROR: Sub-Block tag ${tagName} disagrees with <name> ${block.name}`, elementSourceLoc(ctx.filePath, ctx.source, element));
        }
        block.name = tagName;
    }
    if (!block.name) {
        reportDiagnostic(ctx, "BML_MISSING_SUBBLOCK_NAME", "BML_MISSING_SUBBLOCK_NAME: neither element tag nor <name> supplies the local name", elementSourceLoc(ctx.filePath, ctx.source, element));
    }
    if (!block.type && parentType && block.name) {
        block.type = `${parentType}.${block.name}`;
    }
}
function isDefinitionWrapper(element) {
    return isDocumentRootLocalName(elementLocalName(element));
}
function mapBlockDefinition(element, ctx, parentType) {
    const block = {
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
    const blockGenerics = parseGenericsBinding(element, ctx, typeResolveOptions(ctx));
    if (blockGenerics) {
        block.generics = blockGenerics;
    }
    const local = elementLocalName(element);
    block.wrapperForm = local === V1_ROOT_ELEMENT ? "block" : "type";
    const tagType = ctx.isRoot || ctx.isEmbedded ? typeFromRootTag(element, ctx) : undefined;
    if (tagType) {
        block.type = tagType;
        block.typeSource = elementSourceLoc(ctx.filePath, ctx.source, element);
        ctx.parentBlockType = tagType;
    }
    const childElements = elementChildren(element);
    const subBlocksRaw = [];
    const embeddedRaw = [];
    const memberSections = {
        properties: [],
        aggregations: [],
        associations: [],
        capabilities: [],
    };
    const unknownElements = [];
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
            subBlocksRaw.push(...elementChildren(child).filter(isDefinitionWrapper));
            continue;
        }
        if (local === "embeddedBlocks") {
            embeddedRaw.push(...elementChildren(child).filter(isDefinitionWrapper));
            continue;
        }
        if (MEMBER_SECTIONS.has(local)) {
            for (const memberEl of elementChildren(child)) {
                if (local === "aggregations" && elementLocalName(memberEl) === "composition") {
                    reportStandaloneComposition(memberEl, ctx);
                    unknownElements.push(toUnknownXmlNode(memberEl, ctx));
                    continue;
                }
                memberSections[local].push(memberEl);
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
    if (ctx.isRoot) {
        applyRootTypeIdentity(element, block, ctx, tagType, "BML_MISSING_BLOCK_TYPE");
    }
    else if (ctx.isEmbedded) {
        applyRootTypeIdentity(element, block, ctx, tagType, "BML_MISSING_EMBEDDED_BLOCK_TYPE");
    }
    else if (parentType !== undefined) {
        applySubBlockIdentity(element, block, ctx, parentType);
    }
    if (!block.name && (ctx.isRoot || ctx.isEmbedded)) {
        block.name = block.type.split(".").pop() ?? "Block";
    }
    if (ctx.isEmbedded && getAttribute(element, "type")) {
        const typeText = getTextOrAttr(element, "type");
        if (typeText) {
            block.type = withElementLocation(ctx.filePath, ctx.source, element, () => resolveBlockReference(typeText, ctx.bindings, ctx.subBlockIndex, parentType), { name: "type", value: typeText });
        }
    }
    else if (!block.type && parentType && block.name) {
        block.type = `${parentType}.${block.name}`;
    }
    const subBlockElements = [...subBlocksRaw];
    for (const child of childElements) {
        if (elementLocalName(child) === V1_ROOT_ELEMENT) {
            subBlockElements.push(child);
        }
    }
    for (const sbEl of subBlockElements) {
        const sbCtx = createMapContext(ctx.filePath, ctx.source, ctx.bindings, {
            parentBlockType: block.type,
            isRoot: false,
            isEmbedded: false,
            diagnostics: ctx.diagnostics,
            ...(ctx.parseValue ? { parseValue: ctx.parseValue } : {}),
        });
        const sb = mapBlockDefinition(sbEl, sbCtx, block.type);
        if (!sb.type) {
            sb.type = `${block.type}.${sb.name}`;
        }
        block.subBlocks.push(sb);
    }
    const subIndex = buildSubBlockIndex(block.subBlocks.map((s) => ({ name: s.name, type: s.type })), block.type);
    ctx.subBlockIndex = subIndex;
    ctx.parentBlockType = block.type;
    for (const ebEl of embeddedRaw) {
        const ebCtx = createMapContext(ctx.filePath, ctx.source, ctx.bindings, {
            isRoot: false,
            isEmbedded: true,
            diagnostics: ctx.diagnostics,
            ...(ctx.parseValue ? { parseValue: ctx.parseValue } : {}),
        });
        block.embeddedBlocks.push(mapBlockDefinition(ebEl, ebCtx));
    }
    appendMembers(memberSections.properties ?? [], "property", block, ctx);
    appendMembers(memberSections.aggregations ?? [], "aggregation", block, ctx, true);
    appendMembers(memberSections.associations ?? [], "association", block, ctx);
    appendMembers(memberSections.capabilities ?? [], "capability", block, ctx);
    return block;
}
function appendMembers(elements, kind, block, ctx, inAggregationsSection = false) {
    for (const el of elements) {
        const typeAttr = getAttribute(el, "type");
        const member = withElementLocation(ctx.filePath, ctx.source, el, () => mapMemberElement(el, kind, ctx, inAggregationsSection), typeAttr !== undefined ? { name: "type", value: typeAttr } : undefined);
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
    "generics",
    "bml:generics",
    "abstract",
    "final",
    "language",
    "status",
]);
function isMemberMetadataChild(element) {
    const local = elementLocalName(element);
    const prefix = elementPrefix(element);
    if (MEMBER_CHILD_METADATA.has(local)) {
        return true;
    }
    if (prefix === "bml" && (local === "xml" || local === "container" || local === "generics")) {
        return true;
    }
    return false;
}
function aggregationHasCompositionContent(element) {
    const compEl = elementChildren(element).find((c) => elementLocalName(c) === "composition");
    if (compEl) {
        return true;
    }
    return elementChildren(element).some((c) => !isMemberMetadataChild(c));
}
function mapMemberElement(element, kind, ctx, inAggregationsSection = false) {
    const rawLocal = elementLocalName(element);
    const { name, visibility } = parseVisibilityFromName(rawLocal);
    const prefix = elementPrefix(element);
    const ns = prefix ? resolvePrefix(prefix, ctx.bindings) : "";
    const base = mapMemberBase(element, name, visibility, ns ?? "", ctx);
    const typeAttrForSpan = getAttribute(element, "type");
    if (typeAttrForSpan !== undefined) {
        const typeSource = attributeValueLoc(ctx.filePath, ctx.source, element, "type", typeAttrForSpan);
        if (typeSource) {
            base.typeSource = typeSource;
        }
    }
    if (kind === "property") {
        const typeAttr = getAttribute(element, "type");
        let typeFqn = "";
        let typeExpr;
        if (typeAttr !== undefined) {
            typeExpr = parseTypeExpression(typeAttr, ctx.bindings, "type", typeResolveOptions(ctx));
            typeFqn = typeExpr.kind === "named" ? typeExpr.fqn : "";
        }
        const prop = {
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
        const agg = {
            ...base,
            kind: "aggregation",
            authoredInAggregationsSection: inAggregationsSection,
        };
        if (typeAttr) {
            agg.type = parseTypeExpression(typeAttr, ctx.bindings, "type", typeResolveOptions(ctx));
            agg.cardinality = inferCardinality(agg.type) ?? "0..n";
        }
        const def = getAttribute(element, "default");
        if (def !== undefined) {
            agg.default = parseBooleanAttribute(def);
        }
        if (aggregationHasCompositionContent(element)) {
            agg.composition = mapCompositionTemplate(element, name, ctx);
        }
        const compositionEls = elementChildren(element).filter((c) => elementLocalName(c) === "composition");
        if (compositionEls.length > 1) {
            const extras = [];
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
            type: parseTypeExpression(typeAttr, ctx.bindings, "block", typeResolveOptions(ctx)),
            cardinality: "0..n",
        }, ctx);
    }
    const capTypeAttr = getAttribute(element, "type") ?? "";
    const cap = {
        ...base,
        kind: "capability",
        typeFqn: resolveTypeName(capTypeAttr, ctx.bindings, "capability"),
    };
    const inputType = getAttribute(element, "inputType");
    const outputType = getAttribute(element, "outputType");
    if (inputType) {
        cap.inputType = parseTypeExpression(inputType, ctx.bindings, "type", typeResolveOptions(ctx));
        const inputTypeSource = attributeValueLoc(ctx.filePath, ctx.source, element, "inputType", inputType);
        if (inputTypeSource) {
            cap.inputTypeSource = inputTypeSource;
        }
    }
    if (outputType) {
        cap.outputType = parseTypeExpression(outputType, ctx.bindings, "type", typeResolveOptions(ctx));
        const outputTypeSource = attributeValueLoc(ctx.filePath, ctx.source, element, "outputType", outputType);
        if (outputTypeSource) {
            cap.outputTypeSource = outputTypeSource;
        }
    }
    const implEl = elementChildren(element).find((c) => elementLocalName(c) === "implementation");
    if (implEl) {
        cap.implementation = mapImplementation(implEl, ctx);
    }
    mapCapabilityThrows(element, cap, ctx);
    return finishMember(element, cap, ctx);
}
function finishMember(element, member, ctx) {
    if (member.kind !== "property") {
        reportUnexpectedTextChildren(element, ctx);
    }
    if (member.kind !== "aggregation") {
        const unknown = [];
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
function parseMemberXmlRendering(raw, placement) {
    const kinds = raw
        .split("|")
        .map((part) => part.trim())
        .filter((part) => part === "element" || part === "attribute");
    return {
        raw,
        kinds: kinds.length > 0 ? kinds : [placement],
        authoredPlacement: placement,
    };
}
function mapMemberBase(element, name, visibility, namespace, ctx) {
    const base = {
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
        base.visibility = visAttr;
    }
    for (const flag of ["readOnly", "abstract", "final", "override"]) {
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
    }
    else if (xmlEl) {
        const { text } = getCharacterData(xmlEl);
        base.xmlRendering = parseMemberXmlRendering(text, "element");
    }
    const memberGenerics = parseGenericsBinding(element, ctx, typeResolveOptions(ctx));
    if (memberGenerics) {
        base.generics = memberGenerics;
    }
    mapMemberDocumentation(element, base, ctx);
    mapMemberConstraints(element, base, ctx);
    return base;
}
function mapMemberDocumentation(element, target, ctx) {
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
                if (v !== undefined)
                    target.since = v;
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
function mapMetadataFields(element, block, ctx) {
    for (const child of elementChildren(element)) {
        const extraAttrs = collectIdentityOrSectionAttributes(child, ctx);
        if (extraAttrs) {
            block.unknownAttributes = { ...block.unknownAttributes, ...extraAttrs };
        }
        if (MEMBER_SECTIONS.has(elementLocalName(child)) && !block.generics) {
            const sectionGenerics = parseGenericsBinding(child, ctx, typeResolveOptions(ctx));
            if (sectionGenerics) {
                block.generics = sectionGenerics;
            }
        }
        const local = elementLocalName(child);
        switch (local) {
            case "name":
                block.name = getTextOrAttr(child) ?? block.name;
                block.authoredNameChild = true;
                break;
            case "type":
                block.type = withElementLocation(ctx.filePath, ctx.source, child, () => resolveBlockReference(getTextOrAttr(child) ?? "", ctx.bindings, ctx.subBlockIndex, ctx.parentBlockType));
                block.typeSource = elementSourceLoc(ctx.filePath, ctx.source, child);
                block.authoredTypeChild = true;
                ctx.parentBlockType = block.type;
                break;
            case "baseType": {
                const bt = getTextOrAttr(child);
                if (bt) {
                    const parsed = withElementLocation(ctx.filePath, ctx.source, child, () => parseBaseType(bt, ctx, block.type));
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
                if (v !== undefined)
                    block.is = v;
                break;
            }
            case "isnot":
            case "isNot": {
                const v = getTextOrAttr(child);
                if (v !== undefined)
                    block.isNot = v;
                break;
            }
            case "version": {
                const v = getTextOrAttr(child);
                if (v !== undefined)
                    block.version = v;
                break;
            }
            case "definition":
                block.definitionFqn = withElementLocation(ctx.filePath, ctx.source, child, () => resolveBlockReference(getTextOrAttr(child) ?? "", ctx.bindings, ctx.subBlockIndex, block.type));
                break;
            case "since": {
                const v = getTextOrAttr(child);
                if (v !== undefined)
                    block.since = v;
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
                block.xmlRendering = { raw: text };
                break;
            }
            case "bml:generics":
            case "generics":
                if (isGenericsDirectiveElement(child) && !block.generics) {
                    const fromChild = parseGenericsBinding(element, ctx, typeResolveOptions(ctx));
                    if (fromChild) {
                        block.generics = fromChild;
                    }
                }
                break;
            default:
                break;
        }
    }
    const xmlAttr = getAttribute(element, "bml:xml");
    if (xmlAttr !== undefined && !block.xmlRendering) {
        block.xmlRendering = { raw: xmlAttr };
    }
}
function seedSubBlockIndex(element, block, ctx, parentType, subBlocksRaw) {
    if (subBlocksRaw.length === 0) {
        return;
    }
    let peekedName = block.name;
    let peekedType = block.type;
    for (const child of elementChildren(element)) {
        const local = elementLocalName(child);
        if (local === "name") {
            peekedName = getTextOrAttr(child) ?? peekedName;
        }
        else if (local === "type") {
            const typeText = getTextOrAttr(child);
            if (typeText) {
                peekedType = resolveBlockReference(typeText, ctx.bindings, ctx.subBlockIndex, parentType);
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
        .filter((entry) => entry !== undefined);
    if (peeked.length === 0) {
        return;
    }
    ctx.subBlockIndex = buildSubBlockIndex(peeked, peekedType);
    ctx.parentBlockType = peekedType;
}
function peekSubBlock(element, parentType, ctx, enclosingParent) {
    let name = getAttribute(element, "name");
    let typeText;
    for (const child of elementChildren(element)) {
        const local = elementLocalName(child);
        if (local === "name" && !name) {
            name = getTextOrAttr(child);
        }
        else if (local === "type") {
            typeText = getTextOrAttr(child);
        }
    }
    if (!name) {
        const local = elementLocalName(element);
        if (local !== V1_ROOT_ELEMENT && isDocumentRootLocalName(local)) {
            name = local;
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
function getTextOrAttr(element, tag) {
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
function mapLanguage(element, block, ctx) {
    for (const child of elementChildren(element)) {
        if (isTypeReferenceEntitySugar(child, ctx)) {
            const { inst } = mapTypeReferenceEntityInstance(child, ctx, undefined, "language");
            block.language = inst;
            block.languageFqn = inst.value;
        }
        else if (elementLocalName(child) === "TypeReferenceEntity") {
            const value = getAttribute(child, "value") ?? getTextOrAttr(child);
            if (value) {
                block.language = {
                    typeFqn: TYPE_REFERENCE_ENTITY,
                    value: resolveTypeName(value, ctx.bindings, "language"),
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
function mapProseEntry(element, ctx) {
    const prefix = elementPrefix(element);
    const { text, form } = getCharacterData(element);
    const langAttr = getAttribute(element, "language");
    return {
        namespace: prefix ? (resolvePrefix(prefix, ctx.bindings) ?? "") : "",
        text,
        languageFqn: langAttr
            ? resolveTypeName(langAttr, ctx.bindings, "language")
            : blockEffectiveLanguage(ctx),
        ...(form === "cdata" ? { authoredCharacterDataForm: "cdata" } : {}),
        source: elementSourceLoc(ctx.filePath, ctx.source, element),
    };
}
function blockEffectiveLanguage(_ctx) {
    return "org.blockml.bml.language.English";
}
const FREE_TEXT_KEYWORD = "org.blockml.bml.meta.FreeTextKeyword";
const FREE_TEXT_ALIAS = "org.blockml.bml.meta.FreeTextAlias";
function commaSeparatedTokens(text) {
    return text
        .split(",")
        .map((token) => token.trim())
        .filter((token) => token.length > 0);
}
function mapKeywords(element, ctx) {
    const entries = [];
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
function mapAliases(element, ctx) {
    const entries = [];
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
function mapChangelog(element, ctx) {
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
function mapExamples(element, ctx) {
    const examples = [];
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
            ...(form === "cdata" ? { authoredCharacterDataForm: "cdata" } : {}),
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
function mapReferences(element, ctx) {
    return elementChildren(element)
        .filter((c) => elementLocalName(c) === "see")
        .map((c) => {
        const langAttr = getAttribute(c, "language");
        const { text } = getCharacterData(c);
        const empty = elementChildren(c).length === 0 && text.length === 0;
        const ref = {
            context: text,
            ...(langAttr !== undefined
                ? { languageFqn: resolveTypeName(langAttr, ctx.bindings, "language") }
                : {}),
            source: elementSourceLoc(ctx.filePath, ctx.source, c),
            ...(empty
                ? {
                    authoredEmptyElementForm: elementStartTagIsSelfClosing(ctx.source, c)
                        ? "selfClosing"
                        : "paired",
                }
                : {}),
        };
        for (const attr of ["type", "instance", "file", "url", "property", "aggregation", "association", "capability"]) {
            const v = getAttribute(c, attr);
            if (v !== undefined) {
                if (attr === "type") {
                    ref.type = resolveBlockReference(v, ctx.bindings, ctx.subBlockIndex, ctx.parentBlockType);
                }
                else {
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
function mapConstraintInstances(element, ctx) {
    return elementChildren(element)
        .filter((c) => elementLocalName(c) !== "composition")
        .map((c) => mapBlockInstanceNode(c, ctx).instance);
}
function mapMemberConstraints(element, target, ctx) {
    const cEl = elementChildren(element).find((c) => elementLocalName(c) === "constraints");
    if (cEl) {
        target.constraints = mapConstraintInstances(cEl, ctx);
    }
}
function mapContracts(element, ctx) {
    const contracts = [];
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
function typeResolveOptions(ctx) {
    const options = {
        subBlockIndex: ctx.subBlockIndex,
    };
    if (ctx.parentBlockType) {
        options.currentTypeFqn = ctx.parentBlockType;
    }
    return options;
}
function isRichNamedType(expr) {
    return (expr.kind === "named" &&
        ((expr.typeArguments?.length ?? 0) > 0 ||
            expr.instanceConfiguration !== undefined ||
            expr.multiplicity !== undefined));
}
function parseBaseType(raw, ctx, fallbackParent) {
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
function namedTypeFqn(raw, ctx, fallbackParent) {
    return parseBaseType(raw, ctx, fallbackParent).fqn;
}
function resolveGenericDefaultType(raw, ctx) {
    const expr = parseTypeExpression(raw, ctx.bindings, "type", typeResolveOptions(ctx));
    if (expr.kind === "genericParam") {
        return expr.name;
    }
    return namedTypeFqn(raw, ctx, ctx.parentBlockType);
}
function mapGenericTypes(element, ctx) {
    return elementChildren(element).map((c) => {
        const defaultType = getAttribute(c, "defaultType");
        const raw = getAttribute(c, "baseType") ?? getTextOrAttr(c) ?? "org.blockml.bml.core.Block";
        const documentations = [];
        for (const child of elementChildren(c)) {
            if (elementLocalName(child) === "documentation") {
                documentations.push(mapProseEntry(child, ctx));
            }
        }
        return {
            name: elementLocalName(c),
            baseType: withElementLocation(ctx.filePath, ctx.source, c, () => namedTypeFqn(raw, ctx, ctx.parentBlockType)),
            ...(defaultType !== undefined
                ? { defaultType: resolveGenericDefaultType(defaultType, ctx) }
                : {}),
            ...(documentations.length > 0 ? { documentations } : {}),
        };
    });
}
function mapPropertyValues(element, prop, typeFqn, ctx) {
    const entries = [];
    const seenNamespaces = new Set();
    const extras = [];
    const addEntry = (ns, val, child, source) => {
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
        const val = parseMemberValue(raw, typeFqn, ctx.filePath, 1, 1, "element", ctx);
        if (val) {
            addEntry(ns, val, child);
        }
    }
    const attrVal = getAttribute(element, "value");
    if (attrVal !== undefined) {
        const val = parseMemberValue(attrVal, typeFqn, ctx.filePath, 1, 1, "attribute", ctx);
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
function mapMemberGroups(element, target, ctx) {
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
function mapSuggestions(element, prop, ctx) {
    const sugEl = elementChildren(element).find((c) => elementLocalName(c) === "suggestions");
    if (!sugEl) {
        return;
    }
    prop.suggestions = elementChildren(sugEl).map((c) => {
        const local = elementLocalName(c);
        const loc = elementSourceLoc(ctx.filePath, ctx.source, c);
        const memberValues = {};
        if (c.attributes) {
            for (let i = 0; i < c.attributes.length; i++) {
                const attr = c.attributes.item(i);
                if (attr.name.startsWith("xmlns") || attr.name.startsWith("xsi:")) {
                    continue;
                }
                const val = parseMemberValue(attr.value, local, ctx.filePath, loc.line, loc.column, "attribute", ctx);
                if (val !== undefined) {
                    memberValues[attr.name] = val;
                }
            }
        }
        return {
            typeFqn: local,
            memberValues,
            source: loc,
        };
    });
}
function mapImplementation(element, ctx) {
    const langRaw = getAttribute(element, "language") ?? "";
    const { text, form } = getCharacterData(element);
    const embeddedExpressions = [];
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
        ...(form === "cdata" ? { authoredCharacterDataForm: "cdata" } : {}),
        embeddedExpressions,
    };
}
const CORE_EXCEPTION = "org.blockml.bml.core.Exception";
function mapThrowsReference(child, ctx) {
    if (isTypeReferenceEntitySugar(child, ctx)) {
        const { inst } = mapTypeReferenceEntityInstance(child, ctx, CORE_EXCEPTION);
        return inst;
    }
    if (elementLocalName(child) === "TypeReferenceEntity") {
        const valueRaw = getAttribute(child, "value") ?? getTextOrAttr(child);
        if (!valueRaw) {
            return undefined;
        }
        let value;
        try {
            value = resolveBlockReference(valueRaw, ctx.bindings, ctx.subBlockIndex, ctx.parentBlockType);
        }
        catch {
            try {
                value = resolveTypeName(valueRaw, ctx.bindings, "type");
            }
            catch {
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
function mapCapabilityThrows(element, cap, ctx) {
    const throwsEl = elementChildren(element).find((c) => elementLocalName(c) === "throws");
    if (!throwsEl) {
        return;
    }
    cap.throws = [];
    const mapChild = (child) => {
        const inst = mapThrowsReference(child, ctx);
        if (inst) {
            cap.throws.push(inst);
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
export function mapBlock(element, ctx) {
    return mapBlockDefinition(element, ctx);
}
export function mapDocumentBlock(element, filePath, source, bindings, diagnostics = [], parseValue) {
    const ctx = createMapContext(filePath, source, bindings, {
        isRoot: true,
        diagnostics,
        ...(parseValue ? { parseValue } : {}),
    });
    return withElementLocation(filePath, source, element, () => mapBlockDefinition(element, ctx));
}
//# sourceMappingURL=map-block.js.map