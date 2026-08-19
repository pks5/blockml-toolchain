import { XSI_NS, BML_XMLNS } from "./constants.js";
export { XSI_NS, BML_XMLNS };
export function hasBmlSemanticQNameBindings(bindings) {
    for (const [prefix, uri] of Object.entries(bindings)) {
        if (prefix === "" || uri === XSI_NS || uri === BML_XMLNS) {
            continue;
        }
        return true;
    }
    return false;
}
export function fqnToQName(fqn, bindings) {
    const entries = Object.entries(bindings).filter(([prefix, uri]) => prefix !== "" && uri !== XSI_NS && uri !== BML_XMLNS);
    for (const [prefix, uri] of entries) {
        const dotPrefix = `${uri}.`;
        if (fqn.startsWith(dotPrefix)) {
            return `${prefix}:${fqn.slice(dotPrefix.length)}`;
        }
    }
    return fqn;
}
export function qnameToParts(qname) {
    const idx = qname.indexOf(":");
    if (idx === -1) {
        return { prefix: "", local: qname };
    }
    return { prefix: qname.slice(0, idx), local: qname.slice(idx + 1) };
}
export function visibilityPrefix(visibility) {
    switch (visibility) {
        case "private":
            return "__";
        case "protected":
            return "_";
        default:
            return "";
    }
}
//# sourceMappingURL=qname.js.map