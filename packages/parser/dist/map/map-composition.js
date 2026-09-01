import { parseDirectives, parseBmlMeta, parseGenericsBinding, isGenericsDirectiveElement, } from "./directives.js";
import { parseMemberValue } from "./member-value.js";
import { elementChildren, elementLocalName, elementPrefix, getAttribute, getCharacterData, isElement, xmlTriviaFromElement, } from "../util/xml.js";
import { resolveBlockReference, resolvePrefix, resolveTypeName, TYPE_REFERENCE_ENTITY, elementSourceLoc, } from "../util/qname.js";
import { parseVisibilityFromName } from "../util/visibility.js";
import { withElementLocation } from "../util/mapping-error.js";
import { listUnknownBmlAttributes, reportNestedComposition, reportStandaloneComposition, reportUnexpectedTextChildren, } from "./structural.js";
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
const RESERVED = new Set([...MEMBER_SECTIONS, ...METADATA_ELEMENTS, "composition", "implementation", "throws", "value", "groups", "suggestions"]);
export function mapCompositionTemplate(element, aggregationName, ctx) {
    const loc = elementSourceLoc(ctx.filePath, ctx.source, element);
    const compositionEls = elementChildren(element).filter((c) => elementLocalName(c) === "composition");
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
    return {
        aggregationName,
        ...(directives.length > 0 ? { directives } : {}),
        ...(generics ? { generics } : {}),
        children,
        source: loc,
    };
}
function mapCompositionChildren(compositionEl, ctx) {
    const nodes = [];
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
            const vnode = {
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
export function mapBlockInstanceNode(element, ctx) {
    const local = elementLocalName(element);
    const prefix = elementPrefix(element);
    const loc = elementSourceLoc(ctx.filePath, ctx.source, element);
    const qname = prefix ? `${prefix}:${local}` : local;
    const typeFqn = withElementLocation(ctx.filePath, ctx.source, element, () => resolveBlockReference(qname, ctx.bindings, ctx.subBlockIndex, ctx.parentBlockType));
    const meta = parseBmlMeta(element, typeFqn, ctx.filePath, loc);
    const memberValues = {};
    if (element.attributes) {
        for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes.item(i);
            const attrName = attr.name;
            const attrLocal = attrName.includes(":")
                ? attrName.split(":").pop()
                : attrName;
            if (attrName.startsWith("xmlns") ||
                attrName.startsWith("xsi:") ||
                attrName.startsWith("bml:") ||
                attrLocal === "bml") {
                continue;
            }
            if (["id", "version", "bean", "scope"].includes(attrLocal) && attrName.startsWith("bml:")) {
                continue;
            }
            const val = parseMemberValue(attr.value, typeFqn, ctx.filePath, loc.line, loc.column, "attribute");
            if (val) {
                memberValues[attrLocal] = val;
            }
        }
    }
    const aggregationCompositions = [];
    for (const child of elementChildren(element)) {
        const childLocal = elementLocalName(child);
        if (childLocal === "composition" || RESERVED.has(childLocal)) {
            continue;
        }
        if (isGenericsDirectiveElement(child)) {
            continue;
        }
        if (!instanceMemberIsAggregationFill(child)) {
            continue;
        }
        for (const compositionEl of elementChildren(child).filter((c) => elementLocalName(c) === "composition")) {
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
        if (RESERVED.has(childLocal)) {
            continue;
        }
        if (isGenericsDirectiveElement(child)) {
            continue;
        }
        if (instanceMemberIsAggregationFill(child)) {
            continue;
        }
        const { text } = getCharacterData(child);
        const val = parseMemberValue(text || getAttribute(child, "value"), typeFqn, ctx.filePath, loc.line, loc.column, "element");
        if (val) {
            memberValues[childLocal] = val;
        }
    }
    const directives = parseDirectives(element, loc, ctx);
    const generics = parseGenericsBinding(element, ctx);
    const instance = {
        typeFqn,
        memberValues: Object.fromEntries(Object.entries(memberValues).filter(([, v]) => v !== undefined)),
        source: loc,
    };
    const unknownBml = listUnknownBmlAttributes(element);
    if (unknownBml) {
        instance.unknownAttributes = unknownBml;
    }
    if (meta.id)
        instance.id = meta.id;
    if (meta.version)
        instance.version = meta.version;
    if (meta.bean)
        instance.bean = meta.bean;
    if (meta.scope)
        instance.scope = meta.scope;
    if (generics)
        instance.generics = generics;
    const trivia = xmlTriviaFromElement(element);
    if (trivia)
        instance.xmlTrivia = trivia;
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
function instanceMemberIsAggregationFill(element) {
    return elementChildren(element).some((c) => {
        const local = elementLocalName(c);
        return local === "composition" || local === "container" || !RESERVED.has(local);
    });
}
export function isTypeReferenceEntitySugar(element, ctx) {
    if (element.childNodes.length > 0) {
        for (let i = 0; i < element.childNodes.length; i++) {
            const child = element.childNodes.item(i);
            if (isElement(child)) {
                return false;
            }
        }
    }
    const local = elementLocalName(element);
    return local !== "TypeReferenceEntity" && local !== "composition";
}
export function mapTypeReferenceEntityInstance(element, ctx, boundB) {
    const prefix = elementPrefix(element);
    const local = elementLocalName(element);
    const qname = prefix ? `${prefix}:${local}` : local;
    const valueAttr = getAttribute(element, "value");
    let value;
    try {
        value =
            valueAttr ??
                resolveBlockReference(prefix ? `${prefix}:${local}` : local, ctx.bindings, ctx.subBlockIndex, ctx.parentBlockType);
    }
    catch {
        value =
            valueAttr ??
                resolveTypeName(local, ctx.bindings, "language");
    }
    const meta = parseBmlMeta(element, TYPE_REFERENCE_ENTITY, ctx.filePath, elementSourceLoc(ctx.filePath, ctx.source, element));
    const inst = {
        typeFqn: TYPE_REFERENCE_ENTITY,
        value,
        ...(boundB ? { boundB } : {}),
    };
    return { inst, version: meta.version };
}
export function buildSubBlockIndex(subBlocks, parentType) {
    const index = new Map();
    for (const sb of subBlocks) {
        index.set(sb.name, sb.type);
        const qualified = `${parentType.split(".").pop()}.${sb.name}`;
        index.set(qualified, sb.type);
    }
    return index;
}
//# sourceMappingURL=map-composition.js.map