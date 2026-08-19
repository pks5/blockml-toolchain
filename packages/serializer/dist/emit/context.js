import { hasBmlSemanticQNameBindings } from "./qname.js";
export function createEmitContext(bindings, indent) {
    return {
        bindings,
        useQName: hasBmlSemanticQNameBindings(bindings),
        indent,
    };
}
//# sourceMappingURL=context.js.map