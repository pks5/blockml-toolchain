import { elementLocalName } from "../util/xml.js";
export function assertBlockRoot(element) {
    const local = elementLocalName(element);
    if (local !== "block") {
        throw new Error(`BML_INVALID_ROOT: expected <block>, got <${local}>`);
    }
}
//# sourceMappingURL=root-type.js.map