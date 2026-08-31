import { XMLSerializer } from "@xmldom/xmldom";
import { attributeValueLoc, elementSourceLoc } from "../util/qname.js";
import { elementLocalName, elementPrefix, isCData, isTextNode } from "../util/xml.js";
const MEMBER_SECTIONS = new Set([
    "properties",
    "aggregations",
    "associations",
    "capabilities",
]);
const METADATA_TAGS = new Set([
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
    "languages",
    "subTypes",
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
]);
const ROOT_EXTRA_TAGS = new Set(["block"]);
export const KNOWN_BML_ATTRIBUTE_LOCALS = new Set([
    "each",
    "if",
    "unless",
    "with",
    "id",
    "version",
    "bean",
    "scope",
    "xml",
]);
const BLOCK_ALLOWED_ATTR_LOCALS = new Set(["type"]);
const IDENTITY_ALLOWED_ATTRS = {
    name: new Set(["value"]),
    type: new Set(["value"]),
    baseType: new Set(["value"]),
    is: new Set(["value"]),
    isnot: new Set(["value"]),
    isNot: new Set(["value"]),
    version: new Set(["value"]),
    definition: new Set(["value"]),
    since: new Set(["value"]),
    status: new Set(["value"]),
    abstract: new Set(["value"]),
    final: new Set(["value"]),
    summary: new Set(["value", "language"]),
    documentation: new Set(["value", "language"]),
    language: new Set(["value"]),
};
const SECTION_ALLOWED_ATTRS = new Set();
const MEMBER_ALLOWED_ATTR_LOCALS = new Set([
    "type",
    "visibility",
    "readOnly",
    "abstract",
    "final",
    "override",
    "default",
    "value",
    "inputType",
    "outputType",
]);
export const isAllowedRootChild = (element) => {
    const local = elementLocalName(element);
    const prefix = elementPrefix(element);
    if (METADATA_TAGS.has(local) || MEMBER_SECTIONS.has(local) || ROOT_EXTRA_TAGS.has(local)) {
        return true;
    }
    if (prefix === "bml" && (local === "xml" || local === "container")) {
        return true;
    }
    return false;
};
export const isInfrastructureAttribute = (name) => {
    return name === "xmlns" || name.startsWith("xmlns:") || name.startsWith("xsi:");
};
export const bmlAttributeLocalName = (name) => {
    if (name.startsWith("bml:")) {
        return name.slice(4);
    }
    return undefined;
};
export const toUnknownXmlNode = (element, ctx) => {
    const localName = elementLocalName(element);
    const prefix = elementPrefix(element);
    const attributes = {};
    if (element.attributes) {
        for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes.item(i);
            attributes[attr.name] = attr.value;
        }
    }
    const innerXml = serializeInnerXml(element);
    const node = {
        localName,
        attributes,
        source: elementSourceLoc(ctx.filePath, ctx.source, element),
    };
    if (prefix) {
        node.prefix = prefix;
    }
    if (innerXml !== undefined) {
        node.innerXml = innerXml;
    }
    return node;
};
export const reportDiagnostic = (ctx, code, message, source) => {
    const diagnostic = {
        severity: "error",
        code,
        message,
        source,
    };
    ctx.diagnostics.push(diagnostic);
};
export const collectUnknownGrammarAttributes = (element, ctx, allowedLocals) => {
    if (!element.attributes) {
        return undefined;
    }
    const unknown = {};
    for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes.item(i);
        const name = attr.name;
        if (isInfrastructureAttribute(name)) {
            continue;
        }
        const bmlLocal = bmlAttributeLocalName(name);
        if (bmlLocal !== undefined) {
            if (KNOWN_BML_ATTRIBUTE_LOCALS.has(bmlLocal)) {
                continue;
            }
            const loc = attributeValueLoc(ctx.filePath, ctx.source, element, name, attr.value) ??
                elementSourceLoc(ctx.filePath, ctx.source, element);
            reportDiagnostic(ctx, "BML_UNKNOWN_DIRECTIVE", `Unknown bml:* attribute: ${name}`, loc);
            unknown[name] = attr.value;
            continue;
        }
        const local = name.includes(":") ? name.slice(name.indexOf(":") + 1) : name;
        if (allowedLocals.has(local) || allowedLocals.has(name)) {
            continue;
        }
        const loc = attributeValueLoc(ctx.filePath, ctx.source, element, name, attr.value) ??
            elementSourceLoc(ctx.filePath, ctx.source, element);
        reportDiagnostic(ctx, "BML_UNKNOWN_ATTRIBUTE", `Unknown attribute: ${name}`, loc);
        unknown[name] = attr.value;
    }
    return Object.keys(unknown).length > 0 ? unknown : undefined;
};
export const collectBlockGrammarAttributes = (element, ctx) => {
    return collectUnknownGrammarAttributes(element, ctx, BLOCK_ALLOWED_ATTR_LOCALS);
};
const CONTAINER_TAGS = new Set([
    ...MEMBER_SECTIONS,
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
    "subTypes",
    "languages",
]);
export const collectIdentityOrSectionAttributes = (element, ctx) => {
    const local = elementLocalName(element);
    if (CONTAINER_TAGS.has(local)) {
        return collectUnknownGrammarAttributes(element, ctx, SECTION_ALLOWED_ATTRS);
    }
    const allowed = IDENTITY_ALLOWED_ATTRS[local];
    if (!allowed) {
        return undefined;
    }
    return collectUnknownGrammarAttributes(element, ctx, allowed);
};
export const collectMemberGrammarAttributes = (element, ctx) => {
    return collectUnknownGrammarAttributes(element, ctx, MEMBER_ALLOWED_ATTR_LOCALS);
};
export const reportUnknownElement = (element, ctx) => {
    const qname = element.nodeName;
    reportDiagnostic(ctx, "BML_UNKNOWN_ELEMENT", `Unknown element: ${qname}`, elementSourceLoc(ctx.filePath, ctx.source, element));
};
export const reportStandaloneComposition = (element, ctx) => {
    reportDiagnostic(ctx, "BML_STANDALONE_COMPOSITION", "composition must be a direct child of an aggregation member", elementSourceLoc(ctx.filePath, ctx.source, element));
};
export const reportDuplicateComposition = (element, ctx) => {
    reportDiagnostic(ctx, "BML_DUPLICATE_COMPOSITION", "aggregation members may have at most one composition", elementSourceLoc(ctx.filePath, ctx.source, element));
};
export const reportNestedComposition = (element, ctx) => {
    reportDiagnostic(ctx, "BML_NESTED_COMPOSITION", "composition must not appear inside an aggregation that is already nested in a composition", elementSourceLoc(ctx.filePath, ctx.source, element));
};
export const reportDuplicatePropertyValue = (element, ctx, source) => {
    reportDiagnostic(ctx, "BML_DUPLICATE_PROPERTY_VALUE", "property members may have at most one value per namespace", source ?? elementSourceLoc(ctx.filePath, ctx.source, element));
};
const CHARACTER_DATA_HOSTS = new Set([
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
    "value",
    "xml",
    "keywords",
    "aliases",
]);
export const isCharacterDataHost = (element) => {
    return CHARACTER_DATA_HOSTS.has(elementLocalName(element));
};
function advanceOverText(data, from, to, line, column) {
    let i = from;
    while (i < to) {
        const ch = data[i];
        if (ch === "\r") {
            line++;
            column = 1;
            i += data[i + 1] === "\n" ? 2 : 1;
            continue;
        }
        if (ch === "\n") {
            line++;
            column = 1;
            i++;
            continue;
        }
        column++;
        i++;
    }
    return { line, column };
}
function textNodeSourceLoc(ctx, node) {
    const line = node.lineNumber !== undefined && node.lineNumber >= 1 ? node.lineNumber : 1;
    const column = node.columnNumber !== undefined && node.columnNumber >= 1 ? node.columnNumber : 1;
    const data = node.data;
    const trimmed = data.trim();
    const leading = data.length - data.trimStart().length;
    const start = advanceOverText(data, 0, leading, line, column);
    const end = advanceOverText(data, leading, leading + trimmed.length, start.line, start.column);
    return {
        file: ctx.filePath,
        line: start.line,
        column: start.column,
        endLine: end.line,
        endColumn: end.column,
    };
}
export const reportUnexpectedTextChildren = (element, ctx) => {
    for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes.item(i);
        if (!child) {
            continue;
        }
        if (!isTextNode(child) && !isCData(child)) {
            continue;
        }
        const data = child.data ?? "";
        if (data.trim() === "") {
            continue;
        }
        reportDiagnostic(ctx, "BML_UNEXPECTED_TEXT", `Unexpected text: ${data.trim().slice(0, 40)}`, textNodeSourceLoc(ctx, child));
    }
};
export const listUnknownBmlAttributes = (element) => {
    if (!element.attributes) {
        return undefined;
    }
    const unknown = {};
    for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes.item(i);
        const bmlLocal = bmlAttributeLocalName(attr.name);
        if (bmlLocal === undefined) {
            continue;
        }
        if (KNOWN_BML_ATTRIBUTE_LOCALS.has(bmlLocal)) {
            continue;
        }
        unknown[attr.name] = attr.value;
    }
    return Object.keys(unknown).length > 0 ? unknown : undefined;
};
export const collectUnknownBmlAttributes = (element, ctx) => {
    const unknown = listUnknownBmlAttributes(element);
    if (!unknown) {
        return undefined;
    }
    for (const [name, value] of Object.entries(unknown)) {
        const loc = attributeValueLoc(ctx.filePath, ctx.source, element, name, value) ??
            elementSourceLoc(ctx.filePath, ctx.source, element);
        reportDiagnostic(ctx, "BML_UNKNOWN_DIRECTIVE", `Unknown bml:* attribute: ${name}`, loc);
    }
    return unknown;
};
function serializeInnerXml(element) {
    if (!element.childNodes.length) {
        return undefined;
    }
    const serializer = new XMLSerializer();
    let out = "";
    for (let i = 0; i < element.childNodes.length; i++) {
        const child = element.childNodes.item(i);
        if (child) {
            out += serializer.serializeToString(child);
        }
    }
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
//# sourceMappingURL=structural.js.map