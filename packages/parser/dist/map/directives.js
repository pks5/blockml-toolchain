import { expressionFromRaw } from "./member-value.js";
import { getAttribute } from "../util/xml.js";
const BML_NS = "http://blockml.org/bml";
function bmlAttr(element, local) {
    return (getAttribute(element, `bml:${local}`) ??
        getAttribute(element, `${BML_NS}:${local}`));
}
export function parseDirectives(element, loc) {
    const directives = [];
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
    return {
        kind: "literal",
        value: raw,
        typeFqn,
    };
}
//# sourceMappingURL=directives.js.map