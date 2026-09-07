import { elementLocalName, elementPrefix } from "../util/xml.js";
/** Legacy document root. Type identity comes from child `<type>`. */
export const V1_ROOT_ELEMENT = "block";
/** Block name local part — PascalCase, optional visibility underscores. */
const TYPE_AS_ROOT_LOCAL = /^(?:_+)?[A-Z][a-zA-Z0-9]*$/;
function authoredRootTag(element) {
    const local = elementLocalName(element);
    const prefix = elementPrefix(element);
    return prefix ? `${prefix}:${local}` : local;
}
export function isDocumentRootLocalName(local) {
    return local === V1_ROOT_ELEMENT || TYPE_AS_ROOT_LOCAL.test(local);
}
export function assertBlockRoot(element) {
    const local = elementLocalName(element);
    if (isDocumentRootLocalName(local)) {
        return;
    }
    throw new Error(`BML_INVALID_ROOT: expected <block> or a type tag, got <${authoredRootTag(element)}>`);
}
//# sourceMappingURL=root-type.js.map