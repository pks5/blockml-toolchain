import { containsUnescapedInterpolation, expressionFromRaw, unescapeInterpolationDelimiters, } from "./member-value.js";
import { elementChildren, elementLocalName, elementPrefix, getAttribute, getCharacterData, } from "../util/xml.js";
import { collectUnknownBmlAttributes, reportDiagnostic } from "./structural.js";
import { parseGenericArgumentList, } from "./type-expression.js";
import { attributeValueLoc, elementSourceLoc } from "../util/qname.js";
const BML_NS = "http://blockml.org/bml";
function bmlAttr(element, local) {
    return (getAttribute(element, `bml:${local}`) ??
        getAttribute(element, `${BML_NS}:${local}`));
}
export const isGenericsDirectiveElement = (element) => {
    const local = elementLocalName(element);
    const prefix = elementPrefix(element);
    return (prefix === "bml" && local === "generics") || local === "bml:generics";
};
export function parseGenericsBinding(element, ctx, options) {
    const loc = elementSourceLoc(ctx.filePath, ctx.source, element);
    const attr = bmlAttr(element, "generics");
    const child = elementChildren(element).find(isGenericsDirectiveElement);
    let raw;
    let authoredPlacement;
    let source = loc;
    if (attr !== undefined) {
        raw = attr;
        authoredPlacement = "attribute";
        source =
            attributeValueLoc(ctx.filePath, ctx.source, element, "bml:generics", attr) ?? loc;
    }
    else if (child) {
        raw = getCharacterData(child).text;
        authoredPlacement = "element";
        source = elementSourceLoc(ctx.filePath, ctx.source, child);
    }
    else {
        return undefined;
    }
    const binding = {
        raw,
        authoredPlacement,
        source,
    };
    const parsed = parseGenericArgumentList(raw, ctx.bindings, "type", options);
    if (parsed.ok) {
        binding.arguments = parsed.arguments;
    }
    else if (parsed.code === "BML_INVALID_TYPE_REFERENCE") {
        reportDiagnostic(ctx, parsed.code, parsed.message, source);
    }
    return binding;
}
export function parseDirectives(element, loc, ctx) {
    const directives = [];
    if (ctx) {
        collectUnknownBmlAttributes(element, ctx);
    }
    const each = bmlAttr(element, "each");
    if (each !== undefined) {
        const colon = each.indexOf(":");
        let variables = [];
        let collectionRaw = each;
        if (colon !== -1) {
            variables = each
                .slice(0, colon)
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean);
            collectionRaw = each.slice(colon + 1).trim();
        }
        let collection;
        if (collectionRaw.startsWith("${")) {
            collection = expressionFromRaw(collectionRaw, loc);
        }
        else {
            collection = expressionFromRaw(`\${ ${collectionRaw} }`, loc);
        }
        directives.push({
            type: "each",
            variables,
            collection,
        });
    }
    const ifAttr = bmlAttr(element, "if");
    if (ifAttr !== undefined) {
        directives.push({
            type: "if",
            condition: expressionFromRaw(ifAttr, loc),
        });
    }
    const unless = bmlAttr(element, "unless");
    if (unless !== undefined) {
        directives.push({
            type: "unless",
            condition: expressionFromRaw(unless, loc),
        });
    }
    const withAttr = bmlAttr(element, "with");
    if (withAttr !== undefined) {
        const bindings = withAttr.split(",").map((part) => {
            const eq = part.indexOf("=");
            const name = (eq === -1 ? part : part.slice(0, eq)).trim();
            const valueRaw = eq === -1 ? "" : part.slice(eq + 1).trim();
            return {
                name,
                value: expressionFromRaw(valueRaw, loc),
            };
        });
        directives.push({ type: "with", bindings });
    }
    return directives;
}
export function parseBmlMeta(element, typeFqn, file, loc) {
    const id = bmlAttr(element, "id");
    const version = bmlAttr(element, "version");
    const bean = bmlAttr(element, "bean");
    const scope = bmlAttr(element, "scope");
    return {
        id: id !== undefined ? parseMetaValue(id, typeFqn, file, loc) : undefined,
        version: version !== undefined
            ? parseMetaValue(version, typeFqn, file, loc)
            : undefined,
        bean: bean !== undefined ? parseMetaValue(bean, typeFqn, file, loc) : undefined,
        scope,
    };
}
function parseMetaValue(raw, typeFqn, file, loc) {
    if (raw.startsWith("${") && raw.endsWith("}")) {
        return expressionFromRaw(raw, loc);
    }
    const trimmed = raw.trim();
    const looksLikeJson = trimmed.startsWith("[") || trimmed.startsWith("{");
    if (!looksLikeJson && containsUnescapedInterpolation(raw)) {
        return {
            kind: "interpolated",
            raw,
            source: loc,
        };
    }
    return {
        kind: "literal",
        value: unescapeInterpolationDelimiters(raw),
        typeFqn,
    };
}
//# sourceMappingURL=directives.js.map